import { useCallback, useMemo, useRef, useEffect } from 'react'; // ^18.2.0
import { useBidding, UseBiddingConfig, BidError } from '@rtb/hooks/useBidding';
import { useSelector, useDispatch } from 'react-redux';

// Interfaces
export interface UseRTBConfig {
  leadId: string;
  vertical: string;
  leadScore: number;
  timeout?: number;
  retryAttempts?: number;
  cacheDuration?: number;
}

export interface BidStats {
  averageBidAmount: number;
  totalBids: number;
  highestBid: number;
  lowestBid: number;
  bidDistribution: Record<string, number>;
}

export interface UseRTBResult {
  bids: Bid[];
  isLoading: boolean;
  error: BidError | null;
  refreshBids: () => Promise<void>;
  handleBidClick: (bid: Bid) => Promise<void>;
  isCached: boolean;
  clearCache: () => void;
  bidStats: BidStats;
}

// Constants
const DEFAULT_CONFIG = {
  timeout: 500, // 500ms as per technical spec
  retryAttempts: 2,
  cacheDuration: 30000, // 30 seconds
};

/**
 * Custom hook for managing RTB operations with enhanced session tracking
 * and performance optimizations
 */
export const useRTB = (config: UseRTBConfig): UseRTBResult => {
  // Redux state management
  const dispatch = useDispatch();
  const sessionState = useSelector((state) => state.session);
  
  // Refs for performance tracking
  const performanceRef = useRef<{
    startTime: number;
    loadTimes: number[];
  }>({
    startTime: performance.now(),
    loadTimes: [],
  });

  // Memoized bidding configuration
  const biddingConfig = useMemo<UseBiddingConfig>(() => ({
    leadId: config.leadId,
    vertical: config.vertical,
    leadScore: config.leadScore,
    userData: {
      sessionId: sessionState.sessionId,
      deviceInfo: sessionState.deviceInfo,
      trafficSource: sessionState.trafficSource,
      behaviorData: {
        formStepsCompleted: sessionState.behaviorData.formStepsCompleted,
        timeOnPage: sessionState.behaviorData.timeOnPage,
      },
    },
    refreshInterval: config.cacheDuration ?? DEFAULT_CONFIG.cacheDuration,
    maxRetries: config.retryAttempts ?? DEFAULT_CONFIG.retryAttempts,
  }), [config, sessionState]);

  // Initialize useBidding hook
  const {
    bids,
    isLoading,
    error,
    refreshBids: refreshBidsBase,
    handleBidClick: handleBidClickBase,
    isStale,
    lastRefreshTime,
    resetError,
  } = useBidding(biddingConfig);

  // Calculate bid statistics
  const calculateBidStats = useCallback((currentBids: Bid[]): BidStats => {
    if (currentBids.length === 0) {
      return {
        averageBidAmount: 0,
        totalBids: 0,
        highestBid: 0,
        lowestBid: 0,
        bidDistribution: {},
      };
    }

    const amounts = currentBids.map(bid => bid.amount);
    const distribution: Record<string, number> = {};
    
    currentBids.forEach(bid => {
      distribution[bid.advertiserId] = (distribution[bid.advertiserId] || 0) + 1;
    });

    return {
      averageBidAmount: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      totalBids: currentBids.length,
      highestBid: Math.max(...amounts),
      lowestBid: Math.min(...amounts),
      bidDistribution: distribution,
    };
  }, []);

  // Enhanced refresh bids with performance tracking
  const refreshBids = useCallback(async () => {
    const start = performance.now();
    try {
      await refreshBidsBase();
      const duration = performance.now() - start;
      performanceRef.current.loadTimes.push(duration);
      
      // Track in session if exceeding performance threshold
      if (duration > DEFAULT_CONFIG.timeout) {
        dispatch({
          type: 'session/updateBehaviorData',
          payload: {
            errorCounts: {
              ...sessionState.behaviorData.errorCounts,
              rtbTimeout: (sessionState.behaviorData.errorCounts.rtbTimeout || 0) + 1,
            },
          },
        });
      }
    } catch (error) {
      resetError();
      throw error;
    }
  }, [refreshBidsBase, dispatch, sessionState.behaviorData.errorCounts]);

  // Enhanced bid click handler with session tracking
  const handleBidClick = useCallback(async (bid: Bid) => {
    try {
      await handleBidClickBase(bid);
      
      // Track interaction in session
      dispatch({
        type: 'session/updateBehaviorData',
        payload: {
          navigationPattern: [
            ...sessionState.behaviorData.navigationPattern,
            `click_wall_click_${bid.advertiserId}`,
          ],
        },
      });
    } catch (error) {
      console.error('Bid click handling failed:', error);
      throw error;
    }
  }, [handleBidClickBase, dispatch, sessionState.behaviorData.navigationPattern]);

  // Clear RTB cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(`rtb_cache_${config.leadId}`);
  }, [config.leadId]);

  // Monitor performance metrics
  useEffect(() => {
    const avgLoadTime = performanceRef.current.loadTimes.reduce((a, b) => a + b, 0) / 
      (performanceRef.current.loadTimes.length || 1);

    if (avgLoadTime > DEFAULT_CONFIG.timeout) {
      console.warn(`RTB average load time (${avgLoadTime}ms) exceeds threshold (${DEFAULT_CONFIG.timeout}ms)`);
    }
  }, [bids]);

  // Calculate current bid statistics
  const bidStats = useMemo(() => calculateBidStats(bids), [bids, calculateBidStats]);

  return {
    bids,
    isLoading,
    error,
    refreshBids,
    handleBidClick,
    isCached: !isStale && Date.now() - lastRefreshTime < (config.cacheDuration ?? DEFAULT_CONFIG.cacheDuration),
    clearCache,
    bidStats,
  };
};

export default useRTB;