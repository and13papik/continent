
import { AppState, AccountingPeriod, Admin, CloudSnapshot, PaidStatus } from './types';

const STORAGE_KEY = 'continental_dashboard_v3';
const EMERGENCY_KEY = 'continental_emergency_backup';

const defaultOperators = ['Op1', 'Op2', 'Op3', 'Op4', 'Op5', 'Op6', 'Op7', 'Op8', 'Op9', 'Op10'];
const defaultModels = ['Succuba', 'Mermaid', 'Mommy', 'Fitness Stacy', 'Nola Lust', 'Caitlyn', 'Anastasiia Heat', 'Sophia Reilly'];
const defaultAdmins: Admin[] = [
  { id: '1', name: 'Админ 1', rate: 8 },
  { id: '2', name: 'Админ 2', rate: 8 }
];

export function createInitialState(): AppState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        lastUpdated: parsed.lastUpdated || Date.now(),
        version: parsed.version || 1,
        operators: parsed.operators || defaultOperators,
        models: parsed.models || defaultModels,
        admins: parsed.admins || defaultAdmins,
        incomeData: parsed.incomeData || [],
        operationsData: parsed.operationsData || [],
        accountingPeriods: parsed.accountingPeriods || [],
        ownerExpenses: parsed.ownerExpenses || [],
        ownerManualIncomes: parsed.ownerManualIncomes || [],
        ownerAdvances: parsed.ownerAdvances || [],
        modelBonuses: parsed.modelBonuses || [],
        paidStatuses: parsed.paidStatuses || [],
        deletedIds: parsed.deletedIds || [],
        modelRates: parsed.modelRates || { of: 25, pp: 17, cr: 25 }
      };
    } catch (e) {
      console.error("Failed to parse storage", e);
    }
  }

  const now = new Date();
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const firstPeriod: AccountingPeriod = {
    id: String(Date.now()),
    label: `${months[now.getMonth()]} ${now.getFullYear()}`,
    startAt: now.toISOString(),
    endAt: null,
    status: 'open'
  };

  return {
    lastUpdated: Date.now(),
    version: 1,
    operators: defaultOperators,
    models: defaultModels,
    admins: defaultAdmins,
    incomeData: [],
    operationsData: [],
    accountingPeriods: [firstPeriod],
    selectedPeriodId: firstPeriod.id,
    modelRates: { of: 25, pp: 17, cr: 25 },
    ownerExpenses: [],
    ownerManualIncomes: [],
    ownerAdvances: [],
    modelBonuses: [],
    paidStatuses: [],
    deletedIds: []
  };
}

export function saveLocal(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createEmergencyBackup(state: AppState) {
  localStorage.setItem(EMERGENCY_KEY, JSON.stringify(state));
}

export function restoreEmergencyBackup(): AppState | null {
  const data = localStorage.getItem(EMERGENCY_KEY);
  return data ? JSON.parse(data) : null;
}

/**
 * SMART MERGE LOGIC v3
 * Теперь учитывает список удаленных ID (deletedIds).
 */
function mergeArraysById<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  local: T[], 
  remote: T[], 
  deletedIds: string[]
): T[] {
  const map = new Map<string, T>();
  
  // 1. Сначала обрабатываем удаленные данные (если ID в списке удаленных - игнорируем)
  remote.forEach(item => {
    if (!deletedIds.includes(item.id)) {
      map.set(item.id, item);
    }
  });
  
  // 2. Накладываем локальные данные (если ID в списке удаленных - игнорируем)
  local.forEach(item => {
    if (deletedIds.includes(item.id)) return;

    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      
      if (itemTime >= existingTime) {
        map.set(item.id, item);
      }
    }
  });
  
  return Array.from(map.values());
}

