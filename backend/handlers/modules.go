package handlers

import (
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /api/v1/modules
func ListModules(c *fiber.Ctx) error {
	var modules []models.Module
	query := database.DB.Order("created_at DESC")

	// Filter by status if provided
	status := c.Query("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Find(&modules).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch modules"})
	}

	return c.JSON(modules)
}

// GET /api/v1/modules/:id
func GetModule(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	// Only superadmin can access modules
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	id := c.Params("id")

	var module models.Module
	if err := database.DB.Where("id = ?", id).First(&module).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "module not found"})
	}

	return c.JSON(module)
}

// POST /api/v1/modules
func CreateModule(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	// Only superadmin can create modules
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	var req models.CreateModuleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	// Check if module with same code already exists
	var existingModule models.Module
	if err := database.DB.Where("code = ?", req.Code).First(&existingModule).Error; err == nil {
		return c.Status(409).JSON(fiber.Map{"error": "module with this code already exists"})
	}

	module := models.Module{
		ID:          uuid.New(),
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
		Unit:        req.Unit,
		Status:      req.Status,
	}

	if module.Status == "" {
		module.Status = "active"
	}

	if err := database.DB.Create(&module).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create module"})
	}

	return c.Status(201).JSON(module)
}

// PUT /api/v1/modules/:id
func UpdateModule(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	// Only superadmin can update modules
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	id := c.Params("id")

	var module models.Module
	if err := database.DB.Where("id = ?", id).First(&module).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "module not found"})
	}

	var req models.UpdateModuleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Code != nil {
		// Check if new code conflicts with existing module
		var existingModule models.Module
		if err := database.DB.Where("code = ? AND id != ?", *req.Code, id).First(&existingModule).Error; err == nil {
			return c.Status(409).JSON(fiber.Map{"error": "module with this code already exists"})
		}
		updates["code"] = *req.Code
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Unit != nil {
		updates["unit"] = *req.Unit
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}

	if len(updates) > 0 {
		if err := database.DB.Model(&module).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to update module"})
		}
	}

	// Reload module
	database.DB.First(&module, "id = ?", module.ID)

	return c.JSON(module)
}

// DELETE /api/v1/modules/:id
func DeleteModule(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	// Only superadmin can delete modules
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	id := c.Params("id")

	var module models.Module
	if err := database.DB.Where("id = ?", id).First(&module).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "module not found"})
	}

	// Check if module is being used by any machines
	var machineCount int64
	database.DB.Model(&models.Machine{}).Where("module_id = ?", id).Count(&machineCount)
	if machineCount > 0 {
		return c.Status(400).JSON(fiber.Map{"error": "cannot delete module that is assigned to machines"})
	}

	if err := database.DB.Delete(&module).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete module"})
	}

	return c.JSON(fiber.Map{"message": "module deleted successfully"})
}
