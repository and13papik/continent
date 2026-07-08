
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
        ownerNotes: parsed.ownerNotes || [],
        ownerDocument: parsed.ownerDocument || '',
        completedDocument: parsed.completedDocument || '',
        advanceRequests: parsed.advanceRequests || [],
        operatorWallets: parsed.operatorWallets || [],
        totalTableEntries: parsed.totalTableEntries || [],
        rosterData: parsed.rosterData || [],
        priorityModels: parsed.priorityModels || [],
        inactiveModels: parsed.inactiveModels || [],
        modelDefaultGoals: parsed.modelDefaultGoals || {},
        modelMonthlyPlans: parsed.modelMonthlyPlans || {},
        operatorAssessments: parsed.operatorAssessments || [],
        modelGroups: parsed.modelGroups || []
      };
    } catch (e) {
      console.error("Failed to parse storage", e);
    }
  }

  const now = new Date();
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  
  // Создаем дату начала месяца в UTC, чтобы избежать проблем с часовыми поясами
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  
  const firstPeriod: AccountingPeriod = {
    id: String(Date.now()),
    label: `${months[now.getMonth()]} ${now.getFullYear()}`,
    startAt: startOfMonth.toISOString(),
    endAt: null,
    status: 'open',
    operators: defaultOperators,
    models: defaultModels,
    modelRates: { of: 25, pp: 17, cr: 25 },
    modelDefaultGoals: {},
    admins: defaultAdmins,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    operatorAssessments: [],
    modelRates: { of: 25, pp: 17, cr: 25 },
    ownerExpenses: [],
    ownerManualIncomes: [],
    ownerAdvances: [],
    modelBonuses: [],
    paidStatuses: [],
    ownerTasks: [],
    ownerNotes: [],
    ownerDocument: '',
    completedDocument: '',
    advanceRequests: [],
    operatorWallets: [],
    totalTableEntries: [],
    rosterData: [],
    priorityModels: [],
    inactiveModels: [],
    modelGroups: [],
    modelDefaultGoals: {},
    modelMonthlyPlans: {},
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
  
  const getTime = (item: T) => {
    if (!item) return 0;
    const d = new Date(item.updatedAt || item.createdAt || 0);
    const t = d.getTime();
    return isNaN(t) ? 0 : t;
  };

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
      const itemTime = getTime(item);
      const existingTime = getTime(existing);
      
      if (itemTime >= existingTime) {
        map.set(itemId, item);
      }
    }
  });
  
  return Array.from(map.values());
}

