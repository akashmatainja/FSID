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
}

export interface CompanyUser {
  id: string;
  company_id: string;
  auth_user_id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  created_at: string;
  user_roles?: UserRole[];
  machine_assignments?: MachineAssignment[];
  company?: Company;
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
  name: string;
  code: string;
  location: string;
  status: "active" | "inactive" | "maintenance";
  created_at: string;
  company?: Company;
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

export type MetricKey = "temperature" | "rpm" | "vibration" | "energy" | "pressure";

export const METRIC_UNITS: Record<MetricKey, string> = {
  temperature: "°C",
  rpm: "RPM",
  vibration: "mm/s",
  energy: "kWh",
  pressure: "bar",
};

export const METRIC_COLORS: Record<MetricKey, string> = {
  temperature: "#ef4444",
  rpm: "#3b82f6",
  vibration: "#f59e0b",
  energy: "#10b981",
  pressure: "#8b5cf6",
};

export type DateRange = "15m" | "1h" | "24h" | "7d" | "custom";
