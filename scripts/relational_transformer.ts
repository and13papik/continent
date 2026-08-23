/**
 * RELATIONAL MIGRATION SHARED TRANSFORMER
 * 
 * Pure, deterministic transformation layer: AppState -> RelationalMigrationPayload
 * Used synchronously by both dry-run validator and real migration executor.
 * Guarantees 100% parity between Dry-Run checks and actual database inserts.
 */

import {
  AppState,
  AccountingPeriod,
  Admin,
  IncomeRecord,
  OperationRecord,
  OwnerManualExpense,
  OwnerManualIncome,
  OwnerAdvance,
  ModelBonus,
  PaidStatus,
  DailyTotalEntry,
  RosterEntry,
} from '../types';

// ============================================================================
// RELATIONAL DATABASE ROW TYPES (1:1 with target_relational_schema.sql)
// ============================================================================

export interface AccountingPeriodRow {
  id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  status: 'open' | 'closed';
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OperatorRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModelRow {
  id: string;
  name: string;
  default_rate_of: number;
  default_rate_pp: number;
  default_rate_crypto: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OwnerRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OwnerPeriodShareRow {
  period_id: string;
  owner_id: string;
  share_percent: number;
  created_at: string;
  updated_at: string;
}

export interface ModelPeriodRateRow {
  period_id: string;
  model_id: string;
  rate_of: number;
  rate_pp: number;
  rate_crypto: number;
  created_at: string;
  updated_at: string;
}

export interface AdminPeriodRateRow {
  period_id: string;
  admin_id: string;
  rate_percent: number;
  created_at: string;
  updated_at: string;
}

export interface IncomeRecordRow {
  id: string;
  period_id: string;
  date: string;
  shift_index: number;
  operator_id: string;
  model_id: string;
  operator_name_snapshot: string;
  model_name_snapshot: string;
  onlyfans_gross: number;
  paypal_gross: number;
  crypto_gross: number;
  percent_of: number;
  percent_pp: number;
  percent_crypto: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialOperationRow {
  id: string;
  period_id: string;
  date: string;
  type: 'advance' | 'penalty' | 'bonus' | 'salary_payment' | 'refund' | 'training' | 'internship';
  target_type: 'operator' | 'model' | 'admin';
  operator_id: string | null;
  model_id: string | null;
  admin_id: string | null;
  target_name_snapshot: string;
  related_model_id: string | null;
  amount: number;
  comment: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AgencyTransactionRow {
  id: string;
  period_id: string;
  date: string;
  direction: 'expense' | 'income';
  category: string;
  platform: string;
  amount: number;
  comment: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OwnerDrawRow {
  id: string;
  period_id: string;
  date: string;
  owner_id: string;
  platform: string;
  amount: number;
  comment: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ModelPeriodBonusRow {
  id: string;
  period_id: string;
  model_id: string;
  amount: number;
  date: string;
  comment: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PayoutSettlementFlagRow {
  id: string;
  period_id: string;
  target_type: 'operator' | 'model' | 'admin';
  operator_id: string | null;
  model_id: string | null;
  admin_id: string | null;
  is_settled: boolean;
  settled_at: string;
  version: number;
}

export interface ModelMonthlyPlanRow {
  id: string;
  month_key: string;
  model_id: string;
  plan_amount: number;
  version: number;
  updated_at: string;
}

export interface ShiftBalanceEntryRow {
  id: string;
  period_id: string;
  date: string;
  model_id: string;
  shift_index: number;
  balance: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RosterShiftRow {
  id: string;
  date: string;
  shift_index: number;
  operator_id: string;
  is_trainee: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RosterShiftModelRow {
  roster_shift_id: string;
  model_id: string;
  created_at: string;
}

// ============================================================================
// COMPLETE MIGRATION PAYLOAD
// ============================================================================

export interface RelationalMigrationPayload {
  accounting_periods: AccountingPeriodRow[];
  operators: OperatorRow[];
  models: ModelRow[];
  owners: OwnerRow[];
  admins: AdminRow[];
  owner_period_shares: OwnerPeriodShareRow[];
  model_period_rates: ModelPeriodRateRow[];
  admin_period_rates: AdminPeriodRateRow[];
  income_records: IncomeRecordRow[];
  financial_operations: FinancialOperationRow[];
  agency_transactions: AgencyTransactionRow[];
  owner_draws: OwnerDrawRow[];
  model_period_bonuses: ModelPeriodBonusRow[];
  payout_settlement_flags: PayoutSettlementFlagRow[];
  model_monthly_plans: ModelMonthlyPlanRow[];
  shift_balance_entries: ShiftBalanceEntryRow[];
  roster_shifts: RosterShiftRow[];
  roster_shift_models: RosterShiftModelRow[];
}

export interface EntityMappingContext {
  operatorMap: Map<string, string>; // lowerName -> operator_id
  modelMap: Map<string, string>;    // lowerName -> model_id
  ownerMap: Map<string, string>;    // lowerAlias -> owner_id
  adminMap: Map<string, string>;    // lowerName -> admin_id
  periodIds: Set<string>;
}

export interface RelationalTransformationResult {
  payload: RelationalMigrationPayload;
  context: EntityMappingContext;
  warnings: string[];
}

// Shift index helper: morning=0, day=1, evening=2, night=3
export function getShiftIndex(shift: string | undefined): number {
  if (!shift) return 0;
  const s = shift.toLowerCase();
  if (s === 'morning') return 0;
  if (s === 'day') return 1;
  if (s === 'evening') return 2;
  if (s === 'night') return 3;
  return 0;
}

// ============================================================================
// PURE DETERMINISTIC TRANSFORMATION ENGINE
// ============================================================================

export function transformAppStateToRelational(state: AppState): RelationalTransformationResult {
  const warnings: string[] = [];
  const now = new Date().toISOString();

  // 1. Source Collections
  const periods: AccountingPeriod[] = state.accountingPeriods || [];
  const operatorsList: string[] = state.operators || [];
  const modelsList: string[] = state.models || [];
  const adminsList: Admin[] = state.admins || [];
  const incomeRecords: IncomeRecord[] = state.incomeData || [];
  const opsRecords: OperationRecord[] = state.operationsData || [];
  const ownerExp: OwnerManualExpense[] = state.ownerExpenses || [];
  const ownerManualInc: OwnerManualIncome[] = state.ownerManualIncomes || [];
  const ownerAdv: OwnerAdvance[] = state.ownerAdvances || [];
  const modelBonuses: ModelBonus[] = state.modelBonuses || [];
  const paidStatuses: PaidStatus[] = state.paidStatuses || [];
  const monthlyPlans: Record<string, number> = state.modelMonthlyPlans || {};
  const totalEntries: DailyTotalEntry[] = state.totalTableEntries || [];
  const roster: RosterEntry[] = state.rosterData || [];

  const periodIds = new Set<string>(periods.map(p => p.id));
  const operatorMap = new Map<string, string>();
  const modelMap = new Map<string, string>();
  const ownerMap = new Map<string, string>();
  const adminMap = new Map<string, string>();

  // 2. Canonical Owners (exactly 2 owners with full alias mapping)
  const owners: OwnerRow[] = [
    { id: 'owner_andrey', name: 'Андрей', is_active: true, created_at: now, updated_at: now },
    { id: 'owner_anton', name: 'Антон', is_active: true, created_at: now, updated_at: now },
  ];
  ownerMap.set('andrey', 'owner_andrey');
  ownerMap.set('андрей', 'owner_andrey');
  ownerMap.set('anton', 'owner_anton');
  ownerMap.set('антон', 'owner_anton');

  // 3. Admins Mapping
  const adminRows: AdminRow[] = [];
  const adminNameLowerToRow = new Map<string, AdminRow>();

  adminsList.forEach((adm, idx) => {
    if (adm.name && adm.name.trim()) {
      const lower = adm.name.trim().toLowerCase();
      if (!adminNameLowerToRow.has(lower)) {
        const id = adm.id ? (adm.id.startsWith('adm_') ? adm.id : `adm_${adm.id}`) : `adm_${idx + 1}`;
        const row: AdminRow = {
          id,
          name: adm.name.trim(),
          is_active: true,
          created_at: now,
          updated_at: now,
        };
        adminNameLowerToRow.set(lower, row);
        adminMap.set(lower, id);
      }
    }
  });

  periods.forEach(p => {
    if (p.admins && Array.isArray(p.admins)) {
      p.admins.forEach((adm, idx) => {
        if (adm.name && adm.name.trim()) {
          const lower = adm.name.trim().toLowerCase();
          if (!adminNameLowerToRow.has(lower)) {
            const id = adm.id ? (adm.id.startsWith('adm_') ? adm.id : `adm_${adm.id}`) : `adm_p_${idx + 1}`;
            const row: AdminRow = {
              id,
              name: adm.name.trim(),
              is_active: true,
              created_at: now,
              updated_at: now,
            };
            adminNameLowerToRow.set(lower, row);
            adminMap.set(lower, id);
          }
        }
      });
    }
  });

  adminNameLowerToRow.forEach(row => adminRows.push(row));

  // 4. Models Mapping (Active vs Inactive)
  const activeModelNames = new Set<string>(modelsList.map(m => m.trim().toLowerCase()));
  const allModelNamesMap = new Map<string, string>(); // lower -> originalName

  modelsList.forEach(m => { if (m && m.trim()) allModelNamesMap.set(m.trim().toLowerCase(), m.trim()); });
  incomeRecords.forEach(inc => { if (inc.model && inc.model.trim()) allModelNamesMap.set(inc.model.trim().toLowerCase(), inc.model.trim()); });
  opsRecords.forEach(op => { if (op.model && op.model.trim()) allModelNamesMap.set(op.model.trim().toLowerCase(), op.model.trim()); });
  modelBonuses.forEach(b => { if (b.model && b.model.trim()) allModelNamesMap.set(b.model.trim().toLowerCase(), b.model.trim()); });
  totalEntries.forEach(t => { if (t.modelName && t.modelName.trim()) allModelNamesMap.set(t.modelName.trim().toLowerCase(), t.modelName.trim()); });
  periods.forEach(p => {
    if (p.models && Array.isArray(p.models)) {
      p.models.forEach(m => { if (m && m.trim()) allModelNamesMap.set(m.trim().toLowerCase(), m.trim()); });
    }
  });

  const modelRows: ModelRow[] = [];
  let modIndex = 1;
  allModelNamesMap.forEach((originalName, lower) => {
    const id = `mod_${modIndex++}`;
    modelMap.set(lower, id);
    const isActive = activeModelNames.has(lower);
    modelRows.push({
      id,
      name: originalName,
      default_rate_of: state.modelRates?.of ?? 20.00,
      default_rate_pp: state.modelRates?.pp ?? 20.00,
      default_rate_crypto: state.modelRates?.cr ?? 20.00,
      is_active: isActive,
      created_at: now,
      updated_at: now,
    });
  });

  // 5. Operators Mapping (Excluding Admins, Active vs Inactive)
  const activeOpNames = new Set<string>(operatorsList.map(o => o.trim().toLowerCase()));
  const allOpNamesMap = new Map<string, string>(); // lower -> originalName

  const registerOpCandidate = (name: string | undefined) => {
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === 'SYSTEM') return;
    const lower = trimmed.toLowerCase();
    // Strictly skip admins
    if (adminMap.has(lower)) return;
    if (!allOpNamesMap.has(lower)) {
      allOpNamesMap.set(lower, trimmed);
    }
  };

  operatorsList.forEach(registerOpCandidate);
  incomeRecords.forEach(inc => registerOpCandidate(inc.operator));
  opsRecords.forEach(op => {
    // If an operation targets an admin or model, don't treat as operator
    if (op.operator && !adminMap.has(op.operator.trim().toLowerCase())) {
      registerOpCandidate(op.operator);
    }
  });
  roster.forEach(r => registerOpCandidate(r.operator));
  periods.forEach(p => {
    if (p.operators && Array.isArray(p.operators)) {
      p.operators.forEach(registerOpCandidate);
    }
  });

  const operatorRows: OperatorRow[] = [];
  let opIndex = 1;
  allOpNamesMap.forEach((originalName, lower) => {
    const id = `op_${opIndex++}`;
    operatorMap.set(lower, id);
    const isActive = activeOpNames.has(lower);
    operatorRows.push({
      id,
      name: originalName,
      is_active: isActive,
      created_at: now,
      updated_at: now,
    });
  });

  // 6. Accounting Periods
  const accounting_periods: AccountingPeriodRow[] = periods.map(p => ({
    id: p.id,
    label: p.label,
    start_at: p.startAt,
    end_at: p.endAt || null,
    status: p.status || 'open',
    version: 1,
    created_at: p.createdAt || now,
    updated_at: p.updatedAt || now,
  }));

  // 7. Owner Period Shares (2 per period: 50.00% each)
  const owner_period_shares: OwnerPeriodShareRow[] = [];
  periods.forEach(p => {
    owner_period_shares.push(
      { period_id: p.id, owner_id: 'owner_andrey', share_percent: 50.00, created_at: now, updated_at: now },
      { period_id: p.id, owner_id: 'owner_anton', share_percent: 50.00, created_at: now, updated_at: now }
    );
  });

  // 8. Model Period Rates
  const model_period_rates: ModelPeriodRateRow[] = [];
  periods.forEach(p => {
    const periodRates = p.modelRates || state.modelRates || { of: 20, pp: 20, cr: 20 };
    const periodModels = new Set<string>();
    if (p.models && Array.isArray(p.models)) {
      p.models.forEach(m => { if (m && m.trim()) periodModels.add(m.trim().toLowerCase()); });
    }
    incomeRecords.forEach(inc => {
      if (inc.periodId === p.id && inc.model && inc.model.trim()) {
        periodModels.add(inc.model.trim().toLowerCase());
      }
    });

    periodModels.forEach(mLower => {
      const modelId = modelMap.get(mLower);
      if (modelId) {
        model_period_rates.push({
          period_id: p.id,
          model_id: modelId,
          rate_of: periodRates.of,
          rate_pp: periodRates.pp,
          rate_crypto: periodRates.cr,
          created_at: now,
          updated_at: now,
        });
      }
    });
  });

  // 9. Admin Period Rates
  const admin_period_rates: AdminPeriodRateRow[] = [];
  periods.forEach(p => {
    const currentAdmins = p.admins || state.admins || [];
    currentAdmins.forEach(adm => {
      if (adm.name && adm.name.trim()) {
        const lower = adm.name.trim().toLowerCase();
        const adminId = adminMap.get(lower);
        if (adminId) {
          admin_period_rates.push({
            period_id: p.id,
            admin_id: adminId,
            rate_percent: adm.rate ?? 3.00,
            created_at: now,
            updated_at: now,
          });
        }
      }
    });
  });

  // 10. Income Records
  const income_records: IncomeRecordRow[] = incomeRecords.map(inc => {
    const opLower = (inc.operator || '').trim().toLowerCase();
    const modLower = (inc.model || '').trim().toLowerCase();
    const operator_id = operatorMap.get(opLower) || 'op_unknown';
    const model_id = modelMap.get(modLower) || 'mod_unknown';

    return {
      id: inc.id,
      period_id: inc.periodId,
      date: inc.date,
      shift_index: 0,
      operator_id,
      model_id,
      operator_name_snapshot: inc.operator || '',
      model_name_snapshot: inc.model || '',
      onlyfans_gross: inc.onlyFans ?? 0,
      paypal_gross: inc.paypal ?? 0,
      crypto_gross: inc.crypto ?? 0,
      percent_of: inc.percentOF ?? 20.00,
      percent_pp: inc.percentPP ?? 20.00,
      percent_crypto: inc.percentCrypto ?? 20.00,
      version: 1,
      created_at: inc.createdAt || now,
      updated_at: inc.updatedAt || now,
    };
  });

  // 11. Financial Operations
  const financial_operations: FinancialOperationRow[] = opsRecords.map(op => {
    const targetName = (op.operator || '').trim();
    const targetLower = targetName.toLowerCase();
    const modName = (op.model || '').trim();
    const modLower = modName.toLowerCase();

    let target_type: 'operator' | 'model' | 'admin' = 'operator';
    let operator_id: string | null = null;
    let model_id: string | null = null;
    let admin_id: string | null = null;

    if (modName && modelMap.has(modLower)) {
      target_type = 'model';
      model_id = modelMap.get(modLower)!;
    } else if (adminMap.has(targetLower)) {
      target_type = 'admin';
      admin_id = adminMap.get(targetLower)!;
    } else if (operatorMap.has(targetLower)) {
      target_type = 'operator';
      operator_id = operatorMap.get(targetLower)!;
    } else if (modelMap.has(targetLower)) {
      target_type = 'model';
      model_id = modelMap.get(targetLower)!;
    }

    const related_model_id = modName && modelMap.has(modLower) ? modelMap.get(modLower)! : null;

    return {
      id: op.id,
      period_id: op.periodId,
      date: op.date,
      type: op.type,
      target_type,
      operator_id,
      model_id,
      admin_id,
      target_name_snapshot: targetName || modName,
      related_model_id,
      amount: op.amount,
      comment: op.comment || null,
      version: 1,
      created_at: op.createdAt || now,
      updated_at: op.updatedAt || now,
    };
  });

  // 12. Agency Transactions (Expenses + Manual Incomes)
  const agency_transactions: AgencyTransactionRow[] = [];
  ownerExp.forEach(exp => {
    agency_transactions.push({
      id: exp.id,
      period_id: exp.periodId,
      date: exp.date,
      direction: 'expense',
      category: exp.category,
      platform: exp.platform || 'Other',
      amount: exp.amount,
      comment: exp.comment || null,
      version: 1,
      created_at: exp.createdAt || now,
      updated_at: exp.updatedAt || now,
    });
  });

  ownerManualInc.forEach(inc => {
    agency_transactions.push({
      id: inc.id,
      period_id: inc.periodId,
      date: inc.date,
      direction: 'income',
      category: 'manual_income',
      platform: inc.platform || 'Other',
      amount: inc.amount,
      comment: inc.comment || null,
      version: 1,
      created_at: inc.createdAt || now,
      updated_at: inc.updatedAt || now,
    });
  });

  // 13. Owner Draws
  const owner_draws: OwnerDrawRow[] = ownerAdv.map(adv => {
    const ownerLower = (adv.ownerName || '').trim().toLowerCase();
    const owner_id = ownerMap.get(ownerLower) || 'owner_andrey';
    return {
      id: adv.id,
      period_id: adv.periodId,
      date: adv.date,
      owner_id,
      platform: adv.platform || 'Crypto',
      amount: adv.amount,
      comment: adv.comment || null,
      version: 1,
      created_at: adv.createdAt || now,
      updated_at: adv.updatedAt || now,
    };
  });

  // 14. Model Period Bonuses
  const model_period_bonuses: ModelPeriodBonusRow[] = modelBonuses.map(b => {
    const modLower = (b.model || '').trim().toLowerCase();
    const model_id = modelMap.get(modLower) || 'mod_unknown';
    return {
      id: b.id,
      period_id: b.periodId,
      model_id,
      amount: b.amount,
      date: b.date,
      comment: b.comment || null,
      version: 1,
      created_at: b.createdAt || now,
      updated_at: b.updatedAt || now,
    };
  });

  // 15. Payout Settlement Flags
  const payout_settlement_flags: PayoutSettlementFlagRow[] = paidStatuses.map(ps => {
    const entityLower = (ps.entityName || '').trim().toLowerCase();
    let target_type: 'operator' | 'model' | 'admin' = ps.entityType;
    let operator_id: string | null = null;
    let model_id: string | null = null;
    let admin_id: string | null = null;

    if (ps.entityType === 'model' || modelMap.has(entityLower)) {
      target_type = 'model';
      model_id = modelMap.get(entityLower) || null;
    } else if (ps.entityType === 'admin' || adminMap.has(entityLower)) {
      target_type = 'admin';
      admin_id = adminMap.get(entityLower) || null;
    } else {
      target_type = 'operator';
      operator_id = operatorMap.get(entityLower) || null;
    }

    return {
      id: ps.id,
      period_id: ps.periodId,
      target_type,
      operator_id,
      model_id,
      admin_id,
      is_settled: true,
      settled_at: ps.updatedAt || ps.createdAt || now,
      version: 1,
    };
  });

  // 16. Model Monthly Plans (Handling root object with model names and period-level monthly plans)
  const model_monthly_plans: ModelMonthlyPlanRow[] = [];
  const planMap = new Map<string, ModelMonthlyPlanRow>(); // `${month_key}__${model_id}` -> row

  // Determine default active month_key from active period or current date
  const activePeriod = periods.find(p => p.id === state.selectedPeriodId) || periods[0];
  const defaultMonthKey = activePeriod?.startAt ? activePeriod.startAt.slice(0, 7) : (activePeriod?.id || now.slice(0, 7));

  const registerPlan = (rawKey: string, amount: number, fallbackMonthKey: string) => {
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return;

    let month_key = fallbackMonthKey;
    let model_name = rawKey.trim();

    if (rawKey.includes('_')) {
      const parts = rawKey.split('_');
      // e.g. "2025-11_Ashley" or "period_2025_11_Ashley"
      if (parts[0].match(/^\d{4}-\d{2}$/) || parts[0].startsWith('period_')) {
        month_key = parts[0];
        model_name = parts.slice(1).join('_').trim();
      }
    }

    const modLower = model_name.toLowerCase();
    const model_id = modelMap.get(modLower);
    if (!model_id) return;

    const uniqueKey = `${month_key}__${model_id}`;
    if (!planMap.has(uniqueKey)) {
      planMap.set(uniqueKey, {
        id: `plan_${month_key.replace(/[^a-zA-Z0-9]/g, '_')}_${model_id}`,
        month_key,
        model_id,
        plan_amount: numAmount,
        version: 1,
        updated_at: now,
      });
    } else {
      // update plan amount if not already set
      planMap.get(uniqueKey)!.plan_amount = numAmount;
    }
  };

  // Process root state.modelMonthlyPlans
  if (monthlyPlans && typeof monthlyPlans === 'object') {
    Object.entries(monthlyPlans).forEach(([key, amount]) => {
      registerPlan(key, amount, defaultMonthKey);
    });
  }

  // Process period-level modelMonthlyPlans
  periods.forEach(p => {
    const pMonthKey = p.startAt ? p.startAt.slice(0, 7) : p.id;
    if (p.modelMonthlyPlans && typeof p.modelMonthlyPlans === 'object') {
      Object.entries(p.modelMonthlyPlans).forEach(([key, amount]) => {
        registerPlan(key, amount, pMonthKey);
      });
    }
  });

  planMap.forEach(row => model_monthly_plans.push(row));

  // 17. Shift Balance Entries (TotalTable)
  const shift_balance_entries: ShiftBalanceEntryRow[] = [];
  totalEntries.forEach(entry => {
    const modLower = (entry.modelName || '').trim().toLowerCase();
    const model_id = modelMap.get(modLower) || 'mod_unknown';

    const shifts: { shift_index: number; balance: number }[] = [
      { shift_index: 3, balance: entry.night?.balance ?? 0 },
      { shift_index: 0, balance: entry.morning?.balance ?? 0 },
      { shift_index: 1, balance: entry.day?.balance ?? 0 },
      { shift_index: 2, balance: entry.evening?.balance ?? 0 },
    ];

    shifts.forEach(s => {
      shift_balance_entries.push({
        id: `${entry.id}_shift_${s.shift_index}`,
        period_id: entry.periodId,
        date: entry.date,
        model_id,
        shift_index: s.shift_index,
        balance: s.balance,
        version: 1,
        created_at: entry.createdAt || now,
        updated_at: entry.updatedAt || now,
      });
    });
  });

  // 18. Roster Shifts & Junction
  const roster_shifts: RosterShiftRow[] = [];
  const roster_shift_models: RosterShiftModelRow[] = [];

  roster.forEach(r => {
    const opLower = (r.operator || '').trim().toLowerCase();
    const operator_id = operatorMap.get(opLower) || 'op_unknown';
    const shift_index = getShiftIndex(r.shift);

    roster_shifts.push({
      id: r.id,
      date: r.date,
      shift_index,
      operator_id,
      is_trainee: Boolean(r.isTrainee),
      version: 1,
      created_at: r.createdAt || now,
      updated_at: r.updatedAt || now,
    });

    if (r.models && Array.isArray(r.models)) {
      r.models.forEach(m => {
        const modLower = m.trim().toLowerCase();
        const model_id = modelMap.get(modLower);
        if (model_id) {
          roster_shift_models.push({
            roster_shift_id: r.id,
            model_id,
            created_at: now,
          });
        }
      });
    }
  });

  const payload: RelationalMigrationPayload = {
    accounting_periods,
    operators: operatorRows,
    models: modelRows,
    owners,
    admins: adminRows,
    owner_period_shares,
    model_period_rates,
    admin_period_rates,
    income_records,
    financial_operations,
    agency_transactions,
    owner_draws,
    model_period_bonuses,
    payout_settlement_flags,
    model_monthly_plans,
    shift_balance_entries,
    roster_shifts,
    roster_shift_models,
  };

  const context: EntityMappingContext = {
    operatorMap,
    modelMap,
    ownerMap,
    adminMap,
    periodIds,
  };

  return {
    payload,
    context,
    warnings,
  };
}
