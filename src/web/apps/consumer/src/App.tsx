import React, { useEffect } from 'react';
import { BrowserRouter, RouterProvider } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SkipNavLink, SkipNavContent } from '@reach/skip-nav';
import { init, ErrorBoundary } from '@sentry/react';

import routes from './routes';
import store from './store';
import theme from '@shared/theme';

// Initialize Sentry with environment-specific configuration
const initializeSentry = (): void => {
  if (process.env.REACT_APP_SENTRY_DSN) {
    init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.REACT_APP_VERSION,
      tracesSampleRate: 1.0,
      integrations: [
        new Sentry.BrowserTracing({
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            React.useEffect,
            useLocation,
            useNavigationType,
            createRoutesFromChildren,
            matchRoutes
          ),
        }),
      ],
      beforeSend(event) {
        // Sanitize PII data before sending to Sentry
        if (event.extra) {
          delete event.extra.email;
          delete event.extra.phone;
          delete event.extra.ssn;
        }
        return event;
      },
    });
  }
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>An unexpected error occurred</h2>
    <p>Our team has been notified. Please try refreshing the page.</p>
    {process.env.NODE_ENV === 'development' && (
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

// Performance monitoring component
const PerformanceMonitor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Report core web vitals
    if ('reportWebVitals' in window) {
      const reportWebVitals = (metric: any) => {
        if (process.env.NODE_ENV === 'production') {
          Sentry.captureMessage('Web Vital', {
            extra: {
              metric: {
                name: metric.name,
                value: metric.value,
                rating: metric.rating,
              },
            },
          });
        }
      };

      // @ts-ignore - Web Vitals API
      window.reportWebVitals(reportWebVitals);
    }
  }, []);

  return <>{children}</>;
};

const App: React.FC = () => {
  // Initialize error tracking
  useEffect(() => {
    initializeSentry();
  }, []);

  return (
    <ErrorBoundary
      fallback={ErrorFallback}
      onError={(error) => {
        console.error('Application Error:', error);
        // Log to error reporting service in production
        if (process.env.NODE_ENV === 'production') {
          Sentry.captureException(error);
        }
      }}
    >
      <PerformanceMonitor>
        <Provider store={store}>
          <ThemeProvider theme={theme}>
            {/* Reset CSS and provide base styles */}
            <CssBaseline />
            
            {/* Accessibility skip link */}
            <SkipNavLink>Skip to main content</SkipNavLink>
            
            <BrowserRouter>
              <SkipNavContent>
                <RouterProvider router={routes} />
              </SkipNavContent>
            </BrowserRouter>
          </ThemeProvider>
        </Provider>
      </PerformanceMonitor>
    </ErrorBoundary>
  );
};

export default App;