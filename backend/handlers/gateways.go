package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/companyuser/backend/alerts"
	"github.com/companyuser/backend/database"
	"github.com/companyuser/backend/hub"
	"github.com/companyuser/backend/middleware"
	"github.com/companyuser/backend/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/gopcua/opcua/ua"
	"gorm.io/gorm"
)

// OPC UA edge gateways (schema: add_opcua_gateways.sql, agent: gateway/).
//
// Admin API (JWT):    /api/v1/gateways…, /api/v1/machines/:id/opcua
// Gateway API (key):  /gateway/v1/config, /gateway/v1/ingest, /gateway/v1/status
//
// Which OPC UA node a gateway reads for a machine's metric:
//   1. machine_metric_nodes.node_id (per-machine override), else
//   2. module_metrics.node_id as a template ({machine_code}, {machine_name}, {metric_code}), else
//   3. nothing — the metric is not read.

const (
	gatewayOnlineWindow   = 90 * time.Second
	gatewayMaxBatch       = 5000
	gatewayLiveWindow     = 2 * time.Minute // older (buffered) readings are stored but not pushed to live sockets
	gatewayMaxFutureSkew  = 5 * time.Minute
	gatewayMaxStatusBytes = 16 * 1024
)

// ─── Node resolution ──────────────────────────────────────────────────────

func resolveNodeTemplate(template, machineCode, machineName, metricCode string) string {
	if template == "" {
		return ""
	}
	r := strings.NewReplacer("{machine_code}", machineCode, "{machine_name}", machineName, "{metric_code}", metricCode)
	return strings.TrimSpace(r.Replace(template))
}

// validateNodeTemplate checks that a template (or a concrete node ID) parses
// once placeholders are filled in. Empty is valid (= not read).
func validateNodeTemplate(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if len(s) > 512 {
		return "node ID is too long (max 512 characters)"
	}
	if _, err := ua.ParseNodeID(resolveNodeTemplate(s, "M1", "Machine", "metric")); err != nil {
		return "invalid OPC UA node ID \"" + s + "\" (expected e.g. ns=2;s=Line1.Voltage or ns=3;i=1001)"
	}
	return ""
}

type machineMetricNodeRow struct {
	MachineID   uuid.UUID `json:"-"`
	MachineCode string    `json:"-"`
	MachineName string    `json:"-"`
	MetricID    uuid.UUID `json:"metric_id"`
	MetricCode  string    `json:"metric_code"`
	MetricName  string    `json:"metric_name"`
	Unit        string    `json:"unit"`
	ModuleName  string    `json:"module_name"`
	Template    string    `json:"template"`
	Override    *string   `json:"override"`
	Effective   string    `json:"effective" gorm:"-"`
}

// machineMetricNodes lists every metric of the machines' active modules with
// its template, override and effective node ID.
func machineMetricNodes(where string, args ...any) ([]machineMetricNodeRow, error) {
	rows := make([]machineMetricNodeRow, 0)
	err := database.DB.Raw(`
		SELECT m.id AS machine_id, m.code AS machine_code, m.name AS machine_name,
		       mm.id AS metric_id, mm.code AS metric_code, mm.name AS metric_name,
		       COALESCE(mm.unit, '') AS unit, md.name AS module_name,
		       COALESCE(mm.node_id, '') AS template, n.node_id AS override
		FROM machines m
		JOIN machine_modules mmod ON mmod.machine_id = m.id
		JOIN modules md ON md.id = mmod.module_id AND md.is_active AND lower(md.code) <> ?
		JOIN module_metrics mm ON mm.module_id = md.id
		LEFT JOIN machine_metric_nodes n ON n.machine_id = m.id AND n.metric_id = mm.id
		WHERE `+where+`
		ORDER BY m.code, md.name, mm.name`, append([]any{HiddenModuleCode}, args...)...).
		Scan(&rows).Error
	for i := range rows {
		r := &rows[i]
		if r.Override != nil && strings.TrimSpace(*r.Override) != "" {
			r.Effective = strings.TrimSpace(*r.Override)
		} else {
			r.Effective = resolveNodeTemplate(r.Template, r.MachineCode, r.MachineName, r.MetricCode)
		}
	}
	return rows, err
}

// ─── Admin: gateways ──────────────────────────────────────────────────────

type gatewayRow struct {
	models.OPCUAGateway
	CompanyName  string `json:"company_name"`
	MachineCount int    `json:"machine_count"`
	Online       bool   `json:"online" gorm:"-"`
}

