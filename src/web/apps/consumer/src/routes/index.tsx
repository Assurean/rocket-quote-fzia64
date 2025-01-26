import React, { Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { useSelector } from 'react-redux';
import { useRouteTracking } from '../utils/analytics';

// Lazy-loaded components with loading boundaries
const LandingPage = React.lazy(() => import('./LandingPage'));
const BasicInfo = React.lazy(() => import('./BasicInfo'));
const AutoForm = React.lazy(() => import('./AutoForm'));
const ClickWall = React.lazy(() => import('./ClickWall'));

// Route path constants
export const ROUTE_PATHS = {
  ROOT: '/',
  BASIC_INFO: '/basic-info',
  AUTO: '/auto',
  HOME: '/home',
  HEALTH: '/health',
  LIFE: '/life',
  RENTERS: '/renters',
  COMMERCIAL: '/commercial',
  CROSS_SELL: '/cross-sell',
  THANK_YOU: '/thank-you',
  CLICK_WALL: '/offers'
} as const;

// Loading fallback component
const LoadingFallback = () => (
  <div 
    role="progressbar" 
    aria-busy="true"
    aria-label="Loading page content"
    style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}
  >
    Loading...
  </div>
);

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={() => window.location.reload()}>Retry</button>
  </div>
);

// Route guard HOC for form state protection
const withRouteGuard = (Component: React.FC, requiredSteps: string[] = []) => {
  return function GuardedRoute() {
    const formState = useSelector((state: any) => state.form);
    const location = useLocation();

    // Check if required form steps are completed
    const canAccess = requiredSteps.every(step => 
      formState.validatedSteps.includes(step)
    );

    if (!canAccess) {
      // Redirect to appropriate step if requirements not met
      const firstIncompleteStep = requiredSteps.find(
        step => !formState.validatedSteps.includes(step)
      );
      return <Navigate to={firstIncompleteStep || '/'} replace />;
    }

    return <Component />;
  };
};

// Main routing component
const AppRoutes: React.FC = () => {
  // Initialize route tracking
  useRouteTracking();

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public routes */}
          <Route 
            path={ROUTE_PATHS.ROOT} 
            element={<LandingPage />} 
          />

          {/* Protected form flow routes */}
          <Route
            path={ROUTE_PATHS.BASIC_INFO}
            element={withRouteGuard(BasicInfo, ['landing'])}
          />

          <Route
            path={ROUTE_PATHS.AUTO}
            element={withRouteGuard(AutoForm, ['landing', 'basic-info'])}
          />

          <Route
            path={ROUTE_PATHS.HOME}
            element={withRouteGuard(
              React.lazy(() => import('./HomeForm')),
              ['landing', 'basic-info']
            )}
          />

          <Route
            path={ROUTE_PATHS.HEALTH}
            element={withRouteGuard(
              React.lazy(() => import('./HealthForm')),
              ['landing', 'basic-info']
            )}
          />

          <Route
            path={ROUTE_PATHS.LIFE}
            element={withRouteGuard(
              React.lazy(() => import('./LifeForm')),
              ['landing', 'basic-info']
            )}
          />

          <Route
            path={ROUTE_PATHS.RENTERS}
            element={withRouteGuard(
              React.lazy(() => import('./RentersForm')),
              ['landing', 'basic-info']
            )}
          />

          <Route
            path={ROUTE_PATHS.COMMERCIAL}
            element={withRouteGuard(
              React.lazy(() => import('./CommercialForm')),
              ['landing', 'basic-info']
            )}
          />

          <Route
            path={ROUTE_PATHS.CROSS_SELL}
            element={withRouteGuard(
              React.lazy(() => import('./CrossSell')),
              ['landing', 'basic-info', 'vertical-specific']
            )}
          />

          <Route
            path={ROUTE_PATHS.THANK_YOU}
            element={withRouteGuard(
              React.lazy(() => import('./ThankYou')),
              ['landing', 'basic-info', 'vertical-specific']
            )}
          />

          <Route
            path={ROUTE_PATHS.CLICK_WALL}
            element={<ClickWall />}
          />

          {/* Catch-all redirect */}
          <Route 
            path="*" 
            element={<Navigate to={ROUTE_PATHS.ROOT} replace />} 
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default AppRoutes;