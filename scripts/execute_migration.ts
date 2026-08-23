/**
 * PRODUCTION REAL DATA MIGRATION RUNNER (PHASE 2)
 *
 * Transfers CURRENT app_storage.main.state into the 18 pre-created relational tables.
 * 
 * CORE GUARANTEES:
 * 1. Reuses the pure transformation engine (scripts/relational_transformer.ts).
 * 2. 100% Atomic Transaction: (BEGIN ... INSERTS ... RECONCILIATION ... COMMIT).
 * 3. Empty Target Guard: verifies all 18 tables have 0 rows before writing.
 * 4. Source Fingerprint & Concurrency Guard: verifies app_storage.main wasn't modified during migration.
 * 5. Full Post-Migration Financial Reconciliation: 1:1 metric verification per period.
 * 6. NO mutation/deletion of app_storage.main.
 * 7. Generates atomic SQL bundle: migrations/production_migration_bundle.sql
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AppState } from '../types';
import {
  transformAppStateToRelational,
  RelationalMigrationPayload,
  EntityMappingContext,
} from './relational_transformer';
import {
  runPostMigrationReconciliation,
  ReconciliationReport,
} from './post_migration_reconciliation';

import { getSupabaseCredentials } from '../api/_lib/supabase';

export interface SourceFingerprint {
  snapshotUpdatedAt: string;
  sourceRecordCount: number;
  deterministicHash: string;
}

export function computeSourceFingerprint(state: AppState, updatedAt?: string, rawText?: string): SourceFingerprint {
  const normalizedJson = rawText || JSON.stringify(state, Object.keys(state).sort());
  const hash = crypto.createHash('sha256').update(normalizedJson).digest('hex');

  const sourceRecordCount =
    (state.accountingPeriods?.length || 0) +
    (state.operators?.length || 0) +
    (state.models?.length || 0) +
    (state.admins?.length || 0) +
    (state.incomeData?.length || 0) +
    (state.operationsData?.length || 0) +
    (state.ownerExpenses?.length || 0) +
    (state.ownerManualIncomes?.length || 0) +
    (state.ownerAdvances?.length || 0) +
    (state.modelBonuses?.length || 0) +
    (state.paidStatuses?.length || 0) +
    (Object.keys(state.modelMonthlyPlans || {}).length) +
    (state.totalTableEntries?.length || 0) +
    (state.rosterData?.length || 0);

  return {
    snapshotUpdatedAt: updatedAt || new Date(state.lastUpdated || Date.now()).toISOString(),
    sourceRecordCount,
    deterministicHash: hash,
  };
}

// SQL Escape helper
function escapeSqlString(val: string | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function escapeSqlNum(val: number | null | undefined, fallback: number = 0): string {
  if (val === null || val === undefined || isNaN(val)) return String(fallback);
  return Number(val).toFixed(2);
}

function escapeSqlBool(val: boolean | null | undefined): string {
  return val ? 'TRUE' : 'FALSE';
}

/**
 * Generate fully atomic PostgreSQL migration bundle
 */
