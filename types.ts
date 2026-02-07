
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
  updatedAt?: string;
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
  model?: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
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
  createdAt: string;
  updatedAt?: string;
}

export interface OwnerManualIncome {
  id: string;
  periodId: string;
  amount: number;
  comment: string;
  date: string;
  platform: Platform | 'all';
  createdAt: string;
  updatedAt?: string;
}

export interface OwnerAdvance {
  id: string;
  periodId: string;
  ownerName: 'Andrey' | 'Anton';
  platform: Platform;
  amount: number;
  comment: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ModelBonus {
  id: string;
  model: string;
  periodId: string;
  amount: number;
  comment: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaidStatus {
  id: string;
  entityName: string;
  entityType: 'model' | 'operator';
  periodId: string;
  createdAt: string;
  updatedAt?: string;
}

export type TaskStatus = 'idea' | 'planned' | 'in_progress' | 'waiting' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type OwnerTag = 'CRITICAL' | 'MONEY' | 'SYSTEM' | 'CONTENT' | 'BLOCKER';

export interface TaskNote {
  id: string;
  text: string;
  author: 'Andrey' | 'Anton' | 'Rector' | 'Mentor';
  createdAt: string;
}

export type TaskAssignee = 'Andrey' | 'Anton' | 'Rector' | 'Mentor' | 'Owners' | 'Admins' | 'All';

export interface OwnerTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: TaskAssignee;
  isForAdmins?: boolean; 
  isRoutine?: boolean;
  adminReport?: {
    text: string;
    links: string[];
  };
  tags: OwnerTag[];
  strategyData?: {
    goal: string;
    reason: string;
    effect: string;
  };
  notes: TaskNote[];
  modelId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  periodId: string;
}

export interface ShiftData {
  balance: number;
  goal: number;
}

export interface DailyTotalEntry {
  id: string;
  date: string; // Новое поле для фильтрации по дням
  modelName: string;
  night: ShiftData;
  morning: ShiftData;
  day: ShiftData;
  evening: ShiftData;
  updatedAt?: string;
  createdAt?: string;
}

export interface AppState {
  lastUpdated: number;
  version: number;
  remoteVersion?: number;
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
  ownerTasks?: OwnerTask[];
  totalTableEntries?: DailyTotalEntry[]; 
  tgChatId?: string; 
  deletedIds: string[]; 
  syncUrl?: string;
  syncKey?: string;
  dbUrl?: string;
  lastSyncedAt?: string;
}

export interface CloudSnapshot {
  id: string;
  state: AppState;
  updated_at: string;
}
