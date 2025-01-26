// Package services provides core business logic for the RTB service
// Version: 1.0.0
package services

import (
    "context"
    "errors"
    "sync"
    "time"

    "github.com/yourdomain/rtb-service/src/config"
    "github.com/yourdomain/rtb-service/src/models"
    "github.com/yourdomain/rtb-service/src/utils"
)

// Global error definitions
var (
    ErrNoValidBids     = errors.New("no valid bids received")
    ErrAuctionTimeout  = errors.New("auction timed out")
    ErrInvalidRequest  = errors.New("invalid bid request")
    ErrPartnerFailure  = errors.New("partner bid collection failed")
)

// AuctionService manages RTB auctions with thread-safe operations
type AuctionService struct {
    config          *config.Config
    optimizer       *utils.BidOptimizer
    mutex           sync.RWMutex
    partnerFailures map[string]int
}

// NewAuctionService creates a new AuctionService instance with configuration validation
func NewAuctionService(cfg *config.Config) (*AuctionService, error) {
    if cfg == nil {
        return nil, errors.New("configuration cannot be nil")
    }

    optimizer, err := utils.NewBidOptimizer(cfg, nil)
    if err != nil {
        return nil, err
    }

    return &AuctionService{
        config:          cfg,
        optimizer:       optimizer,
        partnerFailures: make(map[string]int),
    }, nil
}

// RunAuction executes a complete RTB auction process
func (s *AuctionService) RunAuction(ctx context.Context, request *models.BidRequest) (*models.BidResponse, error) {
    startTime := time.Now()

    // Validate request
    if request == nil || request.RequestID == "" {
        return nil, ErrInvalidRequest
    }

    // Collect bids from partners
    bids, err := s.collectBids(ctx, request)
    if err != nil {
        return nil, err
    }

    // Optimize and determine winners
    winners, err := s.determineWinners(bids)
    if err != nil {
        return nil, err
    }

    // Create response
    response := &models.BidResponse{
        RequestID:      request.RequestID,
        Bids:          winners,
        Timestamp:     time.Now(),
        ProcessingTime: time.Since(startTime),
    }

    return response, nil
}

// collectBids collects bids from all configured RTB partners in parallel
func (s *AuctionService) collectBids(ctx context.Context, request *models.BidRequest) ([]*models.Bid, error) {
    s.mutex.RLock()
    defer s.mutex.RUnlock()

    var wg sync.WaitGroup
    bidChan := make(chan *models.Bid, len(s.config.Partners))
    errChan := make(chan error, len(s.config.Partners))

    // Launch bid collection for each partner
    for partnerID, partner := range s.config.Partners {
        if !partner.Enabled {
            continue
        }

        wg.Add(1)
        go func(pID string, p *config.PartnerConfig) {
            defer wg.Done()
            
            // Create partner-specific timeout context
            partnerCtx, cancel := context.WithTimeout(ctx, p.Timeout)
            defer cancel()

            bid, err := s.collectPartnerBid(partnerCtx, pID, p, request)
            if err != nil {
                s.recordPartnerFailure(pID)
                errChan <- err
                return
            }

            if bid != nil {
                bidChan <- bid
            }
        }(partnerID, partner)
    }

    // Wait for all bid collections with timeout
    done := make(chan struct{})
    go func() {
        wg.Wait()
        close(done)
    }()

    select {
    case <-ctx.Done():
        return nil, ErrAuctionTimeout
    case <-done:
        close(bidChan)
        close(errChan)
    }

    // Collect and validate bids
    var validBids []*models.Bid
    for bid := range bidChan {
        if err := models.ValidateBid(bid); err == nil {
            validBids = append(validBids, bid)
        }
    }

    if len(validBids) == 0 {
        return nil, ErrNoValidBids
    }

    return validBids, nil
}

// determineWinners selects winning bids based on price and quality score
func (s *AuctionService) determineWinners(bids []*models.Bid) ([]*models.Bid, error) {
    if len(bids) == 0 {
        return nil, ErrNoValidBids
    }

    // Optimize bids using the bid optimizer
    optimizedBids, err := s.optimizer.OptimizeBidSet(bids)
    if err != nil {
        return nil, err
    }

    // Apply partner diversity rules and select top N bids
    maxWinners := s.config.MaxBidsPerRequest
    if maxWinners > len(optimizedBids) {
        maxWinners = len(optimizedBids)
    }

    winners := make([]*models.Bid, 0, maxWinners)
    seenPartners := make(map[string]bool)

    for _, bid := range optimizedBids {
        if len(winners) >= maxWinners {
            break
        }

        // Ensure partner diversity
        if !seenPartners[bid.PartnerID] {
            winners = append(winners, bid)
            seenPartners[bid.PartnerID] = true
        }
    }

    return winners, nil
}

// recordPartnerFailure tracks partner failures for monitoring
func (s *AuctionService) recordPartnerFailure(partnerID string) {
    s.mutex.Lock()
    defer s.mutex.Unlock()
    s.partnerFailures[partnerID]++
}

// GetPartnerStats returns partner performance statistics
func (s *AuctionService) GetPartnerStats() map[string]int {
    s.mutex.RLock()
    defer s.mutex.RUnlock()
    
    stats := make(map[string]int)
    for partner, failures := range s.partnerFailures {
        stats[partner] = failures
    }
    return stats
}

// collectPartnerBid collects a bid from a single partner
func (s *AuctionService) collectPartnerBid(ctx context.Context, partnerID string, 
    partner *config.PartnerConfig, request *models.BidRequest) (*models.Bid, error) {
    
    // Implementation would include HTTP client call to partner endpoint
    // Omitted for brevity as it depends on external HTTP client implementation
    
    return nil, nil
}