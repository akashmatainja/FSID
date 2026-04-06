package models

import (
	"time"

	"github.com/google/uuid"
)

// MustParseUUID parses a UUID string or panics
func MustParseUUID(s string) uuid.UUID {
	id, err := uuid.Parse(s)
	if err != nil {
		panic(err)
	}
	return id
}

// NilUUID returns a nil UUID for comparison
func NilUUID() uuid.UUID {
	return uuid.Nil
}

type Company struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug" gorm:"uniqueIndex"`
	Status    string    `json:"status" gorm:"default:active"`
	Metadata  JSONB     `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CompanyUser struct {
	ID             uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	CompanyID      uuid.UUID  `json:"company_id" gorm:"type:uuid;not null"`
	BranchID       *uuid.UUID `json:"branch_id" gorm:"type:uuid"` // Nullable - user assigned to specific branch
	AuthUserID     uuid.UUID  `json:"auth_user_id" gorm:"type:uuid;not null;uniqueIndex"`
	Name           string     `json:"name"`
	Email          string     `json:"email"`
	HashedPassword string     `json:"-" gorm:"column:hashed_password"` // Hidden from JSON
	Status         string     `json:"status" gorm:"default:active"`
	Metadata       JSONB      `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`

	Company            Company             `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
	Branch             *Branch             `json:"branch,omitempty" gorm:"foreignKey:BranchID"`
	UserRoles          []UserRole          `json:"user_roles,omitempty" gorm:"foreignKey:UserID"`
	MachineAssignments []MachineAssignment `json:"machine_assignments,omitempty" gorm:"foreignKey:UserID"`
}

func (CompanyUser) TableName() string { return "company_users" }

// Company Request Models
type CreateCompanyRequest struct {
	Name     string                 `json:"name"`
	Slug     string                 `json:"slug"`
	Status   string                 `json:"status"`
	Metadata map[string]interface{} `json:"metadata"`
}

type UpdateCompanyRequest struct {
	Name     *string                 `json:"name"`
	Slug     *string                 `json:"slug"`
	Status   *string                 `json:"status"`
	Metadata *map[string]interface{} `json:"metadata"`
}

type Role struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	CompanyID   uuid.UUID `json:"company_id" gorm:"type:uuid;not null"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`

	Company         Company          `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
	RolePermissions []RolePermission `json:"role_permissions,omitempty" gorm:"foreignKey:RoleID"`
}

type Permission struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	Key         string    `json:"key" gorm:"uniqueIndex"`
	Description string    `json:"description"`
}

type RolePermission struct {
	RoleID       uuid.UUID  `json:"role_id" gorm:"type:uuid;primaryKey"`
	PermissionID uuid.UUID  `json:"permission_id" gorm:"type:uuid;primaryKey"`
	Permission   Permission `json:"permission,omitempty" gorm:"foreignKey:PermissionID"`
}

type UserRole struct {
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;primaryKey"`
	RoleID uuid.UUID `json:"role_id" gorm:"type:uuid;primaryKey"`
	Role   Role      `json:"role,omitempty" gorm:"foreignKey:RoleID"`
}

