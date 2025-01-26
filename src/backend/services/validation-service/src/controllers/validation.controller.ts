/**
 * @fileoverview Validation controller handling secure contact information validation
 * with comprehensive error handling, caching, and compliance features.
 * @version 1.0.0
 */

import { Controller, Post, UseGuards, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import * as winston from 'winston';
import { Cache } from 'cache-manager';
import { SecurityUtils } from '@nestjs/security';

import { AddressValidationService } from '../services/address.service';
import { EmailValidationService } from '../services/email.service';
import { PhoneValidationService } from '../services/phone.service';
import { 
  IValidationResult, 
  IAddressInfo,
  ErrorSeverity,
  ValidationConstants 
} from '../interfaces/validation.interface';

@Controller('validation')
@UseGuards(SecurityUtils.AuthGuard)
export class ValidationController {
  private readonly logger: winston.Logger;
  private readonly rateLimiter: RateLimiterMemory;

  constructor(
    private readonly addressService: AddressValidationService,
    private readonly emailService: EmailValidationService,
    private readonly phoneService: PhoneValidationService,
    private readonly cache: Cache
  ) {
    // Initialize secure logger with PII masking
    this.logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        SecurityUtils.maskPIIFormat()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'validation-error.log', level: 'error' })
      ]
    });

    // Initialize rate limiter
    this.rateLimiter = new RateLimiterMemory({
      points: 100, // Number of requests
      duration: 60, // Per minute
      blockDuration: 300 // 5 minutes block duration
    });
  }

  /**
   * Validates physical address with security controls and caching
   */
  @Post('/address')
  @SecurityUtils.ValidateRequest()
  @SecurityUtils.RateLimit()
  async validateAddress(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      // Rate limit check
      await this.rateLimiter.consume(req.ip);

      // Validate request schema
      const address = SecurityUtils.validateSchema<IAddressInfo>(
        req.body,
        'addressValidationSchema'
      );

      // Check cache
      const cacheKey = `addr:${SecurityUtils.hash(JSON.stringify(address))}`;
      const cachedResult = await this.cache.get<IValidationResult<IAddressInfo>>(cacheKey);
      if (cachedResult) {
        this.logger.info('Address validation cache hit', { requestId });
        res.json(cachedResult);
        return;
      }

      // Perform validation
      const validationResult = await this.addressService.validateAddress(address);

      // Cache successful validations
      if (validationResult.isValid) {
        await this.cache.set(
          cacheKey,
          validationResult,
          { ttl: ValidationConstants.CACHE_TTL }
        );
      }

      // Log validation metrics
      this.logger.info('Address validation completed', {
        requestId,
        duration: Date.now() - startTime,
        isValid: validationResult.isValid
      });

      res.json(validationResult);

    } catch (error) {
      this.handleValidationError(error, requestId, res);
    }
  }

  /**
   * Validates email address with disposable email detection
   */
  @Post('/email')
  @SecurityUtils.ValidateRequest()
  @SecurityUtils.RateLimit()
  async validateEmail(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      await this.rateLimiter.consume(req.ip);

      const email = SecurityUtils.validateSchema<string>(
        req.body.email,
        'emailValidationSchema'
      );

      const cacheKey = `email:${SecurityUtils.hash(email)}`;
      const cachedResult = await this.cache.get<IValidationResult<string>>(cacheKey);
      if (cachedResult) {
        this.logger.info('Email validation cache hit', { requestId });
        res.json(cachedResult);
        return;
      }

      const validationResult = await this.emailService.validateEmail(email);

      if (validationResult.isValid) {
        await this.cache.set(
          cacheKey,
          validationResult,
          { ttl: ValidationConstants.CACHE_TTL }
        );
      }

      this.logger.info('Email validation completed', {
        requestId,
        duration: Date.now() - startTime,
        isValid: validationResult.isValid
      });

      res.json(validationResult);

    } catch (error) {
      this.handleValidationError(error, requestId, res);
    }
  }

  /**
   * Validates phone number with TCPA compliance check
   */
  @Post('/phone')
  @SecurityUtils.ValidateRequest()
  @SecurityUtils.RateLimit()
  async validatePhone(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      await this.rateLimiter.consume(req.ip);

      const phone = SecurityUtils.validateSchema<string>(
        req.body.phone,
        'phoneValidationSchema'
      );

      const context = {
        requestId,
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || ''
      };

      const cacheKey = `phone:${SecurityUtils.hash(phone)}`;
      const cachedResult = await this.cache.get<IValidationResult<string>>(cacheKey);
      if (cachedResult) {
        this.logger.info('Phone validation cache hit', { requestId });
        res.json(cachedResult);
        return;
      }

      const validationResult = await this.phoneService.validatePhoneNumber(
        phone,
        'US',
        context
      );

      if (validationResult.isValid) {
        await this.cache.set(
          cacheKey,
          validationResult,
          { ttl: ValidationConstants.CACHE_TTL }
        );
      }

      this.logger.info('Phone validation completed', {
        requestId,
        duration: Date.now() - startTime,
        isValid: validationResult.isValid
      });

      res.json(validationResult);

    } catch (error) {
      this.handleValidationError(error, requestId, res);
    }
  }

  /**
   * Validates multiple contact items in parallel
   */
  @Post('/bulk')
  @SecurityUtils.ValidateRequest()
  @SecurityUtils.RateLimit({ points: 20, duration: 60 })
  async validateBulk(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    try {
      await this.rateLimiter.consume(req.ip, 5); // Higher consumption for bulk

      const { items } = SecurityUtils.validateSchema(
        req.body,
        'bulkValidationSchema'
      );

      const validationPromises = items.map(async (item: any) => {
        switch (item.type) {
          case 'address':
            return this.addressService.validateAddress(item.value);
          case 'email':
            return this.emailService.validateEmail(item.value);
          case 'phone':
            return this.phoneService.validatePhoneNumber(
              item.value,
              'US',
              { requestId, userId: req.user?.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] || '' }
            );
          default:
            throw new Error(`Invalid validation type: ${item.type}`);
        }
      });

      const results = await Promise.all(validationPromises);

      this.logger.info('Bulk validation completed', {
        requestId,
        duration: Date.now() - startTime,
        itemCount: items.length
      });

      res.json({
        success: true,
        results,
        metadata: {
          processedAt: new Date(),
          duration: Date.now() - startTime
        }
      });

    } catch (error) {
      this.handleValidationError(error, requestId, res);
    }
  }

  /**
   * Handles validation errors with proper logging and response formatting
   */
  private handleValidationError(
    error: any,
    requestId: string,
    res: Response
  ): void {
    this.logger.error('Validation error occurred', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    const errorResponse = {
      success: false,
      error: {
        code: error.code || 'VALIDATION_ERROR',
        message: error.message || 'Validation failed',
        severity: ErrorSeverity.ERROR
      },
      requestId
    };

    const statusCode = error.statusCode || 400;
    res.status(statusCode).json(errorResponse);
  }
}