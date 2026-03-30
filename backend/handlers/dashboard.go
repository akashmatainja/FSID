package handlers

import (
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// GET /api/v1/dashboard/summary
func GetDashboardSummary(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)

	var totalMachines, activeMachines int64
	var machineQuery *gorm.DB
	if auth.Permissions["superadmin"] {
		// Superadmin sees all machines
		machineQuery = database.DB.Model(&models.Machine{})
	} else {
		// Regular users see only their company's machines
		machineQuery = database.DB.Model(&models.Machine{}).Where("company_id = ?", auth.CompanyID)
	}
	machineQuery.Count(&totalMachines)
	machineQuery.Where("status = 'active'").Count(&activeMachines)

	var totalStats int64
	var statsQuery *gorm.DB
	if auth.Permissions["superadmin"] {
		// Superadmin sees all stats
		statsQuery = database.DB.Model(&models.MachineStat{})
	} else {
		// Regular users see only their company's stats
		statsQuery = database.DB.Model(&models.MachineStat{}).Where("company_id = ?", auth.CompanyID)

		// Check if user has restricted stats access
		if !auth.Permissions["stats.read_all"] && !auth.Permissions["stats.read_assigned"] {
			// No stats access - return empty
			statsQuery = statsQuery.Where("1=0")
		} else if auth.Permissions["stats.read_assigned"] && !auth.Permissions["stats.read_all"] {
			// Only assigned machines
			statsQuery = statsQuery.Where(
				"machine_id IN (SELECT machine_id FROM machine_assignments WHERE user_id = ?)",
				auth.CompanyUser.ID,
			)
		}
		// If stats.read_all is true, no additional filtering needed
	}
	statsQuery.Count(&totalStats)

	// Latest stat per machine per metric
	var latestSQL string
	var args []interface{}

	if auth.Permissions["superadmin"] {
		latestSQL = `
			SELECT DISTINCT ON (ms.machine_id, ms.metric_key)
				ms.machine_id,
				m.name  AS machine_name,
				m.code  AS machine_code,
				ms.metric_key,
				ms.metric_value,
				ms.ts
			FROM machine_stats ms
			JOIN machines m ON m.id = ms.machine_id
		`
	} else {
		latestSQL = `
			SELECT DISTINCT ON (ms.machine_id, ms.metric_key)
				ms.machine_id,
				m.name  AS machine_name,
				m.code  AS machine_code,
				ms.metric_key,
				ms.metric_value,
				ms.ts
			FROM machine_stats ms
			JOIN machines m ON m.id = ms.machine_id
			WHERE ms.company_id = ?
		`
		args = []interface{}{auth.CompanyID}

		// Check if user has restricted stats access
		if !auth.Permissions["stats.read_all"] && !auth.Permissions["stats.read_assigned"] {
			// No stats access - return empty
			latestSQL += " AND 1=0"
		} else if auth.Permissions["stats.read_assigned"] && !auth.Permissions["stats.read_all"] {
			// Only assigned machines
			latestSQL += " AND ms.machine_id IN (SELECT machine_id FROM machine_assignments WHERE user_id = ?)"
			args = append(args, auth.CompanyUser.ID)
		}
		// If stats.read_all is true, no additional filtering needed
	}
	latestSQL += " ORDER BY ms.machine_id, ms.metric_key, ms.ts DESC"

	var latest []models.LatestMachineStat
	database.DB.Raw(latestSQL, args...).Scan(&latest)

	return c.JSON(models.DashboardSummary{
		TotalMachines:  totalMachines,
		ActiveMachines: activeMachines,
		TotalStats:     totalStats,
		LatestStats:    latest,
	})
}
