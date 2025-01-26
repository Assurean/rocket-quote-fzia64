import { MongoMemoryServer } from 'mongodb-memory-server'; // ^8.0.0
import { createClient } from 'redis-mock'; // ^0.56.0
import { Kafka } from 'kafkajs'; // ^2.0.0
import { Model, connect } from 'mongoose';
import axios from 'axios';
import { performance } from 'perf_hooks';

import { LeadService } from '../../src/services/lead.service';
import { 
  ILead, 
  InsuranceVertical, 
  LeadStatus,
  ILeadDocument 
} from '../../src/interfaces/lead.interface';
import Lead from '../../src/models/lead.model';

// Constants
const TEST_TIMEOUT = 30000;
const PERFORMANCE_THRESHOLD = 500; // 500ms SLA requirement

describe('LeadService Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let leadService: LeadService;
  let leadModel: Model<ILeadDocument>;
  let redisClient: any;
  let kafkaClient: any;

  // Sample test data for each vertical
  const testLeads: Record<InsuranceVertical, Partial<ILead>> = {
    [InsuranceVertical.AUTO]: {
      vertical: InsuranceVertical.AUTO,
      contact_info: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
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
          model: 'Camry',
          primaryUse: 'PERSONAL'
        }
      },
      traffic_source: 'direct'
    },
    // Similar test data for other verticals...
    [InsuranceVertical.HOME]: {/* ... */},
    [InsuranceVertical.HEALTH]: {/* ... */},
    [InsuranceVertical.LIFE]: {/* ... */},
    [InsuranceVertical.RENTERS]: {/* ... */},
    [InsuranceVertical.COMMERCIAL]: {/* ... */}
  };

  beforeAll(async () => {
    // Setup MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'testdb',
        port: 27017
      }
    });
    await connect(mongoServer.getUri());
    leadModel = Lead;

    // Setup Redis Mock
    redisClient = createClient();

    // Setup Kafka Test Client
    kafkaClient = new Kafka({
      clientId: 'test-client',
      brokers: ['localhost:9092']
    });
    const producer = kafkaClient.producer();
    await producer.connect();

    // Setup service mocks
    jest.spyOn(axios, 'post').mockImplementation(async (url) => {
      if (url.includes('/validation')) {
        return { data: { isValid: true, message: 'Validation passed' } };
      }
      if (url.includes('/scoring')) {
        return { data: { score: 85 } };
      }
      return { data: {} };
    });

    // Initialize LeadService
    leadService = new LeadService(
      leadModel,
      redisClient,
      producer,
      {
        startSpan: () => ({
          setAttribute: jest.fn(),
          setStatus: jest.fn(),
          end: jest.fn()
        })
      } as any
    );
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await mongoServer.stop();
    await redisClient.quit();
    await kafkaClient.disconnect();
    jest.restoreAllMocks();
  });

  describe('Lead Creation Pipeline', () => {
    test.each(Object.values(InsuranceVertical))(
      'should process %s lead within performance SLA',
      async (vertical) => {
        const startTime = performance.now();
        
        const result = await leadService.createLead(testLeads[vertical] as ILead);
        
        const processingTime = performance.now() - startTime;
        
        // Verify performance
        expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
        
        // Verify lead creation
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.vertical).toBe(vertical);
        expect(result.status).toBe(LeadStatus.VALIDATED);
        expect(result.ml_score).toBe(85);
        
        // Verify database persistence
        const savedLead = await leadModel.findById(result.id);
        expect(savedLead).toBeDefined();
        expect(savedLead?.vertical).toBe(vertical);
      },
      TEST_TIMEOUT
    );
  });

  describe('Validation Scenarios', () => {
    test('should handle missing required fields', async () => {
      const invalidLead = {
        ...testLeads[InsuranceVertical.AUTO],
        contact_info: {}
      };

      await expect(leadService.createLead(invalidLead as ILead))
        .rejects
        .toThrow();
    });

    test('should detect invalid contact information', async () => {
      const leadWithInvalidEmail = {
        ...testLeads[InsuranceVertical.AUTO],
        contact_info: {
          ...testLeads[InsuranceVertical.AUTO].contact_info,
          email: 'invalid-email'
        }
      };

      await expect(leadService.createLead(leadWithInvalidEmail as ILead))
        .rejects
        .toThrow();
    });

    test('should validate vertical-specific data', async () => {
      const leadWithInvalidVerticalData = {
        ...testLeads[InsuranceVertical.AUTO],
        vertical_data: {
          vertical: InsuranceVertical.AUTO,
          data: {
            vehicleYear: 3000 // Invalid future year
          }
        }
      };

      await expect(leadService.createLead(leadWithInvalidVerticalData as ILead))
        .rejects
        .toThrow();
    });
  });

  describe('Performance Requirements', () => {
    test('should handle concurrent lead processing', async () => {
      const concurrentLeads = 10;
      const startTime = performance.now();
      
      const promises = Array(concurrentLeads)
        .fill(null)
        .map(() => leadService.createLead(testLeads[InsuranceVertical.AUTO] as ILead));
      
      const results = await Promise.all(promises);
      const processingTime = performance.now() - startTime;
      
      // Verify performance for batch processing
      expect(processingTime / concurrentLeads).toBeLessThan(PERFORMANCE_THRESHOLD);
      
      // Verify all leads were created
      expect(results).toHaveLength(concurrentLeads);
      results.forEach(result => {
        expect(result.status).toBe(LeadStatus.VALIDATED);
      });
    });

    test('should utilize caching for repeated validations', async () => {
      // First request - should hit external service
      const firstStart = performance.now();
      await leadService.createLead(testLeads[InsuranceVertical.AUTO] as ILead);
      const firstDuration = performance.now() - firstStart;

      // Second request - should use cache
      const secondStart = performance.now();
      await leadService.createLead({
        ...testLeads[InsuranceVertical.AUTO],
        contact_info: {
          ...testLeads[InsuranceVertical.AUTO].contact_info,
          email: 'different@test.com'
        }
      } as ILead);
      const secondDuration = performance.now() - secondStart;

      // Cached request should be faster
      expect(secondDuration).toBeLessThan(firstDuration);
    });
  });

  describe('Error Handling', () => {
    test('should handle validation service failures gracefully', async () => {
      jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Validation service unavailable'));
      
      const result = await leadService.createLead(testLeads[InsuranceVertical.AUTO] as ILead);
      
      expect(result.status).toBe(LeadStatus.ERROR);
      expect(result.validation_history).toContainEqual(
        expect.objectContaining({
          status: LeadStatus.ERROR,
          message: expect.stringContaining('validation')
        })
      );
    });

    test('should handle scoring service failures gracefully', async () => {
      jest.spyOn(axios, 'post')
        .mockImplementationOnce(async () => ({ data: { isValid: true } })) // Validation succeeds
        .mockRejectedValueOnce(new Error('Scoring service unavailable')); // Scoring fails
      
      const result = await leadService.createLead(testLeads[InsuranceVertical.AUTO] as ILead);
      
      expect(result.status).toBe(LeadStatus.VALIDATED);
      expect(result.ml_score).toBe(0); // Default score when service fails
    });
  });
});