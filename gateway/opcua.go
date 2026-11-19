package main

import (
	"context"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"github.com/gopcua/opcua"
	"github.com/gopcua/opcua/ua"
)

const readChunk = 500 // nodes per OPC UA Read request

// NodeProblem describes a node that could not be read on the last poll.
type NodeProblem struct {
	MachineCode string `json:"machine_code"`
	MetricKey   string `json:"metric_key"`
	NodeID      string `json:"node_id"`
	Error       string `json:"error"`
}

// Reader owns the OPC UA connection: it connects lazily, backs off after
// failures (2 s doubling to 60 s) and reconnects after a dropped session.
type Reader struct {
	cfg          OPCUAConfig
	useSourceTS  bool
	client       *opcua.Client
	nodeCache    map[string]*ua.NodeID
	failures     int
	nextAttempt  time.Time
	LastError    string
	LastProblems []NodeProblem
}

func newReader(cfg OPCUAConfig, useSourceTS bool) *Reader {
	return &Reader{cfg: cfg, useSourceTS: useSourceTS, nodeCache: map[string]*ua.NodeID{}}
}

func (r *Reader) Connected() bool {
	return r.client != nil && r.client.State() == opcua.Connected
}

func (r *Reader) Close() {
	if r.client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = r.client.Close(ctx)
		r.client = nil
	}
}

func (r *Reader) fail(err error) error {
	r.Close()
	r.failures++
	backoff := time.Duration(math.Min(60, math.Pow(2, float64(r.failures)))) * time.Second
	r.nextAttempt = time.Now().Add(backoff)
	r.LastError = err.Error()
	return err
}

func securityPolicyURI(p string) string {
	if p == "" || strings.EqualFold(p, "None") {
		return ua.SecurityPolicyURINone
	}
	if strings.HasPrefix(p, ua.SecurityPolicyURIPrefix) {
		return p
	}
	return ua.SecurityPolicyURIPrefix + p
}

func securityMode(m string) (ua.MessageSecurityMode, error) {
	switch strings.ToLower(strings.ReplaceAll(m, " ", "")) {
	case "", "none":
		return ua.MessageSecurityModeNone, nil
	case "sign":
		return ua.MessageSecurityModeSign, nil
	case "signandencrypt":
		return ua.MessageSecurityModeSignAndEncrypt, nil
	}
	return 0, fmt.Errorf("invalid security_mode %q (use None, Sign or SignAndEncrypt)", m)
}

// ensure connects if needed. Returns an error while backing off.
func (r *Reader) ensure(ctx context.Context) error {
	if r.Connected() {
		return nil
	}
	if r.client != nil {
		r.Close() // session dropped
	}
	if wait := time.Until(r.nextAttempt); wait > 0 {
		return fmt.Errorf("OPC UA reconnect in %s (last error: %s)", wait.Round(time.Second), r.LastError)
	}
	if err := r.connect(ctx); err != nil {
		return r.fail(err)
	}
	r.failures = 0
	r.LastError = ""
	return nil
}

func (r *Reader) connect(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	policy := securityPolicyURI(r.cfg.SecurityPolicy)
	mode, err := securityMode(r.cfg.SecurityMode)
	if err != nil {
		return err
	}
	if (policy == ua.SecurityPolicyURINone) != (mode == ua.MessageSecurityModeNone) {
		return fmt.Errorf("security_policy %q and security_mode %q don't match (use None/None, or a policy with Sign/SignAndEncrypt)", r.cfg.SecurityPolicy, r.cfg.SecurityMode)
	}

	endpoints, err := opcua.GetEndpoints(ctx, r.cfg.Endpoint)
	if err != nil {
		return fmt.Errorf("get endpoints from %s: %w", r.cfg.Endpoint, err)
	}
	var ep *ua.EndpointDescription
	for _, e := range endpoints {
		if e.SecurityPolicyURI == policy && e.SecurityMode == mode && (ep == nil || e.SecurityLevel > ep.SecurityLevel) {
			ep = e
		}
	}
	if ep == nil {
		var offered []string
		for _, e := range endpoints {
			offered = append(offered, strings.TrimPrefix(e.SecurityPolicyURI, ua.SecurityPolicyURIPrefix)+"/"+e.SecurityMode.String())
		}
		return fmt.Errorf("server has no endpoint with policy %s and mode %s; it offers: %s",
			r.cfg.SecurityPolicy, r.cfg.SecurityMode, strings.Join(offered, ", "))
	}

	opts := []opcua.Option{
		opcua.ApplicationName("FSID Gateway"),
		opcua.AutoReconnect(false), // reconnects are handled here, with backoff
		opcua.RequestTimeout(10 * time.Second),
		opcua.DialTimeout(10 * time.Second),
	}
	if r.cfg.ApplicationURI != "" {
		opts = append(opts, opcua.ApplicationURI(r.cfg.ApplicationURI))
	}
	if policy != ua.SecurityPolicyURINone {
		if r.cfg.CertificateFile == "" || r.cfg.PrivateKeyFile == "" {
			return fmt.Errorf("security policy %s needs certificate_file and private_key_file (create them with: fsid-gateway -gen-cert)", r.cfg.SecurityPolicy)
		}
		opts = append(opts, opcua.CertificateFile(r.cfg.CertificateFile), opcua.PrivateKeyFile(r.cfg.PrivateKeyFile))
	}

	authType := ua.UserTokenTypeAnonymous
	if r.cfg.Username != "" {
		authType = ua.UserTokenTypeUserName
		opts = append(opts, opcua.AuthUsername(r.cfg.Username, r.cfg.Password))
	} else {
		opts = append(opts, opcua.AuthAnonymous())
	}
	opts = append(opts, opcua.SecurityFromEndpoint(ep, authType))

	c, err := opcua.NewClient(r.cfg.Endpoint, opts...)
	if err != nil {
		return fmt.Errorf("create OPC UA client: %w", err)
	}
	if err := c.Connect(ctx); err != nil {
		return fmt.Errorf("connect to %s: %w", r.cfg.Endpoint, err)
	}
	r.client = c
	log.Printf("[opcua] connected to %s (%s, %s, auth: %s)", r.cfg.Endpoint,
		strings.TrimPrefix(policy, ua.SecurityPolicyURIPrefix), mode, authType)
	return nil
}

