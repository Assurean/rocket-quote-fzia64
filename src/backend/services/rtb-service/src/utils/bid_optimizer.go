// Package utils provides utility functions for the RTB service
// Version: 1.0.0
package utils

import (
	"errors"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/yourdomain/rtb-service/src/config"
	"github.com/yourdomain/rtb-service/src/models"
)

// Constants for bid optimization
const (
	defaultQualityScore     = 0.5
	minQualityScore        = 0.1
	maxQualityScore        = 1.0
	maxConcurrentProcessing = 100
	bidProcessTimeout       = 400 * time.Millisecond
)

// Error definitions
var (
	ErrNilBids      = errors.New("bids array cannot be nil")
	ErrNilConfig    = errors.New("configuration cannot be nil")
	ErrTimeout      = errors.New("bid optimization timed out")
	ErrInvalidInput = errors.New("invalid input parameters")
)

// BidOptimizer provides thread-safe bid optimization with performance monitoring
type BidOptimizer struct {
	config          *config.Config
	partnerScores   map[string]float64
	mutex           sync.RWMutex
	bidWorkerPool   *sync.Pool
	metricsReporter MetricsReporter
}

// MetricsReporter interface for reporting optimization metrics
type MetricsReporter interface {
	RecordProcessingTime(duration time.Duration)
	RecordBidCount(count int)
	RecordOptimizationError(err error)
}

// NewBidOptimizer creates a new BidOptimizer instance with configuration
func NewBidOptimizer(cfg *config.Config, reporter MetricsReporter) (*BidOptimizer, error) {
	if cfg == nil {
		return nil, ErrNilConfig
	}

	optimizer := &BidOptimizer{
		config:          cfg,
		partnerScores:   make(map[string]float64),
		metricsReporter: reporter,
		bidWorkerPool: &sync.Pool{
			New: func() interface{} {
				return make([]*models.Bid, 0, 10)
			},
		},
	}

	return optimizer, nil
}

// OptimizeBids optimizes and ranks a collection of bids using concurrent processing
func OptimizeBids(bids []*models.Bid, cfg *config.Config) ([]*models.Bid, error) {
	if bids == nil || cfg == nil {
		return nil, ErrInvalidInput
	}

	// Create channels for concurrent processing
	bidCount := len(bids)
	resultChan := make(chan *models.Bid, bidCount)
	errorChan := make(chan error, 1)
	
	// Create worker pool with size limits
	workerCount := int(math.Min(float64(bidCount), float64(maxConcurrentProcessing)))
	var wg sync.WaitGroup
	
	// Process bids concurrently
	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(start int) {
			defer wg.Done()
			for j := start; j < bidCount; j += workerCount {
				if effectivePrice, err := calculateEffectivePrice(bids[j], cfg); err == nil {
					bids[j].QualityScore = math.Max(minQualityScore, 
						math.Min(maxQualityScore, bids[j].QualityScore))
					resultChan <- bids[j]
				}
			}
		}(i)
	}

	// Wait for processing with timeout
	done := make(chan bool)
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		close(resultChan)
	case <-time.After(bidProcessTimeout):
		return nil, ErrTimeout
	}

	// Collect and sort results
	optimizedBids := make([]*models.Bid, 0, bidCount)
	for bid := range resultChan {
		optimizedBids = append(optimizedBids, bid)
	}

	// Sort by effective price descending
	sort.Slice(optimizedBids, func(i, j int) bool {
		return models.CompareBids(optimizedBids[i], optimizedBids[j]) > 0
	})

	return optimizedBids, nil
}

// calculateEffectivePrice calculates the effective bid price with adjustments
func calculateEffectivePrice(bid *models.Bid, cfg *config.Config) (float64, error) {
	if bid == nil || cfg == nil {
		return 0, ErrInvalidInput
	}

	// Validate bid price bounds
	if bid.Price < cfg.MinBidPrice || bid.Price > cfg.MaxBidPrice {
		return 0, errors.New("bid price out of bounds")
	}

	// Apply quality score multiplier
	qualityMultiplier := 1.0 + (bid.QualityScore * models.QualityScoreWeight)

	// Get partner configuration
	partner, exists := cfg.Partners[bid.PartnerID]
	if !exists {
		return 0, errors.New("unknown partner")
	}

	// Apply time-of-day adjustment
	hour := time.Now().Hour()
	timeMultiplier := calculateTimeMultiplier(hour)

	// Apply partner vertical multiplier if exists
	verticalMultiplier := 1.0
	if multiplier, exists := partner.VerticalMultipliers["default"]; exists {
		verticalMultiplier = multiplier
	}

	// Calculate final effective price
	effectivePrice := bid.Price * qualityMultiplier * timeMultiplier * verticalMultiplier

	// Ensure price stays within bounds
	effectivePrice = math.Max(cfg.MinBidPrice, math.Min(cfg.MaxBidPrice, effectivePrice))

	return effectivePrice, nil
}

// calculateTimeMultiplier returns a multiplier based on hour of day
func calculateTimeMultiplier(hour int) float64 {
	// Peak hours (9AM-5PM) get higher multiplier
	if hour >= 9 && hour <= 17 {
		return 1.2
	}
	// Evening hours (6PM-10PM) get medium multiplier
	if hour >= 18 && hour <= 22 {
		return 1.1
	}
	// Off-peak hours get lower multiplier
	return 0.9
}

// OptimizeBidSet provides thread-safe bid optimization with metrics
func (bo *BidOptimizer) OptimizeBidSet(bids []*models.Bid) ([]*models.Bid, error) {
	startTime := time.Now()
	defer func() {
		if bo.metricsReporter != nil {
			bo.metricsReporter.RecordProcessingTime(time.Since(startTime))
			bo.metricsReporter.RecordBidCount(len(bids))
		}
	}()

	// Acquire read lock for configuration access
	bo.mutex.RLock()
	optimizedBids, err := OptimizeBids(bids, bo.config)
	bo.mutex.RUnlock()

	if err != nil && bo.metricsReporter != nil {
		bo.metricsReporter.RecordOptimizationError(err)
	}

	return optimizedBids, err
}