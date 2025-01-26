import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/react';
import App from './App';

// Constants
const ROOT_ELEMENT_ID = 'root';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

/**
 * Validates existence and type of root DOM element
 * @param element Potential root element
 * @returns Validated HTMLElement
 * @throws Error if element is invalid
 */
const validateRootElement = (element: HTMLElement | null): HTMLElement => {
  if (!element) {
    throw new Error(`Root element with id '${ROOT_ELEMENT_ID}' not found. Please ensure the HTML file contains this element.`);
  }

  if (!(element instanceof HTMLElement)) {
    throw new Error('Root element is not a valid HTMLElement');
  }

  return element;
};

/**
 * Initializes Sentry monitoring with environment-specific configuration
 */
const initializeMonitoring = (): void => {
  if (process.env.REACT_APP_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.REACT_APP_VERSION,
      tracesSampleRate: IS_DEVELOPMENT ? 1.0 : 0.2,
      beforeSend(event) {
        // Sanitize PII data before sending to Sentry
        if (event.extra) {
          delete event.extra.email;
          delete event.extra.phone;
          delete event.extra.ssn;
        }
        return event;
      },
      integrations: [
        new Sentry.BrowserTracing({
          tracingOrigins: ['localhost', /^\//, /\.insureleads\.com$/],
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            React.useEffect
          ),
        }),
      ],
    });
  }
};

/**
 * Error fallback component for production error handling
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>An unexpected error occurred</h2>
    <p>Our team has been notified. Please try refreshing the page.</p>
    {IS_DEVELOPMENT && (
      <pre style={{ color: 'red' }}>{error.message}</pre>
    )}
    <button 
      onClick={() => window.location.reload()}
      style={{ padding: '8px 16px', marginTop: '16px' }}
    >
      Refresh Page
    </button>
  </div>
);

/**
 * Initializes the React application with error boundaries and monitoring
 */
const initializeApp = (): void => {
  try {
    // Initialize error monitoring
    initializeMonitoring();

    // Get and validate root element
    const rootElement = validateRootElement(
      document.getElementById(ROOT_ELEMENT_ID)
    );

    // Create React root with concurrent features
    const root = createRoot(rootElement);

    // Render app with error boundary and strict mode
    root.render(
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          console.error('Application Error:', error);
          if (!IS_DEVELOPMENT) {
            Sentry.captureException(error);
          }
        }}
      >
        <React.StrictMode>
          <App />
        </React.StrictMode>
      </ErrorBoundary>
    );

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    if (!IS_DEVELOPMENT) {
      Sentry.captureException(error);
    }
    // Display fallback UI for critical initialization errors
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h2>Unable to load application</h2>
        <p>Please try refreshing the page or contact support if the issue persists.</p>
      </div>
    `;
  }
};

// Initialize application
initializeApp();