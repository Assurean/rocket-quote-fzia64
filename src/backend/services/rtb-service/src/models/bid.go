// Package models provides core data structures and validation logic for the RTB service
// Version: 1.0.0
package models

import (
	"encoding/json" // v1.21
	"errors"        // v1.21
	"time"         // v1.21
)

// Error definitions for bid validation
var (
	ErrInvalidBidPrice    = errors.New("bid price must be greater than zero")
	ErrMissingBidID       = errors.New("bid ID is required")
	ErrMissingPartnerID   = errors.New("partner ID is required")
	ErrMissingClickURL    = errors.New("click URL is required")
	ErrInvalidQualityScore = errors.New("quality score must be between 0 and 1")
	ErrExpiredBid         = errors.New("bid has expired")
)

// Constants for bid processing
const (
	MinBidPrice        = 0.01
	QualityScoreWeight = 0.3
)

// Bid represents a single bid from an RTB partner with quality scoring and rich media support
type Bid struct {
	ID           string                 `json:"id"`
	PartnerID    string                 `json:"partner_id"`
	Price        float64                `json:"price"`
	ClickURL     string                 `json:"click_url"`
	QualityScore float64                `json:"quality_score"`
	ExpiresAt    time.Time             `json:"expires_at"`
	Creative     map[string]interface{} `json:"creative,omitempty"`
}

// BidRequest represents a request for bids from RTB partners with timeout and user targeting support
type BidRequest struct {
	RequestID  string                 `json:"request_id"`
	LeadID     string                 `json:"lead_id"`
	Vertical   string                 `json:"vertical"`
	UserData   map[string]interface{} `json:"user_data,omitempty"`
	Timeout    time.Duration          `json:"timeout"`
	Timestamp  time.Time              `json:"timestamp"`
}

// BidResponse represents the response containing collected bids with timing information
type BidResponse struct {
	RequestID      string        `json:"request_id"`
	Bids          []*Bid        `json:"bids"`
	Timestamp     time.Time     `json:"timestamp"`
	ProcessingTime time.Duration `json:"processing_time"`
}

// ValidateBid validates a bid object ensuring all required fields are present and valid
func ValidateBid(bid *Bid) error {
	if bid == nil {
		return errors.New("bid cannot be nil")
	}

	if bid.ID == "" {
		return ErrMissingBidID
	}

	if bid.PartnerID == "" {
		return ErrMissingPartnerID
	}

	if bid.Price < MinBidPrice {
		return ErrInvalidBidPrice
	}

	if bid.ClickURL == "" {
		return ErrMissingClickURL
	}

	if bid.QualityScore < 0 || bid.QualityScore > 1 {
		return ErrInvalidQualityScore
	}

	if !bid.ExpiresAt.IsZero() && time.Now().After(bid.ExpiresAt) {
		return ErrExpiredBid
	}

	// Validate Creative format if present
	if bid.Creative != nil {
		if _, err := json.Marshal(bid.Creative); err != nil {
			return errors.New("invalid creative format")
		}
	}

	return nil
}

// CompareBids compares two bids based on effective price calculation incorporating quality scores
// Returns: -1 if a < b, 0 if a == b, 1 if a > b
func CompareBids(a, b *Bid) int {
	if a == nil || b == nil {
		if a == nil && b == nil {
			return 0
		}
		if a == nil {
			return -1
		}
		return 1
	}

	// Calculate effective prices incorporating quality scores
	effectivePriceA := a.Price * (1 + QualityScoreWeight*a.QualityScore)
	effectivePriceB := b.Price * (1 + QualityScoreWeight*b.QualityScore)

	if effectivePriceA < effectivePriceB {
		return -1
	}
	if effectivePriceA > effectivePriceB {
		return 1
	}
	return 0
}