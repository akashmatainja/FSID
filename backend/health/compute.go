package health

import (
	"math"
	"sort"
	"strings"
	"time"

	"github.com/companyuser/backend/database"
	"github.com/google/uuid"
)

// MetricHealth is one metric's contribution to a machine's score.
type MetricHealth struct {
	MetricID uuid.UUID `json:"metric_id"`
	Code     string    `json:"code"`
	Name     string    `json:"name"`
	Unit     string    `json:"unit"`
	Latest   *float64  `json:"latest"`
	Samples  int64     `json:"samples"`
	MetricResult
	HasData bool `json:"has_data"`
}

// MachineHealth is the scored state of one machine.
type MachineHealth struct {
	MachineID    uuid.UUID      `json:"machine_id"`
	CompanyID    uuid.UUID      `json:"company_id"`
	ModuleID     uuid.UUID      `json:"module_id"`
	Code         string         `json:"code"`
	Name         string         `json:"name"`
	Score        *int           `json:"score"`  // nil when no metric has limits + data
	Status       string         `json:"status"` // good | watch | critical | unknown
	HoursToLimit *float64       `json:"hours_to_limit"`
	LimitMetric  string         `json:"limit_metric,omitempty"` // metric with the soonest limit
	OpenCritical int64          `json:"open_critical"`
	OpenWarning  int64          `json:"open_warning"`
	Metrics      []MetricHealth `json:"metrics"`
}

