import React, { Suspense, memo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'; // ^6.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { LoadingSpinner } from '@portal/ui-components'; // ^1.0.0
import { useAnalytics } from '@portal/analytics'; // ^1.0.0
import Login from './Login';
import { useAuth } from '../hooks/useAuth';

// Route configurations with code splitting
const PROTECTED_ROUTES = [
  {
    path: '/dashboard',
    component: React.lazy(() => import('./Dashboard')),
    title: 'Dashboard',
    roles: ['buyer', 'admin'],
    preload: true
  },
  {
    path: '/campaigns',
    component: React.lazy(() => import('./Campaigns')),
    title: 'Campaign Management',
    roles: ['buyer', 'admin'],
    preload: true
  },
  {
    path: '/analytics',
    component: React.lazy(() => import('./Analytics')),
    title: 'Analytics',
    roles: ['buyer', 'admin'],
    preload: false
  }
] as const;

const PUBLIC_ROUTES = [
  {
    path: '/login',
    component: Login,
    title: 'Login',
    preload: true
  },
  {
    path: '/forgot-password',
    component: React.lazy(() => import('./ForgotPassword')),
    title: 'Forgot Password',
    preload: false
  }
] as const;

// Error fallback component
const ErrorFallback = memo(({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div role="alert">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
));

ErrorFallback.displayName = 'ErrorFallback';

// Protected route wrapper with role-based access control
const ProtectedRoute = memo(({ 
  component: Component, 
  requiredRoles 
}: { 
  component: React.ComponentType; 
  requiredRoles: string[]; 
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { isAuthenticated, user, hasPermission } = useAuth();

  React.useEffect(() => {
    // Track route access attempts
    trackEvent('route_access', {
      path: location.pathname,
      authenticated: isAuthenticated,
      authorized: requiredRoles.some(role => hasPermission(`role.${role}`))
    });
  }, [location.pathname, isAuthenticated, hasPermission, trackEvent]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const hasRequiredRole = requiredRoles.some(role => hasPermission(`role.${role}`));
  if (!hasRequiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => navigate(0)}
    >
      <Component />
    </ErrorBoundary>
  );
});

ProtectedRoute.displayName = 'ProtectedRoute';

// Public route wrapper that redirects authenticated users
const PublicRoute = memo(({ component: Component }: { component: React.ComponentType }) => {
  const { isAuthenticated } = useAuth();
  const { trackEvent } = useAnalytics();
  const location = useLocation();

  React.useEffect(() => {
    trackEvent('public_route_access', {
      path: location.pathname,
      authenticated: isAuthenticated
    });
  }, [location.pathname, isAuthenticated, trackEvent]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Component />;
});

PublicRoute.displayName = 'PublicRoute';

// Preload critical routes
const preloadRoutes = () => {
  const routesToPreload = [
    ...PROTECTED_ROUTES.filter(route => route.preload),
    ...PUBLIC_ROUTES.filter(route => route.preload)
  ];

  routesToPreload.forEach(route => {
    if ('component' in route && typeof route.component === 'function') {
      route.component();
    }
  });
};

// Root routing component
const AppRoutes: React.FC = () => {
  // Preload critical routes on mount
  React.useEffect(() => {
    preloadRoutes();
  }, []);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Protected Routes */}
        {PROTECTED_ROUTES.map(({ path, component: Component, roles }) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute
                component={Component}
                requiredRoles={roles}
              />
            }
          />
        ))}

        {/* Public Routes */}
        {PUBLIC_ROUTES.map(({ path, component: Component }) => (
          <Route
            key={path}
            path={path}
            element={<PublicRoute component={Component} />}
          />
        ))}

        {/* Default redirect */}
        <Route 
          path="/" 
          element={<Navigate to="/dashboard" replace />} 
        />

        {/* 404 catch-all */}
        <Route 
          path="*" 
          element={<Navigate to="/dashboard" replace />} 
        />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;