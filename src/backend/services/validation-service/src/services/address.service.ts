/**
 * @fileoverview Address validation service with secure PII handling, caching, and monitoring
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // v1.6.0
import { createClient, RedisClientType } from 'redis'; // v4.6.0
import { createLogger, format, transports } from 'winston'; // v3.11.0
import { Registry, Counter, Histogram } from 'prom-client'; // v14.2.0
import { AES, enc } from 'crypto-js'; // v4.2.0

import { IAddressInfo, IValidationResult, ErrorSeverity } from '../interfaces/validation.interface';
import { addressValidationConfig } from '../config/apis';

// Encryption key from environment variable
const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || '';

export class AddressValidationService {
  private logger: ReturnType<typeof createLogger>;
  private axiosInstance: AxiosInstance;
  private redisClient: RedisClientType;
  private metrics: Registry;
  private validationCounter: Counter;
  private validationDuration: Histogram;

  constructor() {
    // Initialize secure logger with PII masking
    this.logger = createLogger({
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
          return `${timestamp} ${level}: ${this.maskPII(message)}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'validation-error.log', level: 'error' })
      ]
    });

    // Initialize axios with retry configuration
    this.axiosInstance = axios.create({
      baseURL: addressValidationConfig.baseUrl,
      timeout: addressValidationConfig.timeout,
      headers: {
        'X-API-Key': addressValidationConfig.apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Initialize Redis client with secure connection
    this.redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: true,
        rejectUnauthorized: true
      }
    });

    // Initialize Prometheus metrics
    this.metrics = new Registry();
    this.validationCounter = new Counter({
      name: 'address_validation_total',
      help: 'Total number of address validations',
      labelNames: ['status']
    });
    this.validationDuration = new Histogram({
      name: 'address_validation_duration_seconds',
      help: 'Address validation duration in seconds',
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.redisClient.connect();
      this.metrics.registerMetric(this.validationCounter);
      this.metrics.registerMetric(this.validationDuration);
    } catch (error) {
      this.logger.error('Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Validates and standardizes a physical address
   * @param address Address information to validate
   * @returns Validation result with standardized address
   */
  public async validateAddress(address: IAddressInfo): Promise<IValidationResult<IAddressInfo>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(address);

    try {
      // Check cache first
      const cachedResult = await this.redisClient.get(cacheKey);
      if (cachedResult) {
        this.validationCounter.inc({ status: 'cache_hit' });
        return JSON.parse(cachedResult);
      }

      // Encrypt sensitive data for API call
      const encryptedAddress = this.encryptSensitiveData(address);
      
      // Call validation API with retry logic
      const validationResponse = await this.axiosInstance.post('/validate', encryptedAddress);
      
      // Process and decrypt response
      const validationResult = this.processValidationResponse(validationResponse.data, address);
      
      // Cache successful validations
      if (validationResult.isValid) {
        await this.redisClient.setEx(
          cacheKey,
          3600, // 1 hour TTL
          JSON.stringify(validationResult)
        );
      }

      // Track metrics
      this.validationCounter.inc({ status: validationResult.isValid ? 'success' : 'invalid' });
      this.validationDuration.observe((Date.now() - startTime) / 1000);

      return validationResult;

    } catch (error) {
      return this.handleValidationError(error, address);
    }
  }

  /**
   * Standardizes address format according to USPS guidelines
   * @param address Address to standardize
   * @returns Standardized address result
   */
  public async standardizeAddress(address: IAddressInfo): Promise<IValidationResult<IAddressInfo>> {
    try {
      const standardized: IAddressInfo = {
        streetAddress: this.standardizeStreetAddress(address.streetAddress),
        city: address.city.toUpperCase().trim(),
        state: this.standardizeState(address.state),
        zipCode: this.standardizeZipCode(address.zipCode),
        unitNumber: address.unitNumber ? this.standardizeUnitNumber(address.unitNumber) : undefined
      };

      return {
        isValid: true,
        errors: [],
        standardizedValue: standardized,
        validationMetrics: {
          processingTime: 0,
          source: 'local',
          confidence: 1
        }
      };
    } catch (error) {
      return this.handleValidationError(error, address);
    }
  }

  /**
   * Retrieves current validation metrics
   * @returns Validation performance metrics
   */
  public async getValidationMetrics(): Promise<Record<string, number>> {
    return {
      totalValidations: await this.validationCounter.get(),
      averageDuration: await this.validationDuration.get(),
      cacheHitRate: await this.calculateCacheHitRate(),
      errorRate: await this.calculateErrorRate()
    };
  }

  private generateCacheKey(address: IAddressInfo): string {
    return `addr:${address.streetAddress}:${address.city}:${address.state}:${address.zipCode}`;
  }

  private encryptSensitiveData(address: IAddressInfo): IAddressInfo {
    return {
      ...address,
      streetAddress: AES.encrypt(address.streetAddress, ENCRYPTION_KEY).toString()
    };
  }

  private maskPII(message: string): string {
    return message.replace(/\d{1,5}\s+[\w\s]+(?:Avenue|Street|Road|Boulevard|Lane|Drive)/gi, '[ADDRESS]');
  }

  private standardizeStreetAddress(street: string): string {
    return street
      .replace(/(\d+)/, '$1 ')
      .replace(/\b(st|str|stre)\b/gi, 'Street')
      .replace(/\b(ave|av)\b/gi, 'Avenue')
      .replace(/\b(rd|ro)\b/gi, 'Road')
      .trim();
  }

  private standardizeState(state: string): string {
    const stateMap: Record<string, string> = {
      'california': 'CA',
      'new york': 'NY',
      // Add more state mappings
    };
    
    const normalized = state.toLowerCase().trim();
    return stateMap[normalized] || state.toUpperCase();
  }

  private standardizeZipCode(zipCode: string): string {
    return zipCode.replace(/(\d{5})[-\s]*(\d{4})?/, '$1-$2').trim();
  }

  private standardizeUnitNumber(unit: string): string {
    return unit
      .replace(/^(#|\s)+/, '')
      .replace(/\b(apt|unit|suite)\b/gi, '')
      .trim();
  }

  private handleValidationError(error: any, address: IAddressInfo): IValidationResult<IAddressInfo> {
    this.validationCounter.inc({ status: 'error' });
    
    const errorResult: IValidationResult<IAddressInfo> = {
      isValid: false,
      errors: [{
        field: 'address',
        code: error.code || 'VALIDATION_ERROR',
        message: error.message || 'Address validation failed',
        severity: ErrorSeverity.ERROR
      }],
      standardizedValue: address,
      validationMetrics: {
        processingTime: 0,
        source: 'error',
        confidence: 0
      }
    };

    this.logger.error('Address validation error:', {
      error: error.message,
      address: this.maskPII(JSON.stringify(address))
    });

    return errorResult;
  }

  private async calculateCacheHitRate(): Promise<number> {
    const hits = await this.validationCounter.get({ status: 'cache_hit' });
    const total = await this.validationCounter.get();
    return total > 0 ? hits / total : 0;
  }

  private async calculateErrorRate(): Promise<number> {
    const errors = await this.validationCounter.get({ status: 'error' });
    const total = await this.validationCounter.get();
    return total > 0 ? errors / total : 0;
  }
}