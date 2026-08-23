-- ============================================================================
-- RELATIONAL CRM TARGET SCHEMA (PHASE 2 - FINAL DRAFT)
-- Safe, Normalized, Multi-Tenant Accounting Architecture
-- NOTE: DO NOT EXECUTE MANUALLY UNTIL DRY-RUN IS FULLY APPROVED.
-- ============================================================================

-- 1. ACCOUNTING PERIODS
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_dates ON public.accounting_periods(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_status ON public.accounting_periods(status);

-- 2. OPERATORS
CREATE TABLE IF NOT EXISTS public.operators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. MODELS
CREATE TABLE IF NOT EXISTS public.models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    default_rate_of NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    default_rate_pp NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    default_rate_crypto NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. OWNERS
CREATE TABLE IF NOT EXISTS public.owners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ADMINS
CREATE TABLE IF NOT EXISTS public.admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. OWNER PERIOD SHARES
CREATE TABLE IF NOT EXISTS public.owner_period_shares (
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    owner_id TEXT NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
    share_percent NUMERIC(5, 2) NOT NULL DEFAULT 50.00 CHECK (share_percent >= 0 AND share_percent <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (period_id, owner_id)
);

-- 7. MODEL PERIOD RATES (Historical rates per period/model)
CREATE TABLE IF NOT EXISTS public.model_period_rates (
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    model_id TEXT NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
    rate_of NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    rate_pp NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    rate_crypto NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (period_id, model_id)
);

-- 8. ADMIN PERIOD RATES (Historical individual admin rates per period)
CREATE TABLE IF NOT EXISTS public.admin_period_rates (
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    admin_id TEXT NOT NULL REFERENCES public.admins(id) ON DELETE RESTRICT,
    rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (period_id, admin_id)
);

-- 9. INCOME RECORDS (Shift Primary Facts)
CREATE TABLE IF NOT EXISTS public.income_records (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    shift_index INT NOT NULL CHECK (shift_index IN (0, 1, 2, 3)),
    operator_id TEXT NOT NULL REFERENCES public.operators(id) ON DELETE RESTRICT,
    model_id TEXT NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
    operator_name_snapshot TEXT NOT NULL,
    model_name_snapshot TEXT NOT NULL,
    onlyfans_gross NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    paypal_gross NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    crypto_gross NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    percent_of NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    percent_pp NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    percent_crypto NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_income_period_date ON public.income_records(period_id, date);
CREATE INDEX IF NOT EXISTS idx_income_operator ON public.income_records(period_id, operator_id);
CREATE INDEX IF NOT EXISTS idx_income_model ON public.income_records(period_id, model_id);

-- 10. FINANCIAL OPERATIONS (Advances, Penalties, Bonuses, Payments, Refunds, Training)
CREATE TABLE IF NOT EXISTS public.financial_operations (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('advance', 'penalty', 'bonus', 'salary_payment', 'refund', 'training', 'internship')),
    target_type TEXT NOT NULL CHECK (target_type IN ('operator', 'model', 'admin')),
    operator_id TEXT REFERENCES public.operators(id) ON DELETE RESTRICT,
    model_id TEXT REFERENCES public.models(id) ON DELETE RESTRICT,
    admin_id TEXT REFERENCES public.admins(id) ON DELETE RESTRICT,
    target_name_snapshot TEXT NOT NULL,
    related_model_id TEXT REFERENCES public.models(id) ON DELETE RESTRICT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    comment TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_fin_ops_target CHECK (
        (target_type = 'operator' AND operator_id IS NOT NULL) OR
        (target_type = 'model' AND model_id IS NOT NULL) OR
        (target_type = 'admin' AND admin_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_fin_ops_period_target ON public.financial_operations(period_id, target_type, operator_id, model_id, admin_id);
CREATE INDEX IF NOT EXISTS idx_fin_ops_period_type ON public.financial_operations(period_id, type);

-- 11. AGENCY TRANSACTIONS (Expenses & Manual Incomes)
CREATE TABLE IF NOT EXISTS public.agency_transactions (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('expense', 'income')),
    category TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'Other',
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    comment TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agency_tx_period ON public.agency_transactions(period_id, direction);

-- 12. OWNER DRAWS
CREATE TABLE IF NOT EXISTS public.owner_draws (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    owner_id TEXT NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
    platform TEXT NOT NULL DEFAULT 'Crypto',
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    comment TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_owner_draws_period ON public.owner_draws(period_id, owner_id);

-- 13. MODEL PERIOD BONUSES
CREATE TABLE IF NOT EXISTS public.model_period_bonuses (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    model_id TEXT NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    comment TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. PAYOUT SETTLEMENT FLAGS
CREATE TABLE IF NOT EXISTS public.payout_settlement_flags (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    target_type TEXT NOT NULL CHECK (target_type IN ('operator', 'model', 'admin')),
    operator_id TEXT REFERENCES public.operators(id) ON DELETE RESTRICT,
    model_id TEXT REFERENCES public.models(id) ON DELETE RESTRICT,
    admin_id TEXT REFERENCES public.admins(id) ON DELETE RESTRICT,
    is_settled BOOLEAN NOT NULL DEFAULT true,
    settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INT NOT NULL DEFAULT 1,
    CONSTRAINT uq_settlement_flag UNIQUE (period_id, target_type, operator_id, model_id, admin_id),
    CONSTRAINT chk_settlement_target CHECK (
        (target_type = 'operator' AND operator_id IS NOT NULL) OR
        (target_type = 'model' AND model_id IS NOT NULL) OR
        (target_type = 'admin' AND admin_id IS NOT NULL)
    )
);

-- 15. MODEL MONTHLY PLANS
CREATE TABLE IF NOT EXISTS public.model_monthly_plans (
    id TEXT PRIMARY KEY,
    month_key TEXT NOT NULL,
    model_id TEXT NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
    plan_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_model_monthly_plan UNIQUE (month_key, model_id)
);

-- 16. SHIFT BALANCE ENTRIES (TotalTable)
CREATE TABLE IF NOT EXISTS public.shift_balance_entries (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    model_id TEXT NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
    shift_index INT NOT NULL CHECK (shift_index IN (0, 1, 2, 3)),
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. ROSTER SHIFTS & JUNCTION
CREATE TABLE IF NOT EXISTS public.roster_shifts (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    shift_index INT NOT NULL CHECK (shift_index IN (0, 1, 2, 3)),
    operator_id TEXT NOT NULL REFERENCES public.operators(id) ON DELETE RESTRICT,
    is_trainee BOOLEAN NOT NULL DEFAULT false,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roster_shift_models (
    roster_shift_id TEXT NOT NULL REFERENCES public.roster_shifts(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (roster_shift_id, model_id)
);
CREATE INDEX IF NOT EXISTS idx_roster_shift_models_model ON public.roster_shift_models(model_id);

-- ============================================================================
-- SQL VIEWS: 100% PRODUCTION FORMULAS MATCHING CURRENT CRM
-- ============================================================================

-- View: Operator Financial Summary per Period
CREATE OR REPLACE VIEW public.v_operator_period_accounting AS
WITH shift_accruals AS (
    SELECT 
        period_id,
        operator_id,
        SUM((onlyfans_gross * percent_of / 100.0) + (paypal_gross * percent_pp / 100.0) + (crypto_gross * percent_crypto / 100.0)) AS shift_net_total,
        SUM(onlyfans_gross + paypal_gross + crypto_gross) AS shift_gross_total
    FROM public.income_records
    GROUP BY period_id, operator_id
),
op_operations AS (
    SELECT 
        period_id,
        operator_id,
        COALESCE(SUM(CASE WHEN type = 'advance' THEN amount ELSE 0 END), 0) AS total_advances,
        COALESCE(SUM(CASE WHEN type = 'penalty' THEN amount ELSE 0 END), 0) AS total_penalties,
        COALESCE(SUM(CASE WHEN type = 'bonus' THEN amount ELSE 0 END), 0) AS total_bonuses,
        COALESCE(SUM(CASE WHEN type = 'training' THEN amount ELSE 0 END), 0) AS total_training,
        COALESCE(SUM(CASE WHEN type = 'salary_payment' THEN amount ELSE 0 END), 0) AS total_paid
    FROM public.financial_operations
    WHERE target_type = 'operator'
    GROUP BY period_id, operator_id
)
SELECT 
    p.id AS period_id,
    o.id AS operator_id,
    o.name AS operator_name,
    COALESCE(sa.shift_gross_total, 0) AS gross_total,
    COALESCE(sa.shift_net_total, 0) + COALESCE(oo.total_bonuses, 0) - COALESCE(oo.total_penalties, 0) - COALESCE(oo.total_training, 0) AS total_accrued,
    COALESCE(oo.total_advances, 0) AS total_advances,
    COALESCE(oo.total_paid, 0) AS total_paid,
    (COALESCE(sa.shift_net_total, 0) + COALESCE(oo.total_bonuses, 0) - COALESCE(oo.total_penalties, 0) - COALESCE(oo.total_training, 0)) - COALESCE(oo.total_advances, 0) - COALESCE(oo.total_paid, 0) AS balance_due,
    COALESCE(ps.is_settled, false) AS is_settled
FROM public.accounting_periods p
CROSS JOIN public.operators o
LEFT JOIN shift_accruals sa ON sa.period_id = p.id AND sa.operator_id = o.id
LEFT JOIN op_operations oo ON oo.period_id = p.id AND oo.operator_id = o.id
LEFT JOIN public.payout_settlement_flags ps ON ps.period_id = p.id AND ps.target_type = 'operator' AND ps.operator_id = o.id;

-- View: Model Financial Summary per Period (using exact model_period_rates)
CREATE OR REPLACE VIEW public.v_model_period_accounting AS
WITH model_shifts AS (
    SELECT 
        i.period_id,
        i.model_id,
        SUM(i.onlyfans_gross) AS of_gross,
        SUM(i.paypal_gross) AS pp_gross,
        SUM(i.crypto_gross) AS cr_gross,
        SUM(i.onlyfans_gross + i.paypal_gross + i.crypto_gross) AS total_gross
    FROM public.income_records i
    GROUP BY i.period_id, i.model_id
),
model_bonuses_sum AS (
    SELECT period_id, model_id, SUM(amount) AS total_bonus
    FROM public.model_period_bonuses
    GROUP BY period_id, model_id
),
model_ops AS (
    SELECT 
        period_id,
        model_id,
        COALESCE(SUM(CASE WHEN type = 'advance' THEN amount ELSE 0 END), 0) AS total_advances,
        COALESCE(SUM(CASE WHEN type = 'penalty' THEN amount ELSE 0 END), 0) AS total_penalties,
        COALESCE(SUM(CASE WHEN type = 'salary_payment' THEN amount ELSE 0 END), 0) AS total_paid
    FROM public.financial_operations
    WHERE target_type = 'model'
    GROUP BY period_id, model_id
)
SELECT 
    p.id AS period_id,
    m.id AS model_id,
    m.name AS model_name,
    COALESCE(ms.total_gross, 0) AS gross_total,
    (
        COALESCE(ms.of_gross, 0) * COALESCE(mpr.rate_of, m.default_rate_of) / 100.0 +
        COALESCE(ms.pp_gross, 0) * COALESCE(mpr.rate_pp, m.default_rate_pp) / 100.0 +
        COALESCE(ms.cr_gross, 0) * COALESCE(mpr.rate_crypto, m.default_rate_crypto) / 100.0 +
        COALESCE(mb.total_bonus, 0) - COALESCE(mo.total_penalties, 0)
    ) AS total_accrued,
    COALESCE(mo.total_advances, 0) AS total_advances,
    COALESCE(mo.total_paid, 0) AS total_paid,
    (
        COALESCE(ms.of_gross, 0) * COALESCE(mpr.rate_of, m.default_rate_of) / 100.0 +
        COALESCE(ms.pp_gross, 0) * COALESCE(mpr.rate_pp, m.default_rate_pp) / 100.0 +
        COALESCE(ms.cr_gross, 0) * COALESCE(mpr.rate_crypto, m.default_rate_crypto) / 100.0 +
        COALESCE(mb.total_bonus, 0) - COALESCE(mo.total_penalties, 0)
    ) - COALESCE(mo.total_advances, 0) - COALESCE(mo.total_paid, 0) AS balance_due,
    COALESCE(ps.is_settled, false) AS is_settled
FROM public.accounting_periods p
CROSS JOIN public.models m
LEFT JOIN public.model_period_rates mpr ON mpr.period_id = p.id AND mpr.model_id = m.id
LEFT JOIN model_shifts ms ON ms.period_id = p.id AND ms.model_id = m.id
LEFT JOIN model_bonuses_sum mb ON mb.period_id = p.id AND mb.model_id = m.id
LEFT JOIN model_ops mo ON mo.period_id = p.id AND mo.model_id = m.id
LEFT JOIN public.payout_settlement_flags ps ON ps.period_id = p.id AND ps.target_type = 'model' AND ps.model_id = m.id;

-- View: Period Comprehensive Agency P&L
CREATE OR REPLACE VIEW public.v_period_agency_pnl AS
WITH period_gross AS (
    SELECT 
        period_id,
        SUM(onlyfans_gross + paypal_gross + crypto_gross) AS primary_gross
    FROM public.income_records
    GROUP BY period_id
),
period_manual_incomes AS (
    SELECT period_id, SUM(amount) AS manual_income
    FROM public.agency_transactions
    WHERE direction = 'income'
    GROUP BY period_id
),
period_expenses AS (
    SELECT period_id, SUM(amount) AS agency_expenses
    FROM public.agency_transactions
    WHERE direction = 'expense'
    GROUP BY period_id
),
period_staff_accrued AS (
    SELECT period_id, SUM(total_accrued) AS staff_pool
    FROM public.v_operator_period_accounting
    GROUP BY period_id
),
period_model_accrued AS (
    SELECT period_id, SUM(total_accrued) AS model_pool
    FROM public.v_model_period_accounting
    GROUP BY period_id
),
period_admin_pool AS (
    SELECT 
        apr.period_id,
        SUM(COALESCE(pg.primary_gross, 0) * apr.rate_percent / 100.0) AS admin_pool
    FROM public.admin_period_rates apr
    LEFT JOIN period_gross pg ON pg.period_id = apr.period_id
    GROUP BY apr.period_id
)
SELECT 
    p.id AS period_id,
    p.label AS period_label,
    p.status,
    COALESCE(pg.primary_gross, 0) + COALESCE(pmi.manual_income, 0) AS gross_revenue,
    COALESCE(psa.staff_pool, 0) AS staff_accruals,
    COALESCE(pma.model_pool, 0) AS model_accruals,
    COALESCE(pap.admin_pool, 0) AS admin_pool,
    COALESCE(pe.agency_expenses, 0) AS agency_expenses,
    (
        (COALESCE(pg.primary_gross, 0) + COALESCE(pmi.manual_income, 0)) -
        (COALESCE(psa.staff_pool, 0) + COALESCE(pma.model_pool, 0) + COALESCE(pap.admin_pool, 0) + COALESCE(pe.agency_expenses, 0))
    ) AS net_agency_profit
FROM public.accounting_periods p
LEFT JOIN period_gross pg ON pg.period_id = p.id
LEFT JOIN period_manual_incomes pmi ON pmi.period_id = p.id
LEFT JOIN period_expenses pe ON pe.period_id = p.id
LEFT JOIN period_staff_accrued psa ON psa.period_id = p.id
LEFT JOIN period_model_accrued pma ON pma.period_id = p.id
LEFT JOIN period_admin_pool pap ON pap.period_id = p.id;

