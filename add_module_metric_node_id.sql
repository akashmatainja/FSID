-- Adds module_metrics.node_id, the OPC UA node template used by gateways
-- (e.g. ns=2;s={machine_code}.Voltage). add_opcua_gateways.sql assumed this
-- column already existed; without it, creating or updating a metric fails.
-- Empty string = metric is not read from OPC UA (the Go model is a plain string,
-- so the column must not be NULL).

ALTER TABLE module_metrics
    ADD COLUMN IF NOT EXISTS node_id TEXT NOT NULL DEFAULT '';
