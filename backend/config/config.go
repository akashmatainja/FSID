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
