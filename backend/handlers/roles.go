package handlers

import (
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
)

// GET /api/v1/roles - Dynamic implementation
func ListRoles(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	// Query database for roles
	var roles []models.Role
	query := database.DB.Preload("RolePermissions.Permission")

	// If not superadmin, only show roles from same company
	if !auth.Permissions["superadmin"] {
		query = query.Where("company_id = ?", auth.CompanyID)
	} else {
		// For superadmin, include company information
		query = query.Preload("Company")
	}

	if err := query.Find(&roles).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch roles"})
	}

	return c.JSON(roles) // Return array directly
}

// POST /api/v1/roles - Dynamic implementation
func CreateRole(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	var req struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Permissions []string `json:"permissions"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	// Create new role
	role := models.Role{
		CompanyID:   auth.CompanyID,
		Name:        req.Name,
		Description: req.Description,
	}

	if err := database.DB.Create(&role).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create role"})
	}

	// Add permissions to role
	for _, permKey := range req.Permissions {
		var permission models.Permission
		if err := database.DB.Where("key = ?", permKey).First(&permission).Error; err != nil {
			continue // Skip invalid permission keys
		}

		rolePermission := models.RolePermission{
			RoleID:       role.ID,
			PermissionID: permission.ID,
		}

		database.DB.Create(&rolePermission)
	}

	// Load relationships
	database.DB.Preload("RolePermissions.Permission").First(&role, "id = ?", role.ID)

	return c.Status(201).JSON(role)
}

// GET /api/v1/permissions - Dynamic implementation
func ListPermissions(c *fiber.Ctx) error {
	// Query database for all permissions
	var permissions []models.Permission
	if err := database.DB.Find(&permissions).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch permissions"})
	}

	return c.JSON(permissions) // Return array directly
}

// PUT /api/v1/roles/:id - Dynamic implementation
func UpdateRole(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	roleID := c.Params("id")

	var req struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Permissions []string `json:"permissions"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	// Find role in database
	var role models.Role
	if err := database.DB.First(&role, "id = ?", roleID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Role not found"})
	}

	// Check permissions - can only edit roles in same company unless superadmin
	if !auth.Permissions["superadmin"] && role.CompanyID != auth.CompanyID {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	// Update role
	role.Name = req.Name
	role.Description = req.Description
	if err := database.DB.Save(&role).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update role"})
	}

	// Delete existing role permissions
	database.DB.Where("role_id = ?", role.ID).Delete(&models.RolePermission{})

	// Add new permissions to role
	for _, permKey := range req.Permissions {
		var permission models.Permission
		if err := database.DB.Where("key = ?", permKey).First(&permission).Error; err != nil {
			continue // Skip invalid permission keys
		}

		rolePermission := models.RolePermission{
			RoleID:       role.ID,
			PermissionID: permission.ID,
		}

		database.DB.Create(&rolePermission)
	}

	// Load relationships
	database.DB.Preload("RolePermissions.Permission").First(&role, "id = ?", role.ID)

	return c.JSON(role)
}

func DeleteRole(c *fiber.Ctx) error {
	return c.SendStatus(204)
}
