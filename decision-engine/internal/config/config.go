// Package config loads decision-engine configuration from the environment.
// Phase 0 keeps this stdlib-only; DATABASE_URL / REDIS_URL are wired in Phase 1.
package config

import "os"

// Config holds runtime configuration for the decision engine.
type Config struct {
	Port        string
	ServiceName string
	Version     string
}

// Load reads configuration from environment variables, applying sane defaults.
func Load() Config {
	return Config{
		Port:        getenv("DECISION_ENGINE_PORT", "8080"),
		ServiceName: getenv("SERVICE_NAME", "decision-engine"),
		Version:     getenv("SERVICE_VERSION", "0.1.0"),
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
