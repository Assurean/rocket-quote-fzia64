/// <reference types="vite/client" />

/**
 * Type definitions for environment variables used in the buyer portal application.
 * Ensures type safety and proper configuration across different deployment environments.
 */
interface ImportMetaEnv {
  /**
   * Base URL for the backend API services.
   * Must be a valid HTTPS URL in staging and production environments.
   * @example 'https://api.insureleads.com'
   */
  readonly VITE_API_URL: string;

  /**
   * Authentication service endpoint for OAuth 2.0 + JWT.
   * Must be a valid HTTPS URL in staging and production environments.
   * @example 'https://auth.insureleads.com'
   */
  readonly VITE_AUTH_URL: string;

  /**
   * Real-time bidding service endpoint for click wall integration.
   * Must be a valid HTTPS URL in staging and production environments.
   * @example 'https://rtb.insureleads.com'
   */
  readonly VITE_RTB_URL: string;

  /**
   * Analytics service endpoint for tracking and reporting.
   * Must be a valid HTTPS URL in staging and production environments.
   * @example 'https://analytics.insureleads.com'
   */
  readonly VITE_ANALYTICS_URL: string;

  /**
   * Current deployment environment.
   * Used for environment-specific configurations and feature flags.
   */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';

  /**
   * API version string for versioned API calls.
   * @example 'v1'
   */
  readonly VITE_API_VERSION: string;

  /**
   * Toggle for debug mode features and logging.
   * Should be false in production environment.
   */
  readonly VITE_ENABLE_DEBUG: boolean;
}

/**
 * Augment the ImportMeta interface to include our custom environment variables.
 * This provides proper TypeScript type checking when accessing import.meta.env
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}