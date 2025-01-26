/**
 * @fileoverview Enterprise-grade entry point for the buyer portal application
 * Implements React 18 concurrent features, performance monitoring, and error handling
 * @version 1.0.0
 */

import React from 'react'; // ^18.2.0
import { createRoot } from 'react-dom/client'; // ^18.2.0
import * as Sentry from '@sentry/react'; // ^7.0.0
import { Integrations as SentryPerf } from '@sentry/performance'; // ^7.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import App from './App';

// Constants
const PERFORMANCE_BUDGET = 500; // 500ms performance budget
const ROOT_ELEMENT_ID = 'root';
const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV;

/**
 * Initializes error tracking and performance monitoring
 */
const initializeMonitoring = (): void => {
  if (ENVIRONMENT === 'production' && SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      integrations: [
        new SentryPerf.BrowserTracing({
          tracingOrigins: ['localhost', /^\/api/],
          routingInstrumentation: Sentry.reactRouterV6Instrumentation()
        })
      ],
      tracesSampleRate: 0.2,
      beforeSend(event) {
        // Sanitize sensitive data
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
        }
        return event;
      }
    });
  }
};

/**
 * Initializes development tools and performance monitoring
 */
const initializeDevelopmentTools = (): void => {
  if (ENVIRONMENT === 'development') {
    // Enable React Dev Tools profiler
    if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object') {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject({
        rendererPackageName: 'react-dom',
        version: React.version
      });
    }

    // Monitor performance
    const reportWebVitals = ({ name, value }: { name: string; value: number }) => {
      if (value > PERFORMANCE_BUDGET) {
        console.warn(`Performance budget exceeded for ${name}: ${value}ms`);
      }
    };

    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(reportWebVitals);
      getFID(reportWebVitals);
      getFCP(reportWebVitals);
      getLCP(reportWebVitals);
      getTTFB(reportWebVitals);
    });
  }
};

/**
 * Configures security headers for the application
 */
const configureSecurityHeaders = (): void => {
  if (ENVIRONMENT === 'production') {
    // Set strict CSP headers
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.* https://sentry.*"
    ].join('; ');
    document.head.appendChild(meta);
  }
};

/**
 * Error fallback component for critical rendering errors
 */
const CriticalErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h1>Critical Error</h1>
    <p>The application failed to start. Please refresh the page or contact support.</p>
    <pre style={{ margin: '20px', padding: '10px', background: '#f5f5f5' }}>
      {error.message}
    </pre>
  </div>
);

/**
 * Initializes and renders the application with all required configurations
 */
const initializeApp = (): void => {
  // Initialize monitoring and security
  initializeMonitoring();
  initializeDevelopmentTools();
  configureSecurityHeaders();

  // Get root element
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (!rootElement) {
    throw new Error(`Unable to find root element with id: ${ROOT_ELEMENT_ID}`);
  }

  // Create React 18 concurrent root
  const root = createRoot(rootElement);

  // Render app with error boundary
  root.render(
    <React.StrictMode>
      <ErrorBoundary FallbackComponent={CriticalErrorFallback}>
        <Sentry.ErrorBoundary fallback={CriticalErrorFallback}>
          <App />
        </Sentry.ErrorBoundary>
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Enable hot module replacement in development
  if (ENVIRONMENT === 'development' && module.hot) {
    module.hot.accept('./App', () => {
      root.render(
        <React.StrictMode>
          <ErrorBoundary FallbackComponent={CriticalErrorFallback}>
            <App />
          </ErrorBoundary>
        </React.StrictMode>
      );
    });
  }
};

// Initialize the application
initializeApp();