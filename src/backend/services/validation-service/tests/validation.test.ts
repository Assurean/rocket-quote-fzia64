/**
 * @fileoverview Comprehensive test suite for validation service components
 * @version 1.0.0
 */

import { ValidationController } from '../src/controllers/validation.controller';
import { Request, Response } from 'express';
import { jest } from '@jest/globals'; // v29.7.0
import supertest from 'supertest'; // v6.3.3
import { performance } from 'perf_hooks';
import { 
  IValidationResult, 
  IAddressInfo,
  ErrorSeverity,
  ValidationConstants 
} from '../src/interfaces/validation.interface';

// Mock security service
const mockSecurityService = {
  validateRequest: jest.fn(),
  maskPII: jest.fn(),
  auditLog: jest.fn()
};

// Mock performance monitor
const mockPerformanceMonitor = {
  startTimer: jest.fn(),
  endTimer: jest.fn(),
  recordMetric: jest.fn()
};

describe('ValidationController', () => {
  let controller: ValidationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new ValidationController(
      mockSecurityService as any,
      mockPerformanceMonitor as any
    );

    mockRequest = {
      headers: {
        'x-request-id': 'test-request-id',
        'user-agent': 'test-user-agent'
      },
      ip: '127.0.0.1'
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Address Validation', () => {
    const validAddress: IAddressInfo = {
      streetAddress: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001'
    };

    it('should validate a valid address with proper security controls', async () => {
      const timer = performance.now();
      mockRequest.body = validAddress;

      await controller.validateAddress(mockRequest as Request, mockResponse as Response);

      expect(mockSecurityService.validateRequest).toHaveBeenCalled();
      expect(mockSecurityService.maskPII).toHaveBeenCalledWith(validAddress);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: true,
          standardizedValue: expect.any(Object),
          metadata: expect.objectContaining({
            validationDuration: expect.any(Number),
            source: 'address-validation'
          })
        })
      );

      // Verify performance
      expect(performance.now() - timer).toBeLessThan(ValidationConstants.TIMEOUT);
    });

    it('should handle invalid addresses with proper error handling', async () => {
      const invalidAddress = { ...validAddress, zipCode: 'invalid' };
      mockRequest.body = invalidAddress;

      await controller.validateAddress(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: false,
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: 'zipCode',
              severity: ErrorSeverity.ERROR
            })
          ])
        })
      );
    });

    it('should properly cache successful validations', async () => {
      mockRequest.body = validAddress;

      // First call
      await controller.validateAddress(mockRequest as Request, mockResponse as Response);
      const firstCallTime = performance.now();

      // Second call with same address
      await controller.validateAddress(mockRequest as Request, mockResponse as Response);
      const secondCallTime = performance.now();

      // Second call should be faster due to caching
      expect(secondCallTime - firstCallTime).toBeLessThan(50);
    });
  });

  describe('Email Validation', () => {
    const validEmail = 'test@example.com';

    it('should validate a valid email with security checks', async () => {
      mockRequest.body = { email: validEmail };

      await controller.validateEmail(mockRequest as Request, mockResponse as Response);

      expect(mockSecurityService.validateRequest).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: true,
          standardizedValue: validEmail.toLowerCase()
        })
      );
    });

    it('should detect disposable email addresses', async () => {
      mockRequest.body = { email: 'test@tempmail.com' };

      await controller.validateEmail(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: false,
          errors: expect.arrayContaining([
            expect.objectContaining({
              code: 'DISPOSABLE_EMAIL',
              severity: ErrorSeverity.ERROR
            })
          ])
        })
      );
    });
  });

  describe('Phone Validation', () => {
    const validPhone = '+14155552671';

    it('should validate a valid phone number with TCPA compliance', async () => {
      mockRequest.body = { phone: validPhone };

      await controller.validatePhone(mockRequest as Request, mockResponse as Response);

      expect(mockSecurityService.validateRequest).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: true,
          standardizedValue: expect.stringMatching(/^\+1\d{10}$/),
          metadata: expect.objectContaining({
            tcpaCompliant: true
          })
        })
      );
    });

    it('should handle invalid phone numbers securely', async () => {
      mockRequest.body = { phone: 'invalid' };

      await controller.validatePhone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockSecurityService.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VALIDATION_ERROR',
          severity: 'ERROR'
        })
      );
    });
  });

  describe('Bulk Validation', () => {
    const bulkItems = [
      { type: 'email', value: 'test@example.com' },
      { type: 'phone', value: '+14155552671' },
      { type: 'address', value: validAddress }
    ];

    it('should handle bulk validation with rate limiting', async () => {
      mockRequest.body = { items: bulkItems };

      const timer = performance.now();
      await controller.validateBulk(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          results: expect.arrayContaining([
            expect.objectContaining({ isValid: expect.any(Boolean) })
          ])
        })
      );

      // Verify bulk processing performance
      expect(performance.now() - timer).toBeLessThan(ValidationConstants.TIMEOUT * 2);
    });

    it('should maintain security controls during bulk processing', async () => {
      mockRequest.body = { items: bulkItems };

      await controller.validateBulk(mockRequest as Request, mockResponse as Response);

      expect(mockSecurityService.validateRequest).toHaveBeenCalled();
      expect(mockSecurityService.maskPII).toHaveBeenCalledTimes(bulkItems.length);
    });
  });

  describe('Performance Requirements', () => {
    it('should meet response time SLA', async () => {
      const timer = performance.now();
      mockRequest.body = { email: 'test@example.com' };

      await controller.validateEmail(mockRequest as Request, mockResponse as Response);

      expect(performance.now() - timer).toBeLessThan(500); // 500ms SLA
    });

    it('should handle concurrent validations efficiently', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map(() => 
        controller.validateEmail(
          { ...mockRequest, body: { email: 'test@example.com' } } as Request,
          mockResponse as Response
        )
      );

      const timer = performance.now();
      await Promise.all(requests);

      expect(performance.now() - timer).toBeLessThan(1000); // 1s for 10 concurrent requests
    });
  });

  describe('Security Requirements', () => {
    it('should properly mask PII data in logs', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        phone: '+14155552671'
      };

      await controller.validateEmail(mockRequest as Request, mockResponse as Response);

      expect(mockSecurityService.maskPII).toHaveBeenCalledWith(
        expect.objectContaining({
          email: expect.any(String)
        })
      );
    });

    it('should enforce rate limiting', async () => {
      const maxRequests = 100;
      const requests = Array(maxRequests + 1).fill(null).map(() =>
        controller.validateEmail(mockRequest as Request, mockResponse as Response)
      );

      await Promise.all(requests);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });
});