func newGatewayKey() (key, prefix, hash string, err error) {
	b := make([]byte, 24)
	if _, err = rand.Read(b); err != nil {
		return
	}
	key = "fsgw_" + hex.EncodeToString(b)
	return key, key[:13], middleware.HashGatewayKey(key), nil
}

// gatewayScope restricts a query on opcua_gateways to the caller's company.
func gatewayScope(auth *models.AuthContext, q *gorm.DB, col string) *gorm.DB {
	if auth.Permissions["superadmin"] {
		return q
	}
	return q.Where(col+" = ?", auth.CompanyID)
}

// GET /api/v1/gateways
func ListGateways(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	q := database.DB.Table("opcua_gateways g").
		Select(`g.*, c.name AS company_name,
		        (SELECT count(*) FROM machine_opcua mo WHERE mo.gateway_id = g.id) AS machine_count`).
		Joins("JOIN companies c ON c.id = g.company_id")
	rows := make([]gatewayRow, 0)
	if err := gatewayScope(auth, q, "g.company_id").Order("g.name").Scan(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load gateways (has add_opcua_gateways.sql been applied?)"})
	}
	for i := range rows {
		rows[i].Online = rows[i].IsActive && rows[i].LastSeenAt != nil && time.Since(*rows[i].LastSeenAt) < gatewayOnlineWindow
	}
	return c.JSON(rows)
}

type gatewayRequest struct {
	Name                *string `json:"name"`
	IsActive            *bool   `json:"is_active"`
	PollIntervalSeconds *int    `json:"poll_interval_seconds"`
	CompanyID           *string `json:"company_id"` // superadmin only, on create
}

func validPollInterval(p *int) bool { return p == nil || (*p >= 1 && *p <= 3600) }

// POST /api/v1/gateways — returns the API key once; only its hash is stored.
func CreateGateway(c *fiber.Ctx) error {
	auth := middleware.GetAuth(c)
	var req gatewayRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if req.Name == nil || strings.TrimSpace(*req.Name) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name is required"})
	}
	if !validPollInterval(req.PollIntervalSeconds) {
		return c.Status(400).JSON(fiber.Map{"error": "poll interval must be 1–3600 seconds"})
	}

	companyID := auth.CompanyID
	if auth.Permissions["superadmin"] {
		if req.CompanyID == nil {
			return c.Status(400).JSON(fiber.Map{"error": "company_id is required"})
		}
		id, err := uuid.Parse(*req.CompanyID)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid company_id"})
		}
		companyID = id
	}
	if companyID == uuid.Nil {
		return c.Status(400).JSON(fiber.Map{"error": "no company"})
	}

	key, prefix, hash, err := newGatewayKey()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate key"})
	}
	gw := models.OPCUAGateway{
		ID:                  uuid.New(),
		CompanyID:           companyID,
		Name:                strings.TrimSpace(*req.Name),
		KeyPrefix:           prefix,
		KeyHash:             hash,
		IsActive:            true,
		PollIntervalSeconds: 5,
	}
	if req.PollIntervalSeconds != nil {
		gw.PollIntervalSeconds = *req.PollIntervalSeconds
	}
	if err := database.DB.Create(&gw).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create gateway (has add_opcua_gateways.sql been applied?)"})
	}
	return c.Status(201).JSON(fiber.Map{"gateway": gw, "api_key": key})
}

func findGateway(c *fiber.Ctx) (*models.OPCUAGateway, error) {
	auth := middleware.GetAuth(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return nil, c.Status(400).JSON(fiber.Map{"error": "invalid gateway id"})
	}
	var gw models.OPCUAGateway
	if err := gatewayScope(auth, database.DB.Where("id = ?", id), "company_id").First(&gw).Error; err != nil {
		return nil, c.Status(404).JSON(fiber.Map{"error": "gateway not found"})
	}
	return &gw, nil
}

