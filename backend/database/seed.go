package database

import (
	"log"

	"github.com/companyuser/backend/models"
	"gorm.io/gorm"
)

// SeedPermissions seeds the initial permissions into the database
func SeedPermissions() {
	permissions := []models.Permission{
		// Existing permissions
		{Key: "superadmin", Description: "Full system access"},
		{Key: "companies.read", Description: "View companies"},
		{Key: "companies.write", Description: "Create, update, delete companies"},
		{Key: "users.read", Description: "View users"},
		{Key: "users.write", Description: "Create, update, delete users"},
		{Key: "roles.read", Description: "View roles"},
		{Key: "roles.write", Description: "Create, update, delete roles"},
		{Key: "machines.read", Description: "View machines"},
		{Key: "machines.write", Description: "Create, update, delete machines"},
		{Key: "stats.read", Description: "View statistics"},
		{Key: "stats.write", Description: "Ingest statistics"},
		{Key: "assignments.read", Description: "View assignments"},
		{Key: "assignments.write", Description: "Manage assignments"},
		{Key: "dashboard.read", Description: "View dashboard"},

		// New branch permissions
		{Key: "branches.read", Description: "View branches"},
		{Key: "branches.write", Description: "Create, update, delete branches"},

		// New subdivision permissions
		{Key: "subdivisions.read", Description: "View subdivisions"},
		{Key: "subdivisions.write", Description: "Create, update, delete subdivisions"},
	}

	for _, perm := range permissions {
		var existingPerm models.Permission
		if err := DB.Where("key = ?", perm.Key).First(&existingPerm).Error; err == gorm.ErrRecordNotFound {
			if err := DB.Create(&perm).Error; err != nil {
				log.Printf("Failed to create permission %s: %v", perm.Key, err)
			} else {
				log.Printf("Created permission: %s", perm.Key)
			}
		}
	}
}

// UpdateExistingRolesWithBranchPermissions adds branch permissions to existing company admin roles
func UpdateExistingRolesWithBranchPermissions() {
	// Get all company admin roles
	var adminRoles []models.Role
	if err := DB.Where("name = ?", "Company Admin").Find(&adminRoles).Error; err != nil {
		log.Printf("Failed to fetch admin roles: %v", err)
		return
	}

	branchPermissions := []string{"branches.read", "branches.write"}

	for _, role := range adminRoles {
		for _, permKey := range branchPermissions {
			var perm models.Permission
			if err := DB.Where("key = ?", permKey).First(&perm).Error; err == nil {
				// Check if role already has this permission
				var existingRolePerm models.RolePermission
				if err := DB.Where("role_id = ? AND permission_id = ?", role.ID, perm.ID).First(&existingRolePerm).Error; err == gorm.ErrRecordNotFound {
					// Add the permission
					rolePerm := models.RolePermission{
						RoleID:       role.ID,
						PermissionID: perm.ID,
					}
					if err := DB.Create(&rolePerm).Error; err != nil {
						log.Printf("Failed to add permission %s to role %s: %v", permKey, role.Name, err)
					} else {
						log.Printf("Added branch permission %s to role %s (Company: %s)", permKey, role.Name, role.CompanyID)
					}
				}
			}
		}
	}
}

// UpdateExistingRolesWithSubdivisionPermissions adds subdivision permissions to existing company admin roles
func UpdateExistingRolesWithSubdivisionPermissions() {
	// Get all company admin roles
	var adminRoles []models.Role
	if err := DB.Where("name = ?", "Company Admin").Find(&adminRoles).Error; err != nil {
		log.Printf("Failed to fetch admin roles: %v", err)
		return
	}

	subdivisionPermissions := []string{"subdivisions.read", "subdivisions.write"}

	for _, role := range adminRoles {
		for _, permKey := range subdivisionPermissions {
			var perm models.Permission
			if err := DB.Where("key = ?", permKey).First(&perm).Error; err == nil {
				// Check if role already has this permission
				var existingRolePerm models.RolePermission
				if err := DB.Where("role_id = ? AND permission_id = ?", role.ID, perm.ID).First(&existingRolePerm).Error; err == gorm.ErrRecordNotFound {
					// Add the permission
					rolePerm := models.RolePermission{
						RoleID:       role.ID,
						PermissionID: perm.ID,
					}
					if err := DB.Create(&rolePerm).Error; err != nil {
						log.Printf("Failed to add permission %s to role %s: %v", permKey, role.Name, err)
					} else {
						log.Printf("Added subdivision permission %s to role %s (Company: %s)", permKey, role.Name, role.CompanyID)
					}
				}
			}
		}
	}
}

// SeedModules seeds the initial modules into the database
func SeedModules() {
	modules := []models.Module{
		{
			Name:        "Power",
			Code:        "POWER",
			Description: "Real-time power consumption monitoring",
			Unit:        "kW",
			Status:      "active",
		},
		{
			Name:        "Energy",
			Code:        "ENERGY",
			Description: "Cumulative energy consumption tracking",
			Unit:        "kWh",
			Status:      "active",
		},
		{
			Name:        "Voltage",
			Code:        "VOLTAGE",
			Description: "Voltage level monitoring",
			Unit:        "V",
			Status:      "active",
		},
		{
			Name:        "Current",
			Code:        "CURRENT",
			Description: "Current flow measurement",
			Unit:        "A",
			Status:      "active",
		},
		{
			Name:        "Power Factor",
			Code:        "POWER_FACTOR",
			Description: "Power factor efficiency measurement",
			Unit:        "PF",
			Status:      "active",
		},
		{
			Name:        "Frequency",
			Code:        "FREQUENCY",
			Description: "Electrical frequency monitoring",
			Unit:        "Hz",
			Status:      "active",
		},
		{
			Name:        "Temperature",
			Code:        "TEMPERATURE",
			Description: "Equipment temperature monitoring",
			Unit:        "°C",
			Status:      "active",
		},
		{
			Name:        "Vibration",
			Code:        "VIBRATION",
			Description: "Mechanical vibration monitoring",
			Unit:        "mm/s",
			Status:      "active",
		},
	}

	for _, module := range modules {
		var existingModule models.Module
		if err := DB.Where("code = ?", module.Code).First(&existingModule).Error; err == gorm.ErrRecordNotFound {
			if err := DB.Create(&module).Error; err != nil {
				log.Printf("Failed to create module %s: %v", module.Code, err)
			} else {
				log.Printf("Created module: %s (%s)", module.Name, module.Code)
			}
		} else {
			log.Printf("Module %s already exists, skipping", module.Code)
		}
	}
}

// SeedData seeds initial data into the database
func SeedData() {
	log.Println("Seeding initial data...")

	// Seed permissions first
	SeedPermissions()

	// Update existing roles with new branch permissions
	UpdateExistingRolesWithBranchPermissions()

	// Update existing roles with new subdivision permissions
	UpdateExistingRolesWithSubdivisionPermissions()

	// Seed initial modules
	SeedModules()

	log.Println("Database seeding completed")
}
