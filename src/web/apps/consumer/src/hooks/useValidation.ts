import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ValidationService } from '../services/validation';
import { 
  setFieldError, 
  setSectionError, 
  startValidation,
  endValidation,
  updateSecurityMetadata,
  addValidationHistoryEntry,
  selectFieldError,
  selectSectionErrors,
  selectValidationMetadata,
  ValidationErrorType,
  EncryptionLevel
} from '../store/slices/validationSlice';
import useDebounce from '@shared/hooks/useDebounce';

// Constants
const DEFAULT_DEBOUNCE_MS = 300;
const MAX_RETRY_ATTEMPTS = 3;
const VALIDATION_TIMEOUT_MS = 5000;
const PII_FIELD_TYPES = ['ssn', 'dob', 'dlNumber'];

// Types
export type ValidationPriority = 'high' | 'medium' | 'low';

interface ValidationPerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  attempts: number;
}

interface ValidationMetadata {
  lastValidated: Date;
  validationAttempts: number;
  validationType: ValidationErrorType;
  isPIIField: boolean;
  performanceMetrics: ValidationPerformanceMetrics;
}

interface ValidationHistory {
  fieldName: string;
  timestamp: Date;
  result: boolean;
  errorType: ValidationErrorType;
  securityLevel: EncryptionLevel;
}

interface UseValidationProps {
  vertical: string;
  debounceMs?: number;
  retryAttempts?: number;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  validationPriority?: ValidationPriority;
}

interface UseValidationReturn {
  validateField: (fieldName: string, value: any) => Promise<boolean>;
  validateSection: (sectionName: string, data: Record<string, any>) => Promise<boolean>;
  fieldError: string | null;
  sectionErrors: string[];
  isValidating: boolean;
  validationMetadata: ValidationMetadata;
  validationHistory: ValidationHistory[];
  resetValidation: () => void;
  isPIIField: (fieldName: string) => boolean;
}

/**
 * Custom hook for comprehensive form validation with security and performance optimizations
 */
export const useValidation = ({
  vertical,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  retryAttempts = MAX_RETRY_ATTEMPTS,
  validateOnBlur = true,
  validateOnChange = true,
  validationPriority = 'medium'
}: UseValidationProps): UseValidationReturn => {
  const dispatch = useDispatch();
  const [isValidating, setIsValidating] = useState(false);
  const [validationHistory, setValidationHistory] = useState<ValidationHistory[]>([]);
  const [currentField, setCurrentField] = useState<string>('');

  // Initialize validation service with security context
  const validationService = useMemo(() => new ValidationService({
    enablePIIEncryption: true,
    validateCerts: true,
    fieldLevelEncryption: true
  }), []);

  // Redux selectors
  const fieldError = useSelector((state) => selectFieldError(state, currentField));
  const sectionErrors = useSelector((state) => selectSectionErrors(state, currentField));
  const securityMetadata = useSelector(selectValidationMetadata);

  // Performance optimization with debouncing
  const debouncedValidation = useDebounce((value: any) => {
    if (currentField && value !== undefined) {
      return performValidation(currentField, value);
    }
    return Promise.resolve(true);
  }, debounceMs);

  /**
   * Validates a single field with security considerations
   */
  const validateField = useCallback(async (
    fieldName: string,
    value: any
  ): Promise<boolean> => {
    const startTime = Date.now();
    setCurrentField(fieldName);
    setIsValidating(true);
    dispatch(startValidation());

    try {
      const isPII = validationService.isPIIField(fieldName);
      const validationResult = await validationService.validateField(
        fieldName,
        value,
        vertical,
        isPII
      );

      // Update validation history
      const historyEntry: ValidationHistory = {
        fieldName,
        timestamp: new Date(),
        result: validationResult.isValid,
        errorType: isPII ? 'PII' : 'CLIENT',
        securityLevel: isPII ? 'HIGH' : 'MEDIUM'
      };
      setValidationHistory(prev => [...prev, historyEntry]);

      // Update Redux state
      dispatch(setFieldError({
        fieldName,
        errorMessage: validationResult.isValid ? '' : validationResult.errors[0]?.message,
        securityLevel: isPII ? 'HIGH' : 'MEDIUM'
      }));

      // Update security metadata for PII fields
      if (isPII) {
        dispatch(updateSecurityMetadata({
          piiFields: [...securityMetadata.piiFields, fieldName],
          validationAttempts: securityMetadata.validationAttempts + 1
        }));
      }

      return validationResult.isValid;
    } catch (error) {
      console.error('Field validation error:', error);
      dispatch(setFieldError({
        fieldName,
        errorMessage: 'Validation failed',
        securityLevel: 'HIGH'
      }));
      return false;
    } finally {
      const endTime = Date.now();
      setIsValidating(false);
      dispatch(endValidation());
      
      // Track performance metrics
      dispatch(addValidationHistoryEntry({
        fieldName,
        result: !fieldError,
        errorType: 'CLIENT',
        retryCount: 0,
        securityLevel: PII_FIELD_TYPES.includes(fieldName) ? 'HIGH' : 'MEDIUM'
      }));
    }
  }, [vertical, dispatch, validationService, securityMetadata, fieldError]);

  /**
   * Validates an entire form section with enhanced security
   */
  const validateSection = useCallback(async (
    sectionName: string,
    data: Record<string, any>
  ): Promise<boolean> => {
    setIsValidating(true);
    dispatch(startValidation());

    try {
      const validationResult = await validationService.validateSection(
        data,
        sectionName,
        vertical,
        {
          enablePIIEncryption: true,
          validateCerts: true,
          fieldLevelEncryption: true
        }
      );

      dispatch(setSectionError({
        sectionName,
        errors: validationResult.isValid ? [] : validationResult.errors.map(e => e.message)
      }));

      return validationResult.isValid;
    } catch (error) {
      console.error('Section validation error:', error);
      dispatch(setSectionError({
        sectionName,
        errors: ['Section validation failed']
      }));
      return false;
    } finally {
      setIsValidating(false);
      dispatch(endValidation());
    }
  }, [vertical, dispatch, validationService]);

  /**
   * Resets validation state
   */
  const resetValidation = useCallback(() => {
    setIsValidating(false);
    setValidationHistory([]);
    setCurrentField('');
    dispatch(endValidation());
  }, [dispatch]);

  /**
   * Checks if a field contains PII data
   */
  const isPIIField = useCallback((fieldName: string): boolean => {
    return PII_FIELD_TYPES.includes(fieldName) || validationService.isPIIField(fieldName);
  }, [validationService]);

  // Initialize validation metadata
  const validationMetadata: ValidationMetadata = {
    lastValidated: new Date(),
    validationAttempts: securityMetadata.validationAttempts,
    validationType: 'CLIENT',
    isPIIField: false,
    performanceMetrics: {
      startTime: 0,
      endTime: 0,
      duration: 0,
      attempts: 0
    }
  };

  return {
    validateField,
    validateSection,
    fieldError,
    sectionErrors,
    isValidating,
    validationMetadata,
    validationHistory,
    resetValidation,
    isPIIField
  };
};

export default useValidation;