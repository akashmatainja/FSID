package main

// Real OPC UA client — connects to the configured OPC UA server and reads node values.
//
// This replaces the simulator with actual machine data from the OPC UA server.
// The client polls nodes periodically and broadcasts updates via the WebSocket hub.

import (
	"context"
	"github.com/companyuser/backend/alerts"
	"log"
	"strings"
	"time"

	"github.com/companyuser/backend/config"
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/hub"
	"github.com/companyuser/backend/models"
	"github.com/google/uuid"
	"github.com/gopcua/opcua"
	"github.com/gopcua/opcua/ua"
)

// StartOPCUAClient connects to the OPC UA server and starts polling machines.
func StartOPCUAClient() {
	endpoint := config.Cfg.OPCUAEndpoint
	if endpoint == "" {
		log.Println("[OPCUA] no endpoint configured, client disabled")
		return
	}

	log.Printf("[OPCUA] connecting to %s", endpoint)

	// Load machines with active module metrics with retry logic
	var machines []models.Machine
	var err error
	for i := 0; i < 5; i++ {
		err = database.DB.Preload("Modules.Metrics").Find(&machines).Error
		if err == nil {
			break
		}
		log.Printf("[OPCUA] retry %d/5 loading machines: %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Printf("[OPCUA] cannot load machines after retries: %v", err)
		return
	}

	// Connect to OPC UA server
	ctx := context.Background()
	client, err := opcua.NewClient(endpoint, opcua.SecurityMode(ua.MessageSecurityModeNone))
	if err != nil {
		log.Printf("[OPCUA] failed to create client: %v", err)
		return
	}

	if err := client.Connect(ctx); err != nil {
		log.Printf("[OPCUA] failed to connect: %v", err)
		return
	}
	defer client.Close(ctx)

	log.Println("[OPCUA] connected successfully")

	// Get server endpoints
	endpoints, err := client.GetEndpoints(ctx)
	if err != nil {
		log.Printf("[OPCUA] failed to get endpoints: %v", err)
	} else {
		log.Printf("[OPCUA] server endpoints: %d found", len(endpoints.Endpoints))
		for i, ep := range endpoints.Endpoints {
			log.Printf("[OPCUA]   endpoint %d: %s (security: %s)", i+1, ep.EndpointURL, ep.SecurityMode)
		}
	}

	// Get namespaces
	namespaces := client.Namespaces()
	log.Printf("[OPCUA] namespaces: %v", namespaces)

	// Build node ID mapping for each machine
	type machineNodes struct {
		machineID string
		companyID string
		nodeIDs   map[string]string // metricKey → nodeID
	}
	machineNodeList := make([]machineNodes, 0)

	for _, m := range machines {
		nodeIDs := make(map[string]string)
		for _, mod := range m.Modules {
			if !mod.IsActive {
				continue
			}
			for _, metric := range mod.Metrics {
				// Use metric's node_id if available, otherwise construct from code
				nodeID := metric.NodeID
				if nodeID == "" {
					// Default: ns=2;s=<metric_code>
					nodeID = strings.ToLower(metric.Code)
				}
				key := strings.ToLower(metric.Code)
				nodeIDs[key] = nodeID
			}
		}

		if len(nodeIDs) > 0 {
			machineNodeList = append(machineNodeList, machineNodes{
				machineID: m.ID.String(),
				companyID: m.CompanyID.String(),
				nodeIDs:   nodeIDs,
			})
		}
	}

	log.Printf("[OPCUA] monitoring %d machine(s)", len(machineNodeList))

	// Poll nodes every 5 seconds
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		for _, mn := range machineNodeList {
			readMachineNodes(ctx, client, mn)
		}
	}
}

func readMachineNodes(ctx context.Context, client *opcua.Client, mn struct {
	machineID string
	companyID string
	nodeIDs   map[string]string
}) {
	req := &ua.ReadRequest{
		MaxAge:             2000,
		TimestampsToReturn: ua.TimestampsToReturnBoth,
		NodesToRead:        make([]*ua.ReadValueID, 0, len(mn.nodeIDs)),
	}

	var metricKeys []string
	for metricKey, nodeIDStr := range mn.nodeIDs {
		nodeID, err := ua.ParseNodeID(nodeIDStr)
		if err != nil {
			log.Printf("[OPCUA] invalid node ID %s for metric %s: %v", nodeIDStr, metricKey, err)
			continue
		}
		req.NodesToRead = append(req.NodesToRead, &ua.ReadValueID{
			NodeID:      nodeID,
			AttributeID: ua.AttributeIDValue,
		})
		metricKeys = append(metricKeys, metricKey)
	}

	if len(req.NodesToRead) == 0 {
		return
	}

	resp, err := client.Read(ctx, req)
	if err != nil {
		log.Printf("[OPCUA] read error for machine %s: %v", mn.machineID, err)
		return
	}

	now := time.Now().UTC()
	payloads := make([]hub.MetricPayload, 0, len(resp.Results))

	for i, res := range resp.Results {
		if res.Status != ua.StatusOK {
			log.Printf("[OPCUA] node %s (ID: %s) returned status %s - skipping", metricKeys[i], mn.nodeIDs[metricKeys[i]], res.Status)
			continue
		}

		val, ok := res.Value.Value().(float64)
		if !ok {
			// Try to convert to float64
			switch v := res.Value.Value().(type) {
			case float32:
				val = float64(v)
			case int, int8, int16, int32, int64:
				val = float64(v.(int))
			case uint, uint8, uint16, uint32, uint64:
				val = float64(v.(uint))
			default:
				log.Printf("[OPCUA] unsupported type for %s: %T", metricKeys[i], res.Value.Value())
				continue
			}
		}

		payloads = append(payloads, hub.MetricPayload{
			MachineID:   mn.machineID,
			CompanyID:   mn.companyID,
			MetricKey:   metricKeys[i],
			MetricValue: val,
			Timestamp:   now,
			Unit:        "",
			Source:      "opcua_real",
		})
	}

	if len(payloads) == 0 {
		return
	}

	// Broadcast to WebSocket
	hub.GlobalHub.Broadcast(mn.machineID, payloads)

	// Store in database
	machineID, _ := uuid.Parse(mn.machineID)
	companyID, _ := uuid.Parse(mn.companyID)
	stats := make([]models.MachineStat, 0, len(payloads))
	for _, p := range payloads {
		stats = append(stats, models.MachineStat{
			ID:          uuid.New(),
			CompanyID:   companyID,
			MachineID:   machineID,
			Ts:          p.Timestamp,
			MetricKey:   p.MetricKey,
			MetricValue: p.MetricValue,
			Meta:        map[string]any{"unit": p.Unit, "source": p.Source},
		})
	}
	if err := database.DB.Create(&stats).Error; err != nil {
		log.Printf("[OPCUA] DB write error: %v", err)
		return
	}
	alerts.EvaluateStats(stats)
}
