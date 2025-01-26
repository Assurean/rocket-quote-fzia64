import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.2.0
import { debounce } from 'lodash'; // ^4.17.21
import { TrackingService, TrackingServiceConfig } from '../services/tracking';
import { Bid } from '../utils/bid';

// Interface for hook configuration options
export interface UseTrackingOptions {
  leadId: string;
  debugMode?: boolean;
  debounceMs?: number;
  errorHandler?: (error: Error) => void;
  performanceConfig?: {
    sampleRate: number;
    metricsBuffer: number;
    flushInterval: number;
  };
}

// Interface for performance metrics
interface PerformanceMetrics {
  averageLoadTime: number;
  averageRenderTime: number;
  successRate: number;
  totalImpressions: number;
  totalClicks: number;
}

// Interface for debug information
interface DebugInfo {
  lastEventTimestamp: number;
  queueSize: number;
  failedAttempts: number;
  lastError?: Error;
}

// Interface for hook return value
export interface UseTrackingResult {
  trackImpression: (bid: Bid, metadata?: Record<string, unknown>) => Promise<void>;
  trackClick: (bid: Bid, clickData?: Record<string, unknown>) => Promise<void>;
  trackPerformance: (bid: Bid, performanceData: Record<string, unknown>) => Promise<void>;
  isTracking: boolean;
  debugInfo: DebugInfo;
  metrics: PerformanceMetrics;
}

/**
 * React hook for managing RTB event tracking with performance optimization and debugging
 * @param options - Configuration options for tracking behavior
 * @returns Object containing tracking functions and state
 */
export const useTracking = (options: UseTrackingOptions): UseTrackingResult => {
  // Validate required options
  if (!options.leadId) {
    throw new Error('leadId is required for RTB tracking');
  }

  // Initialize state
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    lastEventTimestamp: 0,
    queueSize: 0,
    failedAttempts: 0
  });
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    averageLoadTime: 0,
    averageRenderTime: 0,
    successRate: 100,
    totalImpressions: 0,
    totalClicks: 0
  });

  // Create refs for tracking service and cleanup
  const trackingServiceRef = useRef<TrackingService | null>(null);
  const metricsBufferRef = useRef<number[]>([]);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Initialize tracking service
  useEffect(() => {
    const config: TrackingServiceConfig = {
      trackingEndpoint: process.env.REACT_APP_RTB_TRACKING_ENDPOINT || 'https://tracking.rtb.example.com',
      timeout: 5000,
      retryAttempts: 3,
      debugMode: options.debugMode || false,
      batchSize: 10,
      flushInterval: 30000,
      compression: true,
      headers: {
        'X-Lead-ID': options.leadId,
        'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0'
      }
    };

    trackingServiceRef.current = new TrackingService(config);
    return () => {
      cleanupRef.current.forEach(cleanup => cleanup());
      cleanupRef.current = [];
    };
  }, [options.leadId]);

  // Create debounced tracking functions
  const debouncedTrackImpression = useCallback(
    debounce(
      async (bid: Bid, metadata?: Record<string, unknown>) => {
        try {
          setIsTracking(true);
          await trackingServiceRef.current?.trackBidImpression(bid, options.leadId, metadata || {});
          updateMetrics('impression');
        } catch (error) {
          handleError(error as Error);
        } finally {
          setIsTracking(false);
        }
      },
      options.debounceMs || 250
    ),
    [options.leadId]
  );

  const trackClick = useCallback(
    async (bid: Bid, clickData?: Record<string, unknown>) => {
      try {
        setIsTracking(true);
        await trackingServiceRef.current?.trackBidClick(bid, options.leadId, clickData || {});
        updateMetrics('click');
      } catch (error) {
        handleError(error as Error);
      } finally {
        setIsTracking(false);
      }
    },
    [options.leadId]
  );

  const debouncedTrackPerformance = useCallback(
    debounce(
      async (bid: Bid, performanceData: Record<string, unknown>) => {
        try {
          await trackingServiceRef.current?.trackBidPerformance(bid, {
            ...performanceData,
            leadId: options.leadId
          });
        } catch (error) {
          handleError(error as Error);
        }
      },
      options.debounceMs || 250
    ),
    [options.leadId]
  );

  // Error handling function
  const handleError = useCallback((error: Error) => {
    setDebugInfo(prev => ({
      ...prev,
      failedAttempts: prev.failedAttempts + 1,
      lastError: error
    }));

    if (options.errorHandler) {
      options.errorHandler(error);
    } else {
      console.error('[RTB Tracking Error]:', error);
    }
  }, [options.errorHandler]);

  // Metrics update function
  const updateMetrics = useCallback((eventType: 'impression' | 'click') => {
    setMetrics(prev => {
      const newMetrics = { ...prev };
      if (eventType === 'impression') {
        newMetrics.totalImpressions++;
      } else {
        newMetrics.totalClicks++;
      }
      
      // Update performance metrics if sampling is enabled
      if (options.performanceConfig?.sampleRate && 
          Math.random() < options.performanceConfig.sampleRate) {
        const loadTime = performance.now();
        metricsBufferRef.current.push(loadTime);
        
        if (metricsBufferRef.current.length >= (options.performanceConfig.metricsBuffer || 100)) {
          newMetrics.averageLoadTime = metricsBufferRef.current.reduce((a, b) => a + b, 0) / 
            metricsBufferRef.current.length;
          metricsBufferRef.current = [];
        }
      }
      
      return newMetrics;
    });

    setDebugInfo(prev => ({
      ...prev,
      lastEventTimestamp: Date.now(),
      queueSize: trackingServiceRef.current?.eventQueue?.length || 0
    }));
  }, [options.performanceConfig]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedTrackImpression.cancel();
      debouncedTrackPerformance.cancel();
    };
  }, [debouncedTrackImpression, debouncedTrackPerformance]);

  return {
    trackImpression: debouncedTrackImpression,
    trackClick,
    trackPerformance: debouncedTrackPerformance,
    isTracking,
    debugInfo,
    metrics
  };
};