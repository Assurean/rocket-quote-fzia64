/// <reference types="vite/client" />

/**
 * Type declaration for Vite environment variables used throughout the consumer application.
 * @version Vite 4.0.0
 */
interface ImportMetaEnv {
  /**
   * Base URL for the API endpoints
   */
  readonly VITE_API_URL: string;

  /**
   * Endpoint for Real-Time Bidding (RTB) service
   */
  readonly VITE_RTB_ENDPOINT: string;

  /**
   * Analytics service API key
   */
  readonly VITE_ANALYTICS_KEY: string;

  /**
   * Current deployment environment
   */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';

  /**
   * Lead service endpoint URL
   */
  readonly VITE_LEAD_SERVICE_URL: string;

  /**
   * Validation service endpoint URL
   */
  readonly VITE_VALIDATION_SERVICE_URL: string;

  /**
   * Machine Learning service endpoint URL
   */
  readonly VITE_ML_SERVICE_URL: string;

  /**
   * Maximum number of form steps in the lead generation flow
   */
  readonly VITE_MAX_FORM_STEPS: number;

  /**
   * Feature flag for cross-sell functionality
   */
  readonly VITE_ENABLE_CROSS_SELL: boolean;

  /**
   * Session timeout duration in milliseconds
   */
  readonly VITE_SESSION_TIMEOUT: number;
}

/**
 * Type extension for Vite's ImportMeta interface to include strongly-typed environment variables
 * Ensures type safety when accessing import.meta.env throughout the application
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}