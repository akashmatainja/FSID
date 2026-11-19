// Package alerts turns incoming machine readings into limit-breach alerts.
//
// Every ingest path calls Evaluate / EvaluateStats after storing readings. A
// single worker goroutine checks each reading against the limits configured on
// the module metrics assigned to that machine and keeps the alerts table in
// sync:
//
//   - reading outside a limit, no open alert      → open a new alert
//   - worse severity than the open alert          → escalate (warning → critical)
//   - still outside, same severity                → track peak / last_seen (throttled)
//   - reading back inside the limits              → resolve the open alert
//
// Limits are cached per machine for cacheTTL; call Invalidate after limits or
// module assignments change. Open-alert state is cached in memory and seeded
// from the DB the first time a machine is seen, so writes only happen on
// transitions.
package alerts

import (
	"fmt"
	"log"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/models"
	"github.com/google/uuid"
	"gorm.io/gorm/clause"
)

const (
	cacheTTL      = 60 * time.Second
	touchInterval = 60 * time.Second // min gap between last_seen/peak updates
	queueSize     = 8192
)

// Reading is one metric value to check.
type Reading struct {
	MachineID uuid.UUID
	MetricKey string
	Value     float64
	Ts        time.Time
}

type rule struct {
	ModuleID   uuid.UUID
	MetricID   uuid.UUID
	MetricName string
	Unit       string
	WarnMin    *float64
	WarnMax    *float64
	CritMin    *float64
	CritMax    *float64
}

type machineRules struct {
	companyID   uuid.UUID
	machineCode string
	byKey       map[string][]rule
	loadedAt    time.Time
}

type openAlert struct {
	id        uuid.UUID
	severity  string
	direction string
	peak      float64
	lastWrite time.Time
}

var (
	procMu     sync.Mutex // serialises process() (inline mode may be concurrent)
	cacheMu    sync.Mutex
	rulesCache = map[uuid.UUID]*machineRules{}
	open       = map[uuid.UUID]map[string]*openAlert{} // machine → "metric|module" → alert
	queue      chan Reading
	warnedOnce sync.Once
)

// Start launches the background worker. Without it (e.g. serverless),
// readings are evaluated inline.
func Start() {
	queue = make(chan Reading, queueSize)
	go func() {
		for r := range queue {
			process(r)
		}
	}()
	log.Println("[alerts] worker started")
}

// Evaluate queues a reading for limit checks. Never blocks the caller.
func Evaluate(r Reading) {
	if r.Ts.IsZero() {
		r.Ts = time.Now()
	}
	r.MetricKey = strings.ToLower(r.MetricKey)
	if queue == nil {
		process(r)
		return
	}
	select {
	case queue <- r:
	default:
		log.Printf("[alerts] queue full, dropped reading %s/%s", r.MachineID, r.MetricKey)
	}
}

// EvaluateStats is a convenience for a batch of stored stats.
func EvaluateStats(stats []models.MachineStat) {
	for _, s := range stats {
		Evaluate(Reading{MachineID: s.MachineID, MetricKey: s.MetricKey, Value: s.MetricValue, Ts: s.Ts})
	}
}

// Invalidate drops cached limits so the next reading reloads them.
func Invalidate() {
	cacheMu.Lock()
	rulesCache = map[uuid.UUID]*machineRules{}
	cacheMu.Unlock()
}

func process(r Reading) {
	procMu.Lock()
	defer procMu.Unlock()

	mr := getRules(r.MachineID)
	if mr == nil {
		return
	}
	ensureOpenLoaded(r.MachineID)

	rules := mr.byKey[r.MetricKey]
	stillRuled := map[string]bool{}

	for _, ru := range rules {
		k := r.MetricKey + "|" + ru.ModuleID.String()
		stillRuled[k] = true
		sev, dir, lim := classify(r.Value, ru)
		cur := open[r.MachineID][k]

		switch {
		case sev == "" && cur != nil:
			resolve(r.MachineID, k, cur, r.Ts)

		case sev != "" && cur == nil:
			create(mr, r, ru, sev, dir, lim)

		case sev != "" && cur != nil:
			if rank(sev) > rank(cur.severity) || dir != cur.direction {
				escalate(mr, r, ru, cur, sev, dir, lim)
			} else {
				worse := (dir == "high" && r.Value > cur.peak) || (dir == "low" && r.Value < cur.peak)
				if worse {
					cur.peak = r.Value
				}
				if r.Ts.Sub(cur.lastWrite) >= touchInterval {
					touch(cur, r.Ts)
				}
			}
		}
	}

	// Limits removed (or module unassigned) while an alert was open → resolve it.
	for k, cur := range open[r.MachineID] {
		if strings.HasPrefix(k, r.MetricKey+"|") && !stillRuled[k] {
			resolve(r.MachineID, k, cur, r.Ts)
		}
	}
}

