package handlers

import (
	"github.com/companyuser/backend/alerts"
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"strings"
)

// HiddenModuleCode is the Expert Guided Remote Maintenance module, which now has
// its own dedicated site. It is excluded from every module listing in this app.
// Remove this filter to show it again.
const HiddenModuleCode = "remote_maintenance"

// GET /api/v1/modules - superadmin only, returns all modules with metrics
func ListModules(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	if !auth.Permissions["superadmin"] {
		return c.Status(403).JSON(fiber.Map{"error": "access denied"})
	}

	var modules []models.Module
	// Expert Guided Remote Maintenance module is hidden here (it lives on a separate site).
	if err := database.DB.Preload("Metrics").Where("LOWER(code) <> ?", HiddenModuleCode).Order("created_at ASC").Find(&modules).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to fetch modules"})
	}

	return c.JSON(modules)
}

// GET /api/v1/modules/active - all authenticated users, returns only active modules with metrics
func ListActiveModules(c *fiber.Ctx) error {
	var modules []models.Module
	if err := database.DB.Preload("Metrics").Where("is_active = ? AND LOWER(code) <> ?", true, HiddenModuleCode).Order("created_at ASC").Find(&modules).Error; err != nil {
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

	if msg := validateLimits(req.Limits); msg != "" {
		return c.Status(400).JSON(fiber.Map{"error": msg})
	}
	if msg := validateNodeTemplate(req.NodeID); msg != "" {
		return c.Status(400).JSON(fiber.Map{"error": msg})
	}

	mID, _ := uuid.Parse(moduleID)
	metric := models.ModuleMetric{
		ID:       uuid.New(),
		ModuleID: mID,
		Name:     req.Name,
		Code:     req.Code,
		Unit:     req.Unit,
		NodeID:   strings.TrimSpace(req.NodeID),
	}
	if req.Limits != nil {
		metric.WarnMin, metric.WarnMax = req.Limits.WarnMin, req.Limits.WarnMax
		metric.CritMin, metric.CritMax = req.Limits.CritMin, req.Limits.CritMax
	}

	if err := database.DB.Create(&metric).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create metric"})
	}

	alerts.Invalidate()
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
	if req.NodeID != nil {
		if msg := validateNodeTemplate(*req.NodeID); msg != "" {
			return c.Status(400).JSON(fiber.Map{"error": msg})
		}
		updates["node_id"] = strings.TrimSpace(*req.NodeID)
	}
	if req.Limits != nil {
		if msg := validateLimits(req.Limits); msg != "" {
			return c.Status(400).JSON(fiber.Map{"error": msg})
		}
		// nil clears a limit
		updates["warn_min"] = req.Limits.WarnMin
		updates["warn_max"] = req.Limits.WarnMax
		updates["crit_min"] = req.Limits.CritMin
		updates["crit_max"] = req.Limits.CritMax
	}

	if len(updates) > 0 {
		if err := database.DB.Model(&metric).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to update metric"})
		}
	}

	alerts.Invalidate()
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

// validateLimits checks that limits are ordered:
// crit_min ≤ warn_min ≤ warn_max ≤ crit_max (for whichever are set).
func validateLimits(l *models.MetricLimits) string {
	if l == nil {
		return ""
	}
	seq := []struct {
		name string
		v    *float64
	}{{"crit_min", l.CritMin}, {"warn_min", l.WarnMin}, {"warn_max", l.WarnMax}, {"crit_max", l.CritMax}}
	for i := 0; i < len(seq); i++ {
		for j := i + 1; j < len(seq); j++ {
			if seq[i].v != nil && seq[j].v != nil && *seq[i].v > *seq[j].v {
				return seq[i].name + " must not be greater than " + seq[j].name
			}
		}
	}
	return ""
}