export function mergeStates(local: AppState, remote: AppState): AppState {
  const combinedDeletedIds = Array.from(new Set([
    ...(local.deletedIds || []).map(id => String(id)), 
    ...(remote.deletedIds || []).map(id => String(id))
  ]));
  
  const finalState = { ...local };
  finalState.deletedIds = combinedDeletedIds;

  finalState.accountingPeriods = mergeArraysById(local.accountingPeriods || [], remote.accountingPeriods || [], combinedDeletedIds);
  finalState.incomeData = mergeArraysById(local.incomeData || [], remote.incomeData || [], combinedDeletedIds);
  finalState.operationsData = mergeArraysById(local.operationsData || [], remote.operationsData || [], combinedDeletedIds);
  finalState.ownerExpenses = mergeArraysById(local.ownerExpenses || [], remote.ownerExpenses || [], combinedDeletedIds);
  finalState.ownerAdvances = mergeArraysById(local.ownerAdvances || [], remote.ownerAdvances || [], combinedDeletedIds);
  finalState.ownerManualIncomes = mergeArraysById(local.ownerManualIncomes || [], remote.ownerManualIncomes || [], combinedDeletedIds);
  finalState.modelBonuses = mergeArraysById(local.modelBonuses || [], remote.modelBonuses || [], combinedDeletedIds);
  finalState.paidStatuses = mergeArraysById(local.paidStatuses || [], remote.paidStatuses || [], combinedDeletedIds);
  finalState.ownerTasks = mergeArraysById(local.ownerTasks || [], remote.ownerTasks || [], combinedDeletedIds);
  finalState.ownerNotes = mergeArraysById(local.ownerNotes || [], remote.ownerNotes || [], combinedDeletedIds);
  
  const isLocalNewer = local.lastUpdated > (remote.lastUpdated || 0);
  
  finalState.ownerDocument = isLocalNewer ? (local.ownerDocument || '') : (remote.ownerDocument || '');
  finalState.completedDocument = isLocalNewer ? (local.completedDocument || '') : (remote.completedDocument || '');
  
  finalState.advanceRequests = mergeArraysById(local.advanceRequests || [], remote.advanceRequests || [], combinedDeletedIds);
  finalState.operatorWallets = mergeArraysById(local.operatorWallets || [], remote.operatorWallets || [], combinedDeletedIds);
  finalState.rosterData = mergeArraysById(local.rosterData || [], remote.rosterData || [], combinedDeletedIds);
  finalState.operatorAssessments = mergeArraysById(local.operatorAssessments || [], remote.operatorAssessments || [], combinedDeletedIds);
  
  finalState.priorityModels = isLocalNewer ? (local.priorityModels || []) : (remote.priorityModels || []);
  finalState.inactiveModels = isLocalNewer ? (local.inactiveModels || []) : (remote.inactiveModels || []);
  finalState.modelGroups = mergeArraysById(local.modelGroups || [], remote.modelGroups || [], combinedDeletedIds);
  
  finalState.modelDefaultGoals = isLocalNewer
    ? { ...(remote.modelDefaultGoals || {}), ...(local.modelDefaultGoals || {}) }
    : { ...(local.modelDefaultGoals || {}), ...(remote.modelDefaultGoals || {}) };

  finalState.modelMonthlyPlans = isLocalNewer
    ? { ...(remote.modelMonthlyPlans || {}), ...(local.modelMonthlyPlans || {}) }
    : { ...(local.modelMonthlyPlans || {}), ...(remote.modelMonthlyPlans || {}) };

  // Global settings merging
  finalState.operators = isLocalNewer ? (local.operators || []) : (remote.operators || []);
  finalState.models = isLocalNewer ? (local.models || []) : (remote.models || []);
  finalState.admins = mergeArraysById(local.admins || [], remote.admins || [], combinedDeletedIds);
  finalState.modelRates = isLocalNewer ? (local.modelRates || remote.modelRates) : (remote.modelRates || local.modelRates);
  finalState.tgChatId = isLocalNewer ? (local.tgChatId || remote.tgChatId) : (remote.tgChatId || local.tgChatId);
  finalState.dbUrl = isLocalNewer ? (local.dbUrl || remote.dbUrl) : (remote.dbUrl || local.dbUrl);

  const localTg = local.telegramState || {};
  const remoteTg = remote.telegramState || {};
  finalState.telegramState = {
    lastRosterNotifyDate: isLocalNewer 
      ? (localTg.lastRosterNotifyDate || remoteTg.lastRosterNotifyDate) 
      : (remoteTg.lastRosterNotifyDate || localTg.lastRosterNotifyDate),
    approvals: {
      ...(remoteTg.approvals || {}),
      ...(localTg.approvals || {})
    }
  };

  finalState.notifiedInterns = Array.from(new Set([
    ...(local.notifiedInterns || []),
    ...(remote.notifiedInterns || [])
  ]));

  if (local.totalTableEntries || remote.totalTableEntries) {
      finalState.totalTableEntries = mergeArraysById(
        local.totalTableEntries || [], 
        remote.totalTableEntries || [], 
        combinedDeletedIds
      );
  }

  // Version merging
  finalState.version = Math.max(local.version, remote.version);
  if (local.version > remote.version) {
     finalState.version = local.version + 1;
  } else if (remote.version > local.version) {
     finalState.version = remote.version + 1;
  } 

  finalState.lastUpdated = Date.now();
  
  return finalState;
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
        finalState = mergeStates(state, remote);
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

export function parseYearMonth(dateStr: string): { year: number, month: number } | null {
  if (!dateStr) return null;
  let year: number, month: number;

  // Пытаемся разобрать дату в форматах ГГГГ-ММ-ДД или ДД.ММ.ГГГГ
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      // ГГГГ-ММ-ДД
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
    } else {
      // ДД-ММ-ГГГГ
      year = parseInt(parts[2], 10);
      month = parseInt(parts[1], 10) - 1;
    }
  } else if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    // Предполагаем ДД.ММ.ГГГГ
    if (parts[2] && parts[2].length === 4) {
      year = parseInt(parts[2], 10);
      month = parseInt(parts[1], 10) - 1;
    } else {
      // ГГГГ.ММ.ДД
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
    }
  } else {
    // Резервный вариант через объект Date
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    
    if (!dateStr.includes('T')) {
       year = d.getFullYear();
       month = d.getMonth();
    } else {
       year = d.getUTCFullYear();
       month = d.getUTCMonth();
    }
  }
  
  if (isNaN(year) || isNaN(month)) return null;
  return { year, month };
}

export function findPeriodIdByDate(dateStr: string, periods: AccountingPeriod[]): string | null {
  const parsed = parseYearMonth(dateStr);
  if (!parsed) return null;
  
  const { year, month } = parsed;

  // Ищем период, который соответствует этому году и месяцу
  const match = periods.find(p => {
    const pDate = new Date(p.startAt);
    // p.startAt всегда ISO UTC
    return pDate.getUTCFullYear() === year && pDate.getUTCMonth() === month;
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
    rosterData: (state.rosterData || []).map(fix),
    ownerTasks: (state.ownerTasks || []).map(fix),
    ownerNotes: (state.ownerNotes || []).map(fix),
    advanceRequests: (state.advanceRequests || []).map(fix),
    lastUpdated: Date.now(),
    version: (state.version || 0) + 1
  };
}
