// External imports with versions
import { isEmail, isMobilePhone, isPostalCode, escape } from 'validator'; // v13.9.0
import DOMPurify from 'dompurify'; // v3.0.6

// Interfaces
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  securityLevel: ValidationSecurityLevel;
  metadata: ValidationMetadata;
}

export interface ValidationError {
  code: string;
  message: string;
  field: string;
  severity: ErrorSeverity;
  suggestions: string[];
}

interface ValidationWarning {
  code: string;
  message: string;
  field: string;
  impact: string;
}

interface ValidationMetadata {
  timestamp: Date;
  validationDuration: number;
  rulesApplied: string[];
  dataClassification: string;
}

type ValidationSecurityLevel = 'high' | 'medium' | 'low';
type ErrorSeverity = 'critical' | 'error' | 'warning';

interface ValidationOptions {
  strictMode?: boolean;
  validatePII?: boolean;
  securityLevel?: ValidationSecurityLevel;
}

interface ContactInfo {
  fullName: string;
  email: string;
  phone: string;
  zipCode: string;
  state?: string;
}

interface InsuranceInfo {
  vertical: string;
  coverage: string;
  [key: string]: any;
}

// Constants
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const PHONE_REGEX = /^\+?1?\s*\(?(\d{3})\)?[-. ]?(\d{3})[-. ]?(\d{4})$/;
const ZIP_CODE_REGEX = /^\d{5}(-\d{4})?$/;
const STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const SECURITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

const ERROR_MESSAGES = {
  INVALID_NAME: 'Please enter a valid full name',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid US phone number',
  INVALID_ZIP: 'Please enter a valid US ZIP code',
  INVALID_STATE: 'Please enter a valid US state code',
  PII_VALIDATION_FAILED: 'Personal information validation failed',
  REQUIRED_FIELD: 'This field is required',
  INVALID_FORMAT: 'Invalid format detected',
  SECURITY_CHECK_FAILED: 'Security validation failed'
};

// Validation Rules
const VALIDATION_RULES = {
  fullName: [
    {
      test: (value: string) => value.length >= NAME_MIN_LENGTH && value.length <= NAME_MAX_LENGTH,
      message: ERROR_MESSAGES.INVALID_NAME,
      severity: 'error' as ErrorSeverity
    },
    {
      test: (value: string) => /^[a-zA-Z\s'-]+$/.test(value),
      message: 'Name contains invalid characters',
      severity: 'error' as ErrorSeverity
    }
  ],
  email: [
    {
      test: (value: string) => isEmail(value),
      message: ERROR_MESSAGES.INVALID_EMAIL,
      severity: 'error' as ErrorSeverity
    }
  ],
  phone: [
    {
      test: (value: string) => PHONE_REGEX.test(value),
      message: ERROR_MESSAGES.INVALID_PHONE,
      severity: 'error' as ErrorSeverity
    }
  ],
  zipCode: [
    {
      test: (value: string) => ZIP_CODE_REGEX.test(value),
      message: ERROR_MESSAGES.INVALID_ZIP,
      severity: 'error' as ErrorSeverity
    }
  ]
};

// Helper Functions
const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(escape(input.trim()));
};

