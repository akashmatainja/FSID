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

export interface ModuleMetric {
  id: string;
  module_id: string;
  name: string;
  code: string;
  unit: string;
  /** OPC UA node template, e.g. ns=2;s={machine_code}.Voltage (empty = not read). */
  node_id?: string;
  /** Alert limits; null/undefined = not checked. */
  warn_min?: number | null;
  warn_max?: number | null;
  crit_min?: number | null;
  crit_max?: number | null;
  created_at: string;
  updated_at: string;
}

export type AlertSeverity = "warning" | "critical";

export interface Alert {
  id: string;
  company_id: string;
  machine_id: string;
  module_id: string | null;
  metric_id: string | null;
  metric_key: string;
  severity: AlertSeverity;
  direction: "high" | "low";
  trigger_value: number;
  peak_value: number;
  limit_value: number;
  unit: string;
  message: string;
  status: "open" | "resolved";
  started_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  machine_name: string;
  machine_code: string;
  module_code: string;
  module_name: string;
}

export interface OverviewMetric {
  metric_id: string;
  code: string;
  name: string;
  unit: string;
  warn_min: number | null;
  warn_max: number | null;
  crit_min: number | null;
  crit_max: number | null;
  samples: number;
  in_limits: number;
  compliance: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface OverviewMachineMetric {
  machine_id: string;
  metric_id: string;
  samples: number;
  in_limits: number;
  compliance: number | null;
  avg: number;
  min: number;
  max: number;
}

export interface OverviewModule {
  module_id: string;
  code: string;
  name: string;
  machine_count: number;
  compliance: number | null;
  open_alerts: number;
  critical: number;
  warning: number;
  metrics: OverviewMetric[];
  per_machine: OverviewMachineMetric[];
}

export interface DashboardOverview {
  since: string;
  until: string;
  alerts: { open: number; critical: number; warning: number };
  modules: OverviewModule[];
}

export interface Module {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  metrics?: ModuleMetric[];
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

export type HealthStatus = "good" | "watch" | "critical" | "unknown";

export interface HealthMetric {
  metric_id: string;
  code: string;
  name: string;
  unit: string;
  latest: number | null;
  samples: number;
  has_data: boolean;
  score: number;
  /** Stress of the latest reading, 0 (healthy) … 1 (far past critical). */
  condition: number;
  out_of_limits_pct: number;
  /** Extra stress if the 24 h trend continues, 0 … 1. */
  trend: number;
  slope_per_hour: number | null;
  hours_to_limit: number | null;
  projected_24h: number | null;
}

export interface MachineHealth {
  machine_id: string;
  code: string;
  name: string;
  score: number | null;
  status: HealthStatus;
  hours_to_limit: number | null;
  limit_metric?: string;
  open_critical: number;
  open_warning: number;
  metrics: HealthMetric[];
}

export interface PredictiveHealth {
  since: string;
  until: string;
  machines: MachineHealth[];
}

export interface HealthHistoryPoint {
  ts: string;
  /** Hourly score, or the daily average when bucket = day. */
  score: number;
  /** Lowest hourly score in the bucket. */
  min_score: number;
  status: Exclude<HealthStatus, "unknown">;
  hours_to_limit: number | null;
  open_critical: number;
  open_warning: number;
}

export interface HealthHistory {
  since: string;
  until: string;
  bucket: "hour" | "day";
  machines: { machine_id: string; code: string; name: string; points: HealthHistoryPoint[] }[];
}

/** One historical reading from GET /api/v1/logs/readings. */
export type ReadingStatus = "normal" | "warning" | "critical" | "no_limits" | "unknown";

export interface ReadingLog {
  id: string;
  ts: string;
  machine_id: string;
  machine_name: string;
  machine_code: string;
  metric_key: string;
  metric_name: string | null;
  unit: string | null;
  module_name: string | null;
  module_code: string | null;
  metric_value: number;
  status: ReadingStatus;
}

export interface ReadingLogPage {
  items: ReadingLog[];
  total: number;
  page: number;
  page_size: number;
  from: string;
  to: string;
}

// ─── OPC UA edge gateways ───────────────────────────────────────────────────

export interface GatewayNodeProblem {
  machine_code: string;
  metric_key: string;
  node_id: string;
  error: string;
}

/** Last health report sent by the gateway agent (free-form, all optional). */
export interface GatewayStatus {
  agent_version?: string;
  hostname?: string;
  opcua_endpoint?: string;
  security_policy?: string;
  security_mode?: string;
  opcua_connected?: boolean;
  opcua_error?: string;
  nodes_ok?: number;
  nodes_bad?: number;
  node_problems?: GatewayNodeProblem[];
  buffered?: number;
  dropped?: number;
  readings_sent?: number;
  upload_error?: string;
  last_poll_at?: string;
  last_upload_at?: string;
  reported_at?: string;
}

export interface Gateway {
  id: string;
  company_id: string;
  company_name: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  poll_interval_seconds: number;
  last_seen_at: string | null;
  last_ip: string | null;
  agent_version: string | null;
  status: GatewayStatus | null;
  machine_count: number;
  online: boolean;
  created_at: string;
}

export interface MachineMetricNode {
  metric_id: string;
  metric_code: string;
  metric_name: string;
  unit: string;
  module_name: string;
  /** Module-level template (module_metrics.node_id). */
  template: string;
  /** Per-machine override, if set. */
  override: string | null;
  /** What the gateway will actually read ("" = not read). */
  effective: string;
}

export interface MachineOpcua {
  gateway_id: string | null;
  metrics: MachineMetricNode[];
}
