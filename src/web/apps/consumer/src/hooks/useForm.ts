import { useState, useEffect } from 'react'; // v18.2.0
import { useDispatch, useSelector } from 'react-redux'; // v8.1.0
import { debounce } from 'lodash'; // v4.17.21
import { validateField, validateSection, isPIIField } from './useValidation';
import { ApiService } from '../services/api';
import { formActions } from '../store/slices/formSlice';
import { InsuranceVertical } from '../../backend/services/lead-service/src/interfaces/lead.interface';

// Constants
const AUTO_SAVE_INTERVAL_MS = 30000;
const VALIDATION_DEBOUNCE_MS = 300;
const MAX_RETRY_ATTEMPTS = 3;

export const FORM_STEPS = {
  LANDING: 'landing',
  VERTICAL_SELECTION: 'vertical-selection',
  BASIC_INFO: 'basic-info',
  VERTICAL_SPECIFIC: 'vertical-specific',
  CROSS_SELL: 'cross-sell',
  THANK_YOU: 'thank-you'
} as const;

// Types
interface FormPerformanceMetrics {
  fieldUpdateTimes: Record<string, number>;
  validationTimes: Record<string, number>;
  autoSaveAttempts: number;
  lastAutoSave: number;
  totalValidationTime: number;
}

interface ValidationState {
  isValid: boolean;
  errors: string[];
  lastValidated: number;
}

interface UseFormReturn {
  formData: Record<string, any>;
  currentStep: string;
  isSubmitting: boolean;
  validationState: Record<string, ValidationState>;
  performanceMetrics: FormPerformanceMetrics;
  updateField: (fieldName: string, value: any) => Promise<void>;
  submitForm: () => Promise<boolean>;
  goToStep: (step: string) => void;
  resetForm: () => void;
}

/**
 * Enhanced custom hook for secure form state management with validation and performance tracking
 */
export const useForm = (vertical: InsuranceVertical): UseFormReturn => {
  const dispatch = useDispatch();
  
  // Redux state selectors
  const formData = useSelector((state: any) => state.form.formData);
  const currentStep = useSelector((state: any) => state.form.currentStep);
  const isSubmitting = useSelector((state: any) => state.form.isSubmitting);
  
  // Local state for performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState<FormPerformanceMetrics>({
    fieldUpdateTimes: {},
    validationTimes: {},
    autoSaveAttempts: 0,
    lastAutoSave: Date.now(),
    totalValidationTime: 0
  });

  // Initialize API service with security config
  const apiService = new ApiService({
    baseURL: process.env.API_BASE_URL || '',
    timeout: 30000,
    headers: {},
    enableEncryption: true,
    securityOptions: {
      validateCerts: true,
      enablePIIEncryption: true,
      rateLimiting: true
    },
    retryConfig: {
      maxRetries: MAX_RETRY_ATTEMPTS,
      baseDelay: 1000,
      maxDelay: 5000,
      enableExponentialBackoff: true
    },
    circuitBreakerConfig: {
      threshold: 5,
      timeout: 30000,
      resetTimeout: 30000
    }
  });

  // Debounced validation function
  const debouncedValidation = debounce(async (fieldName: string, value: any) => {
    const startTime = Date.now();
    const validationResult = await validateField(fieldName, value, vertical);
    
    setPerformanceMetrics(prev => ({
      ...prev,
      validationTimes: {
        ...prev.validationTimes,
        [fieldName]: Date.now() - startTime
      },
      totalValidationTime: prev.totalValidationTime + (Date.now() - startTime)
    }));

    dispatch(formActions.setValidationState({
      field: fieldName,
      status: {
        isValid: validationResult.isValid,
        errors: validationResult.errors.map(e => e.message)
      }
    }));
  }, VALIDATION_DEBOUNCE_MS);

  // Auto-save functionality
  useEffect(() => {
    const autoSaveInterval = setInterval(async () => {
      if (Object.keys(formData).length > 0) {
        try {
          await apiService.autoSaveLead({
            ...formData,
            vertical,
            lastUpdated: new Date()
          });

          setPerformanceMetrics(prev => ({
            ...prev,
            autoSaveAttempts: prev.autoSaveAttempts + 1,
            lastAutoSave: Date.now()
          }));
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearInterval(autoSaveInterval);
  }, [formData, vertical]);

  /**
   * Updates form field with validation and PII handling
   */
  const updateField = async (fieldName: string, value: any): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // Handle PII fields
      if (isPIIField(fieldName)) {
        value = await apiService.encryptPIIData(value);
      }

      // Update form data
      dispatch(formActions.updateFormData({
        field: fieldName,
        value,
        securityLevel: isPIIField(fieldName) ? 'pii' : 'normal'
      }));

      // Trigger validation
      await debouncedValidation(fieldName, value);

      // Update performance metrics
      setPerformanceMetrics(prev => ({
        ...prev,
        fieldUpdateTimes: {
          ...prev.fieldUpdateTimes,
          [fieldName]: Date.now() - startTime
        }
      }));
    } catch (error) {
      console.error('Field update failed:', error);
      throw error;
    }
  };

  /**
   * Submits form with validation and error handling
   */
  const submitForm = async (): Promise<boolean> => {
    dispatch(formActions.setSubmitting(true));
    
    try {
      // Validate all sections
      const validationResult = await validateSection(currentStep, formData);
      if (!validationResult.isValid) {
        throw new Error('Form validation failed');
      }

      // Submit lead
      const response = await apiService.submitLead({
        ...formData,
        vertical,
        submittedAt: new Date()
      });

      if (response.status === 'success') {
        dispatch(formActions.setStep(FORM_STEPS.THANK_YOU));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Form submission failed:', error);
      return false;
    } finally {
      dispatch(formActions.setSubmitting(false));
    }
  };

  /**
   * Navigation and reset handlers
   */
  const goToStep = (step: string): void => {
    dispatch(formActions.setStep(step));
  };

  const resetForm = (): void => {
    dispatch(formActions.resetForm());
    setPerformanceMetrics({
      fieldUpdateTimes: {},
      validationTimes: {},
      autoSaveAttempts: 0,
      lastAutoSave: Date.now(),
      totalValidationTime: 0
    });
  };

  return {
    formData,
    currentStep,
    isSubmitting,
    validationState: useSelector((state: any) => state.form.validationState),
    performanceMetrics,
    updateField,
    submitForm,
    goToStep,
    resetForm
  };
};

export default useForm;