// PUT /api/v1/gateways/:id
func UpdateGateway(c *fiber.Ctx) error {
	gw, err := findGateway(c)
	if gw == nil {
		return err
	}
	var req gatewayRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if !validPollInterval(req.PollIntervalSeconds) {
		return c.Status(400).JSON(fiber.Map{"error": "poll interval must be 1–3600 seconds"})
	}
	updates := map[string]any{"updated_at": time.Now()}
	if req.Name != nil {
		if strings.TrimSpace(*req.Name) == "" {
			return c.Status(400).JSON(fiber.Map{"error": "name is required"})
		}
		updates["name"] = strings.TrimSpace(*req.Name)
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.PollIntervalSeconds != nil {
		updates["poll_interval_seconds"] = *req.PollIntervalSeconds
	}
	if err := database.DB.Model(&models.OPCUAGateway{}).Where("id = ?", gw.ID).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update gateway"})
	}
	database.DB.First(gw, "id = ?", gw.ID)
	return c.JSON(gw)
}

// POST /api/v1/gateways/:id/rotate-key — the old key stops working immediately.
func RotateGatewayKey(c *fiber.Ctx) error {
	gw, err := findGateway(c)
	if gw == nil {
		return err
	}
	key, prefix, hash, kerr := newGatewayKey()
	if kerr != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to generate key"})
	}
	if err := database.DB.Model(&models.OPCUAGateway{}).Where("id = ?", gw.ID).
		Updates(map[string]any{"key_prefix": prefix, "key_hash": hash, "updated_at": time.Now()}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to rotate key"})
	}
	gw.KeyPrefix = prefix
	return c.JSON(fiber.Map{"gateway": gw, "api_key": key})
}

// DELETE /api/v1/gateways/:id — its machines become unassigned.
func DeleteGateway(c *fiber.Ctx) error {
	gw, err := findGateway(c)
	if gw == nil {
		return err
	}
	if err := database.DB.Delete(&models.OPCUAGateway{}, "id = ?", gw.ID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete gateway"})
	}
	return c.SendStatus(204)
}

// ─── Admin: per-machine OPC UA mapping ────────────────────────────────────

func findMachineForUser(c *fiber.Ctx) (*models.Machine, error) {
	auth := middleware.GetAuth(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return nil, c.Status(400).JSON(fiber.Map{"error": "invalid machine id"})
	}
	q := database.DB.Where("id = ?", id)
	if !auth.Permissions["superadmin"] {
		q = q.Where("company_id = ?", auth.CompanyID)
	}
	var m models.Machine
	if err := q.First(&m).Error; err != nil {
		return nil, c.Status(404).JSON(fiber.Map{"error": "machine not found"})
	}
	return &m, nil
}

// GET /api/v1/machines/:id/opcua
func GetMachineOPCUA(c *fiber.Ctx) error {
	m, err := findMachineForUser(c)
	if m == nil {
		return err
	}
	var link struct{ GatewayID *uuid.UUID }
	database.DB.Raw("SELECT gateway_id FROM machine_opcua WHERE machine_id = ?", m.ID).Scan(&link)

	rows, qerr := machineMetricNodes("m.id = ?", m.ID)
	if qerr != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load OPC UA mapping (has add_opcua_gateways.sql been applied?)"})
	}
	return c.JSON(fiber.Map{"gateway_id": link.GatewayID, "metrics": rows})
}

type machineOPCUARequest struct {
	GatewayID *string `json:"gateway_id"` // null or "" = not read by any gateway
	Nodes     []struct {
		MetricID string `json:"metric_id"`
		NodeID   string `json:"node_id"` // "" = remove override (fall back to template)
	} `json:"nodes"`
}

