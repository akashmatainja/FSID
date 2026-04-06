-- ========================================
-- Add energy monitoring fields to machines table
-- Migration to support comprehensive machine energy tracking
-- ========================================

-- Add energy monitoring columns to machines table
ALTER TABLE machines 
ADD COLUMN equipment_type TEXT,
ADD COLUMN rated_power DOUBLE PRECISION,
ADD COLUMN voltage_rating TEXT,
ADD COLUMN energy_meter_id TEXT,
ADD COLUMN operating_hours DOUBLE PRECISION;

-- Add indexes for performance on frequently queried fields
CREATE INDEX idx_machines_equipment_type ON machines(equipment_type) WHERE equipment_type IS NOT NULL;
CREATE INDEX idx_machines_rated_power ON machines(rated_power) WHERE rated_power IS NOT NULL;
CREATE INDEX idx_machines_energy_meter_id ON machines(energy_meter_id) WHERE energy_meter_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN machines.equipment_type IS 'Type of equipment (Motor, Pump, Compressor, etc.)';
COMMENT ON COLUMN machines.rated_power IS 'Rated power consumption in kilowatts (kW)';
COMMENT ON COLUMN machines.voltage_rating IS 'Voltage rating (230V, 415V, etc.)';
COMMENT ON COLUMN machines.energy_meter_id IS 'IoT sensor/meter ID for energy monitoring';
COMMENT ON COLUMN machines.operating_hours IS 'Average operating hours per day';
