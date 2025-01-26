/**
 * @fileoverview Enhanced phone validation service with security, caching, and compliance features
 * for the Multi-Vertical Insurance Lead Generation Platform.
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { parsePhoneNumber, PhoneNumber } from 'libphonenumber-js';
import CircuitBreaker from 'circuit-breaker-js';
import { RedisClient } from 'redis';
import CryptoJS from 'crypto-js';
import {
  IValidationResult,
  IValidationError,
  ErrorSeverity,
  PhoneType,
  ICarrierInfo,
  ValidationConstants
} from '../interfaces/validation.interface';

// Configuration constants
const phoneValidationConfig = {
  CACHE_PREFIX: 'phone_validation:',
  CACHE_TTL: 3600, // 1 hour
  ENCRYPTION_KEY: process.env.PHONE_ENCRYPTION_KEY,
  API_TIMEOUT: 5000,
  MAX_RETRIES: 3,
  CIRCUIT_BREAKER: {
    failureThreshold: 5,
    resetTimeout: 60000
  }
};

/**
 * Interface for validation context with enhanced security metadata
 */
interface ValidationContext {
  requestId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Enhanced service for secure phone number validation with encryption and compliance checks
 */
@Injectable()
export class PhoneValidationService {
  private readonly axios: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly encryptionKey: string;

  constructor(
    private readonly auditLogger: IAuditLogger,
    private readonly cache: RedisClient,
    private readonly metrics: MetricsService
  ) {
    // Initialize axios with retry and timeout configuration
    this.axios = axios.create({
      timeout: phoneValidationConfig.API_TIMEOUT,
      retries: phoneValidationConfig.MAX_RETRIES
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: phoneValidationConfig.CIRCUIT_BREAKER.failureThreshold,
      resetTimeout: phoneValidationConfig.CIRCUIT_BREAKER.resetTimeout
    });

    this.encryptionKey = phoneValidationConfig.ENCRYPTION_KEY;
  }

  /**
   * Validates phone number with enhanced security and compliance checks
   */
  public async validatePhoneNumber(
    phoneNumber: string,
    countryCode: string = 'US',
    context: ValidationContext
  ): Promise<IValidationResult<string>> {
    const startTime = Date.now();
    const maskedPhone = this.maskPhoneNumber(phoneNumber);

    try {
      // Log validation attempt with masked data
      this.auditLogger.log({
        action: 'PHONE_VALIDATION_ATTEMPT',
        maskedData: maskedPhone,
        context
      });

      // Check cache first
      const cachedResult = await this.getCachedValidation(phoneNumber);
      if (cachedResult) {
        this.metrics.recordCacheHit('phone_validation');
        return cachedResult;
      }

      // Parse and validate basic format
      const parsedPhone = this.parsePhoneNumber(phoneNumber, countryCode);
      if (!parsedPhone.isValid()) {
        return this.createErrorResult('INVALID_FORMAT', 'Invalid phone number format');
      }

      // Get carrier information with circuit breaker
      const carrierInfo = await this.getCarrierInfo(parsedPhone.number);
      
      // Verify TCPA compliance
      const tcpaStatus = await this.verifyTCPACompliance(parsedPhone.number);
      
      // Check for fraud indicators
      const fraudScore = await this.checkFraudIndicators(parsedPhone.number, context);

      const validationResult = this.createValidationResult(
        parsedPhone,
        carrierInfo,
        tcpaStatus,
        fraudScore
      );

      // Cache successful validation
      await this.cacheValidationResult(phoneNumber, validationResult);

      // Log successful validation
      this.auditLogger.log({
        action: 'PHONE_VALIDATION_SUCCESS',
        maskedData: maskedPhone,
        metadata: {
          duration: Date.now() - startTime,
          carrier: carrierInfo.carrierName,
          tcpaCompliant: tcpaStatus
        }
      });

      return validationResult;

    } catch (error) {
      // Log validation error
      this.auditLogger.error({
        action: 'PHONE_VALIDATION_ERROR',
        maskedData: maskedPhone,
        error: error.message,
        context
      });

      this.metrics.incrementCounter('phone_validation_errors');
      throw error;
    }
  }

