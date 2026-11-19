package handlers

import (
	"errors"
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/health"
	"github.com/companyuser/backend/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /api/v1/predictive/health?since=<RFC3339>
//
// Health score (0–100) for every visible machine with the predictive module,
// computed from metric limits, readings in the window (default 24 h) and open
// alerts. See package health for the formula.
func GetPredictiveHealth(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	now := time.Now()
	since := now.Add(-24 * time.Hour)
	if s := c.Query("since"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil && t.Before(now) {
			since = t
		}
	}

	scope, args := machineScope(auth, "m.id", "m.company_id")
	machines, err := health.Compute(scope, args, since, now)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to compute health"})
	}
	return c.JSON(fiber.Map{"since": since, "until": now, "machines": machines})
}

type healthPoint struct {
	Ts           time.Time `json:"ts"`
	Score        float64   `json:"score"`     // hourly value, or daily average
	MinScore     int       `json:"min_score"` // equals score for hourly points
	Status       string    `json:"status"`    // status of score (daily: of the average)
	HoursToLimit *float64  `json:"hours_to_limit"`
	OpenCritical int       `json:"open_critical"`
	OpenWarning  int       `json:"open_warning"`
}

type healthSeries struct {
	MachineID uuid.UUID     `json:"machine_id"`
	Code      string        `json:"code"`
	Name      string        `json:"name"`
	Points    []healthPoint `json:"points"`
}

// GET /api/v1/predictive/health/history?machine_id=&since=<RFC3339>&bucket=hour|day
//
// Health score history from machine_health_snapshots. Hourly by default;
// bucket=day returns the daily average (and the day's lowest score). Defaults
// to the last 7 days; machine_id narrows to one machine.
func GetPredictiveHealthHistory(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	now := time.Now()
	since := now.Add(-7 * 24 * time.Hour)
	if s := c.Query("since"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil && t.Before(now) {
			since = t
		}
	}
	trunc := "hour"
	if c.Query("bucket") == "day" {
		trunc = "day"
	}

	q := `
		SELECT s.machine_id, m.code, m.name,
		       date_trunc('` + trunc + `', s.captured_at) AS ts,
		       AVG(s.score)::float8 AS score, MIN(s.score) AS min_score,
		       MIN(s.hours_to_limit) AS hours_to_limit,
		       MAX(s.open_critical) AS open_critical, MAX(s.open_warning) AS open_warning
		FROM machine_health_snapshots s
		JOIN machines m ON m.id = s.machine_id
		WHERE s.captured_at >= ?`
	args := []any{since}
	if id, err := uuid.Parse(c.Query("machine_id")); err == nil {
		q += " AND s.machine_id = ?"
		args = append(args, id)
	}
	if scope, sArgs := machineScope(auth, "m.id", "m.company_id"); scope != "" {
		q += " AND " + scope
		args = append(args, sArgs...)
	}
	q += " GROUP BY 1, 2, 3, 4 ORDER BY 2, 4"

	type row struct {
		MachineID    uuid.UUID
		Code         string
		Name         string
		Ts           time.Time
		Score        float64
		MinScore     int
		HoursToLimit *float64
		OpenCritical int
		OpenWarning  int
	}
	var rows []row
	if err := database.DB.Raw(q, args...).Scan(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load health history"})
	}

	out := []healthSeries{}
	idx := map[uuid.UUID]int{}
	for _, r := range rows {
		i, ok := idx[r.MachineID]
		if !ok {
			i = len(out)
			idx[r.MachineID] = i
			out = append(out, healthSeries{MachineID: r.MachineID, Code: r.Code, Name: r.Name, Points: []healthPoint{}})
		}
		out[i].Points = append(out[i].Points, healthPoint{
			Ts: r.Ts, Score: r.Score, MinScore: r.MinScore, Status: health.Status(int(r.Score + 0.5)),
			HoursToLimit: r.HoursToLimit, OpenCritical: r.OpenCritical, OpenWarning: r.OpenWarning,
		})
	}
	return c.JSON(fiber.Map{"since": since, "until": now, "bucket": trunc, "machines": out})
}

// POST /api/v1/predictive/health/backfill?days=90  (superadmin)
//
// Rebuilds missing hourly health snapshots for the past N days in the
// background. Existing snapshots are kept. Poll GET .../backfill for progress.
func StartHealthBackfill(c *fiber.Ctx) error {
	days := c.QueryInt("days", 90)
	st, err := health.StartBackfill(days)
	if errors.Is(err, health.ErrBackfillRunning) {
		return c.Status(409).JSON(fiber.Map{"error": err.Error(), "status": st})
	}
	return c.Status(202).JSON(st)
}

// GET /api/v1/predictive/health/backfill  (superadmin)
func GetHealthBackfillStatus(c *fiber.Ctx) error {
	return c.JSON(health.GetBackfillStatus())
}
