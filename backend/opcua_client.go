package main

// Built-in OPC UA client — demo connection to one OPC UA server (OPCUA_ENDPOINT)
// for the machines listed in OPCUA_DEMO_MACHINES (machine codes or IDs, comma-separated).
// No gateway or API key involved; meant for demos until the edge gateway
// (gateway/) is approved. Requires the backend to reach the server directly.
//
// Which node a metric reads (first match wins):
//   1. machine_metric_nodes override (if add_opcua_gateways.sql is applied)
//   2. the metric's node template (module_metrics.node_id)
//   3. defaultChannelNodes below (ABExON channel "value" nodes)
// Metrics read here are skipped by the simulator; the machine's other metrics
// stay simulated.
//
//   every 1 s   read all nodes → hub broadcast (live dashboards)
//   every 10 s  store a sample per metric in machine_stats + alerts.Evaluate
//   every 60 s  reload machines/metrics (changes apply without a restart)

import (
	"context"
	"fmt"
	"log"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/companyuser/backend/alerts"
	"github.com/companyuser/backend/config"
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/hub"
	"github.com/companyuser/backend/models"
	"github.com/google/uuid"
	"github.com/gopcua/opcua"
	"github.com/gopcua/opcua/ua"
)

const (
	opcPollInterval   = 1 * time.Second
	opcStoreInterval  = 10 * time.Second
	opcReloadInterval = time.Minute
)

// defaultChannelNodes maps metric codes to the ABExON server's channel value
// nodes (ABExON-000_Ch-NN/value = ns=2;i=2003+5*NN), as used by
// opcua_local_demo/opcua_client.py.
var defaultChannelNodes = map[string]string{
	"temperature":  "ns=2;i=2003", // Ch-00
	"humidity":     "ns=2;i=2008", // Ch-01
	"pressure":     "ns=2;i=2013", // Ch-02
	"co2":          "ns=2;i=2018", // Ch-03
	"power":        "ns=2;i=2023", // Ch-04
	"energy":       "ns=2;i=2028", // Ch-05
	"voltage":      "ns=2;i=2033", // Ch-06
	"current":      "ns=2;i=2038", // Ch-07
	"power_factor": "ns=2;i=2043", // Ch-08
}

// ─── Metrics read from OPC UA (shared with the simulator) ─────────────────

var (
	opcRealMu sync.RWMutex
	opcReal   = map[uuid.UUID]map[string]bool{} // machine → metric keys read from OPC UA
)

// isRealMetric reports whether the built-in client supplies this metric, so
// the simulator leaves it alone.
func isRealMetric(machineID uuid.UUID, key string) bool {
	opcRealMu.RLock()
	defer opcRealMu.RUnlock()
	return opcReal[machineID][key]
}

// ─── Targets ──────────────────────────────────────────────────────────────

type opcTarget struct {
	machineID uuid.UUID
	companyID uuid.UUID
	code      string
	metricKey string
	unit      string
	nodeStr   string
	nodeID    *ua.NodeID
}

func demoMachineCodes() []string {
	var codes []string
	for _, c := range strings.Split(config.Cfg.OPCUADemoMachines, ",") {
		if c = strings.TrimSpace(c); c != "" {
			codes = append(codes, strings.ToLower(c))
		}
	}
	return codes
}

// machineNodeOverrides returns per-machine node IDs (machine|metricID → node);
// empty if add_opcua_gateways.sql hasn't been applied.
func machineNodeOverrides(ids []uuid.UUID) map[string]string {
	out := map[string]string{}
	var rows []struct {
		MachineID uuid.UUID
		MetricID  uuid.UUID
		NodeID    string
	}
	if err := database.DB.Raw("SELECT machine_id, metric_id, node_id FROM machine_metric_nodes WHERE machine_id IN ?", ids).
		Scan(&rows).Error; err != nil {
		return out
	}
	for _, r := range rows {
		out[r.MachineID.String()+"|"+r.MetricID.String()] = strings.TrimSpace(r.NodeID)
	}
	return out
}

