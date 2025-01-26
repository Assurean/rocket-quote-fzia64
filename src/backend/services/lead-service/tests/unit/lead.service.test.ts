import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import 'jest-extended';
import { Model } from 'mongoose';
import { RedisClient } from 'redis';
import { Producer } from 'kafka-node';
import { Tracer } from '@opentelemetry/api';
import CircuitBreaker from 'opossum';

import LeadService from '../../src/services/lead.service';
import { 
  ILead, 
  InsuranceVertical, 
  LeadStatus,
  ILeadDocument 
} from '../../src/interfaces/lead.interface';

// Mock implementations
jest.mock('mongoose');
jest.mock('redis');
jest.mock('kafka-node');
jest.mock('@opentelemetry/api');
jest.mock('prom-client');
jest.mock('opossum');

describe('LeadService', () => {
  let leadService: LeadService;
  let mockLeadModel: jest.Mocked<Model<ILeadDocument>>;
  let mockRedisClient: jest.Mocked<RedisClient>;
  let mockKafkaProducer: jest.Mocked<Producer>;
  let mockTracer: jest.Mocked<Tracer>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock implementations
    mockLeadModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      updateOne: jest.fn(),
      db: {
        db: {
          admin: () => ({
            ping: jest.fn().mockResolvedValue(true)
          })
        }
      }
    } as unknown as jest.Mocked<Model<ILeadDocument>>;

    mockRedisClient = {
      get: jest.fn(),
      setex: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG')
    } as unknown as jest.Mocked<RedisClient>;

    mockKafkaProducer = {
      send: jest.fn().mockImplementation((payload) => Promise.resolve())
    } as unknown as jest.Mocked<Producer>;

    mockTracer = {
      startSpan: jest.fn().mockReturnValue({
        setAttribute: jest.fn(),
        setStatus: jest.fn(),
        end: jest.fn()
      })
    } as unknown as jest.Mocked<Tracer>;

    // Initialize service with mocks
    leadService = new LeadService(
      mockLeadModel,
      mockRedisClient,
      mockKafkaProducer,
      mockTracer
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createLead', () => {
    it('should successfully create a lead within performance SLA', async () => {
      // Setup test data
      const validLead: ILead = {
        id: '123',
        vertical: InsuranceVertical.AUTO,
        contact_info: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
          address: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zip: '12345'
          },
          dateOfBirth: new Date('1990-01-01')
        },
        vertical_data: {
          vertical: InsuranceVertical.AUTO,
          data: {
            vehicleYear: 2020,
            make: 'Toyota',
            model: 'Camry'
          },
          validationResults: {},
          enrichmentData: {}
        },
        traffic_source: 'organic',
        ml_score: 0,
        status: LeadStatus.CREATED,
        created_at: new Date(),
        updated_at: new Date(),
        validation_history: [],
        encryption_status: {
          pii: false,
          sensitive: false
        }
      };

      // Mock validation and scoring responses
      const mockValidationResult = { isValid: true, message: 'Validation passed' };
      const mockMlScore = 85;

      mockRedisClient.get.mockResolvedValue(null);
      mockLeadModel.create.mockResolvedValue({
        ...validLead,
        save: jest.fn().mockResolvedValue(validLead)
      } as any);

      // Execute test with timing
      const startTime = Date.now();
      const result = await leadService.createLead(validLead);
      const endTime = Date.now();

      // Verify performance
      expect(endTime - startTime).toBeLessThan(500);

      // Verify lead creation
      expect(result).toBeDefined();
      expect(result.status).toBe(LeadStatus.VALIDATED);
      expect(result.ml_score).toBe(mockMlScore);

      // Verify PII encryption
      expect(mockLeadModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          encryption_status: { pii: true, sensitive: true }
        })
      );

      // Verify event emission
      expect(mockKafkaProducer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'leads',
          messages: expect.arrayContaining([
            expect.objectContaining({
              value: expect.stringContaining(validLead.id)
            })
          ])
        })
      );
    });

    it('should handle validation failures appropriately', async () => {
      const invalidLead: ILead = {
        ...validLead,
        contact_info: {
          ...validLead.contact_info,
          email: 'invalid-email'
        }
      };

      mockRedisClient.get.mockResolvedValue(null);
      mockLeadModel.create.mockResolvedValue({
        ...invalidLead,
        save: jest.fn().mockResolvedValue({
          ...invalidLead,
          status: LeadStatus.REJECTED
        })
      } as any);

      const result = await leadService.createLead(invalidLead);

      expect(result.status).toBe(LeadStatus.REJECTED);
      expect(result.validation_history).toContainEqual(
        expect.objectContaining({
          status: LeadStatus.REJECTED
        })
      );
    });

    it('should enforce TCPA/CCPA compliance requirements', async () => {
      const leadWithoutConsent: ILead = {
        ...validLead,
        vertical_data: {
          ...validLead.vertical_data,
          data: {
            ...validLead.vertical_data.data,
            tcpa_consent: false,
            ccpa_notice: false
          }
        }
      };

      await expect(leadService.createLead(leadWithoutConsent))
        .rejects
        .toThrow('TCPA consent and CCPA notice required');
    });

    it('should handle service timeouts within SLA', async () => {
      mockRedisClient.get.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 600))
      );

      await expect(leadService.createLead(validLead))
        .rejects
        .toThrow('Service timeout');
    });

    it('should maintain lead quality threshold', async () => {
      const lowQualityLead: ILead = {
        ...validLead,
        ml_score: 30
      };

      mockRedisClient.get.mockResolvedValue(null);
      mockLeadModel.create.mockResolvedValue({
        ...lowQualityLead,
        save: jest.fn().mockResolvedValue(lowQualityLead)
      } as any);

      const result = await leadService.createLead(lowQualityLead);

      expect(result.status).toBe(LeadStatus.REJECTED);
      expect(result.ml_score).toBeLessThan(40);
    });
  });

  describe('healthCheck', () => {
    it('should verify all service dependencies', async () => {
      const result = await leadService.healthCheck();
      
      expect(result).toBe(true);
      expect(mockRedisClient.ping).toHaveBeenCalled();
      expect(mockLeadModel.db.db.admin().ping).toHaveBeenCalled();
    });
  });
});