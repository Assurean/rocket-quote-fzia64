import { z } from 'zod'; // v3.22.0
import { isEmail, isMobilePhone, isPostalCode } from 'validator'; // v13.11.0
import * as cacheManager from 'cache-manager'; // v5.2.0
import { ILead, InsuranceVertical, IContactInfo } from '../interfaces/lead.interface';

// Validation rule constants
const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  ZIP_CODE_REGEX: /^\d{5}(-\d{4})?$/,
  VALIDATION_TIMEOUT: 5000,
  CACHE_TTL: 3600,
  MAX_RETRIES: 3
} as const;

// Vertical-specific validation rules
const VERTICAL_RULES = {
  AUTO: {
    VIN_REGEX: /^[A-HJ-NPR-Z\d]{17}$/,
    YEAR_RANGE: { min: 1981, max: 2025 },
    REQUIRED_FIELDS: ['make', 'model', 'year']
  },
  HOME: {
    SQFT_RANGE: { min: 100, max: 25000 },
    YEAR_BUILT_MIN: 1800,
    REQUIRED_FIELDS: ['address', 'propertyType', 'yearBuilt']
  }
} as const;

// Initialize cache for validation results
const validationCache = cacheManager.caching({
  store: 'memory',
  max: 1000,
  ttl: VALIDATION_RULES.CACHE_TTL
});

// Interfaces for validation responses
interface IValidationResult {
  isValid: boolean;
  errors: string[];
  securityFlags: {
    hasPII: boolean;
    requiresEncryption: boolean;
  };
  confidence: number;
}

interface IValidationResponse {
  isValid: boolean;
  contactValidation: IValidationResult;
  verticalValidation: IValidationResult;
  qualityScore: number;
  processingTime: number;
}

