package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// OPCUAConfig describes the plant OPC UA server. Credentials stay on this
// machine; they are never sent to the cloud.
type OPCUAConfig struct {
	Endpoint        string `json:"endpoint"`         // opc.tcp://192.168.1.10:4840
	SecurityPolicy  string `json:"security_policy"`  // None | Basic256Sha256 | Aes128_Sha256_RsaOaep | Aes256_Sha256_RsaPss | Basic256 | Basic128Rsa15
	SecurityMode    string `json:"security_mode"`    // None | Sign | SignAndEncrypt
	Username        string `json:"username"`         // empty = anonymous
	Password        string `json:"password"`         // or env OPCUA_PASSWORD
	CertificateFile string `json:"certificate_file"` // client certificate (.pem or .der), required unless policy is None
	PrivateKeyFile  string `json:"private_key_file"` // RSA key (.pem or .der)
	ApplicationURI  string `json:"application_uri"`  // must match the certificate; -gen-cert sets it
}

type Config struct {
	APIURL               string      `json:"api_url"` // https://your-backend.up.railway.app
	APIKey               string      `json:"api_key"` // fsgw_... from the Gateways page (or env FSID_API_KEY)
	OPCUA                OPCUAConfig `json:"opcua"`
	BufferFile           string      `json:"buffer_file"`           // readings kept here while offline
	MaxBufferedReadings  int         `json:"max_buffered_readings"` // oldest dropped beyond this
	UseSourceTimestamp   bool        `json:"use_source_timestamp"`  // use the PLC timestamp instead of this PC clock
	ConfigRefreshSeconds int         `json:"config_refresh_seconds"`
	LogFile              string      `json:"log_file"` // optional; also logs to stdout

	dir string // directory of the config file; relative paths resolve against it
}

func loadConfig(path string) (*Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}
	cfg := &Config{}
	if err := json.Unmarshal(b, cfg); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	abs, _ := filepath.Abs(path)
	cfg.dir = filepath.Dir(abs)

	// Secrets can come from the environment instead of the file.
	envOverride(&cfg.APIURL, "FSID_API_URL")
	envOverride(&cfg.APIKey, "FSID_API_KEY")
	envOverride(&cfg.OPCUA.Endpoint, "OPCUA_ENDPOINT")
	envOverride(&cfg.OPCUA.Username, "OPCUA_USERNAME")
	envOverride(&cfg.OPCUA.Password, "OPCUA_PASSWORD")

	if cfg.BufferFile == "" {
		cfg.BufferFile = "gateway-buffer.jsonl"
	}
	if cfg.MaxBufferedReadings <= 0 {
		cfg.MaxBufferedReadings = 500000
	}
	if cfg.ConfigRefreshSeconds <= 0 {
		cfg.ConfigRefreshSeconds = 60
	}
	if cfg.OPCUA.SecurityPolicy == "" {
		cfg.OPCUA.SecurityPolicy = "None"
	}
	if cfg.OPCUA.SecurityMode == "" {
		if strings.EqualFold(cfg.OPCUA.SecurityPolicy, "None") {
			cfg.OPCUA.SecurityMode = "None"
		} else {
			cfg.OPCUA.SecurityMode = "SignAndEncrypt"
		}
	}
	cfg.BufferFile = cfg.resolve(cfg.BufferFile)
	cfg.LogFile = cfg.resolve(cfg.LogFile)
	cfg.OPCUA.CertificateFile = cfg.resolve(cfg.OPCUA.CertificateFile)
	cfg.OPCUA.PrivateKeyFile = cfg.resolve(cfg.OPCUA.PrivateKeyFile)
	cfg.APIURL = strings.TrimRight(strings.TrimSpace(cfg.APIURL), "/")
	return cfg, nil
}

func (c *Config) validate() error {
	var missing []string
	if c.APIURL == "" {
		missing = append(missing, "api_url")
	}
	if c.APIKey == "" {
		missing = append(missing, "api_key")
	}
	if c.OPCUA.Endpoint == "" {
		missing = append(missing, "opcua.endpoint")
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing config: %s", strings.Join(missing, ", "))
	}
	local := strings.HasPrefix(c.APIURL, "http://localhost") || strings.HasPrefix(c.APIURL, "http://127.0.0.1")
	if !strings.HasPrefix(c.APIURL, "https://") && !local {
		return fmt.Errorf("api_url must use https:// (plain http is only allowed for localhost)")
	}
	return nil
}

func (c *Config) resolve(p string) string {
	if p == "" || filepath.IsAbs(p) {
		return p
	}
	return filepath.Join(c.dir, p)
}

func envOverride(dst *string, key string) {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		*dst = v
	}
}
