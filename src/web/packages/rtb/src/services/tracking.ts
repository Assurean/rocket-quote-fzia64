import axios, { AxiosInstance } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^3.8.0
import compression from 'compression'; // ^1.7.4
import { Bid } from '../utils/bid';

// Enhanced configuration interface for tracking service
export interface TrackingServiceConfig {
  trackingEndpoint: string;
  timeout: number;
  retryAttempts: number;
  debugMode: boolean;
  batchSize: number;
  flushInterval: number;
  compression: boolean;
  headers: Record<string, string>;
}

// Comprehensive tracking event interface
export interface TrackingEvent {
  eventType: 'impression' | 'click' | 'performance';
  bidId: string;
  leadId: string;
  timestamp: number;
  sessionId: string;
  metadata: {
    advertiserId: string;
    amount: number;
    currency: string;
    targetUrl: string;
    [key: string]: unknown;
  };
  performance?: {
    loadTime: number;
    renderTime: number;
    interactionTime?: number;
  };
  device: {
    userAgent: string;
    screenResolution: string;
    viewport: string;
    connection?: string;
  };
  user: {
    anonymousId: string;
    sessionDuration: number;
    interactionCount: number;
  };
}

/**
 * Enhanced service for managing RTB event tracking with reliability and analytics
 */
export class TrackingService {
  private readonly config: TrackingServiceConfig;
  private readonly httpClient: AxiosInstance;
  private readonly eventQueue: TrackingEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly retryCount: Map<string, number> = new Map();
  private isProcessing: boolean = false;

