// Command fsid-gateway is the FSID OPC UA edge gateway.
//
// It runs on a PC inside the plant network, reads the plant's OPC UA server
// and pushes readings to the FSID backend over HTTPS. What to read comes from
// the backend (GET /gateway/v1/config, refreshed every minute), so machines
// and node IDs are managed in the web app. See README.md.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"text/tabwriter"
	"time"
)

const version = "1.0.0"

const (
	pushBatch      = 2000
	statusInterval = 30 * time.Second
	saveInterval   = 30 * time.Second
)

func main() {
	configPath := flag.String("config", defaultConfigPath(), "path to gateway.json")
	once := flag.Bool("once", false, "read every configured node once, print the values and exit (nothing is sent)")
	genCert := flag.Bool("gen-cert", false, "create a client certificate and key for secure OPC UA connections, then exit")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println("fsid-gateway", version)
		return
	}

	cfg, err := loadConfig(*configPath)
	if err != nil {
		log.Fatalf("%v\n(copy gateway.example.json to gateway.json and fill it in, or pass -config)", err)
	}

	if *genCert {
		runGenCert(cfg)
		return
	}
	if err := cfg.validate(); err != nil {
		log.Fatal(err)
	}
	setupLogging(cfg.LogFile)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	api := newAPI(cfg.APIURL, cfg.APIKey)
	if *once {
		os.Exit(runOnce(ctx, cfg, api))
	}
	run(ctx, cfg, api)
}

func defaultConfigPath() string {
	if exe, err := os.Executable(); err == nil {
		p := filepath.Join(filepath.Dir(exe), "gateway.json")
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "gateway.json"
}

func setupLogging(file string) {
	log.SetFlags(log.LstdFlags)
	if file == "" {
		return
	}
	// Keep one previous log of up to 10 MB.
	if st, err := os.Stat(file); err == nil && st.Size() > 10<<20 {
		_ = os.Rename(file, file+".1")
	}
	f, err := os.OpenFile(file, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		log.Printf("cannot open log file %s: %v", file, err)
		return
	}
	log.SetOutput(io.MultiWriter(os.Stdout, f))
}

func runGenCert(cfg *Config) {
	host, _ := os.Hostname()
	uri := cfg.OPCUA.ApplicationURI
	if uri == "" {
		uri = "urn:" + strings.ToLower(host) + ":fsid:gateway"
	}
	certPath := cfg.OPCUA.CertificateFile
	keyPath := cfg.OPCUA.PrivateKeyFile
	if certPath == "" {
		certPath = cfg.resolve("pki/gateway-cert.pem")
	}
	if keyPath == "" {
		keyPath = cfg.resolve("pki/gateway-key.pem")
	}
	if err := generateCert(certPath, keyPath, uri); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Created:\n  certificate: %s\n  private key: %s\n  application URI: %s\n\n", certPath, keyPath, uri)
	fmt.Println("Put these in gateway.json under \"opcua\":")
	fmt.Printf("  \"certificate_file\": %q,\n  \"private_key_file\": %q,\n  \"application_uri\": %q\n\n", certPath, keyPath, uri)
	fmt.Println("Then make the OPC UA server trust the certificate (after the first connection attempt it")
	fmt.Println("usually appears under \"rejected\" in the server's certificate store; move it to \"trusted\").")
}

// runOnce is a setup check: fetch the config, read every node once, print a table.
func runOnce(ctx context.Context, cfg *Config, api *API) int {
	rc, err := api.Config(ctx)
	if err != nil {
		log.Printf("cannot fetch configuration from %s: %v", cfg.APIURL, err)
		return 1
	}
	fmt.Printf("Gateway %q: %d machine(s), %d node(s)", rc.Gateway.Name, len(rc.Machines), rc.nodeCount())
	if rc.UnmappedMetrics > 0 {
		fmt.Printf(", %d metric(s) without a node ID (skipped)", rc.UnmappedMetrics)
	}
	fmt.Println()
	if rc.nodeCount() == 0 {
		fmt.Println("Nothing to read yet: assign machines to this gateway and set node IDs in the web app.")
		return 0
	}

	reader := newReader(cfg.OPCUA, cfg.UseSourceTimestamp)
	defer reader.Close()
	readings, ok, bad, err := reader.ReadAll(ctx, rc.Machines)
	if err != nil {
		log.Printf("OPC UA error: %v", err)
		return 1
	}

	values := map[string]Reading{}
	for _, r := range readings {
		values[r.MachineID+"|"+r.MetricKey] = r
	}
	problems := map[string]string{}
	for _, p := range reader.LastProblems {
		problems[p.MachineCode+"|"+p.MetricKey] = p.Error
	}
	tw := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "\nMACHINE\tMETRIC\tNODE ID\tVALUE")
	for _, m := range rc.Machines {
		for _, n := range m.Nodes {
			val := "?"
			if r, found := values[m.MachineID+"|"+n.MetricKey]; found {
				val = fmt.Sprintf("%g %s", r.Value, n.Unit)
			} else if e, found := problems[m.MachineCode+"|"+n.MetricKey]; found {
				val = "ERROR: " + e
			}
			fmt.Fprintf(tw, "%s\t%s\t%s\t%s\n", m.MachineCode, n.MetricKey, n.NodeID, val)
		}
	}
	tw.Flush()
	fmt.Printf("\n%d ok, %d failed. Nothing was sent (this was a -once check).\n", ok, bad)
	if bad > 0 {
		return 2
	}
	return 0
}

