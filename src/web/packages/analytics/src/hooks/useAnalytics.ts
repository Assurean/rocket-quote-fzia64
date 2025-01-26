// External imports
import { useState, useEffect, useCallback } from 'react'; // v18.2.0
import dayjs from 'dayjs'; // v1.11.0

// Internal imports
import { 
  generateReport, 
  ReportConfig, 
  ReportData 
} from '../services/reporting';
import {
  calculateLeadAcceptanceRate,
  calculateRevenueMetrics,
  calculateConversionMetrics,
  calculateRTBMetrics,
  LeadMetrics,
  RevenueMetrics,
  ConversionMetrics,
  RTBMetrics
} from '../utils/metrics';

// Interfaces
export interface AnalyticsState {
  leadMetrics: LeadMetrics | null;
  revenueMetrics: RevenueMetrics | null;
  conversionMetrics: ConversionMetrics | null;
  rtbMetrics: RTBMetrics | null;
  loading: boolean;
  error: string | null;
  timeframe: { start: Date; end: Date };
  refreshInterval: number;
  lastUpdated: Date;
}

export interface UseAnalyticsReturn {
  state: AnalyticsState;
  actions: {
    refreshMetrics: () => Promise<void>;
    generateReport: (config: ReportConfig) => Promise<ReportData>;
    setTimeframe: (timeframe: { start: Date; end: Date }) => void;
    setRefreshInterval: (interval: number) => void;
    clearError: () => void;
  };
}

const DEFAULT_REFRESH_INTERVAL = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Custom hook for managing analytics state and operations
 * @param initialTimeframe Initial time range for analytics
 * @param refreshInterval Refresh interval in milliseconds
 * @returns Analytics state and action functions
 */
const useAnalytics = (
  initialTimeframe: { start: Date; end: Date },
  refreshInterval: number = DEFAULT_REFRESH_INTERVAL
): UseAnalyticsReturn => {
  // Initialize state
  const [state, setState] = useState<AnalyticsState>({
    leadMetrics: null,
    revenueMetrics: null,
    conversionMetrics: null,
    rtbMetrics: null,
    loading: true,
    error: null,
    timeframe: initialTimeframe,
    refreshInterval,
    lastUpdated: new Date()
  });

  // Validate timeframe
  const validateTimeframe = useCallback((timeframe: { start: Date; end: Date }): boolean => {
    const start = dayjs(timeframe.start);
    const end = dayjs(timeframe.end);
    return start.isValid() && 
           end.isValid() && 
           end.isAfter(start) && 
           end.diff(start, 'year') <= 1;
  }, []);

  // Refresh metrics with retry logic
  const refreshMetrics = useCallback(async (retryCount = 0): Promise<void> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Validate timeframe before proceeding
      if (!validateTimeframe(state.timeframe)) {
        throw new Error('Invalid timeframe specified');
      }

      // Parallel fetch of all metrics
      const [leadMetrics, revenueMetrics, conversionMetrics, rtbMetrics] = await Promise.all([
        calculateLeadAcceptanceRate([], state.timeframe),
        calculateRevenueMetrics([], state.timeframe),
        calculateConversionMetrics([], state.timeframe),
        calculateRTBMetrics([], state.timeframe)
      ]);

      setState(prev => ({
        ...prev,
        leadMetrics,
        revenueMetrics,
        conversionMetrics,
        rtbMetrics,
        loading: false,
        error: null,
        lastUpdated: new Date()
      }));
    } catch (error) {
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        setTimeout(() => {
          refreshMetrics(retryCount + 1);
        }, RETRY_DELAY);
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: `Failed to fetch metrics: ${error.message}`
        }));
      }
    }
  }, [state.timeframe, validateTimeframe]);

  // Generate report wrapper
  const generateAnalyticsReport = useCallback(async (config: ReportConfig): Promise<ReportData> => {
    try {
      if (!validateTimeframe(config.timeframe)) {
        throw new Error('Invalid report timeframe specified');
      }
      return await generateReport(config);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: `Failed to generate report: ${error.message}`
      }));
      throw error;
    }
  }, [validateTimeframe]);

  // Timeframe setter with validation
  const setTimeframe = useCallback((newTimeframe: { start: Date; end: Date }): void => {
    if (!validateTimeframe(newTimeframe)) {
      setState(prev => ({
        ...prev,
        error: 'Invalid timeframe specified'
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      timeframe: newTimeframe,
      error: null
    }));
  }, [validateTimeframe]);

  // Refresh interval setter
  const setRefreshInterval = useCallback((interval: number): void => {
    if (interval < 5000) { // Minimum 5 second refresh
      setState(prev => ({
        ...prev,
        error: 'Refresh interval too short'
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      refreshInterval: interval,
      error: null
    }));
  }, []);

  // Error clearing utility
  const clearError = useCallback((): void => {
    setState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  // Set up automatic refresh
  useEffect(() => {
    // Initial load
    refreshMetrics();

    // Set up interval
    const intervalId = setInterval(() => {
      refreshMetrics();
    }, state.refreshInterval);

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [refreshMetrics, state.refreshInterval]);

  return {
    state,
    actions: {
      refreshMetrics,
      generateReport: generateAnalyticsReport,
      setTimeframe,
      setRefreshInterval,
      clearError
    }
  };
};

export default useAnalytics;