// Compute scores every machine with the predictive module (the active module
// whose code contains "predict") over [since, now].
//
// scope is an optional SQL condition on `m` (machines) with its args, used to
// restrict to the machines a caller may see; pass "" for all machines.
func Compute(scope string, scopeArgs []any, since, now time.Time) ([]MachineHealth, error) {
	window := now.Sub(since)
	// ~48 buckets across the window, at least one minute each
	bucketSecs := math.Max(60, math.Round(window.Seconds()/48))

	and := func(sql string) string {
		if scope == "" {
			return sql
		}
		return sql + " AND " + scope
	}

	// 1. Machines with the predictive module, and its metrics/limits
	type metaRow struct {
		MachineID   uuid.UUID
		CompanyID   uuid.UUID
		MachineCode string
		MachineName string
		ModuleID    uuid.UUID
		MetricID    uuid.UUID
		MetricCode  string
		MetricName  string
		Unit        string
		WarnMin     *float64
		WarnMax     *float64
		CritMin     *float64
		CritMax     *float64
	}
	var meta []metaRow
	metaSQL := `
		SELECT m.id AS machine_id, m.company_id, m.code AS machine_code, m.name AS machine_name,
		       mo.id AS module_id, mm.id AS metric_id, mm.code AS metric_code, mm.name AS metric_name, mm.unit,
		       mm.warn_min, mm.warn_max, mm.crit_min, mm.crit_max
		FROM machines m
		JOIN machine_modules mmod ON mmod.machine_id = m.id
		JOIN modules mo           ON mo.id = mmod.module_id AND mo.is_active AND lower(mo.code) LIKE '%predict%'
		JOIN module_metrics mm    ON mm.module_id = mo.id
		WHERE 1=1`
	if err := database.DB.Raw(and(metaSQL)+" ORDER BY m.code, mm.created_at", scopeArgs...).Scan(&meta).Error; err != nil {
		return nil, err
	}
	if len(meta) == 0 {
		return []MachineHealth{}, nil
	}

	machineIDs := []uuid.UUID{}
	moduleIDs := []uuid.UUID{}
	seenM, seenMod := map[uuid.UUID]bool{}, map[uuid.UUID]bool{}
	for _, r := range meta {
		if !seenM[r.MachineID] {
			seenM[r.MachineID] = true
			machineIDs = append(machineIDs, r.MachineID)
		}
		if !seenMod[r.ModuleID] {
			seenMod[r.ModuleID] = true
			moduleIDs = append(moduleIDs, r.ModuleID)
		}
	}

	// 2. Bucketed readings for the module's metrics
	type bucketRow struct {
		MachineID uuid.UUID
		MetricID  uuid.UUID
		Bucket    time.Time
		Avg       float64
		N         int64
		InLimits  int64
	}
	var brs []bucketRow
	if err := database.DB.Raw(`
		SELECT ms.machine_id, mm.id AS metric_id,
		       to_timestamp(floor(extract(epoch FROM ms.ts) / ?) * ?) AS bucket,
		       AVG(ms.metric_value) AS avg, COUNT(*) AS n,
		       COUNT(*) FILTER (WHERE
		           (mm.warn_max IS NULL OR ms.metric_value <= mm.warn_max) AND
		           (mm.warn_min IS NULL OR ms.metric_value >= mm.warn_min) AND
		           (mm.crit_max IS NULL OR ms.metric_value <= mm.crit_max) AND
		           (mm.crit_min IS NULL OR ms.metric_value >= mm.crit_min)) AS in_limits
		FROM machine_stats ms
		JOIN module_metrics mm ON mm.module_id IN ? AND lower(mm.code) = lower(ms.metric_key)
		WHERE ms.machine_id IN ? AND ms.ts >= ? AND ms.ts <= ?
		GROUP BY 1, 2, 3`,
		bucketSecs, bucketSecs, moduleIDs, machineIDs, since, now).Scan(&brs).Error; err != nil {
		return nil, err
	}

	// 3. Latest reading per machine/metric inside the window
	type latestRow struct {
		MachineID uuid.UUID
		Key       string
		Value     float64
	}
	var lrs []latestRow
	database.DB.Raw(`
		SELECT DISTINCT ON (ms.machine_id, lower(ms.metric_key))
		       ms.machine_id, lower(ms.metric_key) AS key, ms.metric_value AS value
		FROM machine_stats ms
		WHERE ms.machine_id IN ? AND ms.ts >= ? AND ms.ts <= ?
		ORDER BY ms.machine_id, lower(ms.metric_key), ms.ts DESC`, machineIDs, since, now).Scan(&lrs)
	latest := map[string]float64{}
	for _, l := range lrs {
		latest[l.MachineID.String()+"|"+l.Key] = l.Value
	}

	// 4. Predictive alerts that were open at `now` (works for backfill too).
	// Severity is the alert's final severity; escalation history isn't stored.
	type alertRow struct {
		MachineID uuid.UUID
		Severity  string
		N         int64
	}
	var ars []alertRow
	_ = database.DB.Raw(`
		SELECT machine_id, severity, COUNT(*) AS n FROM alerts
		WHERE module_id IN ? AND machine_id IN ?
		  AND started_at <= ? AND (resolved_at IS NULL OR resolved_at > ?)
		GROUP BY 1, 2`, moduleIDs, machineIDs, now, now).Scan(&ars).Error
	crit, warn := map[uuid.UUID]int64{}, map[uuid.UUID]int64{}
	for _, a := range ars {
		if a.Severity == "critical" {
			crit[a.MachineID] += a.N
		} else {
			warn[a.MachineID] += a.N
		}
	}

	buckets := map[string][]Bucket{}
	for _, b := range brs {
		k := b.MachineID.String() + "|" + b.MetricID.String()
		mid := b.Bucket.Add(time.Duration(bucketSecs/2) * time.Second)
		buckets[k] = append(buckets[k], Bucket{Hours: mid.Sub(now).Hours(), Avg: b.Avg, Samples: b.N, InLimits: b.InLimits})
	}

	// 5. Score
	byMachine := map[uuid.UUID]*MachineHealth{}
	order := []uuid.UUID{}
	for _, r := range meta {
		mh := byMachine[r.MachineID]
		if mh == nil {
			mh = &MachineHealth{
				MachineID: r.MachineID, CompanyID: r.CompanyID, ModuleID: r.ModuleID,
				Code: r.MachineCode, Name: r.MachineName,
				OpenCritical: crit[r.MachineID], OpenWarning: warn[r.MachineID],
				Metrics: []MetricHealth{}, Status: "unknown",
			}
			byMachine[r.MachineID] = mh
			order = append(order, r.MachineID)
		}
		lim := Limits{WarnMin: r.WarnMin, WarnMax: r.WarnMax, CritMin: r.CritMin, CritMax: r.CritMax}
		if !lim.Any() {
			continue // metrics without limits don't contribute
		}
		hm := MetricHealth{MetricID: r.MetricID, Code: r.MetricCode, Name: r.MetricName, Unit: r.Unit}
		v, ok := latest[r.MachineID.String()+"|"+strings.ToLower(r.MetricCode)]
		bs := buckets[r.MachineID.String()+"|"+r.MetricID.String()]
		sort.Slice(bs, func(i, j int) bool { return bs[i].Hours < bs[j].Hours })
		for _, b := range bs {
			hm.Samples += b.Samples
		}
		if ok {
			hm.Latest = &v
			hm.HasData = true
			hm.MetricResult = ScoreMetric(MetricInput{Limits: lim, Latest: v, Buckets: bs})
		}
		mh.Metrics = append(mh.Metrics, hm)
	}

	out := make([]MachineHealth, 0, len(order))
	for _, id := range order {
		mh := byMachine[id]
		scores := []int{}
		for _, m := range mh.Metrics {
			if !m.HasData {
				continue
			}
			scores = append(scores, m.Score)
			if m.HoursToLimit != nil && (mh.HoursToLimit == nil || *m.HoursToLimit < *mh.HoursToLimit) {
				h := *m.HoursToLimit
				mh.HoursToLimit = &h
				mh.LimitMetric = m.Name
			}
		}
		if s, ok := MachineScore(scores, mh.OpenCritical, mh.OpenWarning); ok {
			mh.Score = &s
			mh.Status = Status(s)
		}
		out = append(out, *mh)
	}
	return out, nil
}
