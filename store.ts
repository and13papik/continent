import { AppState, AccountingPeriod, Admin } from './types';

const STORAGE_KEY = 'continental_dashboard_v3';

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
        modelRates: parsed.modelRates || { of: 25, pp: 25, cr: 25 }
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
    operators: defaultOperators,
    models: defaultModels,
    admins: defaultAdmins,
    incomeData: [],
    operationsData: [],
    accountingPeriods: [firstPeriod],
    selectedPeriodId: firstPeriod.id,
    modelRates: { of: 25, pp: 25, cr: 25 },
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

export async function syncToCloud(state: AppState): Promise<boolean> {
  if (!state.syncUrl || !state.syncKey) return false;
  
  const baseUrl = state.syncUrl.trim().replace(/\/$/, "");
  const url = `${baseUrl}/rest/v1/app_storage?id=eq.main`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': state.syncKey.trim(),
        'Authorization': `Bearer ${state.syncKey.trim()}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ 
        state: state, 
        updated_at: new Date().toISOString() 
      })
    });

    return response.ok;
  } catch (e) {
    console.error("Cloud Sync Error:", e);
    return false;
  }
}

export async function fetchFromCloud(url: string, key?: string): Promise<AppState | null> {
  if (!url || !key) return null;
  
  const baseUrl = url.trim().replace(/\/$/, "");
  const fetchUrl = `${baseUrl}/rest/v1/app_storage?id=eq.main&select=state`;

  try {
    const response = await fetch(fetchUrl, {
      headers: { 
        'apikey': key.trim(),
        'Authorization': `Bearer ${key.trim()}`
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].state || null;
    }
    return null;
  } catch (e) {
    console.error("Cloud Fetch Error:", e);
    return null;
  }
}