package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// generateCert creates a self-signed OPC UA application instance certificate
// (RSA 2048, valid 10 years) whose SAN URI is appURI. The OPC UA server must
// trust it: on first connect most servers put it in a "rejected" folder; move
// it to "trusted" (or accept it in the server's admin UI).
func generateCert(certPath, keyPath, appURI string) error {
	for _, p := range []string{certPath, keyPath} {
		if _, err := os.Stat(p); err == nil {
			return fmt.Errorf("%s already exists; delete it first to create a new certificate", p)
		}
	}
	uri, err := url.Parse(appURI)
	if err != nil || uri.Scheme == "" {
		return fmt.Errorf("invalid application URI %q", appURI)
	}
	host, _ := os.Hostname()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 127))
	if err != nil {
		return err
	}
	tmpl := x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: "FSID Gateway " + host, Organization: []string{"FSID"}},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().AddDate(10, 0, 0),
		KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageContentCommitment |
			x509.KeyUsageKeyEncipherment | x509.KeyUsageDataEncipherment | x509.KeyUsageCertSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		URIs:                  []*url.URL{uri},
	}
	if host != "" {
		tmpl.DNSNames = []string{host}
	}
	der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &key.PublicKey, key)
	if err != nil {
		return err
	}

	for _, p := range []string{certPath, keyPath} {
		if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
			return err
		}
	}
	certBytes := der
	if strings.HasSuffix(certPath, ".pem") {
		certBytes = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	}
	keyDER := x509.MarshalPKCS1PrivateKey(key)
	keyBytes := keyDER
	if strings.HasSuffix(keyPath, ".pem") {
		keyBytes = pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: keyDER})
	}
	if err := os.WriteFile(certPath, certBytes, 0o644); err != nil {
		return err
	}
	return os.WriteFile(keyPath, keyBytes, 0o600)
}