// classify returns severity ("" when inside limits), direction and the breached limit.
func classify(v float64, ru rule) (string, string, float64) {
	switch {
	case ru.CritMax != nil && v > *ru.CritMax:
		return "critical", "high", *ru.CritMax
	case ru.CritMin != nil && v < *ru.CritMin:
		return "critical", "low", *ru.CritMin
	case ru.WarnMax != nil && v > *ru.WarnMax:
		return "warning", "high", *ru.WarnMax
	case ru.WarnMin != nil && v < *ru.WarnMin:
		return "warning", "low", *ru.WarnMin
	}
	return "", "", 0
}

func rank(sev string) int {
	if sev == "critical" {
		return 2
	}
	if sev == "warning" {
		return 1
	}
	return 0
}

func message(mr *machineRules, ru rule, v float64, sev, dir string, lim float64) string {
	side := "above"
	if dir == "low" {
		side = "below"
	}
	unit := ""
	if ru.Unit != "" {
		unit = " " + ru.Unit
	}
	return fmt.Sprintf("%s — %s at %s%s, %s %s limit %s%s",
		mr.machineCode, ru.MetricName, num(v), unit, side, sev, num(lim), unit)
}

func num(v float64) string {
	a := math.Abs(v)
	switch {
	case a >= 100:
		return fmt.Sprintf("%.0f", v)
	case a >= 10:
		return fmt.Sprintf("%.1f", v)
	default:
		return fmt.Sprintf("%.2f", v)
	}
}

// ── persistence ────────────────────────────────────────────────────────────

func create(mr *machineRules, r Reading, ru rule, sev, dir string, lim float64) {
	moduleID, metricID := ru.ModuleID, ru.MetricID
	a := models.Alert{
		ID:           uuid.New(),
		CompanyID:    mr.companyID,
		MachineID:    r.MachineID,
		ModuleID:     &moduleID,
		MetricID:     &metricID,
		MetricKey:    r.MetricKey,
		Severity:     sev,
		Direction:    dir,
		TriggerValue: r.Value,
		PeakValue:    r.Value,
		LimitValue:   lim,
		Unit:         ru.Unit,
		Message:      message(mr, ru, r.Value, sev, dir, lim),
		Status:       "open",
		StartedAt:    r.Ts,
		LastSeenAt:   r.Ts,
	}
	res := database.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&a)
	if res.Error != nil {
		log.Printf("[alerts] create failed: %v", res.Error)
		return
	}
	k := r.MetricKey + "|" + moduleID.String()
	if res.RowsAffected == 0 {
		// Another instance opened it first; adopt the existing row.
		var existing models.Alert
		if database.DB.Where("machine_id = ? AND metric_key = ? AND module_id = ? AND status = 'open'",
			r.MachineID, r.MetricKey, moduleID).First(&existing).Error == nil {
			open[r.MachineID][k] = &openAlert{existing.ID, existing.Severity, existing.Direction, existing.PeakValue, r.Ts}
		}
		return
	}
	open[r.MachineID][k] = &openAlert{a.ID, sev, dir, r.Value, r.Ts}
	log.Printf("[alerts] opened %s: %s", sev, a.Message)
}

func escalate(mr *machineRules, r Reading, ru rule, cur *openAlert, sev, dir string, lim float64) {
	if err := database.DB.Model(&models.Alert{}).Where("id = ?", cur.id).Updates(map[string]any{
		"severity":     sev,
		"direction":    dir,
		"limit_value":  lim,
		"peak_value":   r.Value,
		"message":      message(mr, ru, r.Value, sev, dir, lim),
		"last_seen_at": r.Ts,
		"updated_at":   time.Now(),
		// a worse breach needs fresh attention
		"acknowledged_at": nil,
		"acknowledged_by": nil,
	}).Error; err != nil {
		log.Printf("[alerts] escalate failed: %v", err)
		return
	}
	cur.severity, cur.direction, cur.peak, cur.lastWrite = sev, dir, r.Value, r.Ts
}