const validateField = (field: string, value: string, rules: any[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  for (const rule of rules) {
    if (!rule.test(value)) {
      errors.push({
        code: `INVALID_${field.toUpperCase()}`,
        message: rule.message,
        field,
        severity: rule.severity,
        suggestions: rule.suggestions || []
      });
    }
  }
  
  return errors;
};

// Main Validation Functions
export const validateContactInfo = (
  contactInfo: ContactInfo,
  options: ValidationOptions = {}
): ValidationResult => {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Sanitize inputs
  const sanitizedInfo = {
    fullName: sanitizeInput(contactInfo.fullName),
    email: sanitizeInput(contactInfo.email),
    phone: sanitizeInput(contactInfo.phone),
    zipCode: sanitizeInput(contactInfo.zipCode),
    state: contactInfo.state ? sanitizeInput(contactInfo.state) : undefined
  };

  // Validate each field
  errors.push(...validateField('fullName', sanitizedInfo.fullName, VALIDATION_RULES.fullName));
  errors.push(...validateField('email', sanitizedInfo.email, VALIDATION_RULES.email));
  errors.push(...validateField('phone', sanitizedInfo.phone, VALIDATION_RULES.phone));
  errors.push(...validateField('zipCode', sanitizedInfo.zipCode, VALIDATION_RULES.zipCode));

  // State validation if provided
  if (sanitizedInfo.state && !STATE_CODES.includes(sanitizedInfo.state.toUpperCase())) {
    errors.push({
      code: 'INVALID_STATE',
      message: ERROR_MESSAGES.INVALID_STATE,
      field: 'state',
      severity: 'error',
      suggestions: ['Please enter a valid two-letter state code']
    });
  }

  // Enhanced PII validation for high security level
  if (options.validatePII || options.securityLevel === SECURITY_LEVELS.HIGH) {
    const piiValidation = validatePIIFields(sanitizedInfo);
    errors.push(...piiValidation.errors);
    warnings.push(...piiValidation.warnings);
  }

  const validationDuration = Date.now() - startTime;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    securityLevel: options.securityLevel || SECURITY_LEVELS.MEDIUM,
    metadata: {
      timestamp: new Date(),
      validationDuration,
      rulesApplied: Object.keys(VALIDATION_RULES),
      dataClassification: 'PII'
    }
  };
};

export const validateInsuranceInfo = (
  insuranceInfo: InsuranceInfo,
  vertical: string,
  options: ValidationOptions = {}
): ValidationResult => {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate vertical-specific fields
  switch (vertical.toLowerCase()) {
    case 'auto':
      errors.push(...validateAutoInsurance(insuranceInfo));
      break;
    case 'home':
      errors.push(...validateHomeInsurance(insuranceInfo));
      break;
    case 'health':
      errors.push(...validateHealthInsurance(insuranceInfo));
      break;
    case 'life':
      errors.push(...validateLifeInsurance(insuranceInfo));
      break;
    default:
      errors.push({
        code: 'INVALID_VERTICAL',
        message: 'Invalid insurance vertical',
        field: 'vertical',
        severity: 'critical',
        suggestions: ['Please select a valid insurance type']
      });
  }

  const validationDuration = Date.now() - startTime;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    securityLevel: options.securityLevel || SECURITY_LEVELS.MEDIUM,
    metadata: {
      timestamp: new Date(),
      validationDuration,
      rulesApplied: [`${vertical.toLowerCase()}_rules`],
      dataClassification: 'INSURANCE_INFO'
    }
  };
};

// Private helper functions for vertical-specific validation
const validatePIIFields = (info: ContactInfo): { errors: ValidationError[], warnings: ValidationWarning[] } => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Add PII-specific validation logic here
  // This is a simplified example
  if (info.email.includes(info.fullName.toLowerCase())) {
    warnings.push({
      code: 'PII_EMAIL_WARNING',
      message: 'Email contains parts of full name',
      field: 'email',
      impact: 'medium'
    });
  }

  return { errors, warnings };
};

const validateAutoInsurance = (info: InsuranceInfo): ValidationError[] => {
  const errors: ValidationError[] = [];
  // Add auto insurance specific validation
  return errors;
};

const validateHomeInsurance = (info: InsuranceInfo): ValidationError[] => {
  const errors: ValidationError[] = [];
  // Add home insurance specific validation
  return errors;
};

const validateHealthInsurance = (info: InsuranceInfo): ValidationError[] => {
  const errors: ValidationError[] = [];
  // Add health insurance specific validation
  return errors;
};

const validateLifeInsurance = (info: InsuranceInfo): ValidationError[] => {
  const errors: ValidationError[] = [];
  // Add life insurance specific validation
  return errors;
};