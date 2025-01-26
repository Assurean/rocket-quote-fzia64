// Package tests provides comprehensive test coverage for the RTB service
// Version: 1.0.0
package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin" // v1.9.1
	"github.com/stretchr/testify/assert" // v1.8.4
	"github.com/stretchr/testify/mock" // v1.8.4
	"golang.org/x/sync/errgroup" // v0.3.0

	"github.com/yourdomain/rtb-service/src/config"
	"github.com/yourdomain/rtb-service/src/handlers"
	"github.com/yourdomain/rtb-service/src/models"
	"github.com/yourdomain/rtb-service/src/services"
)

// mockAuctionService implements a mock auction service for testing
type mockAuctionService struct {
	mock.Mock
	healthy        bool
	delay          time.Duration
	qualityScores  map[string]float64
	partnerOrder   []string
}

func (m *mockAuctionService) RunAuction(ctx context.Context, request *models.BidRequest) (*models.BidResponse, error) {
	// Simulate configured delay
	if m.delay > 0 {
		select {
		case <-ctx.Done():
			return nil, services.ErrAuctionTimeout
		case <-time.After(m.delay):
		}
	}

	args := m.Called(ctx, request)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.BidResponse), args.Error(1)
}

func (m *mockAuctionService) GetPartnerStats() map[string]int {
	return map[string]int{"test-partner": 0}
}

// setupTestEnvironment creates a test environment with mocked dependencies
func setupTestEnvironment(t *testing.T) (*gin.Engine, *handlers.BidHandler, *mockAuctionService) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	cfg := &config.Config{
		BidTimeout:        500 * time.Millisecond,
		MaxBidsPerRequest: 3,
		MinBidPrice:      0.01,
		MaxBidPrice:      100.0,
		Partners: map[string]*config.PartnerConfig{
			"test-partner": {
				ID:       "test-partner",
				Enabled:  true,
				Timeout:  200 * time.Millisecond,
				MinBid:   0.01,
				MaxBid:   50.0,
				Priority: 1,
			},
		},
	}

	mockAuction := &mockAuctionService{
		healthy:       true,
		qualityScores: make(map[string]float64),
	}

	handler, err := handlers.NewBidHandler(mockAuction, cfg)
	assert.NoError(t, err)

	router.POST("/v1/bids", handler.HandleBidRequest)
	router.GET("/health", handler.HandleHealthCheck)

	return router, handler, mockAuction
}

// TestBidHandlerHandleBidRequest tests the basic bid request handling functionality
func TestBidHandlerHandleBidRequest(t *testing.T) {
	router, _, mockAuction := setupTestEnvironment(t)

	// Prepare test bid response
	testBids := []*models.Bid{
		{
			ID:           "bid-1",
			PartnerID:    "test-partner",
			Price:        10.0,
			QualityScore: 0.8,
			ClickURL:     "http://example.com/click1",
		},
	}

	testResponse := &models.BidResponse{
		RequestID: "test-123",
		Bids:     testBids,
		Timestamp: time.Now(),
	}

	mockAuction.On("RunAuction", mock.Anything, mock.Anything).Return(testResponse, nil)

	// Create test request
	reqBody := models.BidRequest{
		RequestID: "test-123",
		LeadID:   "lead-123",
		Vertical: "auto",
		Timeout:  400 * time.Millisecond,
	}

	jsonBody, err := json.Marshal(reqBody)
	assert.NoError(t, err)

	// Execute request
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/bids", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)

	var response models.BidResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, reqBody.RequestID, response.RequestID)
	assert.Len(t, response.Bids, 1)
	assert.Equal(t, testBids[0].ID, response.Bids[0].ID)
}

