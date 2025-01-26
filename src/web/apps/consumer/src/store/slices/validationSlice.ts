import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.7
import { ValidationService } from '../../services/validation'; // Internal import

// Types and Interfaces
export type ValidationErrorType = 'CLIENT' | 'SERVER' | 'COMBINED' | 'SECURITY' | 'PII';
export type EncryptionLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type VerticalValidationStrategy = 'AUTO' | 'HOME' | 'HEALTH' | 'LIFE' | 'RENTERS' | 'COMMERCIAL';

export interface ValidationHistoryEntry {
  timestamp: number;
  fieldName: string;
  result: boolean;
  errorType: ValidationErrorType;
  retryCount: number;
  securityLevel: EncryptionLevel;
}

export interface SecurityMetadata {
  piiFields: string[];
  encryptionLevel: EncryptionLevel;
  lastSecurityUpdate: number;
  validationAttempts: number;
}

export interface IValidationState {
  fieldErrors: Record<string, string>;
  sectionErrors: Record<string, string[]>;
  isValidating: boolean;
  validatedFields: string[];
  validatedSections: string[];
  lastValidated: number;
  validationHistory: ValidationHistoryEntry[];
  securityMetadata: SecurityMetadata;
  validationStrategy: VerticalValidationStrategy;
}

// Constants
const defaultSecurityMetadata: SecurityMetadata = {
  piiFields: [],
  encryptionLevel: 'HIGH',
  lastSecurityUpdate: Date.now(),
  validationAttempts: 0
};

// Initial State
const initialState: IValidationState = {
  fieldErrors: {},
  sectionErrors: {},
  isValidating: false,
  validatedFields: [],
  validatedSections: [],
  lastValidated: 0,
  validationHistory: [],
  securityMetadata: defaultSecurityMetadata,
  validationStrategy: 'AUTO'
};

// Slice Definition
export const validationSlice = createSlice({
  name: 'validation',
  initialState,
  reducers: {
    setFieldError: (
      state,
      action: PayloadAction<{
        fieldName: string;
        errorMessage: string;
        securityLevel: EncryptionLevel;
      }>
    ) => {
      const { fieldName, errorMessage, securityLevel } = action.payload;
      
      // Update field errors
      state.fieldErrors[fieldName] = errorMessage;
      
      // Track validated fields
      if (!state.validatedFields.includes(fieldName)) {
        state.validatedFields.push(fieldName);
      }

      // Update validation history
      state.validationHistory.push({
        timestamp: Date.now(),
        fieldName,
        result: !errorMessage,
        errorType: 'CLIENT',
        retryCount: 0,
        securityLevel
      });

      // Update security metadata for PII fields
      if (securityLevel === 'HIGH') {
        state.securityMetadata.piiFields = [
          ...new Set([...state.securityMetadata.piiFields, fieldName])
        ];
        state.securityMetadata.lastSecurityUpdate = Date.now();
        state.securityMetadata.validationAttempts++;
      }

      state.lastValidated = Date.now();
    },

    setSectionError: (
      state,
      action: PayloadAction<{
        sectionName: string;
        errors: string[];
      }>
    ) => {
      const { sectionName, errors } = action.payload;
      
      state.sectionErrors[sectionName] = errors;
      
      if (!state.validatedSections.includes(sectionName)) {
        state.validatedSections.push(sectionName);
      }

      state.lastValidated = Date.now();
    },

    setValidationStrategy: (
      state,
      action: PayloadAction<{
        vertical: VerticalValidationStrategy;
        securityLevel: EncryptionLevel;
      }>
    ) => {
      const { vertical, securityLevel } = action.payload;
      
      state.validationStrategy = vertical;
      state.securityMetadata.encryptionLevel = securityLevel;
      
      // Reset validation state for new strategy
      state.fieldErrors = {};
      state.sectionErrors = {};
      state.validatedFields = [];
      state.validatedSections = [];
      state.lastValidated = Date.now();
    },

    startValidation: (state) => {
      state.isValidating = true;
    },

    endValidation: (state) => {
      state.isValidating = false;
      state.lastValidated = Date.now();
    },

    clearValidationErrors: (state) => {
      state.fieldErrors = {};
      state.sectionErrors = {};
      state.lastValidated = Date.now();
    },

    updateSecurityMetadata: (
      state,
      action: PayloadAction<Partial<SecurityMetadata>>
    ) => {
      state.securityMetadata = {
        ...state.securityMetadata,
        ...action.payload,
        lastSecurityUpdate: Date.now()
      };
    },

    addValidationHistoryEntry: (
      state,
      action: PayloadAction<Omit<ValidationHistoryEntry, 'timestamp'>>
    ) => {
      state.validationHistory.push({
        ...action.payload,
        timestamp: Date.now()
      });
    }
  }
});

// Selectors
export const selectFieldError = (state: { validation: IValidationState }, fieldName: string): string =>
  state.validation.fieldErrors[fieldName] || '';

export const selectSectionErrors = (state: { validation: IValidationState }, sectionName: string): string[] =>
  state.validation.sectionErrors[sectionName] || [];

export const selectIsValidating = (state: { validation: IValidationState }): boolean =>
  state.validation.isValidating;

export const selectValidationHistory = (state: { validation: IValidationState }): ValidationHistoryEntry[] =>
  state.validation.validationHistory;

export const selectSecurityMetadata = (state: { validation: IValidationState }): SecurityMetadata =>
  state.validation.securityMetadata;

export const selectValidationStrategy = (state: { validation: IValidationState }): VerticalValidationStrategy =>
  state.validation.validationStrategy;

export const selectIsFieldValidated = (state: { validation: IValidationState }, fieldName: string): boolean =>
  state.validation.validatedFields.includes(fieldName);

export const selectIsSectionValidated = (state: { validation: IValidationState }, sectionName: string): boolean =>
  state.validation.validatedSections.includes(sectionName);

// Actions
export const {
  setFieldError,
  setSectionError,
  setValidationStrategy,
  startValidation,
  endValidation,
  clearValidationErrors,
  updateSecurityMetadata,
  addValidationHistoryEntry
} = validationSlice.actions;

// Default export
export default validationSlice.reducer;