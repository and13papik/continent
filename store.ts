
import { AppState, AccountingPeriod, Admin, IncomeRecord, OperationRecord } from './types';

const STORAGE_KEY = 'continental_dashboard_v2';

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

function generateDetailedReport(state: AppState) {
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  if (!activePeriod) return null;

  const incomes = state.incomeData.filter(r => r.periodId === activePeriodId);
  const ops = state.operationsData.filter(o => o.operator && o.periodId === activePeriodId);

  const operatorReports = state.operators.map(op => {
    const opIncomes = incomes.filter(r => r.operator === op);
    const opOps = ops.filter(o => o.operator === op);

    const stats = {
      grossTotal: opIncomes.reduce((s, r) => s + r.total, 0),
      ofGross: opIncomes.reduce((s, r) => s + r.onlyFans, 0),
      ofNet: opIncomes.reduce((s, r) => s + r.nettoOF, 0),
      ppGross: opIncomes.reduce((s, r) => s + r.paypal, 0),
      ppNet: opIncomes.reduce((s, r) => s + r.nettoPP, 0),
      crGross: opIncomes.reduce((s, r) => s + r.crypto, 0),
      crNet: opIncomes.reduce((s, r) => s + r.nettoCrypto, 0),
      paid: opOps.filter(o => ['advance', 'salary_payment'].includes(o.type)).reduce((s, o) => s + o.amount, 0),
      penalties: opOps.filter(o => o.type === 'penalty').reduce((s, o) => s + o.amount, 0),
      bonuses: opOps.filter(o => o.type === 'bonus').reduce((s, o) => s + o.amount, 0),
    };

    const netTotal = stats.ofNet + stats.ppNet + stats.crNet;
    const remainder = netTotal + stats.bonuses - (stats.paid + stats.penalties);

    const dailyGrid: Record<number, number> = {};
    for (let day = 1; day <= 31; day++) {
      const dayNet = opIncomes
        .filter(r => new Date(r.date).getDate() === day)
        .reduce((s, r) => s + (r.nettoOF + r.nettoPP + r.nettoCrypto), 0);
      dailyGrid[day] = Number(dayNet.toFixed(2));
    }

    return {
      operator: op,
      stats: { ...stats, netTotal: Number(netTotal.toFixed(2)), remainder: Number(remainder.toFixed(2)) },
      daily: dailyGrid
    };
  });

  return {
    monthLabel: activePeriod.label,
    data: operatorReports
  };
}

export async function syncToCloud(state: AppState, action: string = 'sync_full_state'): Promise<boolean> {
  if (!state.syncUrl) return false;
  
  const payload = {
    timestamp: new Date().toISOString(),
    action: action,
    full_backup: { ...state },
    operator_report: generateDetailedReport(state)
  };

  try {
    // Используем POST для отправки и бэкапа и отчета
    await fetch(state.syncUrl, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    // Если есть вторая база
    if (state.dbUrl) {
       await fetch(state.dbUrl, {
         method: 'POST',
         mode: 'no-cors',
         body: JSON.stringify({ backup: payload.full_backup })
       }).catch(() => {});
    }
    
    return true;
  } catch (e) {
    console.error("Sync error", e);
    return false;
  }
}

export async function fetchFromCloud(url: string): Promise<AppState | null> {
  try {
    const response = await fetch(`${url}?t=${Date.now()}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.full_backup || data;
  } catch (e) {
    return null;
  }
}
