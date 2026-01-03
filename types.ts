
export type Platform = 'onlyFans' | 'paypal' | 'crypto';

export interface AccountingPeriod {
  id: string;
  label: string;
  startAt: string;
  endAt: string | null;
  status: 'open' | 'closed';
}

export interface IncomeRecord {
  id: string;
  date: string;
  createdAt: string;
  periodId: string;
  operator: string;
  model: string;
  onlyFans: number;
  paypal: number;
  crypto: number;
  percentOF: number;
  percentPP: number;
  percentCrypto: number;
  total: number;
  nettoOF: number;
  nettoPP: number;
  nettoCrypto: number;
}

export type OperationType = 'advance' | 'penalty' | 'bonus' | 'refund' | 'salary_payment' | 'internship';

export interface OperationRecord {
  id: string;
  type: OperationType;
  operator: string;
  date: string;
  createdAt: string;
  periodId: string;
  amount: number;
  comment: string;
  linkedIncomeId?: string;
  platform?: Platform;
}

export interface Admin {
  id: string;
  name: string;
  rate: number;
}

export interface OwnerManualExpense {
  id: string;
  periodId: string;
  category: 'traffic' | 'infra' | 'items' | 'other' | 'commission' | 'bonus';
  platform: Platform | 'all';
  amount: number;
  comment: string;
  date: string;
}

export interface OwnerManualIncome {
  id: string;
  periodId: string;
  amount: number;
  comment: string;
  date: string;
  platform: Platform | 'all';
}

export interface OwnerAdvance {
  id: string;
  periodId: string;
  ownerName: 'Andrey' | 'Anton';
  platform: Platform;
  amount: number;
  comment: string;
  date: string;
}

export interface ModelBonus {
  id: string;
  model: string;
  periodId: string;
  amount: number;
  comment: string;
}

export interface PaidStatus {
  entityName: string;
  entityType: 'model' | 'operator';
  periodId: string;
}

export interface AppState {
  operators: string[];
  models: string[];
  admins: Admin[];
  incomeData: IncomeRecord[];
  operationsData: OperationRecord[];
  accountingPeriods: AccountingPeriod[];
  selectedPeriodId: string;
  modelRates: {
    of: number;
    pp: number;
    cr: number;
  };
  ownerExpenses: OwnerManualExpense[];
  ownerManualIncomes?: OwnerManualIncome[];
  ownerAdvances: OwnerAdvance[];
  modelBonuses: ModelBonus[];
  paidStatuses: PaidStatus[];
  syncUrl?: string;
  syncKey?: string; // Для защиты базы данных
  dbUrl?: string;
  lastSyncedAt?: string;
}