// stats shared between the poller, uploader and status reporter.
type stats struct {
	mu           sync.Mutex
	rc           *RemoteConfig
	lastPollAt   time.Time
	lastPushAt   time.Time
	nodesOK      int
	nodesBad     int
	lastPushErr  string
	sentTotal    atomic.Int64
	rejectedTot  atomic.Int64
	opcConnected bool
	opcError     string
	problems     []NodeProblem
}

func run(ctx context.Context, cfg *Config, api *API) {
	log.Printf("fsid-gateway %s starting; backend %s, OPC UA %s", version, cfg.APIURL, cfg.OPCUA.Endpoint)

	buf := newBuffer(cfg.BufferFile, cfg.MaxBufferedReadings)
	if n, err := buf.Load(); err != nil {
		log.Printf("could not load offline buffer %s: %v", cfg.BufferFile, err)
	} else if n > 0 {
		log.Printf("restored %d buffered reading(s) from %s", n, cfg.BufferFile)
	}

	st := &stats{}
	reader := newReader(cfg.OPCUA, cfg.UseSourceTimestamp)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); uploader(ctx, api, buf, st) }()
	go func() { defer wg.Done(); statusReporter(ctx, cfg, api, buf, st) }()

	poller(ctx, cfg, api, reader, buf, st)

	// Shutdown: one last upload attempt, then persist whatever is left.
	wg.Wait()
	reader.Close()
	fctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	flush(fctx, api, buf, st)
	cancel()
	if err := buf.Save(); err != nil {
		log.Printf("could not save offline buffer: %v", err)
	} else if n := buf.Len(); n > 0 {
		log.Printf("saved %d unsent reading(s) to %s", n, cfg.BufferFile)
	}
	log.Println("stopped")
}

