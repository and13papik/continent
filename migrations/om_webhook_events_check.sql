-- ============================================================================
-- READ-ONLY SCHEMA & INDEX DIAGNOSTIC SCRIPT FOR public.om_webhook_events
--
-- ПРИМЕЧАНИЕ О ДОСТУПЕ К СХЕМЕ:
-- Прямого доступа к схеме рабочей базы нет: в репозитории отсутствуют исходные
-- DDL-миграции создания таблицы public.om_webhook_events, а автоматическое
-- выполнение SQL на рабочей базе строго запрещено требованиями пользователя.
-- Индекс idx_om_webhook_events_id_asc НЕ доказывает тип данных и монотонность ID
-- (индекс b-tree может быть построен по uuid, bigint, integer или text).
--
-- НАЗНАЧЕНИЕ СКРИПТА:
-- Подготовлен отдельный read-only SELECT для проверки фактического типа,
-- column_default, identity и sequence столбца id — БЕЗ автоматического выполнения.
-- Запуск выполняется вручную администратором в Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ЦЕЛЕВОЙ SELECT: Проверка типа, column_default, identity и sequence столбца id
-- ----------------------------------------------------------------------------
SELECT 
    table_schema,
    table_name,
    column_name, 
    data_type, 
    udt_name,
    is_nullable, 
    column_default,
    is_identity,
    identity_generation,
    identity_start,
    identity_increment,
    pg_get_serial_sequence('public.om_webhook_events', 'id') AS sequence_name
FROM information_schema.columns
WHERE table_name = 'om_webhook_events' AND column_name = 'id';

-- ----------------------------------------------------------------------------
-- 2. Все столбцы таблицы public.om_webhook_events (типы, default, nullability)
-- ----------------------------------------------------------------------------
SELECT 
    column_name, 
    data_type, 
    udt_name,
    is_nullable, 
    column_default,
    is_identity,
    identity_generation
FROM information_schema.columns
WHERE table_name = 'om_webhook_events'
ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 3. Существующие индексы на om_webhook_events
-- ----------------------------------------------------------------------------
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'om_webhook_events'
ORDER BY indexname;

-- ----------------------------------------------------------------------------
-- 4. Ограничения (PRIMARY KEY, UNIQUE, FOREIGN KEY)
-- ----------------------------------------------------------------------------
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'om_webhook_events'
ORDER BY conname;

-- ----------------------------------------------------------------------------
-- 5. Проверка дубликатов по dedup_key
-- ----------------------------------------------------------------------------
SELECT 
    dedup_key, 
    count(*) AS occurrences,
    min(received_at) AS first_received_at,
    max(received_at) AS last_received_at
FROM public.om_webhook_events
WHERE dedup_key IS NOT NULL
GROUP BY dedup_key
HAVING count(*) > 1
ORDER BY count(*) DESC
LIMIT 50;
