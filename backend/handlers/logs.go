package handlers

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strconv"
	"time"
	_ "time/tzdata" // embedded zone database so ?tz= works on hosts without one (Windows, slim containers)

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Historical reading logs: raw machine_stats rows for a time window, joined
// with machine and metric metadata and classified against the metric limits
// (same rules as alerts.classify).

const (
	logMaxRange       = 366 * 24 * time.Hour
	logDefaultRange   = 24 * time.Hour
	logMaxPageSize    = 500
	logExportMaxRows  = 100000
	logDefaultPageLen = 50

	// Same format the frontend tables use (lib/utils.ts formatDateTime): "19 Nov 2026 11:30:50".
	csvTimeLayout = "02 Jan 2006 15:04:05"
)

// logStatusExpr mirrors alerts.classify: critical beats warning; a reading
// whose metric has no limits is "no_limits"; unknown metrics are "unknown".
const logStatusExpr = `CASE
	WHEN mt.metric_name IS NULL THEN 'unknown'
	WHEN mt.crit_max IS NOT NULL AND s.metric_value > mt.crit_max THEN 'critical'
	WHEN mt.crit_min IS NOT NULL AND s.metric_value < mt.crit_min THEN 'critical'
	WHEN mt.warn_max IS NOT NULL AND s.metric_value > mt.warn_max THEN 'warning'
	WHEN mt.warn_min IS NOT NULL AND s.metric_value < mt.warn_min THEN 'warning'
	WHEN mt.warn_min IS NULL AND mt.warn_max IS NULL AND mt.crit_min IS NULL AND mt.crit_max IS NULL THEN 'no_limits'
	ELSE 'normal' END`

type readingLogRow struct {
	ID          uuid.UUID `json:"id"`
	Ts          time.Time `json:"ts"`
	MachineID   uuid.UUID `json:"machine_id"`
	MachineName string    `json:"machine_name"`
	MachineCode string    `json:"machine_code"`
	MetricKey   string    `json:"metric_key"`
	MetricName  *string   `json:"metric_name"`
	Unit        *string   `json:"unit"`
	ModuleName  *string   `json:"module_name"`
	ModuleCode  *string   `json:"module_code"`
	MetricValue float64   `json:"metric_value"`
	Status      string    `json:"status"`
}

type readingLogFilter struct {
	From, To time.Time
	Asc      bool
}

// readingLogQuery builds the filtered query (without select/order/limit).
// Returns a fiber error message on bad input.
func readingLogQuery(c *fiber.Ctx) (*gorm.DB, readingLogFilter, string) {
	auth := middleware.GetAuth(c)
	f := readingLogFilter{To: time.Now().UTC(), Asc: c.Query("order") == "asc"}

	if v := c.Query("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return nil, f, "invalid 'to' timestamp (use RFC3339)"
		}
		f.To = t
	}
	f.From = f.To.Add(-logDefaultRange)
	if v := c.Query("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return nil, f, "invalid 'from' timestamp (use RFC3339)"
		}
		f.From = t
	}
	if !f.From.Before(f.To) {
		return nil, f, "'from' must be before 'to'"
	}
	if f.To.Sub(f.From) > logMaxRange {
		return nil, f, "time range too large (max 366 days)"
	}

	// Metric metadata for this reading: the matching metric among the
	// machine's (visible) modules, optionally restricted to one module.
	lateral := `SELECT mm.name AS metric_name, mm.unit, mm.warn_min, mm.warn_max, mm.crit_min, mm.crit_max,
	                   mo.id AS module_id, mo.name AS module_name, mo.code AS module_code
	            FROM machine_modules mmod
	            JOIN modules mo ON mo.id = mmod.module_id
	            JOIN module_metrics mm ON mm.module_id = mo.id AND mm.code = s.metric_key
	            WHERE mmod.machine_id = s.machine_id AND lower(mo.code) <> ?`
	lateralArgs := []any{HiddenModuleCode}
	moduleID, moduleErr := uuid.Parse(c.Query("module_id"))
	if moduleErr == nil {
		lateral += " AND mo.id = ?"
		lateralArgs = append(lateralArgs, moduleID)
	}
	lateral += " ORDER BY mo.name LIMIT 1"

	q := database.DB.Table("machine_stats s").
		Joins("JOIN machines m ON m.id = s.machine_id").
		Joins("LEFT JOIN LATERAL ("+lateral+") mt ON true", lateralArgs...).
		Where("s.ts >= ? AND s.ts <= ?", f.From, f.To)

	if cond, args := machineScope(auth, "s.machine_id", "s.company_id"); cond != "" {
		q = q.Where(cond, args...)
	}
	if moduleErr == nil {
		q = q.Where("mt.module_id IS NOT NULL")
	}
	if v := c.Query("machine_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			return nil, f, "invalid machine_id"
		}
		q = q.Where("s.machine_id = ?", id)
	}
	if v := c.Query("metric_key"); v != "" {
		q = q.Where("s.metric_key = ?", v)
	}
	switch st := c.Query("status"); st {
	case "", "all":
	case "alarm": // warning or critical
		q = q.Where("(" + logStatusExpr + ") IN ('warning','critical')")
	case "normal", "warning", "critical", "no_limits", "unknown":
		q = q.Where("("+logStatusExpr+") = ?", st)
	default:
		return nil, f, "invalid status"
	}
	return q, f, ""
}

