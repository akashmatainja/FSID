package handlers

import (
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /api/v1/modules - superadmin only, returns all modules with metrics
func ListModules(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	var modules []models.Module
	if err := database.DB.Preload("Metrics").Order("created_at ASC").Find(&modules).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch modules"})
	}

	return c.JSON(modules)
}

// GET /api/v1/modules/active - all authenticated users, returns only active modules with metrics
func ListActiveModules(c *fiber.Ctx) error {
	var modules []models.Module
	if err := database.DB.Preload("Metrics").Where("is_active = ?", true).Order("created_at ASC").Find(&modules).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch modules"})
	}

	return c.JSON(modules)
}

// GET /api/v1/modules/:id - superadmin only
func GetModule(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	id := c.Params("id")
	var module models.Module
	if err := database.DB.Preload("Metrics").Where("id = ?", id).First(&module).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "module not found"})
	}

	return c.JSON(module)
}

// PUT /api/v1/modules/:id/toggle - superadmin only, activate/deactivate
func ToggleModule(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	id := c.Params("id")
	var module models.Module
	if err := database.DB.Where("id = ?", id).First(&module).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "module not found"})
	}

	var req models.ToggleModuleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	if err := database.DB.Model(&module).Update("is_active", req.IsActive).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update module"})
	}

	database.DB.Preload("Metrics").First(&module, "id = ?", module.ID)
	return c.JSON(module)
}

// GET /api/v1/modules/:id/metrics - superadmin only
func ListModuleMetrics(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	moduleID := c.Params("id")
	var metrics []models.ModuleMetric
	if err := database.DB.Where("module_id = ?", moduleID).Order("created_at ASC").Find(&metrics).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch metrics"})
	}

	return c.JSON(metrics)
}

// POST /api/v1/modules/:id/metrics - superadmin only
func CreateModuleMetric(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	moduleID := c.Params("id")
	var module models.Module
	if err := database.DB.Where("id = ?", moduleID).First(&module).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "module not found"})
	}

	var req models.CreateModuleMetricRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	mID, _ := uuid.Parse(moduleID)
	metric := models.ModuleMetric{
		ID:       uuid.New(),
		ModuleID: mID,
		Name:     req.Name,
		Code:     req.Code,
		Unit:     req.Unit,
	}

	if err := database.DB.Create(&metric).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create metric"})
	}

	return c.Status(201).JSON(metric)
}

// PUT /api/v1/modules/:id/metrics/:metric_id - superadmin only
func UpdateModuleMetric(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	metricID := c.Params("metric_id")
	var metric models.ModuleMetric
	if err := database.DB.Where("id = ?", metricID).First(&metric).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "metric not found"})
	}

	var req models.UpdateModuleMetricRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Code != nil {
		updates["code"] = *req.Code
	}
	if req.Unit != nil {
		updates["unit"] = *req.Unit
	}

	if len(updates) > 0 {
		if err := database.DB.Model(&metric).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to update metric"})
		}
	}

	database.DB.First(&metric, "id = ?", metric.ID)
	return c.JSON(metric)
}

// DELETE /api/v1/modules/:id/metrics/:metric_id - superadmin only
func DeleteModuleMetric(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	metricID := c.Params("metric_id")
	var metric models.ModuleMetric
	if err := database.DB.Where("id = ?", metricID).First(&metric).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "metric not found"})
	}

	if err := database.DB.Delete(&metric).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete metric"})
	}

	return c.JSON(fiber.Map{"message": "metric deleted successfully"})
}