// PUT /api/v1/machines/:id/opcua
func UpdateMachineOPCUA(c *fiber.Ctx) error {
	m, err := findMachineForUser(c)
	if m == nil {
		return err
	}
	var req machineOPCUARequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	var gatewayID *uuid.UUID
	if req.GatewayID != nil && *req.GatewayID != "" {
		id, perr := uuid.Parse(*req.GatewayID)
		if perr != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid gateway_id"})
		}
		var n int64
		database.DB.Model(&models.OPCUAGateway{}).Where("id = ? AND company_id = ?", id, m.CompanyID).Count(&n)
		if n == 0 {
			return c.Status(400).JSON(fiber.Map{"error": "gateway not found for this machine's company"})
		}
		gatewayID = &id
	}

	// Metrics that belong to the machine's modules.
	var allowed []uuid.UUID
	database.DB.Raw(`SELECT mm.id FROM module_metrics mm
		JOIN machine_modules mmod ON mmod.module_id = mm.module_id
		WHERE mmod.machine_id = ?`, m.ID).Scan(&allowed)
	allowedSet := make(map[uuid.UUID]bool, len(allowed))
	for _, id := range allowed {
		allowedSet[id] = true
	}

	type nodeUpdate struct {
		metricID uuid.UUID
		nodeID   string
	}
	updates := make([]nodeUpdate, 0, len(req.Nodes))
	for _, n := range req.Nodes {
		id, perr := uuid.Parse(n.MetricID)
		if perr != nil || !allowedSet[id] {
			return c.Status(400).JSON(fiber.Map{"error": "metric " + n.MetricID + " is not part of this machine's modules"})
		}
		node := strings.TrimSpace(n.NodeID)
		if node != "" {
			if len(node) > 512 {
				return c.Status(400).JSON(fiber.Map{"error": "node ID is too long (max 512 characters)"})
			}
			if _, perr := ua.ParseNodeID(node); perr != nil {
				return c.Status(400).JSON(fiber.Map{"error": "invalid OPC UA node ID \"" + node + "\" (expected e.g. ns=2;s=Line1.Voltage or ns=3;i=1001)"})
			}
		}
		updates = append(updates, nodeUpdate{id, node})
	}

	txErr := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`INSERT INTO machine_opcua (machine_id, gateway_id, updated_at) VALUES (?, ?, now())
			ON CONFLICT (machine_id) DO UPDATE SET gateway_id = EXCLUDED.gateway_id, updated_at = now()`,
			m.ID, gatewayID).Error; err != nil {
			return err
		}
		for _, u := range updates {
			var err error
			if u.nodeID == "" {
				err = tx.Exec("DELETE FROM machine_metric_nodes WHERE machine_id = ? AND metric_id = ?", m.ID, u.metricID).Error
			} else {
				err = tx.Exec(`INSERT INTO machine_metric_nodes (machine_id, metric_id, node_id, updated_at) VALUES (?, ?, ?, now())
					ON CONFLICT (machine_id, metric_id) DO UPDATE SET node_id = EXCLUDED.node_id, updated_at = now()`,
					m.ID, u.metricID, u.nodeID).Error
			}
			if err != nil {
				return err
			}
		}
		return nil
	})
	if txErr != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to save OPC UA mapping"})
	}
	return GetMachineOPCUA(c)
}

// ─── Gateway API (authenticated by gateway key) ───────────────────────────

type gatewayNode struct {
	MetricKey string `json:"metric_key"`
	NodeID    string `json:"node_id"`
	Unit      string `json:"unit,omitempty"`
}

type gatewayMachine struct {
	MachineID   uuid.UUID     `json:"machine_id"`
	MachineCode string        `json:"machine_code"`
	MachineName string        `json:"machine_name"`
	Nodes       []gatewayNode `json:"nodes"`
}

// GET /gateway/v1/config — what this gateway should read. Gateways poll this
// (about once a minute), so mapping changes in the UI apply without restarts.
func GatewayConfig(c *fiber.Ctx) error {
	gw := middleware.GetGateway(c)
	rows, err := machineMetricNodes(
		"m.company_id = ? AND m.id IN (SELECT machine_id FROM machine_opcua WHERE gateway_id = ?)",
		gw.CompanyID, gw.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load configuration"})
	}

	machines := make([]gatewayMachine, 0)
	index := map[uuid.UUID]int{}
	seen := map[string]bool{}
	unmapped := 0
	for _, r := range rows {
		i, ok := index[r.MachineID]
		if !ok {
			i = len(machines)
			index[r.MachineID] = i
			machines = append(machines, gatewayMachine{MachineID: r.MachineID, MachineCode: r.MachineCode, MachineName: r.MachineName, Nodes: []gatewayNode{}})
		}
		key := strings.ToLower(r.MetricCode)
		if seen[r.MachineID.String()+"|"+key] {
			continue // same metric code in two modules: read once
		}
		if r.Effective == "" {
			unmapped++
			continue
		}
		seen[r.MachineID.String()+"|"+key] = true
		machines[i].Nodes = append(machines[i].Nodes, gatewayNode{MetricKey: key, NodeID: r.Effective, Unit: r.Unit})
	}

	return c.JSON(fiber.Map{
		"gateway":               fiber.Map{"id": gw.ID, "name": gw.Name},
		"poll_interval_seconds": gw.PollIntervalSeconds,
		"machines":              machines,
		"unmapped_metrics":      unmapped,
		"server_time":           time.Now().UTC(),
	})
}