func fetchConfig(ctx context.Context, api *API, st *stats, cacheFile string) *RemoteConfig {
	rc, err := api.Config(ctx)
	if err != nil {
		if ctx.Err() == nil {
			log.Printf("[config] fetch failed: %v", err)
		}
		return nil
	}
	saveConfigCache(cacheFile, rc)
	st.mu.Lock()
	prev := st.rc
	st.rc = rc
	st.mu.Unlock()
	if prev == nil || prev.nodeCount() != rc.nodeCount() || len(prev.Machines) != len(rc.Machines) || prev.PollIntervalSeconds != rc.PollIntervalSeconds {
		log.Printf("[config] gateway %q: %d machine(s), %d node(s), poll every %ds%s",
			rc.Gateway.Name, len(rc.Machines), rc.nodeCount(), rc.PollIntervalSeconds,
			map[bool]string{true: fmt.Sprintf(" (%d metric(s) have no node ID)", rc.UnmappedMetrics), false: ""}[rc.UnmappedMetrics > 0])
	}
	return rc
}

func saveConfigCache(file string, rc *RemoteConfig) {
	b, err := json.Marshal(rc)
	if err != nil {
		return
	}
	tmp := file + ".tmp"
	if os.WriteFile(tmp, b, 0o600) == nil {
		_ = os.Rename(tmp, file)
	}
}

func loadConfigCache(file string) *RemoteConfig {
	b, err := os.ReadFile(file)
	if err != nil {
		return nil
	}
	var rc RemoteConfig
	if json.Unmarshal(b, &rc) != nil {
		return nil
	}
	return &rc
}

// poller fetches the config on a schedule and reads the OPC UA nodes every poll interval.
func poller(ctx context.Context, cfg *Config, api *API, reader *Reader, buf *Buffer, st *stats) {
	cacheFile := cfg.resolve("gateway-config-cache.json")
	rc := fetchConfig(ctx, api, st, cacheFile)
	nextConfig := time.Now().Add(time.Duration(cfg.ConfigRefreshSeconds) * time.Second)
	if rc == nil {
		nextConfig = time.Now().Add(10 * time.Second)
		// Backend unreachable at startup: keep reading with the last known config.
		if rc = loadConfigCache(cacheFile); rc != nil {
			st.mu.Lock()
			st.rc = rc
			st.mu.Unlock()
			log.Printf("[config] using cached configuration: %d machine(s), %d node(s)", len(rc.Machines), rc.nodeCount())
		}
	}

	interval := func() time.Duration {
		if rc == nil || rc.PollIntervalSeconds < 1 {
			return 5 * time.Second
		}
		return time.Duration(rc.PollIntervalSeconds) * time.Second
	}
	timer := time.NewTimer(0)
	defer timer.Stop()
	saveTicker := time.NewTicker(saveInterval)
	defer saveTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-saveTicker.C:
			if err := buf.Save(); err != nil {
				log.Printf("[buffer] save failed: %v", err)
			}
			continue
		case <-timer.C:
		}

		started := time.Now()
		if started.After(nextConfig) {
			if fresh := fetchConfig(ctx, api, st, cacheFile); fresh != nil {
				rc = fresh
				nextConfig = started.Add(time.Duration(cfg.ConfigRefreshSeconds) * time.Second)
			} else {
				nextConfig = started.Add(10 * time.Second)
			}
		}

		if rc != nil && rc.nodeCount() > 0 {
			readings, ok, bad, err := reader.ReadAll(ctx, rc.Machines)
			buf.Add(readings)
			st.mu.Lock()
			st.lastPollAt = started
			st.opcConnected = reader.Connected()
			st.opcError = reader.LastError
			if err == nil {
				prevBad := st.nodesBad
				st.nodesOK, st.nodesBad, st.problems = ok, bad, reader.LastProblems
				if bad > 0 && bad != prevBad {
					log.Printf("[opcua] %d of %d node(s) failed, e.g. %s %s (%s): %s", bad, ok+bad,
						reader.LastProblems[0].MachineCode, reader.LastProblems[0].MetricKey,
						reader.LastProblems[0].NodeID, reader.LastProblems[0].Error)
				}
			}
			st.mu.Unlock()
			if err != nil && ctx.Err() == nil {
				log.Printf("[opcua] %v", err)
			}
		}

		next := interval() - time.Since(started)
		if next < 100*time.Millisecond {
			next = 100 * time.Millisecond
		}
		timer.Reset(next)
	}
}

