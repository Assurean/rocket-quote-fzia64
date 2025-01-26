/**
 * @fileoverview Core validation service interfaces and types for the Multi-Vertical Insurance Lead Generation Platform.
 * Defines comprehensive contracts for address, email, phone number validation, and PII handling.
 * @version 1.0.0
 */

/**
 * Interface defining the structure for address validation data
 */
export interface IAddressInfo {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  unitNumber?: string;
}

/**
 * Enum defining validation error severity levels
 */
export enum ErrorSeverity {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

/**
 * Interface defining the structure of validation errors
 */
export interface IValidationError {
  field: string;
  code: string;
  message: string;
  severity: ErrorSeverity;
}

/**
 * Interface defining metadata for validation operations
 * Tracks performance metrics and caching information
 */
export interface IValidationMetadata {
  source: string;
  validationDuration: number; // in milliseconds
  cacheTTL: number; // in seconds
}

/**
 * Generic interface for validation operation results
 * @template T The type of the standardized value being validated
 */
export interface IValidationResult<T> {
  isValid: boolean;
  errors: IValidationError[];
  standardizedValue: T;
  metadata: IValidationMetadata;
  validatedAt: Date;
}

/**
 * Interface defining configuration for PII data validation
 * Includes security controls and compliance settings
 */
export interface IPIIValidationConfig {
  maskingRules: Record<string, string>;
  retentionPeriod: number; // in days
  auditingEnabled: boolean;
}

/**
 * Enum defining phone number types for carrier validation
 */
export enum PhoneType {
  MOBILE = 'MOBILE',
  LANDLINE = 'LANDLINE',
  VOIP = 'VOIP'
}

/**
 * Interface defining compliance tracking information
 */
export interface IComplianceInfo {
  tcpaStatus: boolean;
  ccpaStatus: boolean;
  lastComplianceCheck: Date;
}

/**
 * Interface defining carrier information for phone number validation
 * Includes compliance tracking and verification metadata
 */
export interface ICarrierInfo {
  carrierName: string;
  phoneType: PhoneType;
  isActive: boolean;
  tcpaCompliant: boolean;
  lastVerifiedAt: Date;
  complianceMetadata: IComplianceInfo;
}

/**
 * Type guard to check if a validation error is critical
 */
export function isCriticalError(error: IValidationError): boolean {
  return error.severity === ErrorSeverity.ERROR;
}

/**
 * Type guard to check if a phone number is mobile
 */
export function isMobilePhone(carrier: ICarrierInfo): boolean {
  return carrier.phoneType === PhoneType.MOBILE;
}

/**
 * Type alias for validation function signatures
 */
export type ValidationFn<T> = (value: T) => Promise<IValidationResult<T>>;

/**
 * Type alias for PII field names to enforce consistent handling
 */
export type PIIField = 'ssn' | 'dob' | 'driverLicense';

/**
 * Namespace containing validation-related constants
 */
export namespace ValidationConstants {
  export const CACHE_TTL = 3600; // 1 hour in seconds
  export const MAX_RETRIES = 3;
  export const TIMEOUT = 5000; // 5 seconds in milliseconds
  export const MIN_ADDRESS_LENGTH = 5;
  export const MAX_ADDRESS_LENGTH = 100;
  export const PHONE_REGEX = /^\+?1?\d{10}$/;
  export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
}