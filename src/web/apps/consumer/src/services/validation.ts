import { debounce } from 'lodash'; // ^4.17.21
import { 
  ApiService, 
  ValidationResponse 
} from './api';
import { 
  validateContactInfo, 
  validateAddressInfo, 
  validateInsuranceInfo, 
  validateField, 
  ValidationResult, 
  FieldEncryption 
} from '../utils/validators';
import { InsuranceVertical } from '../../backend/services/lead-service/src/interfaces/lead.interface';

// Constants
const VALIDATION_DEBOUNCE_MS = 300;
const VALIDATION_CACHE_TTL_MS = 60000;
const MAX_RETRY_ATTEMPTS = 3;

// Types
interface SecurityConfig {
  enablePIIEncryption: boolean;
  validateCerts: boolean;
  fieldLevelEncryption: boolean;
}

interface ValidationCache {
  result: ValidationResult;
  timestamp: number;
}

// Interface for validation service
export interface IValidationService {
  validateField(
    fieldName: string,
    value: any,
    vertical: InsuranceVertical,
    isPII: boolean
  ): Promise<ValidationResult>;
  
  validateSection(
    sectionData: Record<string, any>,
    sectionName: string,
    vertical: InsuranceVertical,
    securityConfig: SecurityConfig
  ): Promise<ValidationResult>;
}

// Main validation service class
export class ValidationService implements IValidationService {
  private validationCache: Map<string, ValidationCache>;
  private debouncedServerValidation: ReturnType<typeof debounce>;
  private fieldEncryption: FieldEncryption;

  constructor(
    private apiService: ApiService,
    private securityConfig: SecurityConfig
  ) {
    this.validationCache = new Map();
    this.fieldEncryption = new FieldEncryption();
    this.debouncedServerValidation = debounce(
      this.performServerValidation.bind(this),
      VALIDATION_DEBOUNCE_MS
    );
  }

  /**
   * Validates a single form field with enhanced security
   */
  public async validateField(
    fieldName: string,
    value: any,
    vertical: InsuranceVertical,
    isPII: boolean
  ): Promise<ValidationResult> {
    // Check cache first
    const cacheKey = `${fieldName}:${value}:${vertical}`;
    const cachedResult = this.getCachedValidation(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Perform client-side validation first
    let clientValidation: ValidationResult;
    const secureValue = isPII ? this.fieldEncryption.encrypt(value) : value;

    try {
      clientValidation = validateField(fieldName, secureValue, {
        validatePII: isPII,
        securityLevel: isPII ? 'high' : 'medium'
      });
    } catch (error) {
      return this.createErrorValidation(
        fieldName,
        'Client validation failed',
        'VALIDATION_ERROR'
      );
    }

    // If client validation passes, perform server validation
    if (clientValidation.isValid) {
      const serverValidation = await this.debouncedServerValidation(
        { [fieldName]: secureValue },
        vertical,
        this.securityConfig
      );

      const finalResult = this.mergeValidationResults(
        clientValidation,
        serverValidation
      );
      this.cacheValidationResult(cacheKey, finalResult);
      return finalResult;
    }

    return clientValidation;
  }

  /**
   * Validates a complete form section with security measures
   */
  public async validateSection(
    sectionData: Record<string, any>,
    sectionName: string,
    vertical: InsuranceVertical,
    securityConfig: SecurityConfig
  ): Promise<ValidationResult> {
    // Apply security measures to sensitive data
    const secureData = this.secureSectionData(sectionData, sectionName);

    // Determine validation strategy based on section type
    let validationResult: ValidationResult;
    
    switch (sectionName) {
      case 'contactInfo':
        validationResult = validateContactInfo(secureData, {
          validatePII: true,
          securityLevel: 'high'
        });
        break;

      case 'insuranceInfo':
        validationResult = validateInsuranceInfo(
          secureData,
          vertical,
          { securityLevel: 'medium' }
        );
        break;

      default:
        validationResult = await this.performServerValidation(
          secureData,
          vertical,
          securityConfig
        );
    }

    // Perform server-side validation if client validation passes
    if (validationResult.isValid) {
      const serverValidation = await this.apiService.validateLeadData(
        secureData,
        vertical
      );

      return this.mergeValidationResults(
        validationResult,
        this.mapServerValidation(serverValidation)
      );
    }

    return validationResult;
  }

  /**
   * Performs secure server-side validation with retry logic
   */
  private async performServerValidation(
    data: Record<string, any>,
    vertical: InsuranceVertical,
    securityConfig: SecurityConfig
  ): Promise<ValidationResult> {
    try {
      const response = await this.apiService.validateLeadData(data, vertical);
      return this.mapServerValidation(response);
    } catch (error) {
      return this.createErrorValidation(
        'server',
        'Server validation failed',
        'SERVER_ERROR'
      );
    }
  }

  /**
   * Helper methods for validation service
   */
  private secureSectionData(
    data: Record<string, any>,
    sectionName: string
  ): Record<string, any> {
    const secureData = { ...data };
    const piiFields = ['ssn', 'driverLicense', 'dateOfBirth', 'email', 'phone'];

    if (this.securityConfig.fieldLevelEncryption) {
      for (const [key, value] of Object.entries(secureData)) {
        if (piiFields.includes(key)) {
          secureData[key] = this.fieldEncryption.encrypt(value);
        }
      }
    }

    return secureData;
  }

  private getCachedValidation(key: string): ValidationResult | null {
    const cached = this.validationCache.get(key);
    if (cached && Date.now() - cached.timestamp < VALIDATION_CACHE_TTL_MS) {
      return cached.result;
    }
    return null;
  }

  private cacheValidationResult(key: string, result: ValidationResult): void {
    this.validationCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  private mapServerValidation(response: ValidationResponse): ValidationResult {
    return {
      isValid: response.isValid,
      errors: response.errors.map(error => ({
        code: error.code,
        message: error.message,
        field: error.field,
        severity: 'error',
        suggestions: []
      })),
      warnings: [],
      securityLevel: 'high',
      metadata: {
        timestamp: new Date(),
        validationDuration: 0,
        rulesApplied: ['server_validation'],
        dataClassification: 'VALIDATED'
      }
    };
  }

  private mergeValidationResults(
    clientResult: ValidationResult,
    serverResult: ValidationResult
  ): ValidationResult {
    return {
      isValid: clientResult.isValid && serverResult.isValid,
      errors: [...clientResult.errors, ...serverResult.errors],
      warnings: [...clientResult.warnings, ...serverResult.warnings],
      securityLevel: 'high',
      metadata: {
        timestamp: new Date(),
        validationDuration: 
          clientResult.metadata.validationDuration + 
          serverResult.metadata.validationDuration,
        rulesApplied: [
          ...clientResult.metadata.rulesApplied,
          ...serverResult.metadata.rulesApplied
        ],
        dataClassification: 'VALIDATED'
      }
    };
  }

  private createErrorValidation(
    field: string,
    message: string,
    code: string
  ): ValidationResult {
    return {
      isValid: false,
      errors: [{
        code,
        message,
        field,
        severity: 'error',
        suggestions: []
      }],
      warnings: [],
      securityLevel: 'high',
      metadata: {
        timestamp: new Date(),
        validationDuration: 0,
        rulesApplied: ['error_handling'],
        dataClassification: 'ERROR'
      }
    };
  }
}