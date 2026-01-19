
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

/**
 * SMART MERGE LOGIC
 * Сравнивает два массива объектов по ID и возвращает объединенный массив уникальных элементов.
 */
function mergeArraysById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  // Сначала берем удаленные данные (они приоритетнее для "чужих" записей)
  remote.forEach(item => map.set(item.id, item));
  // Затем накладываем локальные (они обновят то, что мы редактировали сами)
  local.forEach(item => map.set(item.id, item));
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
    // 1. ПОЛУЧАЕМ АКТУАЛЬНЫЕ ДАННЫЕ ИЗ ОБЛАКА ПЕРЕД СОХРАНЕНИЕМ
    const checkResponse = await fetch(`${url}?id=eq.main&select=state`, { headers });
    let finalState = { ...state };

    if (checkResponse.ok) {
      const cloudData = await checkResponse.json();
      if (cloudData.length > 0) {
        const remote: AppState = cloudData[0].state;
        
        // 2. ВЫПОЛНЯЕМ УМНОЕ СЛИЯНИЕ ВСЕХ МАССИВОВ
        // Это гарантирует, что если Овнер добавил расход, а Админ - доход, оба останутся.
        finalState.incomeData = mergeArraysById(state.incomeData, remote.incomeData);
        finalState.operationsData = mergeArraysById(state.operationsData, remote.operationsData);
        finalState.ownerExpenses = mergeArraysById(state.ownerExpenses, remote.ownerExpenses);
        finalState.ownerAdvances = mergeArraysById(state.ownerAdvances, remote.ownerAdvances);
        finalState.ownerManualIncomes = mergeArraysById(state.ownerManualIncomes || [], remote.ownerManualIncomes || []);
        finalState.modelBonuses = mergeArraysById(state.modelBonuses || [], remote.modelBonuses || []);
        
        // Обновляем версию и время на основе самой свежей инфы
        finalState.version = Math.max(state.version, remote.version) + 1;
        finalState.lastUpdated = Date.now();
      }
    }

    // 3. ОТПРАВЛЯЕМ ОБЪЕДИНЕННЫЙ РЕЗУЛЬТАТ
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ 
        id: 'main',
        state: { ...finalState, lastSyncedAt: new Date().toISOString() }, 
        updated_at: new Date().toISOString() 
      })
    });

    // 4. ДЕЛАЕМ СНАПШОТ (БЕКАП)
    const snapshotId = `snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        id: snapshotId,
        state: finalState, 
        updated_at: new Date().toISOString() 
      })
    });

    return { success: response.ok, newState: finalState };
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