  constructor(config: TrackingServiceConfig) {
    this.validateConfig(config);
    this.config = config;

    // Initialize HTTP client with enhanced retry configuration
    this.httpClient = axios.create({
      baseURL: config.trackingEndpoint,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    });

    // Configure axios-retry with exponential backoff
    axiosRetry(this.httpClient, {
      retries: config.retryAttempts,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status === 429); // Rate limit handling
      }
    });

    // Initialize compression if enabled
    if (config.compression) {
      this.httpClient.interceptors.request.use((config) => {
        config.headers['Content-Encoding'] = 'gzip';
        return config;
      });
    }

    // Start flush interval timer
    this.startFlushTimer();
  }

  /**
   * Tracks bid impressions with enhanced reliability
   */
  public async trackBidImpression(bid: Bid, leadId: string, metadata: Record<string, unknown>): Promise<void> {
    try {
      const event: TrackingEvent = {
        eventType: 'impression',
        bidId: bid.id,
        leadId,
        timestamp: Date.now(),
        sessionId: this.generateSessionId(),
        metadata: {
          advertiserId: bid.advertiserId,
          amount: bid.amount,
          currency: bid.currency,
          targetUrl: bid.targetUrl,
          ...metadata
        },
        device: this.getDeviceInfo(),
        user: this.getUserInfo(),
        performance: {
          loadTime: performance.now(),
          renderTime: this.calculateRenderTime()
        }
      };

      await this.queueEvent(event);
      this.logDebug('Impression tracked', event);
    } catch (error) {
      this.handleError('Impression tracking failed', error);
    }
  }

  /**
   * Tracks bid clicks with enhanced metadata
   */
  public async trackBidClick(bid: Bid, leadId: string, clickData: Record<string, unknown>): Promise<void> {
    try {
      const event: TrackingEvent = {
        eventType: 'click',
        bidId: bid.id,
        leadId,
        timestamp: Date.now(),
        sessionId: this.generateSessionId(),
        metadata: {
          advertiserId: bid.advertiserId,
          amount: bid.amount,
          currency: bid.currency,
          targetUrl: bid.targetUrl,
          ...clickData
        },
        device: this.getDeviceInfo(),
        user: this.getUserInfo(),
        performance: {
          loadTime: performance.now(),
          renderTime: this.calculateRenderTime(),
          interactionTime: Date.now()
        }
      };

      // Process clicks immediately with high priority
      await this.processEvent(event);
      this.logDebug('Click tracked', event);
    } catch (error) {
      this.handleError('Click tracking failed', error);
    }
  }

  /**
   * Tracks comprehensive bid performance metrics
   */
  public async trackBidPerformance(bid: Bid, performanceData: Record<string, unknown>): Promise<void> {
    try {
      const event: TrackingEvent = {
        eventType: 'performance',
        bidId: bid.id,
        leadId: performanceData.leadId as string,
        timestamp: Date.now(),
        sessionId: this.generateSessionId(),
        metadata: {
          advertiserId: bid.advertiserId,
          amount: bid.amount,
          currency: bid.currency,
          targetUrl: bid.targetUrl,
          ...performanceData
        },
        device: this.getDeviceInfo(),
        user: this.getUserInfo(),
        performance: {
          loadTime: performance.now(),
          renderTime: this.calculateRenderTime()
        }
      };

      await this.queueEvent(event);
      this.logDebug('Performance tracked', event);
    } catch (error) {
      this.handleError('Performance tracking failed', error);
    }
  }

  private validateConfig(config: TrackingServiceConfig): void {
    if (!config.trackingEndpoint || !config.trackingEndpoint.startsWith('https://')) {
      throw new Error('Invalid tracking endpoint URL');
    }
    if (config.timeout < 1000 || config.timeout > 30000) {
      throw new Error('Timeout must be between 1000 and 30000 ms');
    }
    if (config.retryAttempts < 0 || config.retryAttempts > 5) {
      throw new Error('Retry attempts must be between 0 and 5');
    }
  }

  private async queueEvent(event: TrackingEvent): Promise<void> {
    this.eventQueue.push(event);
    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flushQueue();
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    try {
      this.isProcessing = true;
      const events = [...this.eventQueue];
      this.eventQueue.length = 0;

      await this.httpClient.post('/batch', events);
      this.logDebug('Queue flushed', { eventCount: events.length });
    } catch (error) {
      this.handleError('Queue flush failed', error);
      // Requeue failed events
      this.eventQueue.unshift(...events);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: TrackingEvent): Promise<void> {
    try {
      await this.httpClient.post('/event', event);
    } catch (error) {
      const retryCount = (this.retryCount.get(event.bidId) || 0) + 1;
      this.retryCount.set(event.bidId, retryCount);
      
      if (retryCount <= this.config.retryAttempts) {
        await this.queueEvent(event);
      } else {
        this.handleError('Max retries exceeded', error);
      }
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flushQueue().catch(error => {
        this.handleError('Flush timer error', error);
      });
    }, this.config.flushInterval);
  }

  private getDeviceInfo(): TrackingEvent['device'] {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      connection: (navigator as any).connection?.effectiveType
    };
  }

  private getUserInfo(): TrackingEvent['user'] {
    return {
      anonymousId: this.getAnonymousId(),
      sessionDuration: this.getSessionDuration(),
      interactionCount: this.getInteractionCount()
    };
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRenderTime(): number {
    return performance.now() - performance.timing.navigationStart;
  }

  private getAnonymousId(): string {
    let id = localStorage.getItem('rtb_anonymous_id');
    if (!id) {
      id = `anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('rtb_anonymous_id', id);
    }
    return id;
  }

  private getSessionDuration(): number {
    const startTime = sessionStorage.getItem('rtb_session_start');
    if (!startTime) {
      sessionStorage.setItem('rtb_session_start', Date.now().toString());
      return 0;
    }
    return Date.now() - parseInt(startTime);
  }

  private getInteractionCount(): number {
    const count = parseInt(sessionStorage.getItem('rtb_interaction_count') || '0');
    sessionStorage.setItem('rtb_interaction_count', (count + 1).toString());
    return count;
  }

  private logDebug(message: string, data?: unknown): void {
    if (this.config.debugMode) {
      console.debug(`[RTB Tracking] ${message}`, data);
    }
  }

  private handleError(message: string, error: unknown): void {
    console.error(`[RTB Tracking] ${message}:`, error);
    // Could integrate with error reporting service here
  }
}