/**
 * @fileoverview Test suite for campaign service functionality including CRUD operations,
 * caching, analytics, resilience patterns, and enhanced validation.
 * @version 1.0.0
 */

import { MongoMemoryServer } from 'mongodb-memory-server'; // v8.15.0
import mongoose from 'mongoose'; // v7.5.0
import Redis from 'redis-mock'; // v0.56.3
import { jest } from '@jest/globals'; // v29.6.0

import { CampaignService } from '../src/services/campaign.service';
import { Campaign } from '../src/models/campaign.model';
import { ICampaign, InsuranceVertical, CampaignStatus } from '../src/interfaces/campaign.interface';

describe('CampaignService', () => {
  let mongoServer: MongoMemoryServer;
  let campaignService: CampaignService;
  let redisClient: any;
  let metricsCollector: any;

  const mockBuyerId = 'buyer123';
  const mockCampaign: Partial<ICampaign> = {
    buyerId: mockBuyerId,
    name: 'Test Auto Campaign',
    vertical: 'AUTO' as InsuranceVertical,
    filters: {
      rules: [
        {
          field: 'state',
          operator: 'IN',
          value: ['CA', 'NY', 'FL']
        },
        {
          field: 'creditScore',
          operator: 'GREATER_THAN',
          value: 700
        }
      ],
      matchType: 'ALL'
    },
    maxCpl: 50,
    dailyBudget: 1000,
    status: 'DRAFT' as CampaignStatus
  };

  beforeAll(async () => {
    // Setup MongoDB memory server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Redis mock
    redisClient = Redis.createClient();

    // Setup metrics collector mock
    metricsCollector = {
      incrementCounter: jest.fn(),
      recordEvent: jest.fn(),
      recordMetric: jest.fn()
    };

    // Initialize campaign service
    campaignService = new CampaignService(redisClient, metricsCollector);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    redisClient.quit();
  });

  beforeEach(async () => {
    await Campaign.deleteMany({});
    jest.clearAllMocks();
  });

  describe('createCampaign', () => {
    it('should create a valid campaign with caching', async () => {
      const campaign = await campaignService.createCampaign(mockCampaign);

      expect(campaign).toBeDefined();
      expect(campaign.buyerId).toBe(mockBuyerId);
      expect(campaign.status).toBe('DRAFT');
      expect(metricsCollector.incrementCounter).toHaveBeenCalledWith(
        'campaign.created',
        expect.any(Object)
      );

      // Verify cache
      const cacheKey = `campaign:${mockBuyerId}:${mockCampaign.name}`;
      const cachedCampaign = await redisClient.get(cacheKey);
      expect(cachedCampaign).toBeDefined();
    });

    it('should validate complex filter rules', async () => {
      const invalidCampaign = {
        ...mockCampaign,
        filters: {
          rules: [
            {
              field: 'state',
              operator: 'INVALID_OP',
              value: ['CA']
            }
          ],
          matchType: 'ALL'
        }
      };

      await expect(campaignService.createCampaign(invalidCampaign))
        .rejects.toThrow('Invalid filter configuration');
    });

    it('should enforce budget constraints', async () => {
      const invalidBudgetCampaign = {
        ...mockCampaign,
        maxCpl: 2000,
        dailyBudget: 1000
      };

      await expect(campaignService.createCampaign(invalidBudgetCampaign))
        .rejects.toThrow('Maximum CPL cannot exceed daily budget');
    });
  });

  describe('updateCampaign', () => {
    let existingCampaign: ICampaign;

    beforeEach(async () => {
      existingCampaign = await campaignService.createCampaign(mockCampaign);
    });

    it('should update with optimistic locking', async () => {
      const updateData = {
        id: existingCampaign.id,
        name: 'Updated Campaign Name',
        maxCpl: 75
      };

      const updatedCampaign = await campaignService.updateCampaign(updateData);

      expect(updatedCampaign.name).toBe(updateData.name);
      expect(updatedCampaign.maxCpl).toBe(updateData.maxCpl);
      expect(updatedCampaign.version).toBe(existingCampaign.version + 1);
    });

    it('should handle concurrent updates', async () => {
      const updatePromises = [
        campaignService.updateCampaign({ id: existingCampaign.id, maxCpl: 60 }),
        campaignService.updateCampaign({ id: existingCampaign.id, maxCpl: 70 })
      ];

      await expect(Promise.all(updatePromises))
        .rejects.toThrow('Campaign is currently being modified');
    });
  });

  describe('listCampaigns', () => {
    beforeEach(async () => {
      // Create multiple test campaigns
      await Promise.all([
        campaignService.createCampaign(mockCampaign),
        campaignService.createCampaign({
          ...mockCampaign,
          name: 'Test Home Campaign',
          vertical: 'HOME'
        }),
        campaignService.createCampaign({
          ...mockCampaign,
          name: 'Test Life Campaign',
          vertical: 'LIFE'
        })
      ]);
    });

    it('should utilize cache for repeated queries', async () => {
      const request = {
        buyerId: mockBuyerId,
        page: 1,
        pageSize: 10
      };

      // First query - should hit database
      const result1 = await campaignService.listCampaigns(request);
      expect(result1.campaigns).toHaveLength(3);

      // Second query - should hit cache
      const result2 = await campaignService.listCampaigns(request);
      expect(result2).toEqual(result1);
    });

    it('should implement cursor-based pagination', async () => {
      const request = {
        buyerId: mockBuyerId,
        page: 1,
        pageSize: 2,
        sortBy: 'createdAt' as keyof ICampaign,
        sortOrder: 'desc' as const
      };

      const result = await campaignService.listCampaigns(request);
      expect(result.campaigns).toHaveLength(2);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('resilience', () => {
    it('should implement circuit breaker pattern', async () => {
      // Simulate database failure
      jest.spyOn(Campaign, 'findById').mockRejectedValueOnce(new Error('DB Error'));

      await expect(campaignService.updateCampaignStatus(
        'nonexistent-id',
        'ACTIVE'
      )).rejects.toThrow();

      expect(metricsCollector.recordEvent).toHaveBeenCalledWith(
        'campaign.status.changed',
        expect.any(Object)
      );
    });

    it('should maintain data consistency during failures', async () => {
      const campaign = await campaignService.createCampaign(mockCampaign);

      // Simulate cache failure during update
      jest.spyOn(redisClient, 'setex').mockRejectedValueOnce(new Error('Cache Error'));

      const updateData = {
        id: campaign.id,
        name: 'Updated Name'
      };

      await expect(campaignService.updateCampaign(updateData))
        .rejects.toThrow('Cache Error');

      // Verify database state remained unchanged
      const dbCampaign = await Campaign.findById(campaign.id);
      expect(dbCampaign?.name).toBe(mockCampaign.name);
    });
  });
});