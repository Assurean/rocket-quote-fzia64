// validator v13.11.0 - Input validation utilities
import validator from 'validator';

// Import shared utilities
import { 
  formatPhoneNumber, 
  formatSSN, 
  sanitizeInput 
} from '../../packages/shared/src/utils/string';
import { 
  formatCurrency, 
  formatPercentage, 
  formatLeadScore 
} from '../../packages/shared/src/utils/number';
import { 
  formatDate, 
  parseDate, 
  DATE_FORMATS 
} from '../../packages/shared/src/utils/date';

// Constants for insurance verticals and formatting
export const INSURANCE_VERTICALS = {
  AUTO: 'auto',
  HOME: 'home',
  HEALTH: 'health',
  LIFE: 'life',
  RENTERS: 'renters',
  COMMERCIAL: 'commercial'
} as const;

export const COVERAGE_NOTATIONS = {
  THOUSAND: 'K',
  MILLION: 'M',
  BILLION: 'B'
} as const;

export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

export const POLICY_NUMBER_FORMATS = {
  AUTO: /^[A-Z]{2}-\d{6}$/,
  HOME: /^[A-Z]{2}-\d{7}$/,
  HEALTH: /^[A-Z]{3}-\d{8}$/,
  LIFE: /^[A-Z]{2}-\d{7}-[A-Z]$/,
  RENTERS: /^[A-Z]{2}-\d{6}$/,
  COMMERCIAL: /^[A-Z]{3}-\d{8}-[A-Z]{2}$/
} as const;

// Types
type InsuranceVertical = keyof typeof INSURANCE_VERTICALS;
type ValidationResult = { isValid: boolean; message?: string };

/**
 * Formats and validates Vehicle Identification Number (VIN)
 * @param vin - Input VIN string
 * @returns Formatted VIN string or error message
 */
export function formatVIN(vin: string): string {
  // Remove whitespace and convert to uppercase
  const cleanedVIN = vin.replace(/\s/g, '').toUpperCase();

  // Validate VIN format
  if (!VIN_REGEX.test(cleanedVIN)) {
    throw new Error('Invalid VIN format');
  }

  // Perform VIN checksum validation
  const vinDigits = cleanedVIN.split('');
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const values: { [key: string]: number } = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
  };

  const checksum = vinDigits.reduce((sum, char, index) => {
    const value = values[char] || parseInt(char, 10);
    return sum + value * weights[index];
  }, 0) % 11;

  if (checksum !== (vinDigits[8] === 'X' ? 10 : parseInt(vinDigits[8], 10))) {
    throw new Error('Invalid VIN checksum');
  }

  // Log validation for security audit
  console.info('VIN validation successful', { timestamp: new Date().toISOString() });

  return cleanedVIN;
}

/**
 * Formats insurance policy numbers with vertical-specific validation
 * @param policyNumber - Input policy number
 * @param vertical - Insurance vertical
 * @param state - US state code
 * @returns Formatted policy number
 */
export function formatPolicyNumber(
  policyNumber: string,
  vertical: InsuranceVertical,
  state: string
): string {
  // Remove whitespace and special characters
  const cleaned = policyNumber.replace(/[^\w-]/g, '').toUpperCase();

  // Validate against vertical-specific format
  const format = POLICY_NUMBER_FORMATS[vertical];
  if (!format.test(cleaned)) {
    throw new Error(`Invalid policy number format for ${vertical} vertical`);
  }

  // Apply state-specific prefix if needed
  const statePrefix = state.toUpperCase();
  if (!cleaned.startsWith(statePrefix)) {
    return `${statePrefix}-${cleaned}`;
  }

  return cleaned;
}

/**
 * Formats insurance coverage amounts with enhanced notation
 * @param amount - Coverage amount
 * @param vertical - Insurance vertical
 * @param state - US state code
 * @returns Formatted coverage amount
 */
export function formatCoverageAmount(
  amount: number,
  vertical: InsuranceVertical,
  state: string
): string {
  // Validate amount range
  if (amount < 0) {
    throw new Error('Coverage amount cannot be negative');
  }

  // Apply state-specific minimum requirements
  const stateMinimums: { [key: string]: number } = {
    AUTO: 25000,
    HOME: 100000,
    LIFE: 50000
  };

  const minimum = stateMinimums[vertical] || 0;
  if (amount < minimum) {
    throw new Error(`Coverage amount below state minimum of ${formatCurrency(minimum)}`);
  }

  // Format with K/M/B notation for large numbers
  if (amount >= 1e9) {
    return `${(amount / 1e9).toFixed(1)}${COVERAGE_NOTATIONS.BILLION}`;
  } else if (amount >= 1e6) {
    return `${(amount / 1e6).toFixed(1)}${COVERAGE_NOTATIONS.MILLION}`;
  } else if (amount >= 1e3) {
    return `${(amount / 1e3).toFixed(1)}${COVERAGE_NOTATIONS.THOUSAND}`;
  }

  return formatCurrency(amount);
}

/**
 * Formats insurance deductible amounts with vertical-specific rules
 * @param amount - Deductible amount
 * @param vertical - Insurance vertical
 * @param state - US state code
 * @returns Formatted deductible amount
 */
export function formatDeductible(
  amount: number,
  vertical: InsuranceVertical,
  state: string
): string {
  // Validate deductible range
  if (amount < 0) {
    throw new Error('Deductible amount cannot be negative');
  }

  // Apply vertical-specific validation
  const maxDeductibles: { [key: string]: number } = {
    AUTO: 2500,
    HOME: 5000,
    HEALTH: 7500
  };

  const maxAmount = maxDeductibles[vertical] || Infinity;
  if (amount > maxAmount) {
    throw new Error(`Deductible exceeds maximum of ${formatCurrency(maxAmount)} for ${vertical}`);
  }

  // Format amount with currency symbol
  const formatted = formatCurrency(amount);

  // Add vertical-specific suffix
  const suffixes: { [key: string]: string } = {
    HEALTH: ' per year',
    AUTO: ' per incident',
    HOME: ' per claim'
  };

  return `${formatted}${suffixes[vertical] || ''}`;
}