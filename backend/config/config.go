package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL            string
	SupabaseURL            string
	SupabaseAnonKey        string
	SupabaseServiceRoleKey string
	JWTSecret              string
	Port                   string

	// WebRTC ICE servers for the remote camera feature.
	// TURN is required when the two peers are on different networks (NAT traversal).
	// Defaults point at the free public OpenRelay (Metered) TURN servers for testing;
	// override with your own (e.g. self-hosted coturn or Twilio) in production.
	StunURL        string
	TurnURL        string
	TurnUsername   string
	TurnCredential string

	// OPC UA server endpoint for real machine data ingestion
	OPCUAEndpoint string
	OPCUAUsername string
	OPCUAPassword string
}

var Cfg Config

func Load() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	Cfg = Config{
		DatabaseURL:            mustGet("DATABASE_URL"),
		SupabaseURL:            mustGet("SUPABASE_URL"),
		SupabaseAnonKey:        mustGet("SUPABASE_ANON_KEY"),
		SupabaseServiceRoleKey: mustGet("SUPABASE_SERVICE_ROLE_KEY"),
		JWTSecret:              mustGet("SUPABASE_JWT_SECRET"),
		Port:                   getOr("PORT", "8080"),

		StunURL:        getOr("STUN_URL", "stun:stun.l.google.com:19302"),
		TurnURL:        getOr("TURN_URL", "turn:openrelay.metered.ca:80"),
		TurnUsername:   getOr("TURN_USERNAME", "openrelayproject"),
		TurnCredential: getOr("TURN_CREDENTIAL", "openrelayproject"),

		OPCUAEndpoint: getOr("OPCUA_ENDPOINT", "opc.tcp://146.196.46.162:4840/abhipsita/abexon"), // TODO: make dynamic; only used by the in-process client (StartOPCUAClient)
		OPCUAUsername: getOr("OPCUA_USERNAME", ""),
		OPCUAPassword: getOr("OPCUA_PASSWORD", ""),
	}
}

func mustGet(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("Required env var %s is not set", key)
	}
	return v
}

func getOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
