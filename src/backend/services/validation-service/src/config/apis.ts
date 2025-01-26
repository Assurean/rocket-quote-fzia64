// @package dotenv v16.3.1
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

/**
 * Interface defining the required configuration for validation service integrations
 * Ensures consistent configuration across different validation providers
 */
export interface ValidationServiceConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
  backoffMs: number;
}

/**
 * Validates URL format and security requirements
 * @param url The URL to validate
 * @returns boolean indicating if URL is valid and secure
 * @throws Error if URL is invalid or insecure
 */
const validateApiUrl = (url: string): boolean => {
  const urlPattern = /^https:\/\/[\w\-.]+(:\d+)?(\/[\w\-./]*)?$/;
  if (!url.startsWith('https://')) {
    throw new Error('API URL must use HTTPS protocol');
  }
  if (!urlPattern.test(url)) {
    throw new Error('Invalid API URL format');
  }
  return true;
};

/**
 * Validates presence and format of all required environment variables
 * @throws Error if any required variables are missing or invalid
 */
const validateEnvironmentVariables = (): void => {
  const requiredVars = [
    'ADDRESS_VALIDATION_API_KEY',
    'ADDRESS_VALIDATION_URL',
    'EMAIL_VALIDATION_API_KEY',
    'EMAIL_VALIDATION_URL',
    'PHONE_VALIDATION_API_KEY',
    'PHONE_VALIDATION_URL',
    'VALIDATION_TIMEOUT_MS',
    'VALIDATION_RETRIES',
    'VALIDATION_BACKOFF_MS'
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate URLs
  [
    process.env.ADDRESS_VALIDATION_URL,
    process.env.EMAIL_VALIDATION_URL,
    process.env.PHONE_VALIDATION_URL
  ].forEach(url => validateApiUrl(url!));

  // Validate numeric values
  const timeout = Number(process.env.VALIDATION_TIMEOUT_MS);
  const retries = Number(process.env.VALIDATION_RETRIES);
  const backoff = Number(process.env.VALIDATION_BACKOFF_MS);

  if (isNaN(timeout) || timeout <= 0) {
    throw new Error('VALIDATION_TIMEOUT_MS must be a positive number');
  }
  if (isNaN(retries) || retries < 0) {
    throw new Error('VALIDATION_RETRIES must be a non-negative number');
  }
  if (isNaN(backoff) || backoff <= 0) {
    throw new Error('VALIDATION_BACKOFF_MS must be a positive number');
  }

  // Validate API key formats
  const apiKeyPattern = /^[A-Za-z0-9_-]{32,}$/;
  [
    process.env.ADDRESS_VALIDATION_API_KEY,
    process.env.EMAIL_VALIDATION_API_KEY,
    process.env.PHONE_VALIDATION_API_KEY
  ].forEach(key => {
    if (!apiKeyPattern.test(key!)) {
      throw new Error('Invalid API key format');
    }
  });
};

// Validate environment variables on module load
validateEnvironmentVariables();

/**
 * Configuration for address validation service
 * Uses Melissa Data for comprehensive address verification
 */
export const addressValidationConfig: ValidationServiceConfig = {
  baseUrl: process.env.ADDRESS_VALIDATION_URL!,
  apiKey: process.env.ADDRESS_VALIDATION_API_KEY!,
  timeout: Number(process.env.VALIDATION_TIMEOUT_MS),
  retries: Number(process.env.VALIDATION_RETRIES),
  backoffMs: Number(process.env.VALIDATION_BACKOFF_MS)
};

/**
 * Configuration for email validation service
 * Uses email verification service for deliverability checks
 */
export const emailValidationConfig: ValidationServiceConfig = {
  baseUrl: process.env.EMAIL_VALIDATION_URL!,
  apiKey: process.env.EMAIL_VALIDATION_API_KEY!,
  timeout: Number(process.env.VALIDATION_TIMEOUT_MS),
  retries: Number(process.env.VALIDATION_RETRIES),
  backoffMs: Number(process.env.VALIDATION_BACKOFF_MS)
};

/**
 * Configuration for phone validation service
 * Uses phone verification service for number validation and carrier lookup
 */
export const phoneValidationConfig: ValidationServiceConfig = {
  baseUrl: process.env.PHONE_VALIDATION_URL!,
  apiKey: process.env.PHONE_VALIDATION_API_KEY!,
  timeout: Number(process.env.VALIDATION_TIMEOUT_MS),
  retries: Number(process.env.VALIDATION_RETRIES),
  backoffMs: Number(process.env.VALIDATION_BACKOFF_MS)
};

// Default validation service timeouts and retry settings
Object.freeze(addressValidationConfig);
Object.freeze(emailValidationConfig);
Object.freeze(phoneValidationConfig);