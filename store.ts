
import { AppState, AccountingPeriod, Admin, CloudSnapshot } from './types';

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
        modelRates: parsed.modelRates || { of: 25, pp: 17, cr: 25 } // Обновлено до 17
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
    modelRates: { of: 25, pp: 17, cr: 25 }, // Обновлено до 17
    ownerExpenses: [],
    ownerManualIncomes: [],
    ownerAdvances: [],
    modelBonuses: [],
    paidStatuses: []
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

export async function syncToCloud(state: AppState): Promise<{ success: boolean; conflict?: boolean }> {
  if (!state.syncUrl || !state.syncKey) return { success: false };
  
  const baseUrl = state.syncUrl.trim().replace(/\/$/, "");
  const url = `${baseUrl}/rest/v1/app_storage`;

  try {
    const checkResponse = await fetch(`${url}?id=eq.main&select=state`, {
      headers: { 'apikey': state.syncKey.trim(), 'Authorization': `Bearer ${state.syncKey.trim()}` }
    });
    
    if (checkResponse.ok) {
      const remoteData = await checkResponse.json();
      if (remoteData.length > 0) {
        const remoteState = remoteData[0].state as AppState;
        if ((remoteState.version > state.version) || (remoteState.lastUpdated > state.lastUpdated + 10000)) {
          return { success: false, conflict: true };
        }
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': state.syncKey.trim(),
        'Authorization': `Bearer ${state.syncKey.trim()}`,
        'Prefer': 'resolution=merge-duplicates' 
      },
      body: JSON.stringify({ 
        id: 'main',
        state: { ...state, lastSyncedAt: new Date().toISOString() }, 
        updated_at: new Date().toISOString() 
      })
    });

    const snapshotId = `snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': state.syncKey.trim(),
        'Authorization': `Bearer ${state.syncKey.trim()}`
      },
      body: JSON.stringify({ 
        id: snapshotId,
        state: state, 
        updated_at: new Date().toISOString() 
      })
    });

    return { success: response.ok };
  } catch (e) {
    console.error("Cloud Sync Error:", e);
    return { success: false };
  }
}

export async function listCloudSnapshots(url: string, key: string): Promise<CloudSnapshot[]> {
  const baseUrl = url.trim().replace(/\/$/, "");
  const fetchUrl = `${baseUrl}/rest/v1/app_storage?id=like.snapshot_*&select=id,state,updated_at&order=updated_at.desc&limit=20`;
  try {
    const response = await fetch(fetchUrl, {
      headers: { 'apikey': key.trim(), 'Authorization': `Bearer ${key.trim()}` }
    });
    return response.ok ? await response.json() : [];
  } catch (e) {
    return [];
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