// uploader sends buffered readings, retrying with backoff while the backend is unreachable.
func uploader(ctx context.Context, api *API, buf *Buffer, st *stats) {
	backoff := 2 * time.Second
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		if err := flush(ctx, api, buf, st); err != nil {
			if ctx.Err() != nil {
				return
			}
			if backoff < time.Minute {
				backoff *= 2
			}
			continue
		}
		backoff = 2 * time.Second
	}
}

// flush uploads the buffer in batches until it is empty or a request fails.
func flush(ctx context.Context, api *API, buf *Buffer, st *stats) error {
	for buf.Len() > 0 {
		batch := buf.Peek(pushBatch)
		accepted, rejected, err := api.Ingest(ctx, batch)
		last := batch[len(batch)-1].seq
		if err != nil {
			if !retryable(err) {
				log.Printf("[upload] backend refused %d reading(s), dropping them: %v", len(batch), err)
				buf.RemoveThrough(last)
				continue
			}
			st.mu.Lock()
			if st.lastPushErr != err.Error() && ctx.Err() == nil {
				var he *httpError
				if errors.As(err, &he) && (he.Code == 401 || he.Code == 403) {
					log.Printf("[upload] %v - check api_key and that the gateway is enabled; keeping %d reading(s) buffered", err, buf.Len())
				} else {
					log.Printf("[upload] %v - keeping %d reading(s) buffered", err, buf.Len())
				}
			}
			st.lastPushErr = err.Error()
			st.mu.Unlock()
			return err
		}
		buf.RemoveThrough(last)
		st.sentTotal.Add(int64(accepted))
		st.rejectedTot.Add(int64(rejected))
		st.mu.Lock()
		if st.lastPushErr != "" {
			log.Printf("[upload] backend reachable again")
		}
		st.lastPushErr = ""
		st.lastPushAt = time.Now()
		st.mu.Unlock()
		if rejected > 0 {
			log.Printf("[upload] backend rejected %d reading(s) (machine no longer assigned to this gateway?)", rejected)
		}
	}
	return nil
}

// statusReporter sends a health report shown on the Gateways page.
func statusReporter(ctx context.Context, cfg *Config, api *API, buf *Buffer, st *stats) {
	host, _ := os.Hostname()
	t := time.NewTicker(statusInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(3 * time.Second): // first report soon after start
		}
		for {
			st.mu.Lock()
			problems := append([]NodeProblem(nil), st.problems...)
			sort.Slice(problems, func(i, j int) bool { return problems[i].MachineCode < problems[j].MachineCode })
			if len(problems) > 20 {
				problems = problems[:20]
			}
			report := map[string]any{
				"agent_version":    version,
				"hostname":         host,
				"opcua_endpoint":   cfg.OPCUA.Endpoint,
				"security_policy":  cfg.OPCUA.SecurityPolicy,
				"security_mode":    cfg.OPCUA.SecurityMode,
				"opcua_connected":  st.opcConnected,
				"opcua_error":      st.opcError,
				"nodes_ok":         st.nodesOK,
				"nodes_bad":        st.nodesBad,
				"node_problems":    problems,
				"buffered":         buf.Len(),
				"dropped":          buf.Dropped(),
				"readings_sent":    st.sentTotal.Load(),
				"readings_refused": st.rejectedTot.Load(),
				"upload_error":     st.lastPushErr,
			}
			if !st.lastPollAt.IsZero() {
				report["last_poll_at"] = st.lastPollAt.UTC()
			}
			if !st.lastPushAt.IsZero() {
				report["last_upload_at"] = st.lastPushAt.UTC()
			}
			st.mu.Unlock()

			rctx, cancel := context.WithTimeout(ctx, 15*time.Second)
			_ = api.Status(rctx, report) // failures already show up as upload errors
			cancel()

			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
		}
	}
}
