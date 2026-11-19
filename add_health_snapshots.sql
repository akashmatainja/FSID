-- ============================================================================
-- Predictive health score history
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- Requires add_metric_limits_and_alerts.sql to have been applied first.
--
-- The backend (health.StartSnapshots) writes one row per machine per hour:
-- it recomputes every 15 minutes and upserts the current hour, so a finished
-- hour keeps its final value. Rows older than ~13 months are deleted by the
-- same job. Machines without a score (no limits or no data) get no row.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS machine_health_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_id      UUID NOT NULL REFERENCES machines(id)  ON DELETE CASCADE,
    module_id       UUID REFERENCES modules(id) ON DELETE SET NULL,
    captured_at     TIMESTAMPTZ NOT NULL,               -- start of the hour (UTC)
    score           SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    status          TEXT NOT NULL CHECK (status IN ('good', 'watch', 'critical')),
    hours_to_limit  DOUBLE PRECISION,                    -- NULL = stable / not trending to a limit
    open_critical   INTEGER NOT NULL DEFAULT 0,
    open_warning    INTEGER NOT NULL DEFAULT 0,
    metrics         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{code, score, latest, hours_to_limit}]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT machine_health_snapshots_machine_hour UNIQUE (machine_id, captured_at)
);

CREATE INDEX IF NOT EXISTS machine_health_snapshots_company_time
    ON machine_health_snapshots (company_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS machine_health_snapshots_captured
    ON machine_health_snapshots (captured_at);

-- Read only through the Go API (table owner, bypasses RLS); block the anon key.
ALTER TABLE machine_health_snapshots ENABLE ROW LEVEL SECURITY;

COMMIT;
