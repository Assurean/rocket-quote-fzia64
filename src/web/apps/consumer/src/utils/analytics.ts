// External imports
import ReactGA from 'react-ga4'; // v2.1.0
import mixpanel from 'mixpanel-browser'; // v2.47.0
import { PrivacyService } from '@privacy/core'; // v1.0.0

// Internal imports
import { 
  calculateLeadAcceptanceRate, 
  calculateConversionMetrics,
  LeadMetrics,
  ConversionMetrics
} from '../../../packages/analytics/src/utils/metrics';

// Constants
const MIXPANEL_TOKEN = process.env.REACT_APP_MIXPANEL_TOKEN;
const GA_TRACKING_ID = process.env.REACT_APP_GA_TRACKING_ID;

// Interfaces
interface SessionData {
  sessionId: string;
  startTime: Date;
  deviceInfo: {
    type: string;
    os: string;
    browser: string;
  };
  trafficSource: string;
}

interface StepData {
  stepName: string;
  duration: number;
  isComplete: boolean;
  vertical?: string;
  formData?: Record<string, any>;
}

interface ValidationError {
  field: string;
  type: string;
  message: string;
}

// Initialize analytics services
const initializeAnalytics = (): void => {
  if (GA_TRACKING_ID) {
    ReactGA.initialize(GA_TRACKING_ID, {
      gaOptions: {
        siteSpeedSampleRate: 100,
        anonymizeIp: true
      }
    });
  }

  if (MIXPANEL_TOKEN) {
    mixpanel.init(MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV === 'development',
      persistence: 'localStorage',
      secure_cookie: true
    });
  }
};

// Initialize on module load
initializeAnalytics();

/**
 * Sanitizes data for tracking by removing PII and sensitive information
 * @param data Object containing data to sanitize
 * @returns Sanitized data object
 */
const sanitizeTrackingData = (data: Record<string, any>): Record<string, any> => {
  const sensitiveFields = ['ssn', 'driverLicense', 'email', 'phone', 'address'];
  const sanitized = { ...data };

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });

  return sanitized;
};

/**
 * Enhanced page view tracking with session management and privacy controls
 * @param pagePath Current page path
 * @param pageTitle Page title
 * @param sessionData Session tracking data
 */
export const trackPageView = async (
  pagePath: string,
  pageTitle: string,
  sessionData: SessionData
): Promise<void> => {
  try {
    // Check privacy consent
    const privacyService = new PrivacyService();
    const hasConsent = await privacyService.checkTrackingConsent();
    
    if (!hasConsent) {
      return;
    }

    // Calculate session duration
    const sessionDuration = new Date().getTime() - new Date(sessionData.startTime).getTime();

    // Track in Google Analytics
    ReactGA.send({
      hitType: 'pageview',
      page: pagePath,
      title: pageTitle,
      dimension1: sessionData.deviceInfo.type,
      dimension2: sessionData.trafficSource,
      metric1: sessionDuration
    });

    // Track in Mixpanel
    const sanitizedSession = sanitizeTrackingData(sessionData);
    mixpanel.track('Page View', {
      page_path: pagePath,
      page_title: pageTitle,
      session_duration: sessionDuration,
      ...sanitizedSession
    });

  } catch (error) {
    console.error('Error tracking page view:', error);
    // Implement retry logic for critical tracking events
    if (error instanceof Error && error.message.includes('network')) {
      setTimeout(() => trackPageView(pagePath, pageTitle, sessionData), 1000);
    }
  }
};

/**
 * Enhanced form step tracking with validation error analysis
 * @param stepName Name of the form step
 * @param stepData Step completion data
 * @param validationErrors Array of validation errors
 */
export const trackFormStep = async (
  stepName: string,
  stepData: StepData,
  validationErrors: ValidationError[] = []
): Promise<void> => {
  try {
    // Check privacy consent
    const privacyService = new PrivacyService();
    const hasConsent = await privacyService.checkTrackingConsent();
    
    if (!hasConsent) {
      return;
    }

    // Sanitize step data
    const sanitizedStepData = sanitizeTrackingData(stepData);

    // Categorize validation errors
    const errorsByType = validationErrors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Track step in Google Analytics
    ReactGA.event({
      category: 'Form',
      action: 'Step Completion',
      label: stepName,
      value: stepData.duration,
      dimension1: stepData.vertical,
      metric1: validationErrors.length
    });

    // Track detailed step data in Mixpanel
    mixpanel.track('Form Step', {
      step_name: stepName,
      duration: stepData.duration,
      is_complete: stepData.isComplete,
      vertical: stepData.vertical,
      validation_errors: errorsByType,
      ...sanitizedStepData
    });

    // Track step conversion metrics
    if (stepData.isComplete) {
      mixpanel.people.increment('steps_completed');
      if (validationErrors.length === 0) {
        mixpanel.people.increment('clean_completions');
      }
    }

  } catch (error) {
    console.error('Error tracking form step:', error);
    // Implement retry logic for critical tracking events
    if (error instanceof Error && error.message.includes('network')) {
      setTimeout(() => trackFormStep(stepName, stepData, validationErrors), 1000);
    }
  }
};

/**
 * Tracks user session timeout or abandonment
 * @param sessionData Session data to track
 */
export const trackSessionEnd = async (sessionData: SessionData): Promise<void> => {
  try {
    const privacyService = new PrivacyService();
    const hasConsent = await privacyService.checkTrackingConsent();
    
    if (!hasConsent) {
      return;
    }

    const sessionDuration = new Date().getTime() - new Date(sessionData.startTime).getTime();
    const sanitizedSession = sanitizeTrackingData(sessionData);

    mixpanel.track('Session End', {
      duration: sessionDuration,
      ...sanitizedSession
    });

  } catch (error) {
    console.error('Error tracking session end:', error);
  }
};

/**
 * Tracks form validation errors for analysis
 * @param errors Array of validation errors
 * @param stepData Current step data
 */
export const trackValidationErrors = async (
  errors: ValidationError[],
  stepData: StepData
): Promise<void> => {
  try {
    const privacyService = new PrivacyService();
    const hasConsent = await privacyService.checkTrackingConsent();
    
    if (!hasConsent) {
      return;
    }

    errors.forEach(error => {
      mixpanel.track('Validation Error', {
        field: error.field,
        error_type: error.type,
        step_name: stepData.stepName,
        vertical: stepData.vertical
      });
    });

  } catch (error) {
    console.error('Error tracking validation errors:', error);
  }
};

// Export types for consumers
export type { SessionData, StepData, ValidationError };