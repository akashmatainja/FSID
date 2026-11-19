package handlers

import (
	"github.com/companyuser/backend/alerts"
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type alertRow struct {
	models.Alert
	MachineName string `json:"machine_name"`
	MachineCode string `json:"machine_code"`
	ModuleCode  string `json:"module_code"`
	ModuleName  string `json:"module_name"`
}

// GET /api/v1/alerts?status=open|resolved|all&module_id=&machine_id=&limit=
//
// Open alerts come first (critical before warning), then newest first.
func ListAlerts(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	q := database.DB.Table("alerts a").
		Select(`a.*, m.name AS machine_name, m.code AS machine_code,
		        COALESCE(mo.code, '') AS module_code, COALESCE(mo.name, '') AS module_name`).
		Joins("JOIN machines m ON m.id = a.machine_id").
		Joins("LEFT JOIN modules mo ON mo.id = a.module_id").
		Where("(mo.code IS NULL OR lower(mo.code) <> ?)", HiddenModuleCode)

	if cond, args := machineScope(auth, "a.machine_id", "a.company_id"); cond != "" {
		q = q.Where(cond, args...)
	}

	switch c.Query("status", "open") {
	case "open":
		q = q.Where("a.status = 'open'")
	case "resolved":
		q = q.Where("a.status = 'resolved'")
	}
	if id, err := uuid.Parse(c.Query("module_id")); err == nil {
		q = q.Where("a.module_id = ?", id)
	}
	if id, err := uuid.Parse(c.Query("machine_id")); err == nil {
		q = q.Where("a.machine_id = ?", id)
	}

	limit := c.QueryInt("limit", 50)
	if limit <= 0 || limit > 500 {
		limit = 50
	}

	rows := make([]alertRow, 0)
	if err := q.Order("(a.status = 'open') DESC, (a.severity = 'critical') DESC, a.started_at DESC").
		Limit(limit).Scan(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load alerts"})
	}
	return c.JSON(rows)
}

// POST /api/v1/alerts/:id/acknowledge
func AcknowledgeAlert(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid alert id"})
	}

	q := database.DB.Model(&models.Alert{}).Where("id = ?", id)
	if cond, args := machineScope(auth, "machine_id", "company_id"); cond != "" {
		q = q.Where(cond, args...)
	}

	updates := map[string]any{"acknowledged_at": time.Now(), "updated_at": time.Now()}
	if auth.CompanyUser.ID != uuid.Nil {
		updates["acknowledged_by"] = auth.CompanyUser.ID
	}
	res := q.Updates(updates)
	if res.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to acknowledge alert"})
	}
	if res.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "alert not found"})
	}
	return c.JSON(fiber.Map{"status": "acknowledged"})
}

// InvalidateAlertRules is route middleware: after a successful change to
// modules, metrics or machine↔module assignments, drop the alert engine's
// cached limits so the next reading uses the new configuration.
func InvalidateAlertRules(c *fiber.Ctx) error {
	err := c.Next()
	if err == nil && c.Response().StatusCode() < 300 {
		alerts.Invalidate()
	}
	return err
}
