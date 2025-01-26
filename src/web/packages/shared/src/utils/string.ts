// validator v13.11.0 - Enterprise-grade string validation and sanitization
import validator from 'validator';

/**
 * Configuration options for string formatting operations
 */
export interface FormattingOptions {
  locale?: string;
  maskLevel?: 'none' | 'partial' | 'full';
  truncateLength?: number;
}

/**
 * Custom error type for validation failures
 */
export class ValidationError extends Error {
  constructor(
    public code: string,
    public message: string,
    public field: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Regular expressions for validation
 */
const PHONE_REGEX = {
  US: /^\(\d{3}\) \d{3}-\d{4}$/,
  INTERNATIONAL: /^\+[1-9]\d{1,14}$/
} as const;

const SSN_REGEX = /^\d{3}-\d{2}-\d{4}$/;

/**
 * Currency formatting configurations
 */
const CURRENCY_FORMATS = {
  USD: { symbol: '$', precision: 2 },
  EUR: { symbol: '€', precision: 2 }
} as const;

/**
 * Security configuration
 */
const SECURITY_CONFIG = {
  maskLevels: ['none', 'partial', 'full'] as const,
  auditEvents: ['format', 'sanitize', 'mask'] as const
};

/**
 * Decorator for memoizing function results
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const cache = new Map();

  descriptor.value = function(...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Decorator for secure operations with audit logging
 */
function secureOperation(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    try {
      // Log security event
      console.info(`Secure operation: ${propertyKey}`, {
        timestamp: new Date().toISOString(),
        operation: propertyKey
      });
      
      return originalMethod.apply(this, args);
    } catch (error) {
      console.error(`Security operation failed: ${propertyKey}`, error);
      throw error;
    }
  };
}

/**
 * Namespace containing string utility functions with enhanced security and internationalization
 */
export namespace StringUtils {
  /**
   * Formats and validates phone numbers with international support
   * @param phoneNumber - Input phone number string
   * @param options - Formatting options
   * @returns Formatted phone number string
   * @throws ValidationError if invalid format
   */
  @memoize
  export function formatPhoneNumber(
    phoneNumber: string,
    options: FormattingOptions = { locale: 'US' }
  ): string {
    if (!phoneNumber) {
      throw new ValidationError('INVALID_PHONE', 'Phone number is required', 'phoneNumber');
    }

    // Remove non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Validate length
    if (options.locale === 'US' && cleaned.length !== 10) {
      throw new ValidationError('INVALID_LENGTH', 'US phone numbers must be 10 digits', 'phoneNumber');
    }

    // Format based on locale
    if (options.locale === 'US') {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }

    // International format
    return `+${cleaned}`;
  }

  /**
   * Securely formats SSN with configurable masking and audit logging
   * @param ssn - Input SSN string
   * @param options - Formatting options
   * @returns Formatted SSN string with masking
   */
  @secureOperation
  export function formatSSN(
    ssn: string,
    options: FormattingOptions = { maskLevel: 'partial' }
  ): string {
    if (!ssn || !validator.isNumeric(ssn.replace(/-/g, ''))) {
      throw new ValidationError('INVALID_SSN', 'Invalid SSN format', 'ssn');
    }

    const cleaned = ssn.replace(/\D/g, '');
    if (cleaned.length !== 9) {
      throw new ValidationError('INVALID_LENGTH', 'SSN must be 9 digits', 'ssn');
    }

    // Apply masking based on configuration
    switch (options.maskLevel) {
      case 'full':
        return 'XXX-XX-XXXX';
      case 'partial':
        return `XXX-XX-${cleaned.slice(5)}`;
      default:
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    }
  }

  /**
   * Formats currency with international support and precision handling
   * @param amount - Numeric amount to format
   * @param options - Formatting options
   * @returns Locale-aware formatted currency string
   */
  @memoize
  export function formatCurrency(
    amount: number,
    options: FormattingOptions = { locale: 'USD' }
  ): string {
    if (typeof amount !== 'number') {
      throw new ValidationError('INVALID_AMOUNT', 'Amount must be a number', 'amount');
    }

    const format = CURRENCY_FORMATS[options.locale as keyof typeof CURRENCY_FORMATS] || CURRENCY_FORMATS.USD;
    
    return new Intl.NumberFormat(options.locale, {
      style: 'currency',
      currency: options.locale || 'USD',
      minimumFractionDigits: format.precision,
      maximumFractionDigits: format.precision
    }).format(amount);
  }

  /**
   * Enhanced input sanitization with XSS protection and PII detection
   * @param input - Input string to sanitize
   * @param options - Sanitization options
   * @returns Sanitized and secured string
   */
  @secureOperation
  export function sanitizeInput(
    input: string,
    options: FormattingOptions = {}
  ): string {
    if (!input) {
      return '';
    }

    // Detect and handle PII
    const hasPII = SSN_REGEX.test(input) || 
                  PHONE_REGEX.US.test(input) ||
                  validator.isCreditCard(input);

    if (hasPII) {
      console.warn('PII detected in input string');
      return '[REDACTED]';
    }

    // Sanitize HTML and dangerous content
    let sanitized = validator.escape(input);

    // Apply truncation if specified
    if (options.truncateLength && sanitized.length > options.truncateLength) {
      sanitized = sanitized.slice(0, options.truncateLength) + '...';
    }

    return sanitized;
  }
}