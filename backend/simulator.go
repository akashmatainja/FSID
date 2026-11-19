package main

// Demo data simulator — generates realistic, slowly changing values for every
// machine's module metrics while the OPC UA edge gateway (gateway/) is not in use.
//
//   every 1 s   new values → hub.GlobalHub.Broadcast (live dashboards)
//   every 1 min one sample per metric is written to machine_stats (charts,
//               Data Logs, health score) and checked by alerts.Evaluate
//   every 5 min the machine list is reloaded, so new machines/metrics appear without a restart
//
// Enabled by SIMULATOR_ENABLED (default true). Machines assigned to a gateway
// (machine_opcua.gateway_id) are skipped, so real and simulated data never mix.
// Metrics read by the built-in OPC UA client (OPCUA_DEMO_MACHINES, opcua_client.go)
// are skipped too. When the gateway goes live for everyone, set SIMULATOR_ENABLED=false.

import (
	"log"
	"math"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/companyuser/backend/alerts"
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/hub"
	"github.com/companyuser/backend/models"
	"github.com/google/uuid"
)

const (
	simLiveInterval    = 1 * time.Second
	simStoreInterval   = time.Minute // one stored sample per metric per minute
	simReloadInterval  = 5 * time.Minute
	simCyclePeriodMins = 30.0 // slow sinusoidal drift period
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
	machineID uuid.UUID
	companyID uuid.UUID
	values    map[string]float64    // metricKey → current simulated value
	phase     map[string]float64    // metricKey → drift phase, so machines don't move in lockstep
	metrics   []models.ModuleMetric // active module metrics (deduplicated by code)
}

// DB write buffer — flushed every minute.
var (
	dbBuf   []models.MachineStat
	dbBufMu sync.Mutex
)

// StartOPCUASimulator starts the demo data generator. Call once from main()
// after the hub is running.
func StartOPCUASimulator() {
	go simulationLoop()
}

// gatewayMachines returns machines read by a real OPC UA gateway. Errors (e.g.
// add_opcua_gateways.sql not applied yet) mean "none".
func gatewayMachines() map[uuid.UUID]bool {
	var ids []uuid.UUID
	if err := database.DB.Raw("SELECT machine_id FROM machine_opcua WHERE gateway_id IS NOT NULL").Scan(&ids).Error; err != nil {
		return nil
	}
	set := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	return set
}

// loadStates builds the machine list, keeping current values for machines that
// were already being simulated.
func loadStates(prev map[uuid.UUID]*simState) (map[uuid.UUID]*simState, error) {
	var machines []models.Machine
	if err := database.DB.Preload("Modules.Metrics").Find(&machines).Error; err != nil {
		return prev, err
	}
	skip := gatewayMachines()

	next := make(map[uuid.UUID]*simState, len(machines))
	for _, m := range machines {
		if skip[m.ID] {
			continue
		}
		st := prev[m.ID]
		if st == nil {
			st = &simState{machineID: m.ID, companyID: m.CompanyID, values: map[string]float64{}, phase: map[string]float64{}}
		}
		st.metrics = st.metrics[:0]
		seen := map[string]bool{}
		for _, mod := range m.Modules {
			if !mod.IsActive || strings.EqualFold(mod.Code, "remote_maintenance") {
				continue
			}
			for _, metric := range mod.Metrics {
				key := strings.ToLower(metric.Code)
				if key == "" || seen[key] {
					continue
				}
				seen[key] = true
				if _, ok := st.values[key]; !ok {
					st.values[key] = cfgFor(key).base * (1 + (rand.Float64()*2-1)*0.03)
					st.phase[key] = rand.Float64() * 2 * math.Pi
				}
				st.metrics = append(st.metrics, metric)
			}
		}
		if len(st.metrics) > 0 {
			next[m.ID] = st
		}
	}
	return next, nil
}

// nextValue moves a metric towards a slowly drifting target with a little
// noise, clamped to ±25 % of its base value. Pull and noise are scaled to the
// tick length, so changing simLiveInterval keeps the same overall behaviour.
func nextValue(prev float64, cfg metricCfg, phase float64, now time.Time) float64 {
	k := simLiveInterval.Seconds() / 5 // tuned for 5 s ticks
	pull := 1 - math.Pow(1-0.15, k)
	mins := float64(now.UnixMilli()) / 60000
	target := cfg.base * (1 + 0.08*math.Sin(2*math.Pi*mins/simCyclePeriodMins+phase))
	noise := (rand.Float64()*2 - 1) * cfg.base * cfg.noise * 0.15 * math.Sqrt(k)
	next := prev + pull*(target-prev) + noise
	next = math.Max(cfg.base*0.75, math.Min(cfg.base*1.25, next))
	return math.Round(next*1000) / 1000
}

func simulationLoop() {
	states, err := loadStates(nil)
	if err != nil {
		log.Printf("[SIM] cannot load machines: %v", err)
	}
	log.Printf("[SIM] started: simulating %d machine(s), live every %s, stored every %s", len(states), simLiveInterval, simStoreInterval)

	live := time.NewTicker(simLiveInterval)
	store := time.NewTicker(simStoreInterval)
	reload := time.NewTicker(simReloadInterval)
	defer live.Stop()
	defer store.Stop()
	defer reload.Stop()

	storeDue := true // store the first sample right away
	for {
		select {
		case <-reload.C:
			if fresh, err := loadStates(states); err != nil {
				log.Printf("[SIM] reload failed: %v", err)
			} else {
				if len(fresh) != len(states) {
					log.Printf("[SIM] now simulating %d machine(s)", len(fresh))
				}
				states = fresh
			}
			continue
		case <-store.C:
			storeDue = true
			flushToDB() // writes the samples buffered on the previous minute
			continue
		case <-live.C:
		}

		now := time.Now().UTC()
		var toStore []models.MachineStat
		for _, st := range states {
			payloads := make([]hub.MetricPayload, 0, len(st.metrics))
			for _, metric := range st.metrics {
				key := strings.ToLower(metric.Code)
				if isRealMetric(st.machineID, key) {
					continue // read from the OPC UA server by opcua_client.go
				}
				cfg := cfgFor(key)
				v := nextValue(st.values[key], cfg, st.phase[key], now)
				st.values[key] = v

				unit := cfg.unit
				if metric.Unit != "" {
					unit = metric.Unit
				}
				payloads = append(payloads, hub.MetricPayload{
					MachineID:   st.machineID.String(),
					CompanyID:   st.companyID.String(),
					MetricKey:   key,
					MetricValue: v,
					Timestamp:   now,
					Unit:        unit,
					Source:      "opcua_sim",
				})
				if storeDue {
					// Alerts follow the stored samples (once a minute), so a value
					// hovering at a limit doesn't open/close an alert every second.
					alerts.Evaluate(alerts.Reading{MachineID: st.machineID, MetricKey: key, Value: v, Ts: now})
					toStore = append(toStore, models.MachineStat{
						ID:          uuid.New(),
						CompanyID:   st.companyID,
						MachineID:   st.machineID,
						Ts:          now,
						MetricKey:   key,
						MetricValue: v,
						Meta:        map[string]any{"unit": unit, "source": "opcua_sim"},
					})
				}
			}
			if len(payloads) > 0 {
				hub.GlobalHub.Broadcast(st.machineID.String(), payloads)
			}
		}
		if storeDue {
			storeDue = false
			dbBufMu.Lock()
			dbBuf = append(dbBuf, toStore...)
			dbBufMu.Unlock()
		}
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
	if total < len(batch) {
		log.Printf("[SIM] stored %d of %d stats", total, len(batch))
	}
}
