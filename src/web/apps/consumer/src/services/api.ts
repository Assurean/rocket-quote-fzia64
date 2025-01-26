import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'; // ^1.6.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import { InsuranceVertical, ILead } from '../../backend/services/lead-service/src/interfaces/lead.interface';

// Constants for configuration
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIMEOUT = 30000;
const MAX_QUEUE_SIZE = 100;
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW_MS = 60000;

// Interface definitions
interface ApiConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  enableEncryption: boolean;
  securityOptions: {
    validateCerts: boolean;
    enablePIIEncryption: boolean;
    rateLimiting: boolean;
  };
  retryConfig: RetryConfig;
  circuitBreakerConfig: {
    threshold: number;
    timeout: number;
    resetTimeout: number;
  };
}

interface ApiError {
  code: string;
  message: string;
  details: Record<string, any>;
  requestId: string;
  timestamp: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  enableExponentialBackoff: boolean;
}

interface ValidationResponse {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  requestId: string;
}

interface LeadSubmissionResponse {
  leadId: string;
  status: string;
  validationResults: ValidationResponse;
  timestamp: number;
}

// Security utility class
class SecurityManager {
  constructor(private config: ApiConfig) {}

  encryptPII(data: any): any {
    if (!this.config.securityOptions.enablePIIEncryption) {
      return data;
    }

    const piiFields = ['ssn', 'driverLicense', 'dateOfBirth'];
    const encrypted = { ...data };

    piiFields.forEach(field => {
      if (encrypted[field]) {
        encrypted[field] = this.encryptField(encrypted[field]);
      }
    });

    return encrypted;
  }

  private encryptField(value: string): string {
    // Implementation would use proper encryption library
    return `encrypted:${value}`;
  }
}

// Retry handler class
class RetryHandler {
  constructor(private config: RetryConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    let delay = this.config.baseDelay;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (!this.shouldRetry(error)) {
          throw error;
        }
        await this.delay(delay);
        if (this.config.enableExponentialBackoff) {
          delay = Math.min(delay * 2, this.config.maxDelay);
        }
      }
    }

    throw lastError;
  }

  private shouldRetry(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      return status === 429 || status === 503 || status >= 500;
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main API Service class
export class ApiService {
  private client: AxiosInstance;
  private circuitBreaker: CircuitBreaker;
  private retryHandler: RetryHandler;
  private securityManager: SecurityManager;
  private rateLimit: {
    requests: number;
    windowStart: number;
  };

  constructor(private config: ApiConfig) {
    this.validateConfig();
    this.initializeClient();
    this.initializeCircuitBreaker();
    this.securityManager = new SecurityManager(config);
    this.retryHandler = new RetryHandler(config.retryConfig);
    this.rateLimit = {
      requests: 0,
      windowStart: Date.now()
    };
  }

  private validateConfig(): void {
    if (!this.config.baseURL) {
      throw new Error('API baseURL is required');
    }
  }

  private initializeClient(): void {
    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout || DEFAULT_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
        ...this.config.headers
      }
    });

    this.setupInterceptors();
  }

  private initializeCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker(async (operation: () => Promise<any>) => {
      return await operation();
    }, {
      timeout: this.config.circuitBreakerConfig.timeout,
      resetTimeout: this.config.circuitBreakerConfig.resetTimeout,
      errorThresholdPercentage: this.config.circuitBreakerConfig.threshold
    });
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        if (!this.checkRateLimit()) {
          throw new Error('Rate limit exceeded');
        }
        config.headers['X-Request-ID'] = this.generateRequestId();
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.rateLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.rateLimit = {
        requests: 1,
        windowStart: now
      };
      return true;
    }

    this.rateLimit.requests++;
    return this.rateLimit.requests <= RATE_LIMIT_REQUESTS;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleApiError(error: AxiosError): ApiError {
    const apiError: ApiError = {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      details: {},
      requestId: error.config?.headers?.['X-Request-ID'] as string || 'unknown',
      timestamp: Date.now()
    };

    if (error.response) {
      apiError.code = `HTTP_${error.response.status}`;
      apiError.message = error.response.data?.message || error.message;
      apiError.details = error.response.data;
    } else if (error.request) {
      apiError.code = 'NETWORK_ERROR';
      apiError.message = 'Network error occurred';
    }

    return apiError;
  }

  async submitLead(leadData: ILead): Promise<LeadSubmissionResponse> {
    const operation = async () => {
      const secureData = this.securityManager.encryptPII(leadData);
      
      const response = await this.client.post<LeadSubmissionResponse>(
        '/v1/leads',
        secureData
      );

      return response.data;
    };

    return await this.circuitBreaker.fire(() => 
      this.retryHandler.execute(operation)
    );
  }

  async validateLeadData(
    data: Partial<ILead>,
    vertical: InsuranceVertical
  ): Promise<ValidationResponse> {
    const operation = async () => {
      const response = await this.client.post<ValidationResponse>(
        '/v1/validation',
        {
          data: this.securityManager.encryptPII(data),
          vertical
        }
      );

      return response.data;
    };

    return await this.circuitBreaker.fire(() => 
      this.retryHandler.execute(operation)
    );
  }
}

export type {
  ApiConfig,
  ApiError,
  ValidationResponse,
  LeadSubmissionResponse
};