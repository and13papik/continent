
import { AppState, AccountingPeriod, Admin, CloudSnapshot, DailyTotalEntry } from './types';

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
        deletedIds: parsed.deletedIds || [],
        incomeData: parsed.incomeData || [],
        operationsData: parsed.operationsData || [],
        ownerExpenses: parsed.ownerExpenses || [],
        ownerManualIncomes: parsed.ownerManualIncomes || [],
        ownerAdvances: parsed.ownerAdvances || [],
        modelBonuses: parsed.modelBonuses || [],
        paidStatuses: parsed.paidStatuses || [],
        ownerTasks: parsed.ownerTasks || [],
        totalTableEntries: parsed.totalTableEntries || [],
        modelDefaultGoals: parsed.modelDefaultGoals || {}
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
    status: 'open',
    operators: defaultOperators,
    models: defaultModels,
    modelRates: { of: 25, pp: 17, cr: 25 },
    modelDefaultGoals: {},
    admins: defaultAdmins
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
    ownerTasks: [],
    totalTableEntries: [],
    modelDefaultGoals: {},
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

function mergeArraysById<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  local: T[], 
  remote: T[], 
  deletedIds: string[]
): T[] {
  const map = new Map<string, T>();
  const deletedSet = new Set(deletedIds.map(id => String(id)));
  
  remote.forEach(item => {
    const itemId = String(item.id);
    if (!deletedSet.has(itemId)) {
      map.set(itemId, item);
    }
  });
  
  local.forEach(item => {
    const itemId = String(item.id);
    if (deletedSet.has(itemId)) return;

    const existing = map.get(itemId);
    if (!existing) {
      map.set(itemId, item);
    } else {
      const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      
      if (itemTime >= existingTime) {
        map.set(itemId, item);
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
        
        const combinedDeletedIds = Array.from(new Set([
          ...(state.deletedIds || []).map(id => String(id)), 
          ...(remote.deletedIds || []).map(id => String(id))
        ]));
        
        finalState.deletedIds = combinedDeletedIds;

        finalState.incomeData = mergeArraysById(state.incomeData, remote.incomeData, combinedDeletedIds);
        finalState.operationsData = mergeArraysById(state.operationsData, remote.operationsData, combinedDeletedIds);
        finalState.ownerExpenses = mergeArraysById(state.ownerExpenses, remote.ownerExpenses, combinedDeletedIds);
        finalState.ownerAdvances = mergeArraysById(state.ownerAdvances, remote.ownerAdvances, combinedDeletedIds);
        finalState.ownerManualIncomes = mergeArraysById(state.ownerManualIncomes || [], remote.ownerManualIncomes || [], combinedDeletedIds);
        finalState.modelBonuses = mergeArraysById(state.modelBonuses || [], remote.modelBonuses || [], combinedDeletedIds);
        finalState.paidStatuses = mergeArraysById(state.paidStatuses, remote.paidStatuses, combinedDeletedIds);
        finalState.ownerTasks = mergeArraysById(state.ownerTasks || [], remote.ownerTasks || [], combinedDeletedIds);
        finalState.modelDefaultGoals = { ...(remote.modelDefaultGoals || {}), ...(state.modelDefaultGoals || {}) };
        
        if (state.totalTableEntries || remote.totalTableEntries) {
            finalState.totalTableEntries = mergeArraysById(
              state.totalTableEntries || [], 
              remote.totalTableEntries || [], 
              combinedDeletedIds
            );
        }

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

export async function forcePushToCloud(state: AppState): Promise<boolean> {
  if (!state.syncUrl || !state.syncKey) return false;
  
  const baseUrl = state.syncUrl.trim().replace(/\/$/, "");
  const url = `${baseUrl}/rest/v1/app_storage`;
  const headers = { 
    'apikey': state.syncKey.trim(), 
    'Authorization': `Bearer ${state.syncKey.trim()}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ 
        id: 'main',
        state: { ...state, lastSyncedAt: new Date().toISOString() }, 
        updated_at: new Date().toISOString() 
      })
    });
    return response.ok;
  } catch (e) {
    console.error("Force Push Error:", e);
    return false;
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

export function findPeriodIdByDate(dateStr: string, periods: AccountingPeriod[]): string | null {
  if (!dateStr || !periods.length) return null;
  const date = new Date(dateStr);
  const month = date.getMonth();
  const year = date.getFullYear();
  
  const match = periods.find(p => {
    const pDate = new Date(p.startAt);
    return pDate.getMonth() === month && pDate.getFullYear() === year;
  });
  
  return match ? match.id : null;
}

export function reindexAllDataByDate(state: AppState): AppState {
  const periods = state.accountingPeriods;
  
  const fix = (item: any) => {
    const dateToUse = item.date || item.createdAt;
    if (!dateToUse) return item;
    const newId = findPeriodIdByDate(dateToUse, periods);
    return newId ? { ...item, periodId: newId } : item;
  };

  return {
    ...state,
    incomeData: state.incomeData.map(fix),
    operationsData: state.operationsData.map(fix),
    ownerExpenses: (state.ownerExpenses || []).map(fix),
    ownerManualIncomes: (state.ownerManualIncomes || []).map(fix),
    ownerAdvances: (state.ownerAdvances || []).map(fix),
    modelBonuses: (state.modelBonuses || []).map(fix),
    totalTableEntries: (state.totalTableEntries || []).map(fix),
    ownerTasks: (state.ownerTasks || []).map(fix),
    lastUpdated: Date.now(),
    version: (state.version || 0) + 1
  };
}
