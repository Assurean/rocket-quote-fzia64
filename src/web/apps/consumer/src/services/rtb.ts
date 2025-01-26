import axios from 'axios'; // ^1.6.0
import { 
  BiddingService, 
  BiddingServiceConfig 
} from '@packages/rtb/services/bidding';
import { 
  TrackingService, 
  TrackingServiceConfig 
} from '@packages/rtb/services/tracking';

// Enhanced configuration interface for consumer RTB service
export interface RTBServiceConfig {
  apiEndpoint: string;
  requestTimeout: number;
  maxBidsToShow: number;
  retryAttempts: number;
  cacheDuration: number;
  enableSanitization: boolean;
}

// Consumer-friendly bid interface with enhanced display properties
export interface ConsumerBid {
  id: string;
  advertiserName: string;
  displayText: string;
  ctaText: string;
  targetUrl: string;
  amount: number;
  imageUrl: string;
  displayTheme: string;
  isPremium: boolean;
  expiresAt: number;
}

export class RTBService {
  private config: RTBServiceConfig;
  private biddingService: BiddingService;
  private trackingService: TrackingService;
  private bidCache: Map<string, ConsumerBid[]>;
  private lastCacheCleanup: number;

  constructor(config: RTBServiceConfig) {
    this.validateConfig(config);
    this.config = config;
    this.bidCache = new Map();
    this.lastCacheCleanup = Date.now();

    // Initialize bidding service with enhanced configuration
    const biddingConfig: BiddingServiceConfig = {
      rtbEndpoint: config.apiEndpoint,
      timeout: config.requestTimeout,
      retryAttempts: config.retryAttempts,
      minBidAmount: 0.01,
      maxBidAmount: 100.00,
      cacheDuration: config.cacheDuration,
      maxConcurrentRequests: 10,
      enableFraudDetection: true,
      rateLimits: {
        requestsPerSecond: 50,
        burstSize: 100
      }
    };

    // Initialize tracking service with enhanced configuration
    const trackingConfig: TrackingServiceConfig = {
      trackingEndpoint: `${config.apiEndpoint}/tracking`,
      timeout: config.requestTimeout,
      retryAttempts: config.retryAttempts,
      debugMode: false,
      batchSize: 10,
      flushInterval: 5000,
      compression: true,
      headers: {
        'X-Client-Version': '1.0.0',
        'X-Client-Type': 'consumer'
      }
    };

    this.biddingService = new BiddingService(biddingConfig, new TrackingService(trackingConfig));
    this.trackingService = new TrackingService(trackingConfig);

    // Set up periodic cache cleanup
    setInterval(() => this.cleanupCache(), config.cacheDuration);
  }

  private validateConfig(config: RTBServiceConfig): void {
    if (!config.apiEndpoint || !config.apiEndpoint.startsWith('https://')) {
      throw new Error('Invalid API endpoint URL');
    }
    if (config.requestTimeout < 100 || config.requestTimeout > 5000) {
      throw new Error('Request timeout must be between 100ms and 5000ms');
    }
    if (config.maxBidsToShow < 1 || config.maxBidsToShow > 10) {
      throw new Error('Max bids to show must be between 1 and 10');
    }
  }

  public async getBidsForLead(
    leadId: string, 
    vertical: string, 
    leadScore: number
  ): Promise<ConsumerBid[]> {
    try {
      // Check cache first
      const cachedBids = this.bidCache.get(leadId);
      if (cachedBids && Date.now() < cachedBids[0].expiresAt) {
        return cachedBids;
      }

      // Request bids from bidding service
      const bids = await this.biddingService.requestBids(leadId, vertical, {
        score: leadScore,
        timestamp: Date.now(),
        vertical
      });

      // Select optimal bids based on lead score
      const optimizedBids = await this.biddingService.selectOptimalBids(
        bids,
        leadScore,
        { vertical, timestamp: Date.now() }
      );

      // Format bids for consumer display
      const consumerBids = optimizedBids
        .slice(0, this.config.maxBidsToShow)
        .map(bid => this.formatConsumerBid(bid));

      // Cache the formatted bids
      if (consumerBids.length > 0) {
        this.bidCache.set(leadId, consumerBids);
      }

      return consumerBids;
    } catch (error) {
      console.error('Error getting bids for lead:', error);
      throw error;
    }
  }

  public async handleBidClick(bid: ConsumerBid, leadId: string): Promise<void> {
    try {
      // Validate bid is still active
      if (Date.now() >= bid.expiresAt) {
        throw new Error('Bid has expired');
      }

      // Track bid click with enhanced metadata
      await this.trackingService.trackBidClick(
        {
          id: bid.id,
          advertiserId: bid.advertiserName,
          amount: bid.amount,
          targetUrl: bid.targetUrl,
          currency: 'USD',
          creativeHtml: '',
          expiresAt: bid.expiresAt,
          metadata: {
            displayTheme: bid.displayTheme,
            isPremium: bid.isPremium
          },
          locale: 'en-US',
          securityMetadata: {}
        },
        leadId,
        {
          clickTimestamp: Date.now(),
          displayPosition: this.getDisplayPosition(bid.id, leadId),
          interactionTime: this.getInteractionTime(leadId)
        }
      );
    } catch (error) {
      console.error('Error handling bid click:', error);
      throw error;
    }
  }

  private formatConsumerBid(bid: any): ConsumerBid {
    return {
      id: bid.id,
      advertiserName: this.config.enableSanitization ? 
        this.sanitizeText(bid.metadata.advertiserName) : 
        bid.metadata.advertiserName,
      displayText: this.config.enableSanitization ? 
        this.sanitizeText(bid.metadata.displayText) : 
        bid.metadata.displayText,
      ctaText: bid.metadata.ctaText || 'Get Quote',
      targetUrl: bid.targetUrl,
      amount: bid.amount,
      imageUrl: bid.metadata.imageUrl || '',
      displayTheme: bid.metadata.theme || 'default',
      isPremium: bid.amount > 50,
      expiresAt: bid.expiresAt
    };
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [leadId, bids] of this.bidCache.entries()) {
      if (bids[0].expiresAt <= now) {
        this.bidCache.delete(leadId);
      }
    }
    this.lastCacheCleanup = now;
  }

  private sanitizeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .trim();
  }

  private getDisplayPosition(bidId: string, leadId: string): number {
    const bids = this.bidCache.get(leadId) || [];
    return bids.findIndex(bid => bid.id === bidId);
  }

  private getInteractionTime(leadId: string): number {
    const bids = this.bidCache.get(leadId);
    if (!bids) return 0;
    return Date.now() - (bids[0].expiresAt - this.config.cacheDuration);
  }
}