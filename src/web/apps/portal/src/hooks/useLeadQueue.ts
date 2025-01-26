// External imports with versions
import { useEffect, useCallback, useRef } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^9.0.0

// Internal imports
import { 
  fetchLeadQueue, 
  updateLeadStatus,
  selectLeadQueueWithMetrics,
  selectLeadQueueStatus
} from '../store/slices/leadSlice';

// Constants
const POLLING_INTERVAL_ACTIVE = 10000; // 10 seconds
const POLLING_INTERVAL_INACTIVE = 30000; // 30 seconds
const ERROR_RETRY_LIMIT = 3;
const PERFORMANCE_THRESHOLD = 500; // 500ms response time threshold

// Types
export interface ILeadQueueParams {
  vertical?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IQueueMetrics {
  acceptanceRate: number;
  averageResponseTime: number;
  errorRate: number;
  isPerformanceOptimal: boolean;
}

interface IQueueState {
  leads: any[];
  loading: boolean;
  error: string | null;
  metrics: IQueueMetrics;
  lastUpdated: number | null;
}

/**
 * Custom hook for managing lead queue operations with performance optimization
 * and quality tracking capabilities
 */
export const useLeadQueue = (params: ILeadQueueParams = {}) => {
  const dispatch = useDispatch();
  
  // Redux selectors
  const { leads, metrics, isPerformanceOptimal } = useSelector(selectLeadQueueWithMetrics);
  const { status, error, lastUpdated } = useSelector(selectLeadQueueStatus);

  // Refs for managing polling and performance
  const pollingInterval = useRef<NodeJS.Timeout>();
  const errorCount = useRef(0);
  const lastFetchTime = useRef<number>();
  const isTabActive = useRef(true);

  /**
   * Memoized fetch function with error handling and performance tracking
   */
  const fetchQueue = useCallback(async () => {
    try {
      const startTime = Date.now();
      await dispatch(fetchLeadQueue(params)).unwrap();
      
      // Track fetch performance
      const fetchDuration = Date.now() - startTime;
      if (fetchDuration > PERFORMANCE_THRESHOLD) {
        console.warn(`Lead queue fetch exceeded performance threshold: ${fetchDuration}ms`);
      }
      
      errorCount.current = 0;
      lastFetchTime.current = Date.now();
    } catch (err) {
      errorCount.current++;
      
      if (errorCount.current >= ERROR_RETRY_LIMIT) {
        console.error('Lead queue fetch failed multiple times:', err);
        // Implement exponential backoff
        return new Promise(resolve => 
          setTimeout(resolve, Math.min(1000 * Math.pow(2, errorCount.current), 30000))
        );
      }
    }
  }, [dispatch, params]);

  /**
   * Memoized status update function with quality tracking
   */
  const updateStatus = useCallback(async (
    leadId: string, 
    newStatus: string, 
    qualityMetrics?: { validationScore: number }
  ) => {
    const startTime = Date.now();
    
    try {
      await dispatch(updateLeadStatus({
        leadId,
        status: newStatus,
        qualityMetrics: {
          ...qualityMetrics,
          responseTime: Date.now() - startTime
        }
      })).unwrap();
      
      // Trigger immediate queue refresh after status update
      fetchQueue();
    } catch (err) {
      console.error('Failed to update lead status:', err);
      throw err;
    }
  }, [dispatch, fetchQueue]);

  /**
   * Set up visibility change handler for polling optimization
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabActive.current = document.visibilityState === 'visible';
      
      if (isTabActive.current) {
        fetchQueue();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchQueue]);

  /**
   * Polling control functions
   */
  const startPolling = useCallback(() => {
    stopPolling();
    const interval = isTabActive.current ? POLLING_INTERVAL_ACTIVE : POLLING_INTERVAL_INACTIVE;
    pollingInterval.current = setInterval(fetchQueue, interval);
  }, [fetchQueue]);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
  }, []);

  /**
   * Initialize polling and cleanup
   */
  useEffect(() => {
    fetchQueue();
    startPolling();

    return () => {
      stopPolling();
    };
  }, [fetchQueue, startPolling, stopPolling]);

  /**
   * Prepare enhanced queue state with metrics
   */
  const queueState: IQueueState = {
    leads,
    loading: status === 'loading',
    error,
    metrics: {
      ...metrics,
      errorRate: errorCount.current / (errorCount.current + leads.length),
      isPerformanceOptimal
    },
    lastUpdated
  };

  return {
    ...queueState,
    updateStatus,
    refresh: fetchQueue,
    startPolling,
    stopPolling
  };
};