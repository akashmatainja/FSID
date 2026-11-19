package main

// OPC UA Simulator — generates realistic random metric data for every machine.
//
// Flow:
//   PLC / OPC UA server
//       ↓  (replace simulationLoop body with real opcua.Client reads)
//   simulationLoop  → every 5 s → hub.GlobalHub.Broadcast (WebSocket → dashboard)
//                             → dbBuf (in-memory, flushed to DB every 30 min)
//
// To switch to real OPC UA:
//   1. Add "github.com/gopcua/opcua" to go.mod
//   2. Replace the random-walk block in simulationLoop with actual Node reads.

import (
	"github.com/companyuser/backend/alerts"
	"log"
	"math"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/hub"
	"github.com/companyuser/backend/models"
	"github.com/google/uuid"
)

// metricCfg holds simulation parameters for one metric type.
type metricCfg struct {
	base  float64
	noise float64 // ± noise as a fraction of base
	unit  string
}

// knownMetrics covers the most common industrial / energy metrics.
// Add entries here to support additional metric codes automatically.
var knownMetrics = map[string]metricCfg{
	"voltage":      {base: 415.0, noise: 0.02, unit: "V"},
	"current":      {base: 32.0, noise: 0.15, unit: "A"},
	"power":        {base: 250.0, noise: 0.10, unit: "kW"},
	"energy":       {base: 1250.0, noise: 0.01, unit: "kWh"},
	"power_factor": {base: 0.85, noise: 0.05, unit: ""},
	"frequency":    {base: 50.0, noise: 0.005, unit: "Hz"},
	"temperature":  {base: 65.0, noise: 0.08, unit: "°C"},
	"vibration":    {base: 2.5, noise: 0.30, unit: "mm/s"},
	"pressure":     {base: 6.5, noise: 0.12, unit: "bar"},
	"speed":        {base: 1450.0, noise: 0.05, unit: "RPM"},
	"humidity":     {base: 55.0, noise: 0.10, unit: "%"},
	"co2":          {base: 750.0, noise: 0.15, unit: "ppm"},
	"noise_level":  {base: 72.0, noise: 0.08, unit: "dB"},
	"efficiency":   {base: 88.0, noise: 0.05, unit: "%"},
	"flow_rate":    {base: 120.0, noise: 0.10, unit: "L/min"},
	"torque":       {base: 850.0, noise: 0.12, unit: "Nm"},
	"load":         {base: 75.0, noise: 0.15, unit: "%"},
}

func cfgFor(key string) metricCfg {
	if c, ok := knownMetrics[key]; ok {
		return c
	}
	return metricCfg{base: 100.0, noise: 0.10, unit: ""}
}

// simState tracks current simulated values for one machine.
type simState struct {
	machineID string
	companyID string
	values    map[string]float64    // metricKey → current simulated value
	metrics   []models.ModuleMetric // all active module metrics for this machine
}

// DB write buffer — accumulated in memory and flushed every 30 minutes.
var (
	dbBuf   []models.MachineStat
	dbBufMu sync.Mutex
)

// StartOPCUASimulator loads machines from the DB and starts background goroutines.
// Call once from main() after the hub is running.
func StartOPCUASimulator() {
	var machines []models.Machine
	if err := database.DB.Preload("Modules.Metrics").Find(&machines).Error; err != nil {
		log.Printf("[SIM] cannot load machines: %v", err)
		return
	}

	states := make([]*simState, 0, len(machines))
	for _, m := range machines {
		st := &simState{
			machineID: m.ID.String(),
			companyID: m.CompanyID.String(),
			values:    make(map[string]float64),
		}
		for _, mod := range m.Modules {
			if !mod.IsActive {
				continue
			}
			for _, metric := range mod.Metrics {
				key := strings.ToLower(metric.Code)
				st.values[key] = cfgFor(key).base
				st.metrics = append(st.metrics, metric)
			}
		}
		if len(st.metrics) > 0 {
			states = append(states, st)
		}
	}

	if len(states) == 0 {
		log.Println("[SIM] no machines with active module metrics — simulator idle")
		return
	}
	log.Printf("[SIM] started: simulating %d machine(s)", len(states))

	go dbFlushLoop()
	go simulationLoop(states)
}

