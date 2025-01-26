/**
 * @fileoverview Root application component for the buyer portal
 * Implements authentication, routing, theme provider, and performance monitoring
 * @version 1.0.0
 */

import React, { Suspense, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom'; // ^6.0.0
import { Provider } from 'react-redux'; // ^9.0.0
import { PersistGate } from 'redux-persist/integration/react'; // ^6.0.0
import { ThemeProvider, CssBaseline, CircularProgress } from '@mui/material'; // ^5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import AppRoutes from './routes';
import { theme } from '@shared/theme';
import { store, persistor } from './store';

// Error fallback component with retry capability
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div 
    role="alert"
    style={{ 
      padding: '20px', 
      textAlign: 'center',
      maxWidth: '600px',
      margin: '40px auto' 
    }}
  >
    <h2>Something went wrong</h2>
    <pre style={{ 
      margin: '20px 0',
      padding: '10px',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px',
      overflow: 'auto'
    }}>
      {error.message}
    </pre>
    <button 
      onClick={resetErrorBoundary}
      style={{
        padding: '8px 16px',
        backgroundColor: theme.colors.ui.primary,
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Try again
    </button>
  </div>
);

// Loading fallback component
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh'
  }}>
    <CircularProgress size={40} />
  </div>
);

/**
 * Root application component with performance monitoring and error handling
 */
const App: React.FC = () => {
  // Monitor performance metrics
  useEffect(() => {
    // Report performance metrics
    const reportPerformance = () => {
      const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintTiming = performance.getEntriesByType('paint');
      
      console.info('Performance Metrics:', {
        loadTime: navigationTiming.loadEventEnd - navigationTiming.startTime,
        firstPaint: paintTiming.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paintTiming.find(p => p.name === 'first-contentful-paint')?.startTime
      });
    };

    // Report metrics after load
    window.addEventListener('load', reportPerformance);
    return () => window.removeEventListener('load', reportPerformance);
  }, []);

  return (
    <React.Profiler
      id="App"
      onRender={(id, phase, actualDuration) => {
        if (actualDuration > 16.67) { // Frame budget of 60fps
          console.warn(`Slow render detected in ${id} during ${phase}: ${actualDuration.toFixed(2)}ms`);
        }
      }}
    >
      <Provider store={store}>
        <PersistGate 
          loading={<LoadingFallback />} 
          persistor={persistor}
        >
          <ThemeProvider theme={theme.createAppTheme()}>
            <CssBaseline />
            <ErrorBoundary
              FallbackComponent={ErrorFallback}
              onError={(error) => {
                console.error('Application Error:', error);
                // Additional error reporting could be added here
              }}
              onReset={() => {
                // Attempt to recover by reloading the page
                window.location.reload();
              }}
            >
              <BrowserRouter>
                <Suspense fallback={<LoadingFallback />}>
                  <AppRoutes />
                </Suspense>
              </BrowserRouter>
            </ErrorBoundary>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </React.Profiler>
  );
};

export default App;