func loadOPCTargets() ([]opcTarget, error) {
	codes := demoMachineCodes()
	if len(codes) == 0 {
		return nil, nil
	}
	// Entries may be machine codes or machine IDs.
	var machines []models.Machine
	if err := database.DB.Preload("Modules.Metrics").
		Where("lower(code) IN ? OR id::text IN ?", codes, codes).Find(&machines).Error; err != nil {
		return nil, err
	}
	if len(machines) == 0 {
		log.Printf("[OPCUA] no machine matches OPCUA_DEMO_MACHINES=%q (use machine codes or IDs)", config.Cfg.OPCUADemoMachines)
	}
	ids := make([]uuid.UUID, 0, len(machines))
	for _, m := range machines {
		ids = append(ids, m.ID)
	}
	overrides := machineNodeOverrides(ids)

	var targets []opcTarget
	for _, m := range machines {
		before := len(targets)
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
				node := overrides[m.ID.String()+"|"+metric.ID.String()]
				if node == "" {
					node = strings.NewReplacer("{machine_code}", m.Code, "{machine_name}", m.Name, "{metric_code}", metric.Code).
						Replace(strings.TrimSpace(metric.NodeID))
				}
				if node == "" {
					node = defaultChannelNodes[key]
				}
				if node == "" {
					continue
				}
				id, err := ua.ParseNodeID(node)
				if err != nil {
					log.Printf("[OPCUA] %s/%s: invalid node ID %q: %v", m.Code, key, node, err)
					continue
				}
				seen[key] = true
				targets = append(targets, opcTarget{
					machineID: m.ID, companyID: m.CompanyID, code: m.Code,
					metricKey: key, unit: metric.Unit, nodeStr: node, nodeID: id,
				})
			}
		}
		if len(targets) == before {
			var have []string
			for _, mod := range m.Modules {
				for _, mt := range mod.Metrics {
					have = append(have, mt.Code)
				}
			}
			log.Printf("[OPCUA] machine %s has no metric with a node ID (its metric codes: %v; built-in channels: temperature, humidity, pressure, co2, power, energy, voltage, current, power_factor)", m.Code, have)
		}
	}
	return targets, nil
}

func publishRealMetrics(targets []opcTarget) {
	next := map[uuid.UUID]map[string]bool{}
	for _, t := range targets {
		if next[t.machineID] == nil {
			next[t.machineID] = map[string]bool{}
		}
		next[t.machineID][t.metricKey] = true
	}
	opcRealMu.Lock()
	opcReal = next
	opcRealMu.Unlock()
}

// ─── Connection ───────────────────────────────────────────────────────────

func connectOPCUA(ctx context.Context) (*opcua.Client, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	endpoint := config.Cfg.OPCUAEndpoint
	endpoints, err := opcua.GetEndpoints(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("get endpoints: %w", err)
	}
	var ep *ua.EndpointDescription
	for _, e := range endpoints {
		if e.SecurityPolicyURI == ua.SecurityPolicyURINone && e.SecurityMode == ua.MessageSecurityModeNone {
			ep = e
			break
		}
	}
	if ep == nil {
		return nil, fmt.Errorf("server offers no unsecured endpoint (the built-in client only supports security None; use the gateway for secure servers)")
	}

	authType := ua.UserTokenTypeAnonymous
	opts := []opcua.Option{
		opcua.ApplicationName("FSID Backend"),
		opcua.AutoReconnect(false),
		opcua.RequestTimeout(10 * time.Second),
		opcua.DialTimeout(10 * time.Second),
	}
	if config.Cfg.OPCUAUsername != "" {
		authType = ua.UserTokenTypeUserName
		opts = append(opts, opcua.AuthUsername(config.Cfg.OPCUAUsername, config.Cfg.OPCUAPassword))
	} else {
		opts = append(opts, opcua.AuthAnonymous())
	}
	opts = append(opts, opcua.SecurityFromEndpoint(ep, authType))

	c, err := opcua.NewClient(endpoint, opts...)
	if err != nil {
		return nil, err
	}
	if err := c.Connect(ctx); err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	return c, nil
}

// ─── Main loop ────────────────────────────────────────────────────────────

// StartOPCUAClient starts the demo OPC UA connection in the background.
func StartOPCUAClient() {
	if config.Cfg.OPCUAEndpoint == "" || len(demoMachineCodes()) == 0 {
		log.Println("[OPCUA] built-in client idle (set OPCUA_DEMO_MACHINES to machine codes to read from OPCUA_ENDPOINT)")
		return
	}
	go opcuaLoop()
}

