/**
 * @fileoverview Campaign service implementation for the Multi-Vertical Insurance Lead Generation Platform.
 * Provides comprehensive campaign management with caching, analytics, and enhanced validation.
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import winston from 'winston'; // v3.10.0
import Redis from 'ioredis'; // v4.6.7
import CircuitBreaker from 'opossum'; // v6.0.0
import { ValidationUtils } from 'validation-utils'; // v1.0.0
import { MetricsCollector } from '@company/metrics-collector'; // v1.0.0

import { Campaign } from '../models/campaign.model';
import {
  ICampaign,
  ICreateCampaignRequest,
  IUpdateCampaignRequest,
  IListCampaignsRequest,
  IListCampaignsResponse,
  CampaignStatus
} from '../interfaces/campaign.interface';

const CACHE_TTL = 300; // 5 minutes
const LOCK_TTL = 30; // 30 seconds

@injectable()
export class CampaignService {
  private logger: winston.Logger;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly redisClient: Redis,
    private readonly metricsCollector: MetricsCollector
  ) {
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'campaign-service-error.log', level: 'error' })
      ]
    });

    // Initialize circuit breaker for DB operations
    this.circuitBreaker = new CircuitBreaker(async (operation: Function) => operation(), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });
  }

  /**
   * Creates a new campaign with enhanced validation and caching
   */
  public async createCampaign(request: ICreateCampaignRequest): Promise<ICampaign> {
    try {
      // Validate request
      ValidationUtils.validateCreateCampaignRequest(request);

      // Check for duplicate campaign name
      const cacheKey = `campaign:${request.buyerId}:${request.name}`;
      const existingCampaign = await this.redisClient.get(cacheKey);
      
      if (existingCampaign) {
        throw new Error('Campaign name already exists for this buyer');
      }

      // Create campaign with circuit breaker
      const campaign = await this.circuitBreaker.fire(async () => {
        const newCampaign = new Campaign({
          ...request,
          status: 'DRAFT',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return newCampaign.save();
      });

      // Cache the new campaign
      await this.redisClient.setex(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(campaign)
      );

      // Record metrics
      this.metricsCollector.incrementCounter('campaign.created', {
        vertical: request.vertical,
        buyerId: request.buyerId
      });

      return campaign;
    } catch (error) {
      this.logger.error('Error creating campaign:', { error, request });
      throw error;
    }
  }

  /**
   * Updates an existing campaign with optimistic locking
   */
  public async updateCampaign(request: IUpdateCampaignRequest): Promise<ICampaign> {
    const lockKey = `lock:campaign:${request.id}`;

    try {
      // Acquire lock
      const locked = await this.redisClient.set(
        lockKey,
        '1',
        'NX',
        'EX',
        LOCK_TTL
      );

      if (!locked) {
        throw new Error('Campaign is currently being modified');
      }

      // Validate update request
      ValidationUtils.validateUpdateCampaignRequest(request);

      // Perform update with circuit breaker
      const campaign = await this.circuitBreaker.fire(async () => {
        const existingCampaign = await Campaign.findById(request.id);
        if (!existingCampaign) {
          throw new Error('Campaign not found');
        }

        // Apply updates
        Object.assign(existingCampaign, request);
        existingCampaign.updatedAt = new Date();

        return existingCampaign.save();
      });

      // Update cache
      const cacheKey = `campaign:${campaign.buyerId}:${campaign.name}`;
      await this.redisClient.setex(
        cacheKey,
        CACHE_TTL,
        JSON.stringify(campaign)
      );

      // Record metrics
      this.metricsCollector.recordEvent('campaign.updated', {
        campaignId: request.id,
        changes: Object.keys(request)
      });

      return campaign;
    } catch (error) {
      this.logger.error('Error updating campaign:', { error, request });
      throw error;
    } finally {
      // Release lock
      await this.redisClient.del(lockKey);
    }
  }

  /**
   * Lists campaigns with cursor-based pagination and caching
   */
  public async listCampaigns(request: IListCampaignsRequest): Promise<IListCampaignsResponse> {
    try {
      const cacheKey = `campaigns:${JSON.stringify(request)}`;
      const cachedResult = await this.redisClient.get(cacheKey);

      if (cachedResult) {
        return JSON.parse(cachedResult);
      }

      // Build query with circuit breaker
      const result = await this.circuitBreaker.fire(async () => {
        const query: any = {};
        
        if (request.buyerId) {
          query.buyerId = request.buyerId;
        }
        
        if (request.vertical) {
          query.vertical = request.vertical;
        }
        
        if (request.status && request.status.length > 0) {
          query.status = { $in: request.status };
        }

        const skip = (request.page - 1) * request.pageSize;
        const sort: any = {};
        sort[request.sortBy || 'createdAt'] = request.sortOrder === 'asc' ? 1 : -1;

        const [campaigns, total] = await Promise.all([
          Campaign.find(query)
            .sort(sort)
            .skip(skip)
            .limit(request.pageSize)
            .lean(),
          Campaign.countDocuments(query)
        ]);

        const response: IListCampaignsResponse = {
          campaigns,
          total,
          page: request.page,
          pageSize: request.pageSize,
          totalPages: Math.ceil(total / request.pageSize)
        };

        // Cache results
        await this.redisClient.setex(
          cacheKey,
          CACHE_TTL,
          JSON.stringify(response)
        );

        return response;
      });

      // Record metrics
      this.metricsCollector.recordMetric('campaign.list.latency', {
        buyerId: request.buyerId,
        resultCount: result.campaigns.length
      });

      return result;
    } catch (error) {
      this.logger.error('Error listing campaigns:', { error, request });
      throw error;
    }
  }

  /**
   * Updates campaign status with validation
   */
  public async updateCampaignStatus(
    campaignId: string,
    status: CampaignStatus
  ): Promise<ICampaign> {
    try {
      const campaign = await this.circuitBreaker.fire(async () => 
        Campaign.updateStatus(campaignId, status)
      );

      // Invalidate cache
      const cacheKey = `campaign:${campaign.buyerId}:${campaign.name}`;
      await this.redisClient.del(cacheKey);

      // Record status change
      this.metricsCollector.recordEvent('campaign.status.changed', {
        campaignId,
        oldStatus: campaign.status,
        newStatus: status
      });

      return campaign;
    } catch (error) {
      this.logger.error('Error updating campaign status:', { error, campaignId, status });
      throw error;
    }
  }
}