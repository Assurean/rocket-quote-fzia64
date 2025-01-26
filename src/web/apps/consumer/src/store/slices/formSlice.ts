import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.7
import { ValidationService } from '../../services/validation';
import { ApiService } from '../../services/api';
import { InsuranceVertical, LeadStatus, ILead } from '../../backend/services/lead-service/src/interfaces/lead.interface';

// Types
interface ValidationStatus {
  isValid: boolean;
  errors: Array<{
    code: string;
    message: string;
    field: string;
    severity: 'critical' | 'error' | 'warning';
  }>;
}

interface CrossSellOpportunity {
  vertical: InsuranceVertical;
  score: number;
  reason: string;
}

interface PerformanceData {
  formStartTime: number;
  stepCompletionTimes: Record<string, number>;
  validationTimes: Record<string, number>;
  totalTimeSpent: number;
}

interface FormError {
  code: string;
  message: string;
  field?: string;
  timestamp: number;
}

// Constants
const FORM_STEPS = {
  LANDING: 'landing',
  VERTICAL_SELECTION: 'vertical-selection',
  BASIC_INFO: 'basic-info',
  VERTICAL_SPECIFIC: 'vertical-specific',
  CROSS_SELL: 'cross-sell',
  THANK_YOU: 'thank-you'
} as const;

const SECURITY_LEVELS = {
  PII: 'pii',
  SENSITIVE: 'sensitive',
  NORMAL: 'normal'
} as const;

const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const VALIDATION_DEBOUNCE = 300; // 300ms
const API_RETRY_CONFIG = {
  maxRetries: 3,
  backoffFactor: 1.5,
  initialDelay: 1000
};

// Initial State
interface FormState {
  currentVertical: InsuranceVertical | null;
  currentStep: string;
  formData: Record<string, any>;
  validationState: Record<string, ValidationStatus>;
  securityMetadata: Record<string, typeof SECURITY_LEVELS[keyof typeof SECURITY_LEVELS]>;
  crossSellOpportunities: CrossSellOpportunity[];
  performanceMetrics: PerformanceData;
  isSubmitting: boolean;
  lastSaved: number;
  errors: FormError[];
}

const initialState: FormState = {
  currentVertical: null,
  currentStep: FORM_STEPS.LANDING,
  formData: {},
  validationState: {},
  securityMetadata: {},
  crossSellOpportunities: [],
  performanceMetrics: {
    formStartTime: Date.now(),
    stepCompletionTimes: {},
    validationTimes: {},
    totalTimeSpent: 0
  },
  isSubmitting: false,
  lastSaved: 0,
  errors: []
};

// Create Slice
const formSlice = createSlice({
  name: 'form',
  initialState,
  reducers: {
    setVertical(state, action: PayloadAction<InsuranceVertical>) {
      state.currentVertical = action.payload;
      state.formData.vertical = action.payload;
    },

    setStep(state, action: PayloadAction<string>) {
      const now = Date.now();
      state.currentStep = action.payload;
      state.performanceMetrics.stepCompletionTimes[action.payload] = now;
      state.performanceMetrics.totalTimeSpent = now - state.performanceMetrics.formStartTime;
    },

    updateFormData(state, action: PayloadAction<{ field: string; value: any; securityLevel?: string }>) {
      const { field, value, securityLevel } = action.payload;
      state.formData[field] = value;
      if (securityLevel) {
        state.securityMetadata[field] = securityLevel as typeof SECURITY_LEVELS[keyof typeof SECURITY_LEVELS];
      }
    },

    setValidationState(state, action: PayloadAction<{ field: string; status: ValidationStatus }>) {
      const { field, status } = action.payload;
      state.validationState[field] = status;
      state.performanceMetrics.validationTimes[field] = Date.now();
    },

    updateCrossSellOpportunities(state, action: PayloadAction<CrossSellOpportunity[]>) {
      state.crossSellOpportunities = action.payload;
    },

    setSubmitting(state, action: PayloadAction<boolean>) {
      state.isSubmitting = action.payload;
    },

    setLastSaved(state, action: PayloadAction<number>) {
      state.lastSaved = action.payload;
    },

    addError(state, action: PayloadAction<Omit<FormError, 'timestamp'>>) {
      state.errors.push({
        ...action.payload,
        timestamp: Date.now()
      });
    },

    clearErrors(state) {
      state.errors = [];
    },

    resetForm(state) {
      return {
        ...initialState,
        performanceMetrics: {
          ...initialState.performanceMetrics,
          formStartTime: Date.now()
        }
      };
    }
  }
});

// Thunks
export const updateField = (field: string, value: any, securityLevel?: string) => async (dispatch: any, getState: any) => {
  const validationService = new ValidationService({
    enablePIIEncryption: true,
    validateCerts: true,
    fieldLevelEncryption: true
  });

  try {
    dispatch(formSlice.actions.updateFormData({ field, value, securityLevel }));

    const state = getState().form;
    const validationResult = await validationService.validateField(
      field,
      value,
      state.currentVertical as InsuranceVertical,
      securityLevel === SECURITY_LEVELS.PII
    );

    dispatch(formSlice.actions.setValidationState({ field, status: validationResult }));

    // Auto-save if enough time has passed
    if (Date.now() - state.lastSaved > AUTO_SAVE_INTERVAL) {
      dispatch(saveFormProgress());
    }
  } catch (error) {
    dispatch(formSlice.actions.addError({
      code: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Validation failed',
      field
    }));
  }
};

export const saveFormProgress = () => async (dispatch: any, getState: any) => {
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
    retryConfig: API_RETRY_CONFIG,
    circuitBreakerConfig: {
      threshold: 5,
      timeout: 30000,
      resetTimeout: 30000
    }
  });

  try {
    const state = getState().form;
    await apiService.savePartialLead({
      ...state.formData,
      status: LeadStatus.PARTIAL,
      created_at: new Date(state.performanceMetrics.formStartTime),
      updated_at: new Date()
    });

    dispatch(formSlice.actions.setLastSaved(Date.now()));
  } catch (error) {
    dispatch(formSlice.actions.addError({
      code: 'SAVE_ERROR',
      message: error instanceof Error ? error.message : 'Failed to save progress'
    }));
  }
};

export const submitForm = () => async (dispatch: any, getState: any) => {
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
    retryConfig: API_RETRY_CONFIG,
    circuitBreakerConfig: {
      threshold: 5,
      timeout: 30000,
      resetTimeout: 30000
    }
  });

  dispatch(formSlice.actions.setSubmitting(true));

  try {
    const state = getState().form;
    const leadData: ILead = {
      ...state.formData,
      status: LeadStatus.CREATED,
      created_at: new Date(state.performanceMetrics.formStartTime),
      updated_at: new Date(),
      validation_history: [{
        timestamp: new Date(),
        status: LeadStatus.CREATED
      }],
      encryption_status: {
        pii: true,
        sensitive: true
      }
    };

    const response = await apiService.submitLead(leadData);
    
    if (response.status === 'success') {
      dispatch(formSlice.actions.setStep(FORM_STEPS.THANK_YOU));
    } else {
      throw new Error('Lead submission failed');
    }
  } catch (error) {
    dispatch(formSlice.actions.addError({
      code: 'SUBMISSION_ERROR',
      message: error instanceof Error ? error.message : 'Form submission failed'
    }));
  } finally {
    dispatch(formSlice.actions.setSubmitting(false));
  }
};

export const { actions, reducer } = formSlice;
export default reducer;