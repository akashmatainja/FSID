export interface Company {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  user_count?: number;
  machine_count?: number;
  role_count?: number;
  stats_count?: number;
  branch_count?: number;
  branches?: Branch[];
}

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  status: "active" | "inactive" | "maintenance";
  created_at: string;
  updated_at: string;
  company?: Company;
  machines?: Machine[];
  subdivisions?: Subdivision[];
}

export interface Subdivision {
  id: string;
  company_id: string;
  branch_id: string;
  name: string;
  code: string;
  description: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  company?: Company;
  branch?: Branch;
  machines?: Machine[];
}

export interface Module {
  id: string;
  name: string;
  code: string;
  description: string;
  unit: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  machines?: Machine[];
}

export interface CompanyUser {
  id: string;
  company_id: string;
  branch_id?: string;
  subdivision_id?: string;
  auth_user_id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  created_at: string;
  user_roles?: UserRole[];
  machine_assignments?: MachineAssignment[];
  company?: Company;
  branch?: Branch;
  subdivision?: Subdivision;
  permissions?: Record<string, boolean>; // For superadmin direct permissions
}

export interface Role {
  id: string;
  company_id: string;
  name: string;
  description: string;
  created_at: string;
  company?: Company;
  role_permissions?: RolePermission[];
}

export interface Permission {
  id: string;
  key: string;
  description: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  permission?: Permission;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  role?: Role;
}

export interface Machine {
  id: string;
  company_id: string;
  branch_id: string;
  subdivision_id?: string;
  module_ids?: string[];
  name: string;
  code: string;
  location: string;
  status: "active" | "inactive" | "maintenance";
  
  // Equipment Information
  equipment_type: string;      // Motor, Pump, Compressor, etc.
  manufacturer?: string;       // Equipment manufacturer
  model_number?: string;       // Model number
  installation_date?: string;  // Installation date
  
  // Energy Monitoring Fields
  rated_power: number;         // kW
  voltage_rating: string;      // 230V, 415V, etc.
  phase?: string;              // Phase information
  energy_meter_id: string;     // IoT sensor/meter ID
  operating_hours: number;     // Hours per day
  
  // Energy Management
  baseline_consumption?: string;
  energy_cost_rate?: string;
  efficiency_target?: string;
  
  // Solar Integration
  solar_compatible?: string;
  solar_priority?: string;
  
  // Maintenance & Monitoring
  maintenance_schedule?: string;
  critical_equipment?: string;
  sub_unit_monitoring?: string;
  
  created_at: string;
  company?: Company;
  branch?: Branch;
  subdivision?: Subdivision;
  modules?: Module[];
}

export interface UserMachine {
  user_id: string;
  machine_id: string;
  assigned_at: string;
  machine?: Machine;
}

export interface MachineStat {
  id: string;
  company_id: string;
  machine_id: string;
  ts: string;
  metric_key: string;
  metric_value: number;
  meta?: Record<string, unknown>;
}

export interface DashboardSummary {
  total_machines: number;
  active_machines: number;
  total_stats: number;
  latest_stats: LatestMachineStat[];
}

export interface LatestMachineStat {
  machine_id: string;
  machine_name: string;
  machine_code: string;
  metric_key: string;
  metric_value: number;
  ts: string;
}

export interface MachineAssignment {
  machine_id: string;
  user_id: string;
  assigned_at: string;
  machine?: Machine;
}

export type MetricKey = "power" | "energy" | "voltage" | "current" | "power_factor" | "temperature" | "rpm" | "vibration" | "pressure";

export const METRIC_UNITS: Record<MetricKey, string> = {
  power: "kW",
  energy: "kWh",
  voltage: "V",
  current: "A",
  power_factor: "",
  temperature: "°C",
  rpm: "RPM",
  vibration: "mm/s",
  pressure: "bar",
};

export const METRIC_COLORS: Record<MetricKey, string> = {
  power: "#3b82f6",
  energy: "#10b981",
  voltage: "#f59e0b",
  current: "#ef4444",
  power_factor: "#8b5cf6",
  temperature: "#ec4899",
  rpm: "#06b6d4",
  vibration: "#f97316",
  pressure: "#a855f7",
};

export type DateRange = "15m" | "1h" | "24h" | "7d" | "custom";
