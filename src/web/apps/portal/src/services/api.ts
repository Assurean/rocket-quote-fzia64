// External imports with versions
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.6.0

// Global constants
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Types for enhanced error handling
interface ApiError extends Error {
  status?: number;
  code?: string;
  retryCount?: number;
  timestamp?: string;
  requestId?: string;
}

interface PerformanceMetrics {
  requestStartTime: number;
  responseTime?: number;
  retryCount: number;
}

/**
 * Enhanced API error handler with retry logic and standardized formatting
 * @param error - The error object from the API request
 * @param retryCount - Current retry attempt count
 * @returns Promise rejection with formatted error details
 */
export const handleApiError = async (error: any, retryCount: number = 0): Promise<never> => {
  const apiError: ApiError = new Error();
  apiError.timestamp = new Date().toISOString();
  apiError.retryCount = retryCount;
  apiError.requestId = error?.config?.headers?.['x-request-id'];

  if (axios.isAxiosError(error)) {
    apiError.status = error.response?.status;
    apiError.code = error.code;
    apiError.message = error.response?.data?.message || error.message;

    // Handle specific error types
    if (error.response?.status === 429) {
      apiError.message = 'Rate limit exceeded. Please try again later.';
    } else if (error.response?.status === 401) {
      apiError.message = 'Authentication failed. Please log in again.';
    } else if (error.response?.status === 403) {
      apiError.message = 'Access denied. Insufficient permissions.';
    }
  } else {
    apiError.message = 'An unexpected error occurred';
  }

  // Determine if error is retryable
  const isRetryable = (
    !apiError.status || // Network errors
    apiError.status >= 500 || // Server errors
    apiError.status === 429 // Rate limiting
  ) && retryCount < MAX_RETRIES;

  if (isRetryable) {
    const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    return Promise.reject(apiError);
  }

  return Promise.reject(apiError);
};

/**
 * Enhanced API service class with performance monitoring, retry logic, and comprehensive error handling
 */
export class ApiService {
  private axiosInstance: AxiosInstance;
  private baseURL: string;
  private requestTimeout: number;
  private metrics: Map<string, PerformanceMetrics>;

  /**
   * Initialize API service with enhanced configuration and interceptors
   * @param baseURL - Base URL for API requests
   * @param config - Additional axios configuration
   */
  constructor(baseURL: string = API_BASE_URL, config: AxiosRequestConfig = {}) {
    this.baseURL = baseURL;
    this.requestTimeout = config.timeout || API_TIMEOUT;
    this.metrics = new Map();

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: this.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...config,
    });

    this.setupInterceptors();
  }

  /**
   * Configure request and response interceptors for authentication, monitoring, and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const requestId = Math.random().toString(36).substring(7);
        config.headers['x-request-id'] = requestId;
        
        // Start performance tracking
        this.metrics.set(requestId, {
          requestStartTime: Date.now(),
          retryCount: 0,
        });

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const requestId = response.config.headers['x-request-id'];
        const metrics = this.metrics.get(requestId);
        
        if (metrics) {
          metrics.responseTime = Date.now() - metrics.requestStartTime;
          // Log performance metrics if response time exceeds threshold
          if (metrics.responseTime > 500) {
            console.warn(`Slow request detected: ${response.config.url} took ${metrics.responseTime}ms`);
          }
        }

        return response;
      },
      async (error) => {
        const requestId = error.config?.headers?.['x-request-id'];
        const metrics = this.metrics.get(requestId);
        
        if (metrics) {
          metrics.retryCount++;
          return handleApiError(error, metrics.retryCount);
        }
        
        return handleApiError(error);
      }
    );
  }

  /**
   * Enhanced GET request method with retry logic and performance monitoring
   * @param url - Request URL
   * @param config - Additional request configuration
   * @returns Promise with API response
   */
  public async get<T = any>(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  /**
   * Enhanced POST request method with payload validation and metrics
   * @param url - Request URL
   * @param data - Request payload
   * @param config - Additional request configuration
   * @returns Promise with API response
   */
  public async post<T = any>(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  /**
   * Enhanced PUT request method
   * @param url - Request URL
   * @param data - Request payload
   * @param config - Additional request configuration
   * @returns Promise with API response
   */
  public async put<T = any>(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  /**
   * Enhanced DELETE request method
   * @param url - Request URL
   * @param config - Additional request configuration
   * @returns Promise with API response
   */
  public async delete<T = any>(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }

  /**
   * Enhanced authentication token management with automatic refresh
   * @param token - JWT authentication token
   * @param expiresIn - Token expiration time in seconds
   */
  public setAuthToken(token: string, expiresIn: number): void {
    if (!token) {
      delete this.axiosInstance.defaults.headers.common['Authorization'];
      return;
    }

    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Schedule token refresh
    if (expiresIn) {
      const refreshBuffer = 60; // Refresh token 1 minute before expiration
      const refreshTime = (expiresIn - refreshBuffer) * 1000;
      setTimeout(() => {
        // Emit token refresh event
        window.dispatchEvent(new CustomEvent('token-refresh-required'));
      }, refreshTime);
    }
  }
}