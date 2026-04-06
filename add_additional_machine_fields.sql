-- ========================================
-- Add additional machine fields to machines table
-- Migration to support comprehensive machine management
-- ========================================

-- Add additional machine information columns
ALTER TABLE machines 
ADD COLUMN manufacturer TEXT,
ADD COLUMN model_number TEXT,
ADD COLUMN installation_date DATE,
ADD COLUMN maintenance_schedule TEXT,
ADD COLUMN phase TEXT,
ADD COLUMN critical_equipment TEXT,
ADD COLUMN sub_unit_monitoring TEXT,
ADD COLUMN baseline_consumption TEXT,
ADD COLUMN energy_cost_rate TEXT,
ADD COLUMN efficiency_target TEXT,
ADD COLUMN solar_compatible TEXT,
ADD COLUMN solar_priority TEXT,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Add indexes for frequently queried fields
CREATE INDEX idx_machines_manufacturer ON machines(manufacturer) WHERE manufacturer IS NOT NULL;
CREATE INDEX idx_machines_model_number ON machines(model_number) WHERE model_number IS NOT NULL;
CREATE INDEX idx_machines_installation_date ON machines(installation_date) WHERE installation_date IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN machines.manufacturer IS 'Machine manufacturer name';
COMMENT ON COLUMN machines.model_number IS 'Machine model number';
COMMENT ON COLUMN machines.installation_date IS 'Date when machine was installed';
COMMENT ON COLUMN machines.maintenance_schedule IS 'Maintenance schedule information';
COMMENT ON COLUMN machines.phase IS 'Electrical phase (1-phase, 3-phase, etc.)';
COMMENT ON COLUMN machines.critical_equipment IS 'Whether this is critical equipment';
COMMENT ON COLUMN machines.sub_unit_monitoring IS 'Sub-unit monitoring configuration';
COMMENT ON COLUMN machines.baseline_consumption IS 'Baseline energy consumption';
COMMENT ON COLUMN machines.energy_cost_rate IS 'Energy cost rate per unit';
COMMENT ON COLUMN machines.efficiency_target IS 'Target efficiency percentage';
COMMENT ON COLUMN machines.solar_compatible IS 'Whether machine is solar compatible';
COMMENT ON COLUMN machines.solar_priority IS 'Priority for solar power usage';
COMMENT ON COLUMN machines.updated_at IS 'Last update timestamp';
