// Package handlers provides HTTP request handlers for the RTB service
// Version: 1.0.0
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin" // v1.9.1
	"github.com/prometheus/client_golang/prometheus" // v1.16.0

	"github.com/yourdomain/rtb-service/src/config"
	"github.com/yourdomain/rtb-service/src/models"
	"github.com/yourdomain/rtb-service/src/services"
)

// Prometheus metrics
var (
	bidRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rtb_bid_requests_total",
			Help: "Total number of bid requests received",
		},
		[]string{"vertical", "partner"},
	)

	bidResponseTime = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "rtb_bid_response_time_seconds",
			Help:    "Bid response time in seconds",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5},
		},
		[]string{"vertical", "partner"},
	)

	successfulBids = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rtb_successful_bids_total",
			Help: "Total number of successful bid responses",
		},
		[]string{"vertical", "partner"},
	)

	bidErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "rtb_bid_errors_total",
			Help: "Total number of bid errors by type",
		},
		[]string{"error_type", "partner"},
	)

	activeBidGauge = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "rtb_active_bids",
			Help: "Number of currently active bid requests",
		},
	)
)

func init() {
	// Register Prometheus metrics
	prometheus.MustRegister(bidRequestsTotal)
	prometheus.MustRegister(bidResponseTime)
	prometheus.MustRegister(successfulBids)
	prometheus.MustRegister(bidErrors)
	prometheus.MustRegister(activeBidGauge)
}

// BidHandler handles RTB requests with thread-safety and metrics
type BidHandler struct {
	auctionService *services.AuctionService
	config         *config.Config
	mutex          sync.RWMutex
	ctx            context.Context
	cancel         context.CancelFunc
}

// NewBidHandler creates a new BidHandler instance
func NewBidHandler(auction *services.AuctionService, cfg *config.Config) (*BidHandler, error) {
	if auction == nil || cfg == nil {
		return nil, models.ErrInvalidInput
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &BidHandler{
		auctionService: auction,
		config:         cfg,
		ctx:            ctx,
		cancel:         cancel,
	}, nil
}

// HandleBidRequest processes incoming RTB requests
func (h *BidHandler) HandleBidRequest(c *gin.Context) {
	startTime := time.Now()
	activeBidGauge.Inc()
	defer activeBidGauge.Dec()

	// Parse request body
	var bidRequest models.BidRequest
	if err := c.ShouldBindJSON(&bidRequest); err != nil {
		bidErrors.WithLabelValues("invalid_request", "unknown").Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Record request metric
	bidRequestsTotal.WithLabelValues(bidRequest.Vertical, "all").Inc()

	// Create timeout context
	reqCtx, cancel := context.WithTimeout(h.ctx, h.config.BidTimeout)
	defer cancel()

	// Execute auction
	response, err := h.auctionService.RunAuction(reqCtx, &bidRequest)
	if err != nil {
		h.handleAuctionError(c, err)
		return
	}

	// Record successful bids
	for _, bid := range response.Bids {
		successfulBids.WithLabelValues(bidRequest.Vertical, bid.PartnerID).Inc()
	}

	// Record response time
	duration := time.Since(startTime).Seconds()
	bidResponseTime.WithLabelValues(bidRequest.Vertical, "all").Observe(duration)

	// Set response headers
	c.Header("X-RTB-Request-ID", bidRequest.RequestID)
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("X-RTB-Processing-Time", duration.String())

	c.JSON(http.StatusOK, response)
}

// HandleHealthCheck provides service health status
func (h *BidHandler) HandleHealthCheck(c *gin.Context) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	status := gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
	}

	// Check auction service health
	if h.auctionService == nil {
		status["status"] = "degraded"
		status["reason"] = "auction service unavailable"
		c.JSON(http.StatusServiceUnavailable, status)
		return
	}

	// Add service stats
	status["active_bids"] = activeBidGauge.Get()
	status["partner_stats"] = h.auctionService.GetPartnerStats()

	c.JSON(http.StatusOK, status)
}

// handleAuctionError handles various auction error cases
func (h *BidHandler) handleAuctionError(c *gin.Context, err error) {
	switch err {
	case services.ErrNoValidBids:
		bidErrors.WithLabelValues("no_valid_bids", "all").Inc()
		c.JSON(http.StatusNoContent, gin.H{"error": "No valid bids received"})
	case services.ErrAuctionTimeout:
		bidErrors.WithLabelValues("timeout", "all").Inc()
		c.JSON(http.StatusGatewayTimeout, gin.H{"error": "Auction timed out"})
	case services.ErrInvalidRequest:
		bidErrors.WithLabelValues("invalid_request", "all").Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid bid request"})
	case services.ErrPartnerFailure:
		bidErrors.WithLabelValues("partner_failure", "all").Inc()
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Partner bid collection failed"})
	default:
		bidErrors.WithLabelValues("unknown", "all").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
	}
}