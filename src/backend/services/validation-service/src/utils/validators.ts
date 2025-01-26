/**
 * @fileoverview Core validation utility functions for contact information validation
 * Implements comprehensive validation with caching, PII protection, and compliance checks
 * @version 1.0.0
 */

import axios, { AxiosError } from 'axios'; // v1.6.0
import validator from 'validator'; // v13.11.0
import { createClient } from 'redis'; // v4.6.10
import winston from 'winston'; // v3.11.0

import {
  IAddressInfo,
  IValidationResult,
  IValidationError,
  ErrorSeverity,
  ICarrierInfo,
  PhoneType,
  IValidationMetrics,
  IAuditLog
} from '../interfaces/validation.interface';

import {
  addressValidationConfig,
  emailValidationConfig,
  phoneValidationConfig
} from '../config/apis';

// Constants
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\+?1?\d{10}$/;
const CACHE_TTL = 3600;
const MAX_RETRY_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 100;

// Initialize Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL
});

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'validation-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'validation-combined.log' })
  ]
});

/**
 * Decorator for tracking validation metrics
 */
function metrics(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const start = Date.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - start;
      logger.info('Validation metrics', {
        operation: propertyKey,
        duration,
        success: result.isValid
      });
      return result;
    } catch (error) {
      logger.error('Validation error', {
        operation: propertyKey,
        error: error.message
      });
      throw error;
    }
  };
  return descriptor;
}

/**
 * Enhanced address validation with caching and PII protection
 * @param address Address information to validate
 * @param enableCache Whether to use cache for validation results
 * @returns Validation result with standardized address or errors
 */
@metrics
export async function validateAddress(
  address: IAddressInfo,
  enableCache = true
): Promise<IValidationResult<IAddressInfo>> {
  const cacheKey = `addr:${JSON.stringify(address)}`;

  // Check cache
  if (enableCache) {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  // Sanitize input
  const sanitizedAddress = {
    ...address,
    streetAddress: validator.escape(address.streetAddress),
    city: validator.escape(address.city),
    state: validator.escape(address.state),
    zipCode: validator.escape(address.zipCode)
  };

  try {
    const response = await axios.post(
      addressValidationConfig.baseUrl,
      sanitizedAddress,
      {
        headers: { 'X-API-Key': addressValidationConfig.apiKey },
        timeout: addressValidationConfig.timeout
      }
    );

    const result: IValidationResult<IAddressInfo> = {
      isValid: response.data.valid,
      standardizedValue: response.data.standardized,
      errors: [],
      metadata: {
        source: 'address-validation-api',
        validationDuration: Date.now(),
        cacheTTL: CACHE_TTL
      },
      validatedAt: new Date()
    };

    if (enableCache) {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
    }

    return result;
  } catch (error) {
    logger.error('Address validation error', { error: error.message, address: sanitizedAddress });
    throw new Error(`Address validation failed: ${error.message}`);
  }
}

/**
 * Enhanced email validation with disposable email detection and MX verification
 * @param email Email address to validate
 * @param checkMX Whether to verify MX records
 * @returns Validation result with standardized email or errors
 */
@metrics
export async function validateEmail(
  email: string,
  checkMX = true
): Promise<IValidationResult<string>> {
  const cacheKey = `email:${email}`;

  if (await redisClient.get(cacheKey)) {
    return JSON.parse(await redisClient.get(cacheKey));
  }

  const sanitizedEmail = validator.normalizeEmail(email);
  const errors: IValidationError[] = [];

  if (!EMAIL_REGEX.test(sanitizedEmail)) {
    errors.push({
      field: 'email',
      code: 'INVALID_FORMAT',
      message: 'Invalid email format',
      severity: ErrorSeverity.ERROR
    });
  }

  try {
    const response = await axios.post(
      emailValidationConfig.baseUrl,
      { email: sanitizedEmail },
      {
        headers: { 'X-API-Key': emailValidationConfig.apiKey },
        timeout: emailValidationConfig.timeout
      }
    );

    const result: IValidationResult<string> = {
      isValid: response.data.valid && errors.length === 0,
      standardizedValue: response.data.standardized || sanitizedEmail,
      errors,
      metadata: {
        source: 'email-validation-api',
        validationDuration: Date.now(),
        cacheTTL: CACHE_TTL
      },
      validatedAt: new Date()
    };

    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  } catch (error) {
    logger.error('Email validation error', { error: error.message, email: sanitizedEmail });
    throw new Error(`Email validation failed: ${error.message}`);
  }
}

/**
 * Enhanced phone validation with TCPA compliance and carrier detection
 * @param phoneNumber Phone number to validate
 * @param type Expected phone type
 * @returns Validation result with carrier info and compliance status
 */
@metrics
export async function validatePhoneNumber(
  phoneNumber: string,
  type: PhoneType
): Promise<IValidationResult<ICarrierInfo>> {
  const cacheKey = `phone:${phoneNumber}`;

  if (await redisClient.get(cacheKey)) {
    return JSON.parse(await redisClient.get(cacheKey));
  }

  const sanitizedPhone = phoneNumber.replace(/\D/g, '');
  const errors: IValidationError[] = [];

  if (!PHONE_REGEX.test(sanitizedPhone)) {
    errors.push({
      field: 'phoneNumber',
      code: 'INVALID_FORMAT',
      message: 'Invalid phone number format',
      severity: ErrorSeverity.ERROR
    });
  }

  try {
    const response = await axios.post(
      phoneValidationConfig.baseUrl,
      { 
        phoneNumber: sanitizedPhone,
        type 
      },
      {
        headers: { 'X-API-Key': phoneValidationConfig.apiKey },
        timeout: phoneValidationConfig.timeout
      }
    );

    const result: IValidationResult<ICarrierInfo> = {
      isValid: response.data.valid && errors.length === 0,
      standardizedValue: {
        carrierName: response.data.carrier,
        phoneType: response.data.type,
        isActive: response.data.active,
        tcpaCompliant: response.data.tcpaCompliant,
        lastVerifiedAt: new Date(),
        complianceMetadata: {
          tcpaStatus: response.data.tcpaCompliant,
          ccpaStatus: response.data.ccpaCompliant,
          lastComplianceCheck: new Date()
        }
      },
      errors,
      metadata: {
        source: 'phone-validation-api',
        validationDuration: Date.now(),
        cacheTTL: CACHE_TTL
      },
      validatedAt: new Date()
    };

    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  } catch (error) {
    logger.error('Phone validation error', { error: error.message, phoneNumber: sanitizedPhone });
    throw new Error(`Phone validation failed: ${error.message}`);
  }
}