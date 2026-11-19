package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// RemoteConfig is what the backend tells this gateway to read (GET /gateway/v1/config).
type RemoteConfig struct {
	Gateway struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"gateway"`
	PollIntervalSeconds int             `json:"poll_interval_seconds"`
	Machines            []RemoteMachine `json:"machines"`
	UnmappedMetrics     int             `json:"unmapped_metrics"`
}

type RemoteMachine struct {
	MachineID   string       `json:"machine_id"`
	MachineCode string       `json:"machine_code"`
	MachineName string       `json:"machine_name"`
	Nodes       []RemoteNode `json:"nodes"`
}

type RemoteNode struct {
	MetricKey string `json:"metric_key"`
	NodeID    string `json:"node_id"`
	Unit      string `json:"unit"`
}

func (c *RemoteConfig) nodeCount() int {
	n := 0
	for _, m := range c.Machines {
		n += len(m.Nodes)
	}
	return n
}

// Reading is one value sent to POST /gateway/v1/ingest.
type Reading struct {
	MachineID string    `json:"machine_id"`
	MetricKey string    `json:"metric_key"`
	Value     float64   `json:"value"`
	Ts        time.Time `json:"ts"`
	Unit      string    `json:"unit,omitempty"`

	seq uint64 // buffer position (not sent)
}

type httpError struct {
	Code int
	Msg  string
}

func (e *httpError) Error() string { return fmt.Sprintf("HTTP %d: %s", e.Code, e.Msg) }

// retryable reports whether a failed request should be retried later
// (network problems, server errors, rate limits, or a bad/disabled key that an
// admin may fix). Other 4xx responses mean the batch itself is unacceptable.
func retryable(err error) bool {
	he, ok := err.(*httpError)
	if !ok {
		return true
	}
	switch he.Code {
	case 401, 403, 408, 429:
		return true
	}
	return he.Code >= 500
}

type API struct {
	base string
	key  string
	http *http.Client
}

func newAPI(base, key string) *API {
	return &API{base: base, key: key, http: &http.Client{Timeout: 30 * time.Second}}
}

func (a *API) do(ctx context.Context, method, path string, body, out any) error {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, a.base+path, rdr)
	if err != nil {
		return err
	}
	req.Header.Set("X-Gateway-Key", a.key)
	req.Header.Set("User-Agent", "fsid-gateway/"+version)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := a.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode >= 300 {
		var e struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(data, &e)
		if e.Error == "" {
			e.Error = http.StatusText(resp.StatusCode)
		}
		return &httpError{Code: resp.StatusCode, Msg: e.Error}
	}
	if out != nil && len(data) > 0 {
		return json.Unmarshal(data, out)
	}
	return nil
}

func (a *API) Config(ctx context.Context) (*RemoteConfig, error) {
	var rc RemoteConfig
	if err := a.do(ctx, http.MethodGet, "/gateway/v1/config", nil, &rc); err != nil {
		return nil, err
	}
	return &rc, nil
}

func (a *API) Ingest(ctx context.Context, rs []Reading) (accepted, rejected int, err error) {
	var out struct {
		Accepted int `json:"accepted"`
		Rejected int `json:"rejected"`
	}
	err = a.do(ctx, http.MethodPost, "/gateway/v1/ingest", map[string]any{"readings": rs}, &out)
	return out.Accepted, out.Rejected, err
}

func (a *API) Status(ctx context.Context, s map[string]any) error {
	return a.do(ctx, http.MethodPost, "/gateway/v1/status", s, nil)
}
