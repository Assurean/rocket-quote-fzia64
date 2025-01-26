// Package config provides configuration management for the Real-Time Bidding (RTB) service
// Version: 1.0.0
package config

import (
	"encoding/json" // v1.21.0
	"fmt"
	"os"      // v1.21.0
	"time"    // v1.21.0
	"github.com/spf13/viper" // v1.16.0
)

// Default configuration values
const (
	defaultTimeout        = 500 * time.Millisecond
	defaultMaxBids       = 5
	defaultMinBidPrice   = 0.01
	defaultMaxBidPrice   = 100.0
	defaultRedisTimeout  = 200 * time.Millisecond
	defaultMetricsInterval = 10 * time.Second
)

// Config represents the main RTB service configuration
type Config struct {
	Port                 int              `json:"port" mapstructure:"port"`
	BidTimeout          time.Duration    `json:"bidTimeout" mapstructure:"bid_timeout"`
	MaxBidsPerRequest   int              `json:"maxBidsPerRequest" mapstructure:"max_bids_per_request"`
	MinBidPrice         float64          `json:"minBidPrice" mapstructure:"min_bid_price"`
	MaxBidPrice         float64          `json:"maxBidPrice" mapstructure:"max_bid_price"`
	Partners            map[string]*PartnerConfig `json:"partners" mapstructure:"partners"`
	Redis               *RedisConfig     `json:"redis" mapstructure:"redis"`
	Metrics             *MetricsConfig   `json:"metrics" mapstructure:"metrics"`
	EnableDynamicPricing bool            `json:"enableDynamicPricing" mapstructure:"enable_dynamic_pricing"`
	ConfigReloadInterval time.Duration   `json:"configReloadInterval" mapstructure:"config_reload_interval"`
}

// PartnerConfig represents configuration for individual RTB partners
type PartnerConfig struct {
	ID                 string             `json:"id" mapstructure:"id"`
	Endpoint           string             `json:"endpoint" mapstructure:"endpoint"`
	APIKey             string             `json:"apiKey" mapstructure:"api_key"`
	Timeout            time.Duration      `json:"timeout" mapstructure:"timeout"`
	MinBid             float64            `json:"minBid" mapstructure:"min_bid"`
	MaxBid             float64            `json:"maxBid" mapstructure:"max_bid"`
	VerticalMultipliers map[string]float64 `json:"verticalMultipliers" mapstructure:"vertical_multipliers"`
	Priority           int                `json:"priority" mapstructure:"priority"`
	Enabled            bool               `json:"enabled" mapstructure:"enabled"`
}

// RedisConfig represents Redis connection configuration
type RedisConfig struct {
	Host          string        `json:"host" mapstructure:"host"`
	Port          int           `json:"port" mapstructure:"port"`
	Password      string        `json:"password" mapstructure:"password"`
	Database      int           `json:"database" mapstructure:"database"`
	Timeout       time.Duration `json:"timeout" mapstructure:"timeout"`
	MaxRetries    int           `json:"maxRetries" mapstructure:"max_retries"`
	RetryInterval time.Duration `json:"retryInterval" mapstructure:"retry_interval"`
}

// MetricsConfig represents metrics collection configuration
type MetricsConfig struct {
	Enabled        bool              `json:"enabled" mapstructure:"enabled"`
	Prefix         string            `json:"prefix" mapstructure:"prefix"`
	ReportInterval time.Duration     `json:"reportInterval" mapstructure:"report_interval"`
	StatsDAddress  string            `json:"statsdAddress" mapstructure:"statsd_address"`
	Tags           map[string]string `json:"tags" mapstructure:"tags"`
}

// LoadConfig loads and validates RTB service configuration from multiple sources
func LoadConfig(configPath string) (*Config, error) {
	v := viper.New()

	// Set default values
	v.SetDefault("port", 8080)
	v.SetDefault("bid_timeout", defaultTimeout)
	v.SetDefault("max_bids_per_request", defaultMaxBids)
	v.SetDefault("min_bid_price", defaultMinBidPrice)
	v.SetDefault("max_bid_price", defaultMaxBidPrice)
	v.SetDefault("enable_dynamic_pricing", true)
	v.SetDefault("config_reload_interval", time.Minute)

	// Configure Viper
	v.SetEnvPrefix("RTB")
	v.AutomaticEnv()
	v.SetConfigFile(configPath)

	// Read config file
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	config := &Config{}
	if err := v.Unmarshal(config); err != nil {
		return nil, fmt.Errorf("error unmarshaling config: %w", err)
	}

	// Validate configuration
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return config, nil
}

// Validate performs comprehensive validation of all configuration parameters
func (c *Config) Validate() error {
	// Validate server configuration
	if c.Port < 1024 || c.Port > 65535 {
		return fmt.Errorf("invalid port number: %d", c.Port)
	}

	if c.BidTimeout < 100*time.Millisecond || c.BidTimeout > time.Second {
		return fmt.Errorf("bid timeout must be between 100ms and 1s")
	}

	if c.MinBidPrice <= 0 || c.MaxBidPrice <= 0 || c.MinBidPrice >= c.MaxBidPrice {
		return fmt.Errorf("invalid bid price range: min=%v, max=%v", c.MinBidPrice, c.MaxBidPrice)
	}

	// Validate partner configurations
	for id, partner := range c.Partners {
		if partner.Enabled {
			if partner.Endpoint == "" {
				return fmt.Errorf("missing endpoint for partner %s", id)
			}
			if partner.APIKey == "" {
				return fmt.Errorf("missing API key for partner %s", id)
			}
			if partner.Timeout < 50*time.Millisecond || partner.Timeout > c.BidTimeout {
				return fmt.Errorf("invalid timeout for partner %s", id)
			}
			for vertical, multiplier := range partner.VerticalMultipliers {
				if multiplier < 0.1 || multiplier > 10.0 {
					return fmt.Errorf("invalid multiplier %v for vertical %s in partner %s", multiplier, vertical, id)
				}
			}
		}
	}

	// Validate Redis configuration
	if c.Redis != nil {
		if c.Redis.Host == "" {
			return fmt.Errorf("missing Redis host")
		}
		if c.Redis.Port < 1 || c.Redis.Port > 65535 {
			return fmt.Errorf("invalid Redis port: %d", c.Redis.Port)
		}
		if c.Redis.Timeout < 50*time.Millisecond {
			return fmt.Errorf("Redis timeout too low: %v", c.Redis.Timeout)
		}
	}

	// Validate metrics configuration
	if c.Metrics != nil && c.Metrics.Enabled {
		if c.Metrics.StatsDAddress == "" {
			return fmt.Errorf("missing StatsD address")
		}
		if c.Metrics.ReportInterval < time.Second {
			return fmt.Errorf("metrics report interval too low: %v", c.Metrics.ReportInterval)
		}
	}

	return nil
}