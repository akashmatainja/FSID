package health

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/companyuser/backend/database"
)

// Snapshot cadence and retention.
const (
	SnapshotEvery     = 15 * time.Minute     // recompute and upsert the current hour's row
	SnapshotWindow    = 24 * time.Hour       // score window, same as the default API view
	SnapshotRetention = 400 * 24 * time.Hour // ~13 months
)

var warnSnapOnce sync.Once

// StartSnapshots records every machine's health score into
// machine_health_snapshots: one row per machine per hour. It runs immediately,
// then every SnapshotEvery; each run upserts the current hour, so a finished
// hour keeps its last value and the live hour stays fresh.
func StartSnapshots() {
	go func() {
		TakeSnapshot(time.Now())
		t := time.NewTicker(SnapshotEvery)
		defer t.Stop()
		for now := range t.C {
			TakeSnapshot(now)
		}
	}()
	log.Println("[health] snapshot job started")
}

// snapMetric is the compact per-metric record stored in the JSON column.
type snapMetric struct {
	Code         string   `json:"code"`
	Score        int      `json:"score"`
	Latest       *float64 `json:"latest"`
	HoursToLimit *float64 `json:"hours_to_limit"`
}

// TakeSnapshot scores all machines and upserts the row for now's hour.
// Machines without a score (no limits/data) are skipped.
func TakeSnapshot(now time.Time) {
	hour := now.UTC().Truncate(time.Hour)
	n, err := writeSnapshot(now, hour, true)
	if err != nil {
		return
	}
	database.DB.Exec(`DELETE FROM machine_health_snapshots WHERE captured_at < ?`, now.Add(-SnapshotRetention))
	if n > 0 {
		log.Printf("[health] snapshot %s: %d machines", hour.Format("2006-01-02 15:04"), n)
	}
}

// writeSnapshot scores all machines as of `asOf` and stores them under `hour`.
// overwrite=false only fills missing rows (used by backfill so it never
// replaces snapshots the live job recorded). Returns rows written.
func writeSnapshot(asOf, hour time.Time, overwrite bool) (int, error) {
	machines, err := Compute("", nil, asOf.Add(-SnapshotWindow), asOf)
	if err != nil {
		log.Printf("[health] snapshot compute failed: %v", err)
		return 0, err
	}
	conflict := `ON CONFLICT (machine_id, captured_at) DO UPDATE SET
			    score = EXCLUDED.score, status = EXCLUDED.status, hours_to_limit = EXCLUDED.hours_to_limit,
			    open_critical = EXCLUDED.open_critical, open_warning = EXCLUDED.open_warning,
			    metrics = EXCLUDED.metrics, updated_at = now()`
	if !overwrite {
		conflict = `ON CONFLICT (machine_id, captured_at) DO NOTHING`
	}
	n := 0
	for _, m := range machines {
		if m.Score == nil {
			continue
		}
		ms := make([]snapMetric, 0, len(m.Metrics))
		for _, x := range m.Metrics {
			if x.HasData {
				ms = append(ms, snapMetric{Code: x.Code, Score: x.Score, Latest: x.Latest, HoursToLimit: x.HoursToLimit})
			}
		}
		metricsJSON, _ := json.Marshal(ms)
		res := database.DB.Exec(`
			INSERT INTO machine_health_snapshots
			    (company_id, machine_id, module_id, captured_at, score, status, hours_to_limit,
			     open_critical, open_warning, metrics, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, now())
			`+conflict,
			m.CompanyID, m.MachineID, m.ModuleID, hour, *m.Score, m.Status, m.HoursToLimit,
			m.OpenCritical, m.OpenWarning, string(metricsJSON))
		if res.Error != nil {
			warnSnapOnce.Do(func() {
				log.Printf("[health] snapshot write failed (has add_health_snapshots.sql been applied?): %v", res.Error)
			})
			return n, res.Error
		}
		n += int(res.RowsAffected)
	}
	return n, nil
}
