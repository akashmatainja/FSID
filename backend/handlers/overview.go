package handlers

import (
	"strings"
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type overviewMetric struct {
	MetricID   uuid.UUID `json:"metric_id"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Unit       string    `json:"unit"`
	WarnMin    *float64  `json:"warn_min"`
	WarnMax    *float64  `json:"warn_max"`
	CritMin    *float64  `json:"crit_min"`
	CritMax    *float64  `json:"crit_max"`
	Samples    int64     `json:"samples"`
	InLimits   int64     `json:"in_limits"`
	Compliance *float64  `json:"compliance"` // % of samples inside limits; null when no limits set
	Avg        *float64  `json:"avg"`
	Min        *float64  `json:"min"`
	Max        *float64  `json:"max"`
}

type overviewMachineMetric struct {
	MachineID  uuid.UUID `json:"machine_id"`
	MetricID   uuid.UUID `json:"metric_id"`
	Samples    int64     `json:"samples"`
	InLimits   int64     `json:"in_limits"`
	Compliance *float64  `json:"compliance"`
	Avg        float64   `json:"avg"`
	Min        float64   `json:"min"`
	Max        float64   `json:"max"`
}

type overviewModule struct {
	ModuleID     uuid.UUID               `json:"module_id"`
	Code         string                  `json:"code"`
	Name         string                  `json:"name"`
	MachineCount int                     `json:"machine_count"`
	Compliance   *float64                `json:"compliance"` // across metrics that have limits
	OpenAlerts   int64                   `json:"open_alerts"`
	Critical     int64                   `json:"critical"`
	Warning      int64                   `json:"warning"`
	Metrics      []overviewMetric        `json:"metrics"`
	PerMachine   []overviewMachineMetric `json:"per_machine"`
}

func pct(in, total int64) *float64 {
	if total == 0 {
		return nil
	}
	v := float64(in) / float64(total) * 100
	return &v
}

func hasLimits(m models.ModuleMetric) bool {
	return m.WarnMin != nil || m.WarnMax != nil || m.CritMin != nil || m.CritMax != nil
}

// GET /api/v1/dashboard/overview?since=<RFC3339>
//
// Per accessible module: machine count, open alert counts, and per-metric
// aggregates over the window (default last 24 h) including compliance —
// the share of readings inside the metric's limits.
func GetDashboardOverview(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	until := time.Now()
	since := until.Add(-24 * time.Hour)
	if s := c.Query("since"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			since = t
		}
	}

	scope, scopeArgs := machineScope(auth, "m.id", "m.company_id")
	and := func(sql string) string {
		if scope == "" {
			return sql
		}
		return sql + " AND " + scope
	}

	// 1. Visible machines per active module
	type mmRow struct {
		ModuleID  uuid.UUID
		MachineID uuid.UUID
	}
	var mm []mmRow
	q := `SELECT mmod.module_id, m.id AS machine_id
	      FROM machine_modules mmod
	      JOIN machines m  ON m.id = mmod.machine_id
	      JOIN modules mo  ON mo.id = mmod.module_id AND mo.is_active AND lower(mo.code) <> ?
	      WHERE 1=1`
	if err := database.DB.Raw(and(q), append([]any{HiddenModuleCode}, scopeArgs...)...).Scan(&mm).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load modules"})
	}
	machinesByModule := map[uuid.UUID]int{}
	for _, r := range mm {
		machinesByModule[r.ModuleID]++
	}

	resp := fiber.Map{"since": since, "until": until, "modules": []overviewModule{}, "alerts": fiber.Map{"open": 0, "critical": 0, "warning": 0}}
	if len(machinesByModule) == 0 {
		return c.JSON(resp)
	}

	moduleIDs := make([]uuid.UUID, 0, len(machinesByModule))
	for id := range machinesByModule {
		moduleIDs = append(moduleIDs, id)
	}
	var modules []models.Module
	database.DB.Preload("Metrics").Where("id IN ?", moduleIDs).Order("created_at ASC").Find(&modules)

	// 2. Per machine × metric aggregates within the window
	type aggRow struct {
		MachineID uuid.UUID
		ModuleID  uuid.UUID
		MetricID  uuid.UUID
		Samples   int64
		InLimits  int64
		Avg       float64
		Min       float64
		Max       float64
	}
	var aggs []aggRow
	aggSQL := `
		SELECT ms.machine_id, mm.module_id, mm.id AS metric_id,
		       COUNT(*) AS samples,
		       COUNT(*) FILTER (WHERE
		           (mm.warn_max IS NULL OR ms.metric_value <= mm.warn_max) AND
		           (mm.warn_min IS NULL OR ms.metric_value >= mm.warn_min) AND
		           (mm.crit_max IS NULL OR ms.metric_value <= mm.crit_max) AND
		           (mm.crit_min IS NULL OR ms.metric_value >= mm.crit_min)) AS in_limits,
		       AVG(ms.metric_value) AS avg, MIN(ms.metric_value) AS min, MAX(ms.metric_value) AS max
		FROM machine_stats ms
		JOIN machines m           ON m.id = ms.machine_id
		JOIN machine_modules mmod ON mmod.machine_id = ms.machine_id AND mmod.module_id IN ?
		JOIN module_metrics mm    ON mm.module_id = mmod.module_id AND lower(mm.code) = lower(ms.metric_key)
		WHERE ms.ts >= ? AND ms.ts <= ?`
	args := append([]any{moduleIDs, since, until}, scopeArgs...)
	if err := database.DB.Raw(and(aggSQL)+" GROUP BY ms.machine_id, mm.module_id, mm.id", args...).Scan(&aggs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to aggregate stats"})
	}

	// 3. Open alerts per module / severity (alerts table may not exist yet)
	type alertCount struct {
		ModuleID *uuid.UUID
		Severity string
		N        int64
	}
	var counts []alertCount
	aScope, aArgs := machineScope(auth, "machine_id", "company_id")
	aq := database.DB.Table("alerts").Select("module_id, severity, COUNT(*) AS n").Where("status = 'open'")
	if aScope != "" {
		aq = aq.Where(aScope, aArgs...)
	}
	_ = aq.Group("module_id, severity").Scan(&counts).Error

	var totalOpen, totalCrit, totalWarn int64
	alertsByModule := map[uuid.UUID][2]int64{} // [critical, warning]
	for _, ac := range counts {
		if ac.ModuleID == nil {
			continue
		}
		v := alertsByModule[*ac.ModuleID]
		if ac.Severity == "critical" {
			v[0] += ac.N
		} else {
			v[1] += ac.N
		}
		alertsByModule[*ac.ModuleID] = v
	}

	out := make([]overviewModule, 0, len(modules))
	for _, mod := range modules {
		if strings.EqualFold(mod.Code, HiddenModuleCode) {
			continue
		}
		ac := alertsByModule[mod.ID]
		totalCrit += ac[0]
		totalWarn += ac[1]
		totalOpen += ac[0] + ac[1]

		om := overviewModule{
			ModuleID: mod.ID, Code: mod.Code, Name: mod.Name,
			MachineCount: machinesByModule[mod.ID],
			Critical:     ac[0], Warning: ac[1], OpenAlerts: ac[0] + ac[1],
			Metrics: []overviewMetric{}, PerMachine: []overviewMachineMetric{},
		}
		var modIn, modTotal int64
		for _, met := range mod.Metrics {
			o := overviewMetric{
				MetricID: met.ID, Code: met.Code, Name: met.Name, Unit: met.Unit,
				WarnMin: met.WarnMin, WarnMax: met.WarnMax, CritMin: met.CritMin, CritMax: met.CritMax,
			}
			var sum float64
			for _, a := range aggs {
				if a.ModuleID != mod.ID || a.MetricID != met.ID {
					continue
				}
				o.Samples += a.Samples
				o.InLimits += a.InLimits
				sum += a.Avg * float64(a.Samples)
				if o.Min == nil || a.Min < *o.Min {
					v := a.Min
					o.Min = &v
				}
				if o.Max == nil || a.Max > *o.Max {
					v := a.Max
					o.Max = &v
				}
				mmAgg := overviewMachineMetric{
					MachineID: a.MachineID, MetricID: met.ID, Samples: a.Samples, InLimits: a.InLimits,
					Avg: a.Avg, Min: a.Min, Max: a.Max,
				}
				if hasLimits(met) {
					mmAgg.Compliance = pct(a.InLimits, a.Samples)
				}
				om.PerMachine = append(om.PerMachine, mmAgg)
			}
			if o.Samples > 0 {
				v := sum / float64(o.Samples)
				o.Avg = &v
			}
			if hasLimits(met) {
				o.Compliance = pct(o.InLimits, o.Samples)
				modIn += o.InLimits
				modTotal += o.Samples
			}
			om.Metrics = append(om.Metrics, o)
		}
		om.Compliance = pct(modIn, modTotal)
		out = append(out, om)
	}

	resp["modules"] = out
	resp["alerts"] = fiber.Map{"open": totalOpen, "critical": totalCrit, "warning": totalWarn}
	return c.JSON(resp)
}
