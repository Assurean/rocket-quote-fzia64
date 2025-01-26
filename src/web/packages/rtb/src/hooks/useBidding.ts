import { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // ^18.2.0
import { debounce } from 'lodash'; // ^4.17.21

import { BiddingService, BiddingServiceConfig } from '../services/bidding';
import { Bid, BidError, BidValidationError } from '../utils/bid';

// Configuration interface for the useBidding hook
export interface UseBiddingConfig {
  leadId: string;
  vertical: string;
  leadScore: number;
  userData: Record<string, unknown>;
  refreshInterval?: number;
  maxRetries?: number;
  bidExpirationTime?: number;
}

// Return interface for the useBidding hook
export interface UseBiddingResult {
  bids: Bid[];
  isLoading: boolean;
  error: BidError | null;
  refreshBids: () => Promise<void>;
  handleBidClick: (bid: Bid) => Promise<void>;
  isStale: boolean;
  lastRefreshTime: number;
  resetError: () => void;
}

// Default configuration values
const DEFAULT_CONFIG: Partial<UseBiddingConfig> = {
  refreshInterval: 30000, // 30 seconds
  maxRetries: 3,
  bidExpirationTime: 300000, // 5 minutes
};

// RTB service configuration
const RTB_CONFIG: BiddingServiceConfig = {
  rtbEndpoint: 'https://rtb-api.insureleads.com/v1',
  timeout: 2000,
  retryAttempts: 3,
  minBidAmount: 0.01,
  maxBidAmount: 100.00,
  cacheDuration: 60000,
  maxConcurrentRequests: 5,
  enableFraudDetection: true,
  rateLimits: {
    requestsPerSecond: 10,
    burstSize: 20
  }
};

export const useBidding = (config: UseBiddingConfig): UseBiddingResult => {
  // State management
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<BidError | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [isStale, setIsStale] = useState<boolean>(false);

  // Refs for managing async operations and caching
  const biddingServiceRef = useRef<BiddingService | null>(null);
  const retryCountRef = useRef<number>(0);
  const refreshTimerRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Memoized bidding service instance
  const biddingService = useMemo(() => {
    if (!biddingServiceRef.current) {
      biddingServiceRef.current = new BiddingService(RTB_CONFIG, {
        trackingEndpoint: 'https://tracking-api.insureleads.com/v1',
        timeout: 1000,
        retryAttempts: 2,
        debugMode: process.env.NODE_ENV === 'development',
        batchSize: 10,
        flushInterval: 5000,
        compression: true,
        headers: {
          'X-Client-Version': '1.0.0'
        }
      });
    }
    return biddingServiceRef.current;
  }, []);

  // Debounced bid refresh function
  const debouncedRefresh = useCallback(
    debounce(async () => {
      if (isLoading) return;

      try {
        setIsLoading(true);
        setError(null);

        // Create new abort controller for this request
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        // Request and optimize bids
        const newBids = await biddingService.requestBids(
          config.leadId,
          config.vertical,
          config.userData
        );

        const optimizedBids = await biddingService.selectOptimalBids(
          newBids,
          config.leadScore,
          {
            timestamp: Date.now(),
            vertical: config.vertical,
            ...config.userData
          }
        );

        setBids(optimizedBids);
        setLastRefreshTime(Date.now());
        setIsStale(false);
        retryCountRef.current = 0;

      } catch (err) {
        const bidError = err as BidError;
        setError(bidError);

        // Implement retry logic
        if (retryCountRef.current < (config.maxRetries ?? DEFAULT_CONFIG.maxRetries!)) {
          retryCountRef.current++;
          setTimeout(() => {
            debouncedRefresh();
          }, 1000 * retryCountRef.current);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250),
    [config.leadId, config.vertical, config.leadScore, config.userData]
  );

  // Bid click handler
  const handleBidClick = useCallback(async (bid: Bid) => {
    try {
      await biddingService.trackBidSelection(bid, config.leadId, {
        vertical: config.vertical,
        leadScore: config.leadScore,
        clickTimestamp: Date.now()
      });
    } catch (err) {
      console.error('Failed to track bid selection:', err);
    }
  }, [config.leadId, config.vertical, config.leadScore]);

  // Error reset handler
  const resetError = useCallback(() => {
    setError(null);
    retryCountRef.current = 0;
  }, []);

  // Setup refresh interval
  useEffect(() => {
    const refreshInterval = config.refreshInterval ?? DEFAULT_CONFIG.refreshInterval;
    
    if (refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        const timeSinceLastRefresh = Date.now() - lastRefreshTime;
        if (timeSinceLastRefresh >= refreshInterval) {
          setIsStale(true);
          debouncedRefresh();
        }
      }, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      debouncedRefresh.cancel();
      abortControllerRef.current?.abort();
    };
  }, [config.refreshInterval, lastRefreshTime]);

  // Initial bid fetch
  useEffect(() => {
    debouncedRefresh();
  }, [config.leadId, config.vertical, config.leadScore]);

  // Bid expiration monitoring
  useEffect(() => {
    const expirationTime = config.bidExpirationTime ?? DEFAULT_CONFIG.bidExpirationTime;
    const checkExpiration = () => {
      const now = Date.now();
      const hasExpiredBids = bids.some(bid => bid.expiresAt <= now);
      if (hasExpiredBids) {
        setIsStale(true);
        debouncedRefresh();
      }
    };

    const expirationTimer = setInterval(checkExpiration, 10000); // Check every 10 seconds

    return () => {
      clearInterval(expirationTimer);
    };
  }, [bids, config.bidExpirationTime]);

  return {
    bids,
    isLoading,
    error,
    refreshBids: debouncedRefresh,
    handleBidClick,
    isStale,
    lastRefreshTime,
    resetError
  };
};

export default useBidding;