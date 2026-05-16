
export type Platform = 'onlyFans' | 'paypal' | 'crypto';

export interface AccountingPeriod {
  id: string;
  label: string;
  startAt: string;
  endAt: string | null;
  status: 'open' | 'closed';
  operators?: string[];
  models?: string[];
  modelRates?: { of: number; pp: number; cr: number };
  modelDefaultGoals?: Record<string, { night: number; morning: number; day: number; evening: number }>;
  modelMonthlyPlans?: Record<string, number>;
  admins?: Admin[];
  createdAt?: string;
  updatedAt?: string;
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
  date: string;
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

export type TaskStatus = 'idea' | 'in_progress' | 'blocked' | 'waiting_external' | 'review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type OwnerTag = 'CRITICAL' | 'MONEY' | 'SYSTEM' | 'CONTENT' | 'BLOCKER';
export type TaskType = 'directive' | 'regular' | 'recurring';
export type RecurrenceCycle = 'daily' | 'weekly' | 'monthly';

export type TaskAssignee = 'Andrey' | 'Anton' | 'Rector' | 'Mentor' | 'Owners' | 'Admins' | 'All';

export interface TaskNote {
  id: string;
  text: string;
  author: TaskAssignee;
  createdAt: string;
}

export interface TaskAuditEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details?: string;
}

export interface OwnerTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  taskType: TaskType;
  assignedTo: TaskAssignee;
  recurrenceCycle?: RecurrenceCycle;
  lastCompletedAt?: string;
  isPinned?: boolean;
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
  auditLog: TaskAuditEntry[]; 
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
  date: string; 
  modelName: string;
  periodId: string;
  night: ShiftData;
  morning: ShiftData;
  day: ShiftData;
  evening: ShiftData;
  updatedAt?: string;
  createdAt?: string;
}

export type ShiftType = 'morning' | 'day' | 'evening' | 'night';

export interface RosterEntry {
  id: string;
  periodId: string;
  date: string;
  shift: ShiftType;
  operator: string;
  isTrainee?: boolean;
  models: string[];
  createdAt: string;
  updatedAt?: string;
}

export type OperatorStatus = 'good' | 'average' | 'bad' | 'deadline' | 'replace' | 'none';

export interface OperatorAssessment {
  id: string;
  operator: string;
  periodId: string;
  status: OperatorStatus;
  modelName?: string;
  comment?: string;
  updatedAt: string;
}

export interface OperatorWallet {
  id: string;
  operator: string;
  address: string;
  method: 'usdt_trc20' | 'card';
  updatedAt: string;
}

export interface AdvanceRequestItem {
  id: string;
  operator: string;
  amount: number;
  remainderAtTime: number;
  method: 'usdt_trc20' | 'card';
  address: string;
  status: 'pending' | 'paid';
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  tgMessageId?: number;
}

export interface OwnerNote {
  id: string;
  title: string;
  content: string;
  items: { id: string; text: string; completed: boolean }[];
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  periodId: string;
}

export interface AppState {
  lastUpdated: number;
  version: number;
  remoteVersion?: number;
  operators: string[];
  operatorWallets?: OperatorWallet[];
  models: string[];
  admins: Admin[];
  incomeData: IncomeRecord[];
  operationsData: OperationRecord[];
  rosterData?: RosterEntry[];
  operatorAssessments?: OperatorAssessment[];
  priorityModels?: string[];
  inactiveModels?: string[];
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
  ownerNotes?: OwnerNote[];
  ownerDocument?: string;
  completedDocument?: string;
  advanceRequests?: AdvanceRequestItem[];
  totalTableEntries?: DailyTotalEntry[]; 
  modelDefaultGoals?: Record<string, { night: number; morning: number; day: number; evening: number }>;
  modelMonthlyPlans?: Record<string, number>;
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