type pendingNode struct {
	machine RemoteMachine
	node    RemoteNode
	id      *ua.NodeID
}

func (r *Reader) parseNode(s string) (*ua.NodeID, error) {
	if id, ok := r.nodeCache[s]; ok {
		return id, nil
	}
	id, err := ua.ParseNodeID(s)
	if err != nil {
		return nil, err
	}
	r.nodeCache[s] = id
	return id, nil
}

// ReadAll reads every configured node once. Per-node problems are reported in
// LastProblems; a returned error means the connection itself failed.
func (r *Reader) ReadAll(ctx context.Context, machines []RemoteMachine) (readings []Reading, ok, bad int, err error) {
	if err := r.ensure(ctx); err != nil {
		return nil, 0, 0, err
	}

	problems := make([]NodeProblem, 0)
	pending := make([]pendingNode, 0)
	for _, m := range machines {
		for _, n := range m.Nodes {
			id, perr := r.parseNode(n.NodeID)
			if perr != nil {
				bad++
				problems = append(problems, NodeProblem{m.MachineCode, n.MetricKey, n.NodeID, "invalid node ID: " + perr.Error()})
				continue
			}
			pending = append(pending, pendingNode{m, n, id})
		}
	}

	now := time.Now().UTC()
	for start := 0; start < len(pending); start += readChunk {
		end := min(start+readChunk, len(pending))
		chunk := pending[start:end]
		req := &ua.ReadRequest{
			MaxAge:             0,
			TimestampsToReturn: ua.TimestampsToReturnBoth,
			NodesToRead:        make([]*ua.ReadValueID, len(chunk)),
		}
		for i, p := range chunk {
			req.NodesToRead[i] = &ua.ReadValueID{NodeID: p.id, AttributeID: ua.AttributeIDValue}
		}

		rctx, cancel := context.WithTimeout(ctx, 15*time.Second)
		resp, rerr := r.client.Read(rctx, req)
		cancel()
		if rerr != nil {
			return readings, ok, bad, r.fail(fmt.Errorf("read: %w", rerr))
		}
		if len(resp.Results) != len(chunk) {
			return readings, ok, bad, r.fail(fmt.Errorf("read: expected %d results, got %d", len(chunk), len(resp.Results)))
		}

		for i, dv := range resp.Results {
			p := chunk[i]
			if dv == nil || dv.Status != ua.StatusOK {
				msg := "no value"
				if dv != nil {
					msg = dv.Status.Error()
				}
				bad++
				problems = append(problems, NodeProblem{p.machine.MachineCode, p.node.MetricKey, p.node.NodeID, msg})
				continue
			}
			var raw any
			if dv.Value != nil {
				raw = dv.Value.Value()
			}
			v, numeric := toFloat(raw)
			if !numeric {
				bad++
				problems = append(problems, NodeProblem{p.machine.MachineCode, p.node.MetricKey, p.node.NodeID, fmt.Sprintf("value is not numeric (%T)", raw)})
				continue
			}
			ts := now
			if r.useSourceTS && !dv.SourceTimestamp.IsZero() && dv.SourceTimestamp.Before(now.Add(5*time.Minute)) {
				ts = dv.SourceTimestamp.UTC()
			}
			ok++
			readings = append(readings, Reading{
				MachineID: p.machine.MachineID, MetricKey: p.node.MetricKey,
				Value: v, Ts: ts, Unit: p.node.Unit,
			})
		}
	}
	r.LastProblems = problems
	return readings, ok, bad, nil
}

func toFloat(v any) (float64, bool) {
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