// gatewayMachineIDs returns the machines this gateway may report for.
func gatewayMachineIDs(gw *models.OPCUAGateway) (map[uuid.UUID]bool, error) {
	var ids []uuid.UUID
	err := database.DB.Raw(`SELECT mo.machine_id FROM machine_opcua mo
		JOIN machines m ON m.id = mo.machine_id
		WHERE mo.gateway_id = ? AND m.company_id = ?`, gw.ID, gw.CompanyID).Scan(&ids).Error
	set := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	return set, err
}

// POST /gateway/v1/ingest
//
//	{"readings":[{"machine_id":"…","metric_key":"voltage","value":415.2,"ts":"2026-11-19T11:30:50Z"}]}
//
// Readings for machines not assigned to this gateway are rejected (counted,
// not an error), so a gateway never retries them.
func GatewayIngest(c *fiber.Ctx) error {
	gw := middleware.GetGateway(c)
	var req struct {
		Readings []struct {
			MachineID string    `json:"machine_id"`
			MetricKey string    `json:"metric_key"`
			Value     float64   `json:"value"`
			Ts        time.Time `json:"ts"`
			Unit      string    `json:"unit"`
		} `json:"readings"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if len(req.Readings) > gatewayMaxBatch {
		return c.Status(413).JSON(fiber.Map{"error": "too many readings in one request (max 5000)"})
	}

	allowed, err := gatewayMachineIDs(gw)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load gateway machines"})
	}

	now := time.Now()
	stats := make([]models.MachineStat, 0, len(req.Readings))
	units := make(map[int]string, len(req.Readings))
	rejected := 0
	for _, r := range req.Readings {
		mid, perr := uuid.Parse(r.MachineID)
		key := strings.ToLower(strings.TrimSpace(r.MetricKey))
		if perr != nil || !allowed[mid] || key == "" || math.IsNaN(r.Value) || math.IsInf(r.Value, 0) {
			rejected++
			continue
		}
		ts := r.Ts
		if ts.IsZero() || ts.After(now.Add(gatewayMaxFutureSkew)) {
			ts = now
		}
		units[len(stats)] = r.Unit
		stats = append(stats, models.MachineStat{
			ID:          uuid.New(),
			CompanyID:   gw.CompanyID,
			MachineID:   mid,
			Ts:          ts,
			MetricKey:   key,
			MetricValue: r.Value,
			Meta:        map[string]any{"unit": r.Unit, "source": "opcua_gateway", "gateway_id": gw.ID.String()},
		})
	}

	if len(stats) > 0 {
		if err := database.DB.CreateInBatches(&stats, 1000).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to store readings"})
		}

		// Live view: only recent readings (a gateway replaying its offline
		// buffer shouldn't flash old values on dashboards).
		if hub.GlobalHub != nil {
			byMachine := map[string][]hub.MetricPayload{}
			for i, s := range stats {
				if now.Sub(s.Ts) > gatewayLiveWindow {
					continue
				}
				id := s.MachineID.String()
				byMachine[id] = append(byMachine[id], hub.MetricPayload{
					MachineID: id, CompanyID: gw.CompanyID.String(), MetricKey: s.MetricKey,
					MetricValue: s.MetricValue, Timestamp: s.Ts, Unit: units[i], Source: "opcua_real",
				})
			}
			for id, p := range byMachine {
				hub.GlobalHub.Broadcast(id, p)
			}
		}

		sort.SliceStable(stats, func(i, j int) bool { return stats[i].Ts.Before(stats[j].Ts) })
		alerts.EvaluateStats(stats)
	}

	return c.JSON(fiber.Map{"accepted": len(stats), "rejected": rejected})
}

// POST /gateway/v1/status — free-form health report shown on the Gateways page.
func GatewayStatus(c *fiber.Ctx) error {
	gw := middleware.GetGateway(c)
	if len(c.Body()) > gatewayMaxStatusBytes {
		return c.Status(413).JSON(fiber.Map{"error": "status report too large"})
	}
	var status map[string]any
	if err := c.BodyParser(&status); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	status["reported_at"] = time.Now().UTC()
	b, err := json.Marshal(status)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid status"})
	}
	updates := map[string]any{"status": gorm.Expr("?::jsonb", string(b)), "last_seen_at": time.Now()}
	if v, ok := status["agent_version"].(string); ok && len(v) <= 64 {
		updates["agent_version"] = v
	}
	if err := database.DB.Model(&models.OPCUAGateway{}).Where("id = ?", gw.ID).
		UpdateColumns(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to store status"})
	}
	return c.SendStatus(204)
}
