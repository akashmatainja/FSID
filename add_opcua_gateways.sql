-- ============================================================================
-- OPC UA edge gateways
--
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- An edge gateway is a small program (see gateway/README.md) running on a PC
-- inside the plant. It reads the plant's OPC UA server and pushes readings to
-- the backend over HTTPS, authenticating with a per-gateway API key.
--
--   opcua_gateways        one row per gateway; only a SHA-256 hash of the key is stored
--   machine_opcua         which gateway reads a machine (NULL = not read)
--   machine_metric_nodes  per-machine OPC UA node ID for a metric; overrides the
--                         metric's node_id template (module_metrics.node_id)
--
-- module_metrics.node_id (already exists) is used as a template, e.g.
--   ns=2;s={machine_code}.Voltage
-- Placeholders: {machine_code}, {machine_name}, {metric_code}.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS opcua_gateways (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name                   TEXT NOT NULL,
    key_prefix             TEXT NOT NULL,              -- first characters of the key, for display
    key_hash               TEXT NOT NULL UNIQUE,       -- hex SHA-256 of the full key
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    poll_interval_seconds  INT NOT NULL DEFAULT 5 CHECK (poll_interval_seconds BETWEEN 1 AND 3600),
    last_seen_at           TIMESTAMPTZ,
    last_ip                TEXT,
    agent_version          TEXT,
    status                 JSONB,                      -- last report from the gateway
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opcua_gateways_company ON opcua_gateways (company_id);

CREATE TABLE IF NOT EXISTS machine_opcua (
    machine_id  UUID PRIMARY KEY REFERENCES machines(id) ON DELETE CASCADE,
    gateway_id  UUID REFERENCES opcua_gateways(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machine_opcua_gateway ON machine_opcua (gateway_id);

CREATE TABLE IF NOT EXISTS machine_metric_nodes (
    machine_id  UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    metric_id   UUID NOT NULL REFERENCES module_metrics(id) ON DELETE CASCADE,
    node_id     TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (machine_id, metric_id)
);

-- Read and written only through the Go API (table owner, bypasses RLS); block the anon key.
ALTER TABLE opcua_gateways       ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_opcua        ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_metric_nodes ENABLE ROW LEVEL SECURITY;

COMMIT;