type Branch struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	CompanyID uuid.UUID `json:"company_id" gorm:"type:uuid;not null"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	Address   string    `json:"address"`
	City      string    `json:"city"`
	State     string    `json:"state"`
	Pincode   string    `json:"pincode"`
	Phone     string    `json:"phone"`
	Email     string    `json:"email"`
	Status    string    `json:"status" gorm:"default:active"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Company  Company   `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
	Machines []Machine `json:"machines,omitempty" gorm:"foreignKey:BranchID"`
}

type Machine struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	CompanyID uuid.UUID `json:"company_id" gorm:"type:uuid;not null"`
	BranchID  uuid.UUID `json:"branch_id" gorm:"type:uuid"` // Made nullable for backward compatibility
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	Location  string    `json:"location"`
	Status    string    `json:"status" gorm:"default:active"`

	// Energy Monitoring Fields
	EquipmentType  string  `json:"equipment_type"`  // Motor, Pump, Compressor, etc.
	RatedPower     float64 `json:"rated_power"`     // kW
	VoltageRating  string  `json:"voltage_rating"`  // 230V, 415V, etc.
	EnergyMeterID  string  `json:"energy_meter_id"` // IoT sensor/meter ID
	OperatingHours float64 `json:"operating_hours"` // Hours per day

	// Additional Machine Information
	Manufacturer        string    `json:"manufacturer"`
	ModelNumber         string    `json:"model_number"`
	InstallationDate    time.Time `json:"installation_date"`
	MaintenanceSchedule string    `json:"maintenance_schedule"`
	Phase               string    `json:"phase"`
	CriticalEquipment   string    `json:"critical_equipment"`
	SubUnitMonitoring   string    `json:"sub_unit_monitoring"`
	BaselineConsumption string    `json:"baseline_consumption"`
	EfficiencyTarget    string    `json:"efficiency_target"`
	SolarCompatible     string    `json:"solar_compatible"`
	SolarPriority       string    `json:"solar_priority"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Company   Company   `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
	Branch    Branch    `json:"branch,omitempty" gorm:"foreignKey:BranchID"`
}

type MachineAssignment struct {
	MachineID  uuid.UUID `json:"machine_id" gorm:"type:uuid;primaryKey"`
	UserID     uuid.UUID `json:"user_id" gorm:"type:uuid;primaryKey"`
	AssignedAt time.Time `json:"assigned_at"`

	// Relationships for both perspectives
	Machine Machine     `json:"machine,omitempty" gorm:"foreignKey:MachineID"`
	User    CompanyUser `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// Branch Request Models
type CreateBranchRequest struct {
	Name    string `json:"name" validate:"required"`
	Code    string `json:"code" validate:"required"`
	Address string `json:"address"`
	City    string `json:"city"`
	State   string `json:"state"`
	Pincode string `json:"pincode"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
	Status  string `json:"status"`
}

type UpdateBranchRequest struct {
	Name    *string `json:"name"`
	Code    *string `json:"code"`
	Address *string `json:"address"`
	City    *string `json:"city"`
	State   *string `json:"state"`
	Pincode *string `json:"pincode"`
	Phone   *string `json:"phone"`
	Email   *string `json:"email"`
	Status  *string `json:"status"`
}

type MachineStat struct {
	ID          uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	CompanyID   uuid.UUID      `json:"company_id" gorm:"type:uuid;not null"`
	MachineID   uuid.UUID      `json:"machine_id" gorm:"type:uuid;not null"`
	Ts          time.Time      `json:"ts" gorm:"default:now()"`
	MetricKey   string         `json:"metric_key"`
	MetricValue float64        `json:"metric_value"`
	Meta        map[string]any `json:"meta" gorm:"type:jsonb;serializer:json"`
}

// ─── Request / Response DTOs ───────────────────────────────────────────────

type StatIngestionRequest struct {
	MetricKey   string         `json:"metric_key" validate:"required"`
	MetricValue float64        `json:"metric_value" validate:"required"`
	Ts          *time.Time     `json:"ts"`
	Meta        map[string]any `json:"meta"`
}

type DashboardSummary struct {
	TotalMachines  int64               `json:"total_machines"`
	ActiveMachines int64               `json:"active_machines"`
	TotalStats     int64               `json:"total_stats"`
	LatestStats    []LatestMachineStat `json:"latest_stats"`
}

type LatestMachineStat struct {
	MachineID   uuid.UUID `json:"machine_id"`
	MachineName string    `json:"machine_name"`
	MachineCode string    `json:"machine_code"`
	MetricKey   string    `json:"metric_key"`
	MetricValue float64   `json:"metric_value"`
	Ts          time.Time `json:"ts"`
}

// ─── Auth context (stored in Fiber locals) ────────────────────────────────

type AuthContext struct {
	AuthUserID  uuid.UUID
	CompanyUser CompanyUser
	CompanyID   uuid.UUID
	Permissions map[string]bool
}
