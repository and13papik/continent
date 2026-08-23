-- ============================================================================
-- RELATIONAL CRM TARGET SCHEMA (PHASE 2 - DRAFT)
-- Safe, Normalized, Multi-Tenant Accounting Architecture
-- NOTE: DO NOT EXECUTE MANUALLY UNTIL DRY-RUN IS FULLY APPROVED.
-- ============================================================================

-- 1. ACCOUNTING PERIODS
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    rates_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
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
    rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
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

-- 7. INCOME RECORDS (Shift Primary Facts)
CREATE TABLE IF NOT EXISTS public.income_records (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    shift_index INT NOT NULL CHECK (shift_index IN (0, 1, 2, 3)),
    operator_id TEXT NOT NULL REFERENCES public.operators(id) ON DELETE RESTRICT,
    model_id TEXT NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
    operator_name_snapshot TEXT NOT NULL,
    model_name_snapshot TEXT NOT NULL,
    onlyfans_gross NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (onlyfans_gross >= 0),
    paypal_gross NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (paypal_gross >= 0),
    crypto_gross NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (crypto_gross >= 0),
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

-- 8. FINANCIAL OPERATIONS
CREATE TABLE IF NOT EXISTS public.financial_operations (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('advance', 'penalty', 'bonus', 'salary_payment', 'refund', 'training')),
    target_type TEXT NOT NULL CHECK (target_type IN ('operator', 'model')),
    operator_id TEXT REFERENCES public.operators(id) ON DELETE RESTRICT,
    model_id TEXT REFERENCES public.models(id) ON DELETE RESTRICT,
    target_name_snapshot TEXT NOT NULL,
    related_model_id TEXT REFERENCES public.models(id) ON DELETE RESTRICT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    comment TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_fin_ops_target CHECK (
        (target_type = 'operator' AND operator_id IS NOT NULL) OR
        (target_type = 'model' AND model_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_fin_ops_period_target ON public.financial_operations(period_id, target_type, operator_id, model_id);
CREATE INDEX IF NOT EXISTS idx_fin_ops_period_type ON public.financial_operations(period_id, type);

-- 9. AGENCY TRANSACTIONS (Expenses & Manual Incomes)
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

-- 10. OWNER DRAWS
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

-- 11. MODEL PERIOD BONUSES
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

-- 12. PAYOUT SETTLEMENT FLAGS
CREATE TABLE IF NOT EXISTS public.payout_settlement_flags (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES public.accounting_periods(id) ON DELETE RESTRICT,
    target_type TEXT NOT NULL CHECK (target_type IN ('operator', 'model')),
    operator_id TEXT REFERENCES public.operators(id) ON DELETE RESTRICT,
    model_id TEXT REFERENCES public.models(id) ON DELETE RESTRICT,
    is_settled BOOLEAN NOT NULL DEFAULT true,
    settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INT NOT NULL DEFAULT 1,
    CONSTRAINT uq_settlement_flag UNIQUE (period_id, target_type, operator_id, model_id),
    CONSTRAINT chk_settlement_target CHECK (
        (target_type = 'operator' AND operator_id IS NOT NULL) OR
        (target_type = 'model' AND model_id IS NOT NULL)
    )
);

-- 13. MODEL MONTHLY PLANS
CREATE TABLE IF NOT EXISTS public.model_monthly_plans (
    id TEXT PRIMARY KEY,
    month_key TEXT NOT NULL,
    model_id TEXT NOT NULL REFERENCES public.models(id) ON DELETE RESTRICT,
    plan_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_model_monthly_plan UNIQUE (month_key, model_id)
);

-- 14. SHIFT BALANCE ENTRIES (TotalTable)
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

-- 15. ROSTER SHIFTS & JUNCTION
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
