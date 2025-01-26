// External dependencies
// date-fns v2.30.0 - Core date manipulation utilities
import {
  format as dateFnsFormat,
  parse as dateFnsParse,
  isValid as dateFnsIsValid,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  addDays,
  addMonths,
  addYears,
  formatDistanceToNow,
  Locale
} from 'date-fns';

// date-fns-tz v2.0.0 - Timezone handling utilities
import {
  zonedTimeToUtc,
  utcToZonedTime,
  format as formatInTimeZone
} from 'date-fns-tz';

// Constants
export const DATE_FORMATS = {
  display: 'MM/dd/yyyy',
  api: 'yyyy-MM-dd',
  full: 'MM/dd/yyyy HH:mm:ss',
  iso: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
  relative: 'PPP',
  time: 'HH:mm:ss'
} as const;

export const TIME_PERIODS = {
  day: 'day',
  week: 'week',
  month: 'month',
  quarter: 'quarter',
  year: 'year'
} as const;

export const MIN_DATE = new Date('1900-01-01');
export const MAX_DATE = new Date('2100-12-31');

// Types
type TimePeriod = keyof typeof TIME_PERIODS;
type DateInput = Date | string | number;

interface DateFormatOptions {
  timezone?: string;
  locale?: Locale;
}

interface DateParseOptions {
  timezone?: string;
  strictParsing?: boolean;
}

interface DateValidationOptions {
  minDate?: Date;
  maxDate?: Date;
  timezone?: string;
}

interface DateRangeOptions {
  endDate?: Date;
  timezone?: string;
}

interface RelativeDateOptions {
  locale?: Locale;
  style?: 'long' | 'short';
}

// Utility Functions
const toDate = (date: DateInput): Date => {
  if (date instanceof Date) return date;
  if (typeof date === 'number') return new Date(date);
  return new Date(date);
};

/**
 * Formats a date into a standardized string representation with timezone and locale support
 * @param date - Date to format
 * @param format - Format string (from DATE_FORMATS or custom)
 * @param options - Optional timezone and locale settings
 * @returns Formatted date string
 * @throws Error if date is invalid
 */
export const formatDate = (
  date: DateInput,
  format: string = DATE_FORMATS.display,
  options: DateFormatOptions = {}
): string => {
  try {
    const dateObj = toDate(date);
    
    if (!dateFnsIsValid(dateObj)) {
      throw new Error('Invalid date provided');
    }

    const { timezone, locale } = options;
    
    if (timezone) {
      return formatInTimeZone(dateObj, timezone, format, { locale });
    }
    
    return dateFnsFormat(dateObj, format, { locale });
  } catch (error) {
    throw new Error(`Error formatting date: ${error.message}`);
  }
};

/**
 * Parses a date string into a Date object with enhanced validation
 * @param dateString - String to parse
 * @param format - Expected format of the date string
 * @param options - Parse options including timezone and strict mode
 * @returns Parsed Date object
 * @throws Error if parsing fails or date is invalid
 */
export const parseDate = (
  dateString: string,
  format: string = DATE_FORMATS.display,
  options: DateParseOptions = {}
): Date => {
  try {
    const { timezone, strictParsing = true } = options;
    
    const parsedDate = dateFnsParse(dateString, format, new Date(), {
      strict: strictParsing
    });

    if (!dateFnsIsValid(parsedDate)) {
      throw new Error('Invalid date string format');
    }

    if (timezone) {
      return zonedTimeToUtc(parsedDate, timezone);
    }

    return parsedDate;
  } catch (error) {
    throw new Error(`Error parsing date: ${error.message}`);
  }
};

/**
 * Validates if a date is valid and within acceptable range
 * @param date - Date to validate
 * @param options - Validation options including min/max dates and timezone
 * @returns Boolean indicating if date is valid
 */
export const isValidDate = (
  date: DateInput,
  options: DateValidationOptions = {}
): boolean => {
  try {
    const dateObj = toDate(date);
    const {
      minDate = MIN_DATE,
      maxDate = MAX_DATE,
      timezone
    } = options;

    if (!dateFnsIsValid(dateObj)) return false;

    const dateToCheck = timezone ? utcToZonedTime(dateObj, timezone) : dateObj;

    return dateToCheck >= minDate && dateToCheck <= maxDate;
  } catch {
    return false;
  }
};

/**
 * Gets start and end dates for a specified time period
 * @param period - Time period to calculate range for
 * @param options - Range options including end date and timezone
 * @returns Object containing start date, end date and duration
 */
export const getDateRange = (
  period: TimePeriod,
  options: DateRangeOptions = {}
): { start: Date; end: Date; duration: number } => {
  try {
    const { endDate = new Date(), timezone } = options;
    const end = timezone ? utcToZonedTime(endDate, timezone) : endDate;
    let start: Date;

    switch (period) {
      case 'day':
        start = addDays(end, -1);
        break;
      case 'week':
        start = addDays(end, -7);
        break;
      case 'month':
        start = addMonths(end, -1);
        break;
      case 'quarter':
        start = addMonths(end, -3);
        break;
      case 'year':
        start = addYears(end, -1);
        break;
      default:
        throw new Error('Invalid time period');
    }

    const duration = differenceInDays(end, start);
    return { start, end, duration };
  } catch (error) {
    throw new Error(`Error calculating date range: ${error.message}`);
  }
};

/**
 * Formats a date relative to current time with locale support
 * @param date - Date to format
 * @param options - Formatting options including locale and style
 * @returns Localized relative date string
 */
export const formatRelativeDate = (
  date: DateInput,
  options: RelativeDateOptions = {}
): string => {
  try {
    const dateObj = toDate(date);
    const { locale, style = 'long' } = options;

    if (!dateFnsIsValid(dateObj)) {
      throw new Error('Invalid date provided');
    }

    return formatDistanceToNow(dateObj, {
      locale,
      addSuffix: true,
      includeSeconds: style === 'long'
    });
  } catch (error) {
    throw new Error(`Error formatting relative date: ${error.message}`);
  }
};