export async function syncToCloud(state: AppState): Promise<{ success: boolean; newState?: AppState }> {
  if (!state.syncUrl || !state.syncKey) return { success: false };
  
  const baseUrl = state.syncUrl.trim().replace(/\/$/, "");
  const url = `${baseUrl}/rest/v1/app_storage`;
  const headers = { 
    'apikey': state.syncKey.trim(), 
    'Authorization': `Bearer ${state.syncKey.trim()}`,
    'Content-Type': 'application/json'
  };

  try {
    const checkResponse = await fetch(`${url}?id=eq.main&select=state`, { headers });
    let finalState = { ...state };

    if (checkResponse.ok) {
      const cloudData = await checkResponse.json();
      if (cloudData.length > 0) {
        const remote: AppState = cloudData[0].state;
        
        // Сливаем списки удаленных ID (объединение уникальных)
        const combinedDeletedIds = Array.from(new Set([...state.deletedIds, ...(remote.deletedIds || [])]));
        finalState.deletedIds = combinedDeletedIds;

        // Сливаем данные с учетом Tombstones
        finalState.incomeData = mergeArraysById(state.incomeData, remote.incomeData, combinedDeletedIds);
        finalState.operationsData = mergeArraysById(state.operationsData, remote.operationsData, combinedDeletedIds);
        finalState.ownerExpenses = mergeArraysById(state.ownerExpenses, remote.ownerExpenses, combinedDeletedIds);
        finalState.ownerAdvances = mergeArraysById(state.ownerAdvances, remote.ownerAdvances, combinedDeletedIds);
        finalState.ownerManualIncomes = mergeArraysById(state.ownerManualIncomes || [], remote.ownerManualIncomes || [], combinedDeletedIds);
        finalState.modelBonuses = mergeArraysById(state.modelBonuses || [], remote.modelBonuses || [], combinedDeletedIds);
        finalState.paidStatuses = mergeArraysById(state.paidStatuses, remote.paidStatuses, combinedDeletedIds);
        
        finalState.version = Math.max(state.version, remote.version) + 1;
        finalState.lastUpdated = Date.now();
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ 
        id: 'main',
        state: { ...finalState, lastSyncedAt: new Date().toISOString() }, 
        updated_at: new Date().toISOString() 
      })
    });

    return { success: response.ok, newState: finalState };
  } catch (e) {
    console.error("Cloud Sync Error:", e);
    return { success: false };
  }
}

export async function fetchFromCloud(url: string, key?: string): Promise<AppState | null> {
  if (!url || !key) return null;
  const baseUrl = url.trim().replace(/\/$/, "");
  const fetchUrl = `${baseUrl}/rest/v1/app_storage?id=eq.main&select=state`;

  try {
    const response = await fetch(fetchUrl, {
      headers: { 'apikey': key.trim(), 'Authorization': `Bearer ${key.trim()}` }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return (data.length > 0) ? data[0].state : null;
  } catch (e) {
    return null;
  }
}

export async function listCloudSnapshots(url: string, key?: string): Promise<CloudSnapshot[]> {
  if (!url || !key) return [];
  const baseUrl = url.trim().replace(/\/$/, "");
  const fetchUrl = `${baseUrl}/rest/v1/app_storage?select=id,state,updated_at&order=updated_at.desc&limit=20`;
  try {
    const response = await fetch(fetchUrl, {
      headers: { 'apikey': key.trim(), 'Authorization': `Bearer ${key.trim()}` }
    });
    return response.ok ? await response.json() : [];
  } catch (e) {
    return [];
  }
}

export async function testDatabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  if (!url || !key) return { success: false, message: "URL или Ключ не введены" };
  const baseUrl = url.trim().replace(/\/$/, "");
  try {
    const checkTable = await fetch(`${baseUrl}/rest/v1/app_storage?select=id&limit=1`, {
      headers: { 'apikey': key.trim(), 'Authorization': `Bearer ${key.trim()}` }
    });
    if (!checkTable.ok) return { success: false, message: "Ошибка подключения" };
    return { success: true, message: "Соединение установлено!" };
  } catch (e) {
    return { success: false, message: "Сервер недоступен" };
  }
}