export function generateAtomicSqlBundle(
  payload: RelationalMigrationPayload,
  fingerprint: SourceFingerprint,
  rawSnapshotStateJson: string
): string {
  const lines: string[] = [];

  lines.push('-- ============================================================================');
  lines.push('-- PRODUCTION REAL DATA MIGRATION BUNDLE (ATOMIC TRANSACTION)');
  lines.push(`-- Diagnostic Source SHA-256: ${fingerprint.deterministicHash}`);
  lines.push(`-- Source Snapshot Updated At: ${fingerprint.snapshotUpdatedAt}`);
  lines.push(`-- Generated At: ${new Date().toISOString()}`);
  lines.push('-- ============================================================================');
  lines.push('BEGIN;');
  lines.push('');
  lines.push('-- Set timeouts for safety: 15s lock acquisition limit, 10min total statement execution limit');
  lines.push("SET LOCAL lock_timeout = '15s';");
  lines.push("SET LOCAL statement_timeout = '10min';");
  lines.push('');

  // 1. Row-Level Lock & Pre-Insert Concurrency + Hash Guard
  lines.push('-- 1. ROW-LEVEL EXCLUSIVE LOCK & PRE-INSERT CONCURRENCY & HASH GUARD (POSTGRESQL-CANONICALIZED)');
  lines.push('DO $$');
  lines.push('DECLARE');
  lines.push('    current_source_updated_at TIMESTAMPTZ;');
  lines.push('    current_source_state_md5 TEXT;');
  lines.push(`    snapshot_updated_at TIMESTAMPTZ := ${escapeSqlString(fingerprint.snapshotUpdatedAt)}::timestamptz;`);
  lines.push(`    snapshot_state_json TEXT := ${escapeSqlString(rawSnapshotStateJson)};`);
  lines.push('    snapshot_state_md5 TEXT;');
  lines.push('BEGIN');
  lines.push('    -- 1.1 Acquire exclusive row-level lock on app_storage.main for the entire transaction');
  lines.push(`    SELECT updated_at, md5(state::text) INTO current_source_updated_at, current_source_state_md5 FROM public.app_storage WHERE id = 'main' FOR UPDATE;`);
  lines.push('    IF NOT FOUND THEN');
  lines.push("        RAISE EXCEPTION 'MIGRATION ABORTED: Source record public.app_storage (id=main) not found!';");
  lines.push('    END IF;');
  lines.push('');
  lines.push('    -- 1.2 Verify updated_at has not drifted from snapshot');
  lines.push('    IF current_source_updated_at IS DISTINCT FROM snapshot_updated_at THEN');
  lines.push(`        RAISE EXCEPTION 'MIGRATION ABORTED (PRE-INSERT CONCURRENCY CONFLICT): Source app_storage.main was modified! Expected snapshot updated_at %, but found % in database.', snapshot_updated_at, current_source_updated_at;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push('    -- 1.3 Verify PostgreSQL-canonicalized JSONB MD5 hash has not drifted');
  lines.push('    snapshot_state_md5 := md5(snapshot_state_json::jsonb::text);');
  lines.push('    IF current_source_state_md5 IS DISTINCT FROM snapshot_state_md5 THEN');
  lines.push(`        RAISE EXCEPTION 'MIGRATION ABORTED (PRE-INSERT HASH CONFLICT): Source app_storage.main state MD5 mismatch! Expected %, but found % in database.', snapshot_state_md5, current_source_state_md5;`);
  lines.push('    END IF;');
  lines.push('END $$;');
  lines.push('');

  // 2. Target Emptiness Guard
  lines.push('-- 2. EMPTY TARGET GUARD: Fail immediately if any relational table has existing rows');
  lines.push('DO $$');
  lines.push('DECLARE');
  lines.push('    non_empty_count INT;');
  lines.push('BEGIN');
  lines.push('    SELECT (');
  lines.push('        (SELECT count(*) FROM public.accounting_periods) +');
  lines.push('        (SELECT count(*) FROM public.operators) +');
  lines.push('        (SELECT count(*) FROM public.models) +');
  lines.push('        (SELECT count(*) FROM public.owners) +');
  lines.push('        (SELECT count(*) FROM public.admins) +');
  lines.push('        (SELECT count(*) FROM public.owner_period_shares) +');
  lines.push('        (SELECT count(*) FROM public.model_period_rates) +');
  lines.push('        (SELECT count(*) FROM public.admin_period_rates) +');
  lines.push('        (SELECT count(*) FROM public.income_records) +');
  lines.push('        (SELECT count(*) FROM public.financial_operations) +');
  lines.push('        (SELECT count(*) FROM public.agency_transactions) +');
  lines.push('        (SELECT count(*) FROM public.owner_draws) +');
  lines.push('        (SELECT count(*) FROM public.model_period_bonuses) +');
  lines.push('        (SELECT count(*) FROM public.payout_settlement_flags) +');
  lines.push('        (SELECT count(*) FROM public.model_monthly_plans) +');
  lines.push('        (SELECT count(*) FROM public.shift_balance_entries) +');
  lines.push('        (SELECT count(*) FROM public.roster_shifts) +');
  lines.push('        (SELECT count(*) FROM public.roster_shift_models)');
  lines.push('    ) INTO non_empty_count;');
  lines.push('');
  lines.push('    IF non_empty_count > 0 THEN');
  lines.push("        RAISE EXCEPTION 'MIGRATION ABORTED: Target tables are not empty (found % existing rows). Aborting to prevent partial/duplicate writes.', non_empty_count;");
  lines.push('    END IF;');
  lines.push('END $$;');
  lines.push('');

  // 2. Insert Core Entities
  lines.push('-- 2. INSERT ACCOUNTING PERIODS');
  payload.accounting_periods.forEach(p => {
    lines.push(`INSERT INTO public.accounting_periods (id, label, start_at, end_at, status, version, created_at, updated_at) VALUES (${escapeSqlString(p.id)}, ${escapeSqlString(p.label)}, ${escapeSqlString(p.start_at)}, ${escapeSqlString(p.end_at)}, ${escapeSqlString(p.status)}, ${p.version}, ${escapeSqlString(p.created_at)}, ${escapeSqlString(p.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 3. INSERT OWNERS');
  payload.owners.forEach(o => {
    lines.push(`INSERT INTO public.owners (id, name, is_active, created_at, updated_at) VALUES (${escapeSqlString(o.id)}, ${escapeSqlString(o.name)}, ${escapeSqlBool(o.is_active)}, ${escapeSqlString(o.created_at)}, ${escapeSqlString(o.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 4. INSERT ADMINS');
  payload.admins.forEach(a => {
    lines.push(`INSERT INTO public.admins (id, name, is_active, created_at, updated_at) VALUES (${escapeSqlString(a.id)}, ${escapeSqlString(a.name)}, ${escapeSqlBool(a.is_active)}, ${escapeSqlString(a.created_at)}, ${escapeSqlString(a.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 5. INSERT MODELS');
  payload.models.forEach(m => {
    lines.push(`INSERT INTO public.models (id, name, default_rate_of, default_rate_pp, default_rate_crypto, is_active, created_at, updated_at) VALUES (${escapeSqlString(m.id)}, ${escapeSqlString(m.name)}, ${escapeSqlNum(m.default_rate_of)}, ${escapeSqlNum(m.default_rate_pp)}, ${escapeSqlNum(m.default_rate_crypto)}, ${escapeSqlBool(m.is_active)}, ${escapeSqlString(m.created_at)}, ${escapeSqlString(m.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 6. INSERT OPERATORS');
  payload.operators.forEach(op => {
    lines.push(`INSERT INTO public.operators (id, name, is_active, created_at, updated_at) VALUES (${escapeSqlString(op.id)}, ${escapeSqlString(op.name)}, ${escapeSqlBool(op.is_active)}, ${escapeSqlString(op.created_at)}, ${escapeSqlString(op.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 7. INSERT OWNER PERIOD SHARES');
  payload.owner_period_shares.forEach(ops => {
    lines.push(`INSERT INTO public.owner_period_shares (period_id, owner_id, share_percent, created_at, updated_at) VALUES (${escapeSqlString(ops.period_id)}, ${escapeSqlString(ops.owner_id)}, ${escapeSqlNum(ops.share_percent)}, ${escapeSqlString(ops.created_at)}, ${escapeSqlString(ops.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 8. INSERT MODEL PERIOD RATES');
  payload.model_period_rates.forEach(mpr => {
    lines.push(`INSERT INTO public.model_period_rates (period_id, model_id, rate_of, rate_pp, rate_crypto, created_at, updated_at) VALUES (${escapeSqlString(mpr.period_id)}, ${escapeSqlString(mpr.model_id)}, ${escapeSqlNum(mpr.rate_of)}, ${escapeSqlNum(mpr.rate_pp)}, ${escapeSqlNum(mpr.rate_crypto)}, ${escapeSqlString(mpr.created_at)}, ${escapeSqlString(mpr.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 9. INSERT ADMIN PERIOD RATES');
  payload.admin_period_rates.forEach(apr => {
    lines.push(`INSERT INTO public.admin_period_rates (period_id, admin_id, rate_percent, created_at, updated_at) VALUES (${escapeSqlString(apr.period_id)}, ${escapeSqlString(apr.admin_id)}, ${escapeSqlNum(apr.rate_percent)}, ${escapeSqlString(apr.created_at)}, ${escapeSqlString(apr.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 10. INSERT INCOME RECORDS');
  payload.income_records.forEach(inc => {
    lines.push(`INSERT INTO public.income_records (id, period_id, date, shift_index, operator_id, model_id, operator_name_snapshot, model_name_snapshot, onlyfans_gross, paypal_gross, crypto_gross, percent_of, percent_pp, percent_crypto, version, created_at, updated_at) VALUES (${escapeSqlString(inc.id)}, ${escapeSqlString(inc.period_id)}, ${escapeSqlString(inc.date)}, ${inc.shift_index}, ${escapeSqlString(inc.operator_id)}, ${escapeSqlString(inc.model_id)}, ${escapeSqlString(inc.operator_name_snapshot)}, ${escapeSqlString(inc.model_name_snapshot)}, ${escapeSqlNum(inc.onlyfans_gross)}, ${escapeSqlNum(inc.paypal_gross)}, ${escapeSqlNum(inc.crypto_gross)}, ${escapeSqlNum(inc.percent_of)}, ${escapeSqlNum(inc.percent_pp)}, ${escapeSqlNum(inc.percent_crypto)}, ${inc.version}, ${escapeSqlString(inc.created_at)}, ${escapeSqlString(inc.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 11. INSERT FINANCIAL OPERATIONS');
  payload.financial_operations.forEach(fo => {
    lines.push(`INSERT INTO public.financial_operations (id, period_id, date, type, target_type, operator_id, model_id, admin_id, target_name_snapshot, related_model_id, amount, comment, version, created_at, updated_at) VALUES (${escapeSqlString(fo.id)}, ${escapeSqlString(fo.period_id)}, ${escapeSqlString(fo.date)}, ${escapeSqlString(fo.type)}, ${escapeSqlString(fo.target_type)}, ${escapeSqlString(fo.operator_id)}, ${escapeSqlString(fo.model_id)}, ${escapeSqlString(fo.admin_id)}, ${escapeSqlString(fo.target_name_snapshot)}, ${escapeSqlString(fo.related_model_id)}, ${escapeSqlNum(fo.amount)}, ${escapeSqlString(fo.comment)}, ${fo.version}, ${escapeSqlString(fo.created_at)}, ${escapeSqlString(fo.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 12. INSERT AGENCY TRANSACTIONS');
  payload.agency_transactions.forEach(at => {
    lines.push(`INSERT INTO public.agency_transactions (id, period_id, date, direction, category, platform, amount, comment, version, created_at, updated_at) VALUES (${escapeSqlString(at.id)}, ${escapeSqlString(at.period_id)}, ${escapeSqlString(at.date)}, ${escapeSqlString(at.direction)}, ${escapeSqlString(at.category)}, ${escapeSqlString(at.platform)}, ${escapeSqlNum(at.amount)}, ${escapeSqlString(at.comment)}, ${at.version}, ${escapeSqlString(at.created_at)}, ${escapeSqlString(at.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 13. INSERT OWNER DRAWS');
  payload.owner_draws.forEach(od => {
    lines.push(`INSERT INTO public.owner_draws (id, period_id, date, owner_id, platform, amount, comment, version, created_at, updated_at) VALUES (${escapeSqlString(od.id)}, ${escapeSqlString(od.period_id)}, ${escapeSqlString(od.date)}, ${escapeSqlString(od.owner_id)}, ${escapeSqlString(od.platform)}, ${escapeSqlNum(od.amount)}, ${escapeSqlString(od.comment)}, ${od.version}, ${escapeSqlString(od.created_at)}, ${escapeSqlString(od.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 14. INSERT MODEL PERIOD BONUSES');
  payload.model_period_bonuses.forEach(mpb => {
    lines.push(`INSERT INTO public.model_period_bonuses (id, period_id, model_id, amount, date, comment, version, created_at, updated_at) VALUES (${escapeSqlString(mpb.id)}, ${escapeSqlString(mpb.period_id)}, ${escapeSqlString(mpb.model_id)}, ${escapeSqlNum(mpb.amount)}, ${escapeSqlString(mpb.date)}, ${escapeSqlString(mpb.comment)}, ${mpb.version}, ${escapeSqlString(mpb.created_at)}, ${escapeSqlString(mpb.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 15. INSERT PAYOUT SETTLEMENT FLAGS');
  payload.payout_settlement_flags.forEach(psf => {
    lines.push(`INSERT INTO public.payout_settlement_flags (id, period_id, target_type, operator_id, model_id, admin_id, is_settled, settled_at, version) VALUES (${escapeSqlString(psf.id)}, ${escapeSqlString(psf.period_id)}, ${escapeSqlString(psf.target_type)}, ${escapeSqlString(psf.operator_id)}, ${escapeSqlString(psf.model_id)}, ${escapeSqlString(psf.admin_id)}, ${escapeSqlBool(psf.is_settled)}, ${escapeSqlString(psf.settled_at)}, ${psf.version});`);
  });
  lines.push('');

  lines.push('-- 16. INSERT MODEL MONTHLY PLANS');
  payload.model_monthly_plans.forEach(mmp => {
    lines.push(`INSERT INTO public.model_monthly_plans (id, month_key, model_id, plan_amount, version, updated_at) VALUES (${escapeSqlString(mmp.id)}, ${escapeSqlString(mmp.month_key)}, ${escapeSqlString(mmp.model_id)}, ${escapeSqlNum(mmp.plan_amount)}, ${mmp.version}, ${escapeSqlString(mmp.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 17. INSERT SHIFT BALANCE ENTRIES');
  payload.shift_balance_entries.forEach(sbe => {
    lines.push(`INSERT INTO public.shift_balance_entries (id, period_id, date, model_id, shift_index, balance, version, created_at, updated_at) VALUES (${escapeSqlString(sbe.id)}, ${escapeSqlString(sbe.period_id)}, ${escapeSqlString(sbe.date)}, ${escapeSqlString(sbe.model_id)}, ${sbe.shift_index}, ${escapeSqlNum(sbe.balance)}, ${sbe.version}, ${escapeSqlString(sbe.created_at)}, ${escapeSqlString(sbe.updated_at)});`);
  });
  lines.push('');

  lines.push('-- 18. INSERT ROSTER SHIFTS & MODEL JUNCTIONS');
  payload.roster_shifts.forEach(rs => {
    lines.push(`INSERT INTO public.roster_shifts (id, date, shift_index, operator_id, is_trainee, version, created_at, updated_at) VALUES (${escapeSqlString(rs.id)}, ${escapeSqlString(rs.date)}, ${rs.shift_index}, ${escapeSqlString(rs.operator_id)}, ${escapeSqlBool(rs.is_trainee)}, ${rs.version}, ${escapeSqlString(rs.created_at)}, ${escapeSqlString(rs.updated_at)});`);
  });
  lines.push('');

  payload.roster_shift_models.forEach(rsm => {
    lines.push(`INSERT INTO public.roster_shift_models (roster_shift_id, model_id, created_at) VALUES (${escapeSqlString(rsm.roster_shift_id)}, ${escapeSqlString(rsm.model_id)}, ${escapeSqlString(rsm.created_at)});`);
  });
  lines.push('');

  // Post-Insert In-Transaction Verification
  lines.push('-- ============================================================================');
  lines.push('-- POST-INSERT IN-TRANSACTION SANITY ASSERTION (ALL 18 TABLES DYNAMICALLY ASSERTED)');
  lines.push('-- ============================================================================');
  lines.push('DO $$');
  lines.push('DECLARE');
  lines.push('    actual_periods_count INT;');
  lines.push('    actual_ops_staff_count INT;');
  lines.push('    actual_models_count INT;');
  lines.push('    actual_owners_count INT;');
  lines.push('    actual_admins_count INT;');
  lines.push('    actual_owner_shares_count INT;');
  lines.push('    actual_model_rates_count INT;');
  lines.push('    actual_admin_rates_count INT;');
  lines.push('    actual_inc_count INT;');
  lines.push('    actual_ops_count INT;');
  lines.push('    actual_tx_count INT;');
  lines.push('    actual_draws_count INT;');
  lines.push('    actual_bonuses_count INT;');
  lines.push('    actual_flags_count INT;');
  lines.push('    actual_plans_count INT;');
  lines.push('    actual_balances_count INT;');
  lines.push('    actual_roster_shifts_count INT;');
  lines.push('    actual_roster_models_count INT;');
  lines.push('    actual_pnl_count INT;');
  lines.push('    current_source_updated_at TIMESTAMPTZ;');
  lines.push('    current_source_state_md5 TEXT;');
  lines.push(`    snapshot_updated_at TIMESTAMPTZ := ${escapeSqlString(fingerprint.snapshotUpdatedAt)}::timestamptz;`);
  lines.push(`    snapshot_state_json TEXT := ${escapeSqlString(rawSnapshotStateJson)};`);
  lines.push('    snapshot_state_md5 TEXT;');
  lines.push('BEGIN');
  lines.push('    -- Concurrency & Hash Guard: Verify app_storage.main was not modified during migration');
  lines.push(`    SELECT updated_at, md5(state::text) INTO current_source_updated_at, current_source_state_md5 FROM public.app_storage WHERE id = 'main';`);
  lines.push('    IF current_source_updated_at IS DISTINCT FROM snapshot_updated_at THEN');
  lines.push(`        RAISE EXCEPTION 'MIGRATION ABORTED (POST-INSERT CONFLICT): Source app_storage.main was modified during execution! Expected updated_at %, but found % in database.', snapshot_updated_at, current_source_updated_at;`);
  lines.push('    END IF;');
  lines.push('    snapshot_state_md5 := md5(snapshot_state_json::jsonb::text);');
  lines.push('    IF current_source_state_md5 IS DISTINCT FROM snapshot_state_md5 THEN');
  lines.push(`        RAISE EXCEPTION 'MIGRATION ABORTED (POST-INSERT HASH CONFLICT): Source app_storage.main state MD5 changed during execution! Expected %, but found % in database.', snapshot_state_md5, current_source_state_md5;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_periods_count FROM public.accounting_periods;`);
  lines.push(`    IF actual_periods_count <> ${payload.accounting_periods.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Accounting periods count mismatch: expected ${payload.accounting_periods.length}, got %', actual_periods_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_ops_staff_count FROM public.operators;`);
  lines.push(`    IF actual_ops_staff_count <> ${payload.operators.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Operators count mismatch: expected ${payload.operators.length}, got %', actual_ops_staff_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_models_count FROM public.models;`);
  lines.push(`    IF actual_models_count <> ${payload.models.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Models count mismatch: expected ${payload.models.length}, got %', actual_models_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_owners_count FROM public.owners;`);
  lines.push(`    IF actual_owners_count <> ${payload.owners.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Owners count mismatch: expected ${payload.owners.length}, got %', actual_owners_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_admins_count FROM public.admins;`);
  lines.push(`    IF actual_admins_count <> ${payload.admins.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Admins count mismatch: expected ${payload.admins.length}, got %', actual_admins_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_owner_shares_count FROM public.owner_period_shares;`);
  lines.push(`    IF actual_owner_shares_count <> ${payload.owner_period_shares.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Owner period shares count mismatch: expected ${payload.owner_period_shares.length}, got %', actual_owner_shares_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_model_rates_count FROM public.model_period_rates;`);
  lines.push(`    IF actual_model_rates_count <> ${payload.model_period_rates.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Model period rates count mismatch: expected ${payload.model_period_rates.length}, got %', actual_model_rates_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_admin_rates_count FROM public.admin_period_rates;`);
  lines.push(`    IF actual_admin_rates_count <> ${payload.admin_period_rates.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Admin period rates count mismatch: expected ${payload.admin_period_rates.length}, got %', actual_admin_rates_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_inc_count FROM public.income_records;`);
  lines.push(`    IF actual_inc_count <> ${payload.income_records.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Income count mismatch: expected ${payload.income_records.length}, got %', actual_inc_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_ops_count FROM public.financial_operations;`);
  lines.push(`    IF actual_ops_count <> ${payload.financial_operations.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Operations count mismatch: expected ${payload.financial_operations.length}, got %', actual_ops_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_tx_count FROM public.agency_transactions;`);
  lines.push(`    IF actual_tx_count <> ${payload.agency_transactions.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Agency transactions count mismatch: expected ${payload.agency_transactions.length}, got %', actual_tx_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_draws_count FROM public.owner_draws;`);
  lines.push(`    IF actual_draws_count <> ${payload.owner_draws.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Owner draws count mismatch: expected ${payload.owner_draws.length}, got %', actual_draws_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_bonuses_count FROM public.model_period_bonuses;`);
  lines.push(`    IF actual_bonuses_count <> ${payload.model_period_bonuses.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Model period bonuses count mismatch: expected ${payload.model_period_bonuses.length}, got %', actual_bonuses_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_flags_count FROM public.payout_settlement_flags;`);
  lines.push(`    IF actual_flags_count <> ${payload.payout_settlement_flags.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Payout flags count mismatch: expected ${payload.payout_settlement_flags.length}, got %', actual_flags_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_plans_count FROM public.model_monthly_plans;`);
  lines.push(`    IF actual_plans_count <> ${payload.model_monthly_plans.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Model monthly plans count mismatch: expected ${payload.model_monthly_plans.length}, got %', actual_plans_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_balances_count FROM public.shift_balance_entries;`);
  lines.push(`    IF actual_balances_count <> ${payload.shift_balance_entries.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Shift balance entries count mismatch: expected ${payload.shift_balance_entries.length}, got %', actual_balances_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_roster_shifts_count FROM public.roster_shifts;`);
  lines.push(`    IF actual_roster_shifts_count <> ${payload.roster_shifts.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Roster shifts count mismatch: expected ${payload.roster_shifts.length}, got %', actual_roster_shifts_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_roster_models_count FROM public.roster_shift_models;`);
  lines.push(`    IF actual_roster_models_count <> ${payload.roster_shift_models.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'Roster shift models junction count mismatch: expected ${payload.roster_shift_models.length}, got %', actual_roster_models_count;`);
  lines.push('    END IF;');
  lines.push('');
  lines.push(`    SELECT count(*) INTO actual_pnl_count FROM public.v_period_agency_pnl;`);
  lines.push(`    IF actual_pnl_count <> ${payload.accounting_periods.length} THEN`);
  lines.push(`        RAISE EXCEPTION 'P&L view count mismatch: expected ${payload.accounting_periods.length}, got %', actual_pnl_count;`);
  lines.push('    END IF;');
  lines.push('END $$;');
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  return lines.join('\n');
}

/**
 * Main function when executed as standalone script
 */
export async function runMigrationPreparation(
  state: AppState,
  outputSqlPath?: string,
  updatedAt?: string,
  rawStateJson?: string
) {
  console.log('====================================================================');
  console.log('🚀 PREPARING PRODUCTION RELATIONAL MIGRATION');
  console.log('====================================================================');

  const rawJson = rawStateJson || JSON.stringify(state);

  // 1. Source Fingerprint
  const fingerprint = computeSourceFingerprint(state, updatedAt, rawJson);
  console.log(`📌 Source Fingerprint:`);
  console.log(`   - Deterministic Hash: ${fingerprint.deterministicHash}`);
  console.log(`   - Snapshot Timestamp: ${fingerprint.snapshotUpdatedAt}`);
  console.log(`   - Source Records: ${fingerprint.sourceRecordCount}`);

  // 2. Transform via Pure Shared Transformer
  console.log('\n⚙️ Executing Pure Transformation Engine...');
  const { payload, context, warnings } = transformAppStateToRelational(state);

  if (warnings.length > 0) {
    console.warn('⚠️ Transformation Warnings:', warnings);
  }

  // 3. Post-Migration Financial Reconciliation
  console.log('\n📊 Running Full Financial Parity Audit across all Accounting Periods...');
  const reconciliation = runPostMigrationReconciliation(state, payload, context);

  console.log(`   - Checked Periods: ${reconciliation.totalPeriodsChecked}`);
  console.log(`   - Discrepancies: ${reconciliation.periodsWithDiscrepancies}`);
  console.log(`   - Orphan Foreign Keys: ${reconciliation.referentialIntegrity.totalOrphans}`);
  console.log(`   - Reconciliation Status: ${reconciliation.isPassed ? '✅ PASS' : '❌ FAIL'}`);

  if (!reconciliation.isPassed) {
    console.error('❌ MIGRATION PREPARATION ABORTED: Financial reconciliation failed!');
    reconciliation.issues.forEach(iss => console.error(`   - ${iss}`));
    return { success: false, reconciliation, fingerprint, payload };
  }

  // 4. Generate SQL Bundle
  const targetSqlFile = outputSqlPath || path.join(process.cwd(), 'migrations', 'production_migration_bundle.sql');
  const sqlContent = generateAtomicSqlBundle(payload, fingerprint, rawJson);
  fs.writeFileSync(targetSqlFile, sqlContent, 'utf-8');

  console.log(`\n💾 Generated Atomic Migration Bundle:`);
  console.log(`   - File: ${targetSqlFile}`);
  console.log(`   - Total Size: ${(sqlContent.length / 1024).toFixed(1)} KB`);
  console.log(`   - Total SQL Lines: ${sqlContent.split('\n').length}`);

  console.log('\n📋 Target Table Row Counts:');
  Object.entries(payload).forEach(([table, rows]) => {
    console.log(`   - ${table.padEnd(25)} : ${rows.length}`);
  });

  console.log('\n✅ All pre-migration checks and SQL bundle preparation completed successfully.');
  console.log('🛑 PAUSED: Awaiting explicit user confirmation before Supabase execution.');

  return {
    success: true,
    fingerprint,
    payload,
    reconciliation,
    targetSqlFile,
  };
}

if (process.argv[1] && process.argv[1].endsWith('execute_migration.ts')) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      let sourcePath = '';
      let url = process.env.SUPABASE_URL || '';
      let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

      args.forEach(arg => {
        if (arg.startsWith('--source=')) sourcePath = arg.split('=')[1];
        if (arg.startsWith('--url=')) url = arg.split('=')[1];
        if (arg.startsWith('--key=')) key = arg.split('=')[1];
      });

      if (!url || !key) {
        const creds = await getSupabaseCredentials();
        if (creds) {
          url = creds.url;
          key = creds.key;
        }
      }

      let state: AppState | null = null;
      let updatedAt = new Date().toISOString();
      let rawStateJson = '';

      if (sourcePath && fs.existsSync(sourcePath)) {
        console.log(`📂 Loading state from file: ${sourcePath}`);
        const fileText = fs.readFileSync(sourcePath, 'utf-8');
        const raw = JSON.parse(fileText);
        state = raw.state || raw;
        updatedAt = raw.updated_at || state?.lastUpdated || updatedAt;
        rawStateJson = JSON.stringify(state);
      } else if (url && key) {
        console.log(`🌐 Fetching state from Supabase: ${url}`);
        const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/app_storage?id=eq.main&select=id,state,updated_at`, {
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        if (!res.ok) throw new Error(`Supabase request failed: ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (!data || data.length === 0) throw new Error('Record app_storage.main not found!');
        state = data[0].state;
        updatedAt = data[0].updated_at;
        rawStateJson = JSON.stringify(data[0].state);
      }

      if (!state) {
        console.error('❌ Error: No AppState source provided.');
        console.log('Usage:');
        console.log('  npx tsx scripts/execute_migration.ts --url=<SUPABASE_URL> --key=<SUPABASE_KEY>');
        console.log('  npx tsx scripts/execute_migration.ts --source=backup.json');
        process.exit(1);
      }

      await runMigrationPreparation(state, undefined, updatedAt, rawStateJson);
    } catch (e: any) {
      console.error('❌ Execution Error:', e.message);
      process.exit(1);
    }
  })();
}