func touch(cur *openAlert, ts time.Time) {
	database.DB.Model(&models.Alert{}).Where("id = ?", cur.id).Updates(map[string]any{
		"peak_value": cur.peak, "last_seen_at": ts, "updated_at": time.Now(),
	})
	cur.lastWrite = ts
}

func resolve(machineID uuid.UUID, k string, cur *openAlert, ts time.Time) {
	if err := database.DB.Model(&models.Alert{}).Where("id = ?", cur.id).Updates(map[string]any{
		"status": "resolved", "resolved_at": ts, "peak_value": cur.peak, "last_seen_at": ts, "updated_at": time.Now(),
	}).Error; err != nil {
		log.Printf("[alerts] resolve failed: %v", err)
		return
	}
	delete(open[machineID], k)
}

// ── caches ─────────────────────────────────────────────────────────────────

func getRules(machineID uuid.UUID) *machineRules {
	cacheMu.Lock()
	mr := rulesCache[machineID]
	cacheMu.Unlock()
	if mr != nil && time.Since(mr.loadedAt) < cacheTTL {
		return mr
	}

	type row struct {
		CompanyID   uuid.UUID
		MachineCode string
		ModuleID    uuid.UUID
		MetricID    uuid.UUID
		MetricName  string
		Unit        string
		Key         string
		WarnMin     *float64
		WarnMax     *float64
		CritMin     *float64
		CritMax     *float64
	}
	var rows []row
	err := database.DB.Raw(`
		SELECT m.company_id, m.code AS machine_code,
		       mm.module_id, mm.id AS metric_id, mm.name AS metric_name, mm.unit,
		       lower(mm.code) AS key, mm.warn_min, mm.warn_max, mm.crit_min, mm.crit_max
		FROM machines m
		JOIN machine_modules mmod ON mmod.machine_id = m.id
		JOIN modules mo           ON mo.id = mmod.module_id AND mo.is_active
		JOIN module_metrics mm    ON mm.module_id = mmod.module_id
		WHERE m.id = ?
		  AND (mm.warn_min IS NOT NULL OR mm.warn_max IS NOT NULL
		       OR mm.crit_min IS NOT NULL OR mm.crit_max IS NOT NULL)`, machineID).Scan(&rows).Error
	if err != nil {
		warnedOnce.Do(func() {
			log.Printf("[alerts] cannot load metric limits (has add_metric_limits_and_alerts.sql been applied?): %v", err)
		})
		rows = nil
	}

	mr = &machineRules{byKey: map[string][]rule{}, loadedAt: time.Now()}
	if len(rows) > 0 {
		mr.companyID, mr.machineCode = rows[0].CompanyID, rows[0].MachineCode
	} else {
		// Still need company/code to resolve alerts whose limits were removed.
		var m models.Machine
		if database.DB.Select("id, company_id, code").First(&m, "id = ?", machineID).Error == nil {
			mr.companyID, mr.machineCode = m.CompanyID, m.Code
		}
	}
	for _, rw := range rows {
		mr.byKey[rw.Key] = append(mr.byKey[rw.Key], rule{
			ModuleID: rw.ModuleID, MetricID: rw.MetricID, MetricName: rw.MetricName, Unit: rw.Unit,
			WarnMin: rw.WarnMin, WarnMax: rw.WarnMax, CritMin: rw.CritMin, CritMax: rw.CritMax,
		})
	}

	cacheMu.Lock()
	rulesCache[machineID] = mr
	cacheMu.Unlock()
	return mr
}

func ensureOpenLoaded(machineID uuid.UUID) {
	if _, ok := open[machineID]; ok {
		return
	}
	open[machineID] = map[string]*openAlert{}
	var rows []models.Alert
	if err := database.DB.Where("machine_id = ? AND status = 'open'", machineID).Find(&rows).Error; err != nil {
		return
	}
	for _, a := range rows {
		mod := ""
		if a.ModuleID != nil {
			mod = a.ModuleID.String()
		}
		open[machineID][a.MetricKey+"|"+mod] = &openAlert{a.ID, a.Severity, a.Direction, a.PeakValue, a.LastSeenAt}
	}
}