const readingLogSelect = `s.id, s.ts, s.machine_id, m.name AS machine_name, m.code AS machine_code,
	s.metric_key, mt.metric_name, mt.unit, mt.module_name, mt.module_code, s.metric_value, ` +
	logStatusExpr + ` AS status`

func readingLogOrder(f readingLogFilter) string {
	if f.Asc {
		return "s.ts ASC, s.id"
	}
	return "s.ts DESC, s.id"
}

// GET /api/v1/logs/readings?from=&to=&machine_id=&module_id=&metric_key=&status=&order=asc|desc&page=&page_size=
func ListReadingLogs(c *fiber.Ctx) error {
	q, f, msg := readingLogQuery(c)
	if msg != "" {
		return c.Status(400).JSON(fiber.Map{"error": msg})
	}

	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}
	size := c.QueryInt("page_size", logDefaultPageLen)
	if size < 1 || size > logMaxPageSize {
		size = logDefaultPageLen
	}

	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to count readings"})
	}

	rows := make([]readingLogRow, 0)
	if err := q.Session(&gorm.Session{}).Select(readingLogSelect).
		Order(readingLogOrder(f)).Offset((page - 1) * size).Limit(size).
		Scan(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load readings"})
	}

	return c.JSON(fiber.Map{
		"items":     rows,
		"total":     total,
		"page":      page,
		"page_size": size,
		"from":      f.From,
		"to":        f.To,
	})
}

// GET /api/v1/logs/readings/export — same filters plus ?tz=<IANA zone> (default UTC)
// for the timestamp column; returns CSV (max 100k rows).
func ExportReadingLogs(c *fiber.Ctx) error {
	q, f, msg := readingLogQuery(c)
	if msg != "" {
		return c.Status(400).JSON(fiber.Map{"error": msg})
	}
	loc := time.UTC
	if tz := c.Query("tz"); tz != "" {
		l, err := time.LoadLocation(tz)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid tz"})
		}
		loc = l
	}

	rows := make([]readingLogRow, 0)
	if err := q.Select(readingLogSelect).Order(readingLogOrder(f)).
		Limit(logExportMaxRows + 1).Scan(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load readings"})
	}
	truncated := len(rows) > logExportMaxRows
	if truncated {
		rows = rows[:logExportMaxRows]
	}

	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{"timestamp (" + loc.String() + ")", "machine_code", "machine_name", "module", "metric_key", "metric_name", "value", "unit", "status"})
	for _, r := range rows {
		_ = w.Write([]string{
			r.Ts.In(loc).Format(csvTimeLayout),
			r.MachineCode, r.MachineName, str(r.ModuleName),
			r.MetricKey, str(r.MetricName),
			strconv.FormatFloat(r.MetricValue, 'f', -1, 64), str(r.Unit),
			r.Status,
		})
	}
	w.Flush()

	name := fmt.Sprintf("readings_%s_%s.csv", f.From.UTC().Format("20060102-1504"), f.To.UTC().Format("20060102-1504"))
	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", `attachment; filename="`+name+`"`)
	c.Set("Access-Control-Expose-Headers", "Content-Disposition, X-Truncated")
	if truncated {
		c.Set("X-Truncated", "true")
	}
	return c.Send(buf.Bytes())
}
