// Intl library v1.2.0 - Internationalization support for number formatting
import 'intl';

// Constants for number formatting and validation
const USD_LOCALE = 'en-US';
const DEFAULT_DECIMALS = 2;
const MIN_LEAD_SCORE = 0;
const MAX_LEAD_SCORE = 1;
const DEFAULT_MIN_VALUE = 0;
const DEFAULT_MAX_VALUE = 1;

// Cache for NumberFormat instances to improve performance
const NUMBER_FORMAT_CACHE: Record<string, Intl.NumberFormat> = {};

/**
 * Gets or creates a cached NumberFormat instance
 * @param locale - Locale string for formatting
 * @param options - NumberFormat options
 * @returns Cached NumberFormat instance
 */
const getNumberFormatter = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const key = `${locale}-${JSON.stringify(options)}`;
  if (!NUMBER_FORMAT_CACHE[key]) {
    NUMBER_FORMAT_CACHE[key] = new Intl.NumberFormat(locale, options);
  }
  return NUMBER_FORMAT_CACHE[key];
};

/**
 * Validates if a value is a valid number
 * @param value - Value to validate
 * @returns True if value is a valid number
 */
export const isValidNumber = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[$,]/g, ''));
    return !isNaN(parsed) && isFinite(parsed);
  }
  
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

/**
 * Safely parses numeric strings with error handling
 * @param value - String to parse
 * @returns Parsed numeric value
 * @throws Error if value cannot be parsed
 */
export const parseNumericString = (value: string): number => {
  const cleanValue = value.replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleanValue);
  
  if (!isValidNumber(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  
  return parsed;
};

/**
 * Formats a number as USD currency
 * @param amount - Amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 * @throws Error if amount is invalid
 */
export const formatCurrency = (
  amount: number | string,
  options: { locale?: string; decimals?: number } = {}
): string => {
  if (!isValidNumber(amount)) {
    throw new Error(`Invalid currency amount: ${amount}`);
  }

  const value = typeof amount === 'string' ? parseNumericString(amount) : amount;
  const locale = options.locale || USD_LOCALE;
  const decimals = options.decimals ?? DEFAULT_DECIMALS;

  const formatter = getNumberFormatter(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return formatter.format(value);
};

/**
 * Formats a decimal number as a percentage
 * @param value - Value to format
 * @param options - Formatting options
 * @returns Formatted percentage string
 * @throws Error if value is invalid or out of range
 */
export const formatPercentage = (
  value: number | string,
  options: { decimals?: number; minValue?: number; maxValue?: number } = {}
): string => {
  if (!isValidNumber(value)) {
    throw new Error(`Invalid percentage value: ${value}`);
  }

  const numValue = typeof value === 'string' ? parseNumericString(value) : value;
  const { decimals = DEFAULT_DECIMALS, minValue = DEFAULT_MIN_VALUE, maxValue = DEFAULT_MAX_VALUE } = options;

  if (numValue < minValue || numValue > maxValue) {
    throw new Error(`Percentage value out of range: ${numValue}. Expected between ${minValue} and ${maxValue}`);
  }

  const formatter = getNumberFormatter(USD_LOCALE, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return formatter.format(numValue);
};

/**
 * Rounds a number to specified decimal places
 * @param value - Value to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 * @throws Error if value is invalid
 */
export const roundNumber = (value: number | string, decimals: number): number => {
  if (!isValidNumber(value)) {
    throw new Error(`Invalid number to round: ${value}`);
  }

  if (decimals < 0) {
    throw new Error(`Invalid decimal places: ${decimals}`);
  }

  const numValue = typeof value === 'string' ? parseNumericString(value) : value;
  const multiplier = Math.pow(10, decimals);
  return Math.round(numValue * multiplier) / multiplier;
};

/**
 * Formats ML lead score for display
 * @param score - Lead score to format
 * @param options - Formatting options
 * @returns Formatted score string
 * @throws Error if score is invalid or out of range
 */
export const formatLeadScore = (
  score: number | string,
  options: { showPercentage?: boolean; decimals?: number } = {}
): string => {
  if (!isValidNumber(score)) {
    throw new Error(`Invalid lead score: ${score}`);
  }

  const numScore = typeof score === 'string' ? parseNumericString(score) : score;
  
  if (numScore < MIN_LEAD_SCORE || numScore > MAX_LEAD_SCORE) {
    throw new Error(`Lead score out of range: ${numScore}. Expected between ${MIN_LEAD_SCORE} and ${MAX_LEAD_SCORE}`);
  }

  const { showPercentage = false, decimals = DEFAULT_DECIMALS } = options;
  const roundedScore = roundNumber(numScore, decimals);

  if (showPercentage) {
    return formatPercentage(roundedScore, { decimals });
  }

  return roundedScore.toFixed(decimals);
};