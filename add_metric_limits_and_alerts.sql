-- ============================================================================
-- Metric limits + alerts
--
-- Run once in the Supabase SQL editor BEFORE deploying the matching backend.
-- Safe to re-run (IF NOT EXISTS everywhere).
--
-- 1. module_metrics gets four optional limits. A reading is:
--      critical  when value > crit_max or value < crit_min
--      warning   when value > warn_max or value < warn_min
--    Leave a limit NULL to ignore that side. Set them on the Modules page.
--
-- 2. alerts stores one row per limit breach. The backend opens an alert when a
--    reading crosses a limit, escalates it warning → critical, and resolves it
--    when readings return inside the warning limits. At most one OPEN alert
--    exists per (machine, metric, module).
-- ============================================================================

BEGIN;

ALTER TABLE module_metrics
    ADD COLUMN IF NOT EXISTS warn_min DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS warn_max DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS crit_min DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS crit_max DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS alerts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_id       UUID NOT NULL REFERENCES machines(id)  ON DELETE CASCADE,
    module_id        UUID REFERENCES modules(id)        ON DELETE CASCADE,
    metric_id        UUID REFERENCES module_metrics(id) ON DELETE SET NULL,
    metric_key       TEXT NOT NULL,
    severity         TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    direction        TEXT NOT NULL CHECK (direction IN ('high', 'low')),
    trigger_value    DOUBLE PRECISION NOT NULL,
    peak_value       DOUBLE PRECISION NOT NULL,
    limit_value      DOUBLE PRECISION NOT NULL,
    unit             TEXT NOT NULL DEFAULT '',
    message          TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at      TIMESTAMPTZ,
    acknowledged_at  TIMESTAMPTZ,
    acknowledged_by  UUID REFERENCES company_users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One open alert per machine/metric/module; lets the backend upsert safely.
CREATE UNIQUE INDEX IF NOT EXISTS alerts_one_open_per_metric
    ON alerts (machine_id, metric_key, module_id)
    WHERE status = 'open';

CREATE INDEX IF NOT EXISTS alerts_company_status_started
    ON alerts (company_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS alerts_machine_started
    ON alerts (machine_id, started_at DESC);

-- Alerts are only read through the Go API (which connects as the table owner
-- and bypasses RLS). Enabling RLS with no policies blocks direct access with
-- the public anon key.
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ----------------------------------------------------------------------------
-- Optional: example limits. Adjust codes/values to your metrics, then run.
-- ----------------------------------------------------------------------------
-- UPDATE module_metrics SET warn_max = 1000, crit_max = 1500 WHERE lower(code) = 'co2';
-- UPDATE module_metrics SET warn_min = 30, warn_max = 65, crit_max = 75 WHERE lower(code) = 'humidity';
-- UPDATE module_metrics SET warn_max = 4.5, crit_max = 7.1 WHERE lower(code) = 'vibration';   -- ISO 10816 class II
-- UPDATE module_metrics SET warn_min = 0.85, crit_min = 0.80 WHERE lower(code) = 'power_factor';
