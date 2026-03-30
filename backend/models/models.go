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
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	CompanyID      uuid.UUID `json:"company_id" gorm:"type:uuid;not null"`
	AuthUserID     uuid.UUID `json:"auth_user_id" gorm:"type:uuid;not null;uniqueIndex"`
	Name           string    `json:"name"`
	Email          string    `json:"email"`
	HashedPassword string    `json:"-" gorm:"column:hashed_password"` // Hidden from JSON
	Status         string    `json:"status" gorm:"default:active"`
	Metadata       JSONB     `json:"metadata" gorm:"type:jsonb;default:'{}'"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	Company            Company             `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
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

type Machine struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:uuid_generate_v4()"`
	CompanyID uuid.UUID `json:"company_id" gorm:"type:uuid;not null"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	Location  string    `json:"location"`
	Status    string    `json:"status" gorm:"default:active"`
	CreatedAt time.Time `json:"created_at"`
	Company   Company   `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
}

type MachineAssignment struct {
	MachineID  uuid.UUID `json:"machine_id" gorm:"type:uuid;primaryKey"`
	UserID     uuid.UUID `json:"user_id" gorm:"type:uuid;primaryKey"`
	AssignedAt time.Time `json:"assigned_at"`

	// Relationships for both perspectives
	Machine Machine     `json:"machine,omitempty" gorm:"foreignKey:MachineID"`
	User    CompanyUser `json:"user,omitempty" gorm:"foreignKey:UserID"`
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