func opcuaLoop() {
	ctx := context.Background()
	var (
		client     *opcua.Client
		targets    []opcTarget
		nextReload time.Time
		nextStore  time.Time
		failures   int
		retryAt    time.Time
		lastErr    string
	)

	disconnect := func(err error) {
		if client != nil {
			cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
			_ = client.Close(cctx)
			cancel()
			client = nil
		}
		failures++
		retryAt = time.Now().Add(time.Duration(math.Min(60, math.Pow(2, float64(failures)))) * time.Second)
		if err.Error() != lastErr {
			log.Printf("[OPCUA] %v (retrying, next attempt in %s)", err, time.Until(retryAt).Round(time.Second))
			lastErr = err.Error()
		}
	}

	ticker := time.NewTicker(opcPollInterval)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()

		if now.After(nextReload) {
			t, err := loadOPCTargets()
			if err != nil {
				log.Printf("[OPCUA] cannot load machines: %v", err)
			} else {
				if len(t) != len(targets) {
					log.Printf("[OPCUA] reading %d metric(s) for machine(s) %s from %s", len(t), config.Cfg.OPCUADemoMachines, config.Cfg.OPCUAEndpoint)
				}
				targets = t
				publishRealMetrics(targets)
			}
			nextReload = now.Add(opcReloadInterval)
		}
		if len(targets) == 0 {
			continue
		}

		if client == nil || client.State() != opcua.Connected {
			if client != nil {
				disconnect(fmt.Errorf("connection lost"))
				continue
			}
			if now.Before(retryAt) {
				continue
			}
			c, err := connectOPCUA(ctx)
			if err != nil {
				disconnect(fmt.Errorf("cannot connect to %s: %w", config.Cfg.OPCUAEndpoint, err))
				continue
			}
			client, failures, lastErr = c, 0, ""
			log.Printf("[OPCUA] connected to %s", config.Cfg.OPCUAEndpoint)
		}

		req := &ua.ReadRequest{TimestampsToReturn: ua.TimestampsToReturnNeither, NodesToRead: make([]*ua.ReadValueID, len(targets))}
		for i, t := range targets {
			req.NodesToRead[i] = &ua.ReadValueID{NodeID: t.nodeID, AttributeID: ua.AttributeIDValue}
		}
		rctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		resp, err := client.Read(rctx, req)
		cancel()
		if err != nil || len(resp.Results) != len(targets) {
			if err == nil {
				err = fmt.Errorf("unexpected result count")
			}
			disconnect(fmt.Errorf("read failed: %w", err))
			continue
		}

		store := now.After(nextStore)
		if store {
			nextStore = now.Add(opcStoreInterval)
		}
		ts := now.UTC()
		byMachine := map[uuid.UUID][]hub.MetricPayload{}
		var stats []models.MachineStat
		for i, dv := range resp.Results {
			t := targets[i]
			if dv == nil || dv.Status != ua.StatusOK || dv.Value == nil {
				continue
			}
			v, ok := opcToFloat(dv.Value.Value())
			if !ok {
				continue
			}
			byMachine[t.machineID] = append(byMachine[t.machineID], hub.MetricPayload{
				MachineID: t.machineID.String(), CompanyID: t.companyID.String(), MetricKey: t.metricKey,
				MetricValue: v, Timestamp: ts, Unit: t.unit, Source: "opcua_real",
			})
			if store {
				stats = append(stats, models.MachineStat{
					ID: uuid.New(), CompanyID: t.companyID, MachineID: t.machineID, Ts: ts,
					MetricKey: t.metricKey, MetricValue: v,
					Meta: map[string]any{"unit": t.unit, "source": "opcua_real", "node_id": t.nodeStr},
				})
			}
		}
		for id, p := range byMachine {
			hub.GlobalHub.Broadcast(id.String(), p)
		}
		if len(stats) > 0 {
			if err := database.DB.Create(&stats).Error; err != nil {
				log.Printf("[OPCUA] store failed: %v", err)
			} else {
				alerts.EvaluateStats(stats)
			}
		}
	}
}

func opcToFloat(v any) (float64, bool) {
	var f float64
	switch x := v.(type) {
	case float64:
		f = x
	case float32:
		f = float64(x)
	case int8:
		f = float64(x)
	case int16:
		f = float64(x)
	case int32:
		f = float64(x)
	case int64:
		f = float64(x)
	case uint8:
		f = float64(x)
	case uint16:
		f = float64(x)
	case uint32:
		f = float64(x)
	case uint64:
		f = float64(x)
	case bool:
		if x {
			f = 1
		}
	default:
		return 0, false
	}
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return 0, false
	}
	return f, true
}
