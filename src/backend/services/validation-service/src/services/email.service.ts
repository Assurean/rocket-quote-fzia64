/**
 * @fileoverview Email validation service with comprehensive security and performance features
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import axios, { AxiosInstance } from 'axios';
import validator from 'validator';
import * as dns from 'dns/promises';
import CircuitBreaker from 'opossum';
import LRUCache from 'lru-cache';

import { 
  IValidationResult, 
  IValidationError, 
  ErrorSeverity 
} from '../interfaces/validation.interface';
import { emailValidationConfig } from '../config/apis';

/**
 * Options for bulk email validation
 */
interface ValidationOptions {
  batchSize?: number;
  concurrency?: number;
  timeoutMs?: number;
}

@injectable()
export class EmailValidationService {
  private readonly apiClient: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly cache: LRUCache<string, IValidationResult<string>>;
  private readonly disposableDomainsSet: Set<string>;

  constructor() {
    // Initialize secure axios client
    this.apiClient = axios.create({
      baseURL: emailValidationConfig.baseUrl,
      timeout: emailValidationConfig.timeout,
      headers: {
        'X-API-Key': emailValidationConfig.apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(this.callValidationAPI.bind(this), {
      timeout: emailValidationConfig.timeout,
      resetTimeout: 30000,
      errorThresholdPercentage: 50,
      volumeThreshold: 10
    });

    // Initialize cache with security-conscious settings
    this.cache = new LRUCache({
      max: 10000,
      ttl: 1000 * 60 * 60, // 1 hour
      updateAgeOnGet: true,
      allowStale: false
    });

    // Initialize disposable email domains set
    this.disposableDomainsSet = new Set();
    this.loadDisposableDomains();
  }

  /**
   * Validates a single email address with comprehensive checks
   * @param email Email address to validate
   * @returns Validation result with standardized email and detailed errors
   */
  public async validateEmail(email: string): Promise<IValidationResult<string>> {
    // Check cache first
    const cachedResult = this.cache.get(email);
    if (cachedResult) {
      return cachedResult;
    }

    const errors: IValidationError[] = [];
    let standardizedEmail = email.trim().toLowerCase();

    // Basic format validation
    if (!validator.isEmail(standardizedEmail)) {
      errors.push({
        field: 'email',
        code: 'INVALID_FORMAT',
        message: 'Invalid email format',
        severity: ErrorSeverity.ERROR
      });
      return this.createValidationResult(standardizedEmail, false, errors);
    }

    // Domain validation
    const domain = standardizedEmail.split('@')[1];
    const hasMX = await this.verifyDomainMX(domain);
    if (!hasMX) {
      errors.push({
        field: 'email',
        code: 'INVALID_DOMAIN',
        message: 'Domain does not have valid MX records',
        severity: ErrorSeverity.ERROR
      });
    }

    // Disposable email check
    if (this.disposableDomainsSet.has(domain)) {
      errors.push({
        field: 'email',
        code: 'DISPOSABLE_EMAIL',
        message: 'Disposable email addresses are not allowed',
        severity: ErrorSeverity.ERROR
      });
    }

    // Third-party API validation through circuit breaker
    try {
      const apiResult = await this.circuitBreaker.fire(standardizedEmail);
      if (!apiResult.isDeliverable) {
        errors.push({
          field: 'email',
          code: 'UNDELIVERABLE',
          message: 'Email address appears to be undeliverable',
          severity: ErrorSeverity.ERROR
        });
      }
    } catch (error) {
      const apiError = this.handleAPIError(error);
      errors.push(apiError);
    }

    const result = this.createValidationResult(
      standardizedEmail,
      errors.length === 0,
      errors
    );

    // Cache successful validations
    if (result.isValid) {
      this.cache.set(email, result);
    }

    return result;
  }

  /**
   * Validates multiple email addresses with optimized batch processing
   * @param emails Array of email addresses to validate
   * @param options Validation options for batch processing
   * @returns Array of validation results
   */
  public async validateBulkEmails(
    emails: string[],
    options: ValidationOptions = {}
  ): Promise<IValidationResult<string>[]> {
    const {
      batchSize = 100,
      concurrency = 5,
      timeoutMs = 30000
    } = options;

    // Deduplicate emails
    const uniqueEmails = [...new Set(emails)];
    const batches: string[][] = [];

    // Split into batches
    for (let i = 0; i < uniqueEmails.length; i += batchSize) {
      batches.push(uniqueEmails.slice(i, i + batchSize));
    }

    // Process batches with concurrency control
    const results: IValidationResult<string>[] = [];
    for (let i = 0; i < batches.length; i += concurrency) {
      const batchPromises = batches
        .slice(i, i + concurrency)
        .map(batch => Promise.all(batch.map(email => this.validateEmail(email))));

      const batchResults = await Promise.race([
        Promise.all(batchPromises),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Batch timeout')), timeoutMs)
        )
      ]);

      results.push(...batchResults.flat());
    }

    return results;
  }

  /**
   * Verifies domain MX records
   * @param domain Domain to verify
   * @returns Boolean indicating if domain has valid MX records
   */
  private async verifyDomainMX(domain: string): Promise<boolean> {
    try {
      const records = await dns.resolveMx(domain);
      return records.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handles API errors with proper logging and fallback
   * @param error Error from API call
   * @returns Formatted validation error
   */
  private handleAPIError(error: Error): IValidationError {
    // Log error without PII
    console.error('Email validation API error:', {
      name: error.name,
      message: error.message,
      timestamp: new Date().toISOString()
    });

    return {
      field: 'email',
      code: 'API_ERROR',
      message: 'Unable to complete email validation',
      severity: ErrorSeverity.WARNING
    };
  }

  /**
   * Creates a standardized validation result
   */
  private createValidationResult(
    email: string,
    isValid: boolean,
    errors: IValidationError[]
  ): IValidationResult<string> {
    return {
      isValid,
      errors,
      standardizedValue: email,
      metadata: {
        source: 'email-validation-service',
        validationDuration: 0,
        cacheTTL: this.cache.ttl
      },
      validatedAt: new Date()
    };
  }

  /**
   * Loads disposable email domains from configuration
   */
  private async loadDisposableDomains(): Promise<void> {
    try {
      const response = await this.apiClient.get('/disposable-domains');
      response.data.domains.forEach((domain: string) => 
        this.disposableDomainsSet.add(domain.toLowerCase())
      );
    } catch (error) {
      console.error('Failed to load disposable domains:', error);
    }
  }

  /**
   * Makes secure API call to validation service
   */
  private async callValidationAPI(email: string): Promise<any> {
    const response = await this.apiClient.post('/validate', {
      email,
      apiKey: emailValidationConfig.apiKey
    });
    return response.data;
  }
}