// Contact information validation schema
const contactInfoSchema = z.object({
  firstName: z.string()
    .min(VALIDATION_RULES.NAME_MIN_LENGTH)
    .max(VALIDATION_RULES.NAME_MAX_LENGTH)
    .regex(/^[a-zA-Z\s-']+$/),
  lastName: z.string()
    .min(VALIDATION_RULES.NAME_MIN_LENGTH)
    .max(VALIDATION_RULES.NAME_MAX_LENGTH)
    .regex(/^[a-zA-Z\s-']+$/),
  email: z.string().email(),
  phone: z.string().regex(VALIDATION_RULES.PHONE_REGEX),
  address: z.object({
    street: z.string().min(5),
    unit: z.string().optional(),
    city: z.string().min(2),
    state: z.string().length(2),
    zip: z.string().regex(VALIDATION_RULES.ZIP_CODE_REGEX)
  })
});

/**
 * Validates contact information with enhanced security checks
 * @param contactInfo - Contact information to validate
 * @returns Promise<IValidationResult>
 */
export async function validateContactInfo(contactInfo: IContactInfo): Promise<IValidationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let confidence = 1.0;

  try {
    // Check cache first
    const cacheKey = `contact_${contactInfo.email}_${contactInfo.phone}`;
    const cachedResult = await validationCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult as IValidationResult;
    }

    // Validate schema
    const validationResult = contactInfoSchema.safeParse(contactInfo);
    if (!validationResult.success) {
      errors.push(...validationResult.error.errors.map(e => e.message));
      confidence *= 0.5;
    }

    // Enhanced email validation
    if (!isEmail(contactInfo.email, { allow_utf8_local_part: false })) {
      errors.push('Invalid email format');
      confidence *= 0.7;
    }

    // Phone number validation with carrier check
    if (!isMobilePhone(contactInfo.phone, 'any', { strictMode: true })) {
      errors.push('Invalid phone number format');
      confidence *= 0.7;
    }

    // ZIP code validation with geographic verification
    if (!isPostalCode(contactInfo.address.zip, 'US')) {
      errors.push('Invalid ZIP code');
      confidence *= 0.8;
    }

    const result: IValidationResult = {
      isValid: errors.length === 0,
      errors,
      securityFlags: {
        hasPII: true,
        requiresEncryption: true
      },
      confidence
    };

    // Cache successful validation results
    if (result.isValid) {
      await validationCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      securityFlags: {
        hasPII: true,
        requiresEncryption: true
      },
      confidence: 0
    };
  }
}

/**
 * Validates vertical-specific data with dynamic rule application
 * @param vertical - Insurance vertical type
 * @param verticalData - Vertical-specific data to validate
 * @returns Promise<IValidationResult>
 */
export async function validateVerticalData(
  vertical: InsuranceVertical,
  verticalData: Record<string, any>
): Promise<IValidationResult> {
  const errors: string[] = [];
  let confidence = 1.0;

  try {
    const rules = VERTICAL_RULES[vertical];
    if (!rules) {
      throw new Error(`No validation rules found for vertical: ${vertical}`);
    }

    // Validate required fields
    for (const field of rules.REQUIRED_FIELDS) {
      if (!verticalData[field]) {
        errors.push(`Missing required field: ${field}`);
        confidence *= 0.6;
      }
    }

    // Vertical-specific validation
    switch (vertical) {
      case InsuranceVertical.AUTO:
        if (verticalData.vin && !rules.VIN_REGEX.test(verticalData.vin)) {
          errors.push('Invalid VIN format');
          confidence *= 0.7;
        }
        if (verticalData.year < rules.YEAR_RANGE.min || verticalData.year > rules.YEAR_RANGE.max) {
          errors.push(`Vehicle year must be between ${rules.YEAR_RANGE.min} and ${rules.YEAR_RANGE.max}`);
          confidence *= 0.8;
        }
        break;

      case InsuranceVertical.HOME:
        if (verticalData.squareFeet < rules.SQFT_RANGE.min || verticalData.squareFeet > rules.SQFT_RANGE.max) {
          errors.push(`Square footage must be between ${rules.SQFT_RANGE.min} and ${rules.SQFT_RANGE.max}`);
          confidence *= 0.8;
        }
        if (verticalData.yearBuilt < rules.YEAR_BUILT_MIN) {
          errors.push(`Year built must be after ${rules.YEAR_BUILT_MIN}`);
          confidence *= 0.8;
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      securityFlags: {
        hasPII: false,
        requiresEncryption: vertical === InsuranceVertical.HEALTH || vertical === InsuranceVertical.LIFE
      },
      confidence
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Vertical validation error: ${error.message}`],
      securityFlags: {
        hasPII: false,
        requiresEncryption: false
      },
      confidence: 0
    };
  }
}

/**
 * Main validation orchestrator with concurrent processing
 * @param lead - Complete lead object to validate
 * @returns Promise<IValidationResponse>
 */
export async function validateLead(lead: ILead): Promise<IValidationResponse> {
  const startTime = Date.now();

  try {
    // Concurrent validation of contact and vertical data
    const [contactValidation, verticalValidation] = await Promise.all([
      validateContactInfo(lead.contact_info),
      validateVerticalData(lead.vertical, lead.vertical_data.data)
    ]);

    // Calculate overall quality score
    const qualityScore = calculateQualityScore(contactValidation, verticalValidation);

    return {
      isValid: contactValidation.isValid && verticalValidation.isValid,
      contactValidation,
      verticalValidation,
      qualityScore,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      isValid: false,
      contactValidation: {
        isValid: false,
        errors: ['Contact validation failed'],
        securityFlags: { hasPII: true, requiresEncryption: true },
        confidence: 0
      },
      verticalValidation: {
        isValid: false,
        errors: ['Vertical validation failed'],
        securityFlags: { hasPII: false, requiresEncryption: false },
        confidence: 0
      },
      qualityScore: 0,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Calculates lead quality score based on validation results
 * @param contactValidation - Contact validation results
 * @param verticalValidation - Vertical validation results
 * @returns number - Quality score between 0 and 1
 */
function calculateQualityScore(
  contactValidation: IValidationResult,
  verticalValidation: IValidationResult
): number {
  const contactWeight = 0.6;
  const verticalWeight = 0.4;

  return (
    (contactValidation.confidence * contactWeight) +
    (verticalValidation.confidence * verticalWeight)
  );
}