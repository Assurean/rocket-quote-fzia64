import axios, { AxiosInstance } from 'axios'; // ^1.6.0
import retry from 'axios-retry'; // ^3.8.0
import { 
  Bid, 
  BidOptimizationConfig, 
  validateBid, 
  calculateOptimalBid, 
  BidCache 
} from '../utils/bid';
import { TrackingService } from './tracking';

// Enhanced configuration interface for bidding service
export interface BiddingServiceConfig {
  rtbEndpoint: string;
  timeout: number;
  retryAttempts: number;
  minBidAmount: number;
  maxBidAmount: number;
  cacheDuration: number;
  maxConcurrentRequests: number;
  enableFraudDetection: boolean;
  rateLimits: {
    requestsPerSecond: number;
    burstSize: number;
    advertiserId?: Record<string, number>;
  };
}

// Circuit breaker for managing service health
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private readonly threshold: number = 5;
  private readonly resetTimeout: number = 30000;

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures >= this.threshold) {
      const now = Date.now();
      if (now - this.lastFailureTime < this.resetTimeout) {
        return true;
      }
      this.reset();
    }
    return false;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}

// Metrics collector for performance monitoring
class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  public recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)?.push(value);
  }

  public getMetrics(name: string): { avg: number; p95: number; p99: number } {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) {
      return { avg: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const p95 = sorted[Math.floor(values.length * 0.95)];
    const p99 = sorted[Math.floor(values.length * 0.99)];

    return { avg, p95, p99 };
  }
}

export class BiddingService {
  private readonly config: BiddingServiceConfig;
  private readonly httpClient: AxiosInstance;
  private readonly trackingService: TrackingService;
  private readonly bidCache: BidCache;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly metricsCollector: MetricsCollector;
  private readonly rateLimiters: Map<string, { lastRequest: number; count: number }>;

  constructor(config: BiddingServiceConfig, trackingService: TrackingService) {
    this.validateConfig(config);
    this.config = config;
    this.trackingService = trackingService;
    this.bidCache = new BidCache();
    this.circuitBreaker = new CircuitBreaker();
    this.metricsCollector = new MetricsCollector();
    this.rateLimiters = new Map();

    // Initialize HTTP client with enhanced configuration
    this.httpClient = axios.create({
      baseURL: config.rtbEndpoint,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-RTB-Version': '2.0'
      }
    });

    // Configure retry logic with exponential backoff
    retry(this.httpClient, {
      retries: config.retryAttempts,
      retryDelay: retry.exponentialDelay,
      retryCondition: (error) => {
        return retry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status === 429);
      }
    });
  }

  private validateConfig(config: BiddingServiceConfig): void {
    if (!config.rtbEndpoint || !config.rtbEndpoint.startsWith('https://')) {
      throw new Error('Invalid RTB endpoint URL');
    }
    if (config.timeout < 100 || config.timeout > 5000) {
      throw new Error('Timeout must be between 100ms and 5000ms');
    }
    if (config.minBidAmount <= 0 || config.maxBidAmount <= config.minBidAmount) {
      throw new Error('Invalid bid amount range');
    }
  }

  public async requestBids(
    leadId: string,
    vertical: string,
    userData: Record<string, unknown>
  ): Promise<Bid[]> {
    const startTime = performance.now();
    try {
      // Check rate limits
      if (!this.checkRateLimit('global')) {
        throw new Error('Rate limit exceeded');
      }

      // Check cache first
      const cachedBids = this.bidCache.get(leadId);
      if (cachedBids) {
        return cachedBids;
      }

      // Prepare bid request payload
      const payload = {
        leadId,
        vertical,
        userData,
        timestamp: Date.now(),
        requestId: `${leadId}-${Date.now()}`
      };

      // Execute bid request with circuit breaker
      const response = await this.circuitBreaker.execute(async () => {
        return this.httpClient.post<Bid[]>('/bids', payload);
      });

      // Validate and process bids
      const validBids = response.data
        .filter(bid => validateBid(bid))
        .filter(bid => this.checkFraudDetection(bid));

      // Cache valid bids
      if (validBids.length > 0) {
        this.bidCache.set(leadId, validBids, this.config.cacheDuration);
      }

      // Track bid impressions
      await Promise.all(validBids.map(bid => 
        this.trackingService.trackBidImpression(bid, leadId, { vertical })
      ));

      // Record metrics
      const duration = performance.now() - startTime;
      this.metricsCollector.recordMetric('bid_request_duration', duration);
      this.metricsCollector.recordMetric('valid_bids_count', validBids.length);

      return validBids;
    } catch (error) {
      console.error('Bid request failed:', error);
      throw error;
    }
  }

  public async selectOptimalBids(
    bids: Bid[],
    leadScore: number,
    optimizationContext: Record<string, unknown>
  ): Promise<Bid[]> {
    try {
      const optimizationConfig: BidOptimizationConfig = {
        minBidAmount: this.config.minBidAmount,
        maxBidAmount: this.config.maxBidAmount,
        defaultMarkup: 0.1,
        qualityMultiplier: leadScore,
        cacheDuration: this.config.cacheDuration,
        roundingStrategy: {
          precision: 2,
          mode: 'floor'
        },
        securityRules: {
          requireSignature: true,
          allowedDomains: ['*.trusted-rtb.com'],
          maxBidAge: 300000
        },
        allowedProtocols: ['https']
      };

      // Calculate optimal bid for each advertiser
      const scoredBids = await Promise.all(bids.map(async bid => {
        const optimalAmount = calculateOptimalBid(
          leadScore,
          optimizationConfig,
          {
            demandMultiplier: 1.0,
            competitionFactor: 1.0,
            timeOfDayAdjustment: 1.0
          }
        );

        return {
          ...bid,
          score: this.calculateBidScore(bid, optimalAmount, leadScore)
        };
      }));

      // Sort by score and return top bids
      return scoredBids
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map(({ score, ...bid }) => bid);
    } catch (error) {
      console.error('Bid optimization failed:', error);
      throw error;
    }
  }

  public async trackBidSelection(
    bid: Bid,
    leadId: string,
    performanceMetrics: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.trackingService.trackBidClick(bid, leadId, performanceMetrics);
      await this.trackingService.trackBidPerformance(bid, {
        leadId,
        ...performanceMetrics
      });
    } catch (error) {
      console.error('Bid selection tracking failed:', error);
      throw error;
    }
  }

  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    const limiter = this.rateLimiters.get(key) || { lastRequest: 0, count: 0 };

    if (now - limiter.lastRequest > 1000) {
      limiter.count = 1;
      limiter.lastRequest = now;
    } else if (limiter.count >= this.config.rateLimits.requestsPerSecond) {
      return false;
    } else {
      limiter.count++;
    }

    this.rateLimiters.set(key, limiter);
    return true;
  }

  private checkFraudDetection(bid: Bid): boolean {
    if (!this.config.enableFraudDetection) {
      return true;
    }

    // Implement fraud detection rules
    const rules = [
      bid.securityMetadata?.signature,
      bid.amount >= this.config.minBidAmount,
      bid.amount <= this.config.maxBidAmount,
      new URL(bid.targetUrl).protocol === 'https:'
    ];

    return rules.every(rule => Boolean(rule));
  }

  private calculateBidScore(bid: Bid, optimalAmount: number, leadScore: number): number {
    const amountScore = 1 - Math.abs(bid.amount - optimalAmount) / optimalAmount;
    const qualityScore = leadScore;
    const securityScore = bid.securityMetadata?.signature ? 1 : 0.5;

    return (amountScore * 0.4) + (qualityScore * 0.4) + (securityScore * 0.2);
  }
}