// TestBidHandlerConcurrentRequests tests handling of concurrent bid requests
func TestBidHandlerConcurrentRequests(t *testing.T) {
	router, _, mockAuction := setupTestEnvironment(t)

	// Configure mock response
	testResponse := &models.BidResponse{
		RequestID: "test-123",
		Bids: []*models.Bid{
			{
				ID:           "bid-1",
				PartnerID:    "test-partner",
				Price:        10.0,
				QualityScore: 0.8,
			},
		},
	}

	mockAuction.On("RunAuction", mock.Anything, mock.Anything).Return(testResponse, nil)

	// Create request template
	reqBody := models.BidRequest{
		LeadID:   "lead-123",
		Vertical: "auto",
		Timeout:  400 * time.Millisecond,
	}

	// Execute concurrent requests
	concurrentRequests := 100
	eg := errgroup.Group{}
	responses := make([]int, concurrentRequests)

	for i := 0; i < concurrentRequests; i++ {
		i := i
		eg.Go(func() error {
			reqBody.RequestID = fmt.Sprintf("test-%d", i)
			jsonBody, err := json.Marshal(reqBody)
			if err != nil {
				return err
			}

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", "/v1/bids", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			responses[i] = w.Code
			return nil
		})
	}

	assert.NoError(t, eg.Wait())

	// Verify all responses were successful
	for i, code := range responses {
		assert.Equal(t, http.StatusOK, code, "Request %d failed", i)
	}
}

// TestBidHandlerQualityScoreOptimization tests quality score-based bid optimization
func TestBidHandlerQualityScoreOptimization(t *testing.T) {
	router, _, mockAuction := setupTestEnvironment(t)

	// Prepare test bids with varying quality scores
	testBids := []*models.Bid{
		{
			ID:           "bid-1",
			PartnerID:    "partner-1",
			Price:        10.0,
			QualityScore: 0.9,
			ClickURL:     "http://example.com/click1",
		},
		{
			ID:           "bid-2",
			PartnerID:    "partner-2",
			Price:        12.0,
			QualityScore: 0.5,
			ClickURL:     "http://example.com/click2",
		},
		{
			ID:           "bid-3",
			PartnerID:    "partner-3",
			Price:        8.0,
			QualityScore: 0.95,
			ClickURL:     "http://example.com/click3",
		},
	}

	testResponse := &models.BidResponse{
		RequestID: "test-123",
		Bids:     testBids,
		Timestamp: time.Now(),
	}

	mockAuction.On("RunAuction", mock.Anything, mock.Anything).Return(testResponse, nil)

	// Execute request
	reqBody := models.BidRequest{
		RequestID: "test-123",
		LeadID:   "lead-123",
		Vertical: "auto",
	}

	jsonBody, err := json.Marshal(reqBody)
	assert.NoError(t, err)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/bids", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)

	var response models.BidResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Verify bids are ordered by effective price (price * quality score)
	for i := 0; i < len(response.Bids)-1; i++ {
		effectivePriceA := response.Bids[i].Price * (1 + models.QualityScoreWeight*response.Bids[i].QualityScore)
		effectivePriceB := response.Bids[i+1].Price * (1 + models.QualityScoreWeight*response.Bids[i+1].QualityScore)
		assert.GreaterOrEqual(t, effectivePriceA, effectivePriceB)
	}
}

// TestBidHandlerErrorScenarios tests various error handling scenarios
func TestBidHandlerErrorScenarios(t *testing.T) {
	router, _, mockAuction := setupTestEnvironment(t)

	testCases := []struct {
		name           string
		request        models.BidRequest
		mockError      error
		expectedStatus int
	}{
		{
			name:           "Invalid Request - Missing RequestID",
			request:        models.BidRequest{LeadID: "lead-123"},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Auction Timeout",
			request:        models.BidRequest{RequestID: "test-123", LeadID: "lead-123"},
			mockError:      services.ErrAuctionTimeout,
			expectedStatus: http.StatusGatewayTimeout,
		},
		{
			name:           "No Valid Bids",
			request:        models.BidRequest{RequestID: "test-123", LeadID: "lead-123"},
			mockError:      services.ErrNoValidBids,
			expectedStatus: http.StatusNoContent,
		},
		{
			name:           "Partner Failure",
			request:        models.BidRequest{RequestID: "test-123", LeadID: "lead-123"},
			mockError:      services.ErrPartnerFailure,
			expectedStatus: http.StatusServiceUnavailable,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.mockError != nil {
				mockAuction.On("RunAuction", mock.Anything, mock.Anything).Return(nil, tc.mockError).Once()
			}

			jsonBody, err := json.Marshal(tc.request)
			assert.NoError(t, err)

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", "/v1/bids", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}