// simulationLoop ticks every 1 minute, generates new values, broadcasts, and buffers.
func simulationLoop(states []*simState) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	step := 0
	for range ticker.C {
		step++
		now := time.Now().UTC()

		for _, st := range states {
			payloads := make([]hub.MetricPayload, 0, len(st.metrics))

			for _, metric := range st.metrics {
				key := strings.ToLower(metric.Code)
				cfg := cfgFor(key)

				// ── Random-walk with sinusoidal drift for realism ──────────
				prev := st.values[key]
				sinDrift := math.Sin(float64(step)*0.25) * cfg.base * 0.02
				noiseDelta := (rand.Float64()*2 - 1) * cfg.base * cfg.noise
				next := prev + sinDrift + noiseDelta

				// Clamp to ±25 % of base
				lo := cfg.base * 0.75
				hi := cfg.base * 1.25
				if next < lo {
					next = lo
				}
				if next > hi {
					next = hi
				}
				next = math.Round(next*1000) / 1000
				st.values[key] = next

				// Use DB-stored unit if available, else fall back to known map
				unit := cfg.unit
				if metric.Unit != "" {
					unit = metric.Unit
				}

				payloads = append(payloads, hub.MetricPayload{
					MachineID:   st.machineID,
					CompanyID:   st.companyID,
					MetricKey:   key,
					MetricValue: next,
					Timestamp:   now,
					Unit:        unit,
					Source:      "opcua_sim",
				})
			}

			if len(payloads) == 0 {
				continue
			}

			// ① Real-time: push to WebSocket clients immediately
			hub.GlobalHub.Broadcast(st.machineID, payloads)

			// Limit checks run on live values, not on the delayed DB flush
			if mid, err := uuid.Parse(st.machineID); err == nil {
				for _, p := range payloads {
					alerts.Evaluate(alerts.Reading{MachineID: mid, MetricKey: p.MetricKey, Value: p.MetricValue, Ts: p.Timestamp})
				}
			}

			// ② Persistence: buffer for 30-minute DB flush
			machineID, _ := uuid.Parse(st.machineID)
			companyID, _ := uuid.Parse(st.companyID)

			dbBufMu.Lock()
			for _, p := range payloads {
				dbBuf = append(dbBuf, models.MachineStat{
					ID:          uuid.New(),
					CompanyID:   companyID,
					MachineID:   machineID,
					Ts:          p.Timestamp,
					MetricKey:   p.MetricKey,
					MetricValue: p.MetricValue,
					Meta:        map[string]any{"unit": p.Unit, "source": p.Source},
				})
			}
			dbBufMu.Unlock()
		}
	}
}

// dbFlushLoop triggers a DB write every 30 minutes.
func dbFlushLoop() {
	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		flushToDB()
	}
}

// flushToDB batch-inserts the accumulated buffer then clears it.
func flushToDB() {
	dbBufMu.Lock()
	if len(dbBuf) == 0 {
		dbBufMu.Unlock()
		return
	}
	batch := dbBuf
	dbBuf = nil
	dbBufMu.Unlock()

	const chunkSize = 500
	total := 0
	for i := 0; i < len(batch); i += chunkSize {
		end := i + chunkSize
		if end > len(batch) {
			end = len(batch)
		}
		chunk := batch[i:end]
		if err := database.DB.Create(&chunk).Error; err != nil {
			log.Printf("[SIM] DB flush error: %v", err)
		} else {
			total += end - i
		}
	}
	log.Printf("[SIM] flushed %d stats to DB", total)
}
