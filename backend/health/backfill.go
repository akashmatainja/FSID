package health

import (
	"database/sql"
	"errors"
	"log"
	"sync"
	"time"

	"github.com/companyuser/backend/database"
)

// MaxBackfillDays bounds a backfill request (retention is ~13 months anyway).
const MaxBackfillDays = 400

// pause between hours so API requests can use the (single) DB connection.
const backfillPause = 40 * time.Millisecond

// BackfillStatus reports progress of the current or last backfill run.
type BackfillStatus struct {
	Running     bool       `json:"running"`
	From        *time.Time `json:"from,omitempty"`
	To          *time.Time `json:"to,omitempty"`
	HoursTotal  int        `json:"hours_total"`
	HoursDone   int        `json:"hours_done"`
	RowsWritten int        `json:"rows_written"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	FinishedAt  *time.Time `json:"finished_at,omitempty"`
	Error       string     `json:"error,omitempty"`
}

var (
	bfMu     sync.Mutex
	bfStatus BackfillStatus
)

var ErrBackfillRunning = errors.New("a backfill is already running")

// GetBackfillStatus returns a copy of the current status.
func GetBackfillStatus() BackfillStatus {
	bfMu.Lock()
	defer bfMu.Unlock()
	return bfStatus
}

// StartBackfill reconstructs hourly snapshots for the past `days` days in the
// background. Each past hour H is scored "as of" the end of H (24 h window of
// readings, alerts open at that moment, current metric limits) and inserted
// only if no snapshot exists for that machine and hour — rows the live job
// recorded are never overwritten. The current hour is left to the live job.
//
// Hours before the earliest predictive reading are skipped. Returns the
// planned range, or ErrBackfillRunning.
func StartBackfill(days int) (BackfillStatus, error) {
	if days < 1 {
		days = 1
	}
	if days > MaxBackfillDays {
		days = MaxBackfillDays
	}

	bfMu.Lock()
	if bfStatus.Running {
		s := bfStatus
		bfMu.Unlock()
		return s, ErrBackfillRunning
	}

	now := time.Now().UTC()
	to := now.Truncate(time.Hour) // exclusive: current hour belongs to the live job
	from := to.Add(-time.Duration(days) * 24 * time.Hour)

	// Don't walk hours before any predictive data exists.
	var earliest sql.NullTime
	if row := database.DB.Raw(`
		SELECT MIN(ms.ts) FROM machine_stats ms
		JOIN machine_modules mmod ON mmod.machine_id = ms.machine_id
		JOIN modules mo ON mo.id = mmod.module_id AND lower(mo.code) LIKE '%predict%'
		WHERE ms.ts >= ?`, from).Row(); row != nil {
		_ = row.Scan(&earliest)
	}
	if !earliest.Valid {
		from = to // no predictive readings in range: nothing to do
	} else if e := earliest.Time.UTC().Truncate(time.Hour); e.After(from) {
		from = e
	}

	total := 0
	if to.After(from) {
		total = int(to.Sub(from) / time.Hour)
	}
	started := now
	bfStatus = BackfillStatus{Running: total > 0, From: &from, To: &to, HoursTotal: total, StartedAt: &started}
	if total == 0 {
		bfStatus.FinishedAt = &started
	}
	s := bfStatus
	bfMu.Unlock()

	if total > 0 {
		go runBackfill(from, to)
	}
	return s, nil
}

func runBackfill(from, to time.Time) {
	log.Printf("[health] backfill %s → %s started", from.Format(time.RFC3339), to.Format(time.RFC3339))
	var runErr error
	for h := from; h.Before(to); h = h.Add(time.Hour) {
		// Score as of the last moment of the hour.
		n, err := writeSnapshot(h.Add(time.Hour-time.Second), h, false)
		if err != nil {
			runErr = err
			break
		}
		bfMu.Lock()
		bfStatus.HoursDone++
		bfStatus.RowsWritten += n
		bfMu.Unlock()
		time.Sleep(backfillPause)
	}

	bfMu.Lock()
	fin := time.Now().UTC()
	bfStatus.Running = false
	bfStatus.FinishedAt = &fin
	if runErr != nil {
		bfStatus.Error = runErr.Error()
	}
	log.Printf("[health] backfill finished: %d/%d hours, %d rows written, err=%v",
		bfStatus.HoursDone, bfStatus.HoursTotal, bfStatus.RowsWritten, runErr)
	bfMu.Unlock()
}