  /**
   * Retrieves carrier information with enhanced security
   */
  private async getCarrierInfo(phoneNumber: string): Promise<ICarrierInfo> {
    const cacheKey = `${phoneValidationConfig.CACHE_PREFIX}carrier:${this.hashPhoneNumber(phoneNumber)}`;
    
    try {
      // Check cache
      const cachedInfo = await this.cache.get(cacheKey);
      if (cachedInfo) {
        return JSON.parse(cachedInfo);
      }

      // Make API call with circuit breaker
      const carrierInfo = await this.circuitBreaker.execute(async () => {
        const response = await this.axios.get(
          `${process.env.CARRIER_API_URL}/lookup`,
          {
            params: { phone: this.encryptPhoneNumber(phoneNumber) }
          }
        );
        return response.data;
      });

      // Cache carrier info
      await this.cache.setex(
        cacheKey,
        phoneValidationConfig.CACHE_TTL,
        JSON.stringify(carrierInfo)
      );

      return carrierInfo;

    } catch (error) {
      this.metrics.incrementCounter('carrier_lookup_errors');
      throw new Error(`Carrier lookup failed: ${error.message}`);
    }
  }

  /**
   * Security utility methods
   */
  private encryptPhoneNumber(phoneNumber: string): string {
    return CryptoJS.AES.encrypt(phoneNumber, this.encryptionKey).toString();
  }

  private maskPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  private hashPhoneNumber(phoneNumber: string): string {
    return CryptoJS.SHA256(phoneNumber).toString();
  }

  /**
   * Helper methods for validation
   */
  private parsePhoneNumber(phoneNumber: string, countryCode: string): PhoneNumber {
    try {
      return parsePhoneNumber(phoneNumber, countryCode);
    } catch (error) {
      throw new Error(`Phone parsing failed: ${error.message}`);
    }
  }

  private async verifyTCPACompliance(phoneNumber: string): Promise<boolean> {
    try {
      const response = await this.circuitBreaker.execute(() =>
        this.axios.post(`${process.env.TCPA_API_URL}/verify`, {
          phone: this.encryptPhoneNumber(phoneNumber)
        })
      );
      return response.data.compliant;
    } catch (error) {
      this.metrics.incrementCounter('tcpa_verification_errors');
      return false;
    }
  }

  private async checkFraudIndicators(
    phoneNumber: string,
    context: ValidationContext
  ): Promise<number> {
    try {
      const response = await this.axios.post(
        `${process.env.FRAUD_API_URL}/check`,
        {
          phone: this.encryptPhoneNumber(phoneNumber),
          ip: context.ipAddress,
          userAgent: context.userAgent
        }
      );
      return response.data.fraudScore;
    } catch (error) {
      this.metrics.incrementCounter('fraud_check_errors');
      return 1.0; // High risk score on error
    }
  }

  private createValidationResult(
    parsedPhone: PhoneNumber,
    carrierInfo: ICarrierInfo,
    tcpaCompliant: boolean,
    fraudScore: number
  ): IValidationResult<string> {
    const errors: IValidationError[] = [];
    
    if (!tcpaCompliant) {
      errors.push({
        field: 'phone',
        code: 'TCPA_VIOLATION',
        message: 'Phone number not TCPA compliant',
        severity: ErrorSeverity.ERROR
      });
    }

    if (fraudScore > 0.8) {
      errors.push({
        field: 'phone',
        code: 'HIGH_FRAUD_RISK',
        message: 'Phone number has high fraud risk',
        severity: ErrorSeverity.ERROR
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      standardizedValue: parsedPhone.format('E.164'),
      metadata: {
        carrier: carrierInfo,
        tcpaCompliant,
        fraudScore,
        validatedAt: new Date(),
        cacheTTL: phoneValidationConfig.CACHE_TTL
      }
    };
  }

  private async getCachedValidation(
    phoneNumber: string
  ): Promise<IValidationResult<string> | null> {
    const cacheKey = `${phoneValidationConfig.CACHE_PREFIX}validation:${this.hashPhoneNumber(phoneNumber)}`;
    const cached = await this.cache.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  }

  private async cacheValidationResult(
    phoneNumber: string,
    result: IValidationResult<string>
  ): Promise<void> {
    const cacheKey = `${phoneValidationConfig.CACHE_PREFIX}validation:${this.hashPhoneNumber(phoneNumber)}`;
    await this.cache.setex(
      cacheKey,
      phoneValidationConfig.CACHE_TTL,
      JSON.stringify(result)
    );
  }
}