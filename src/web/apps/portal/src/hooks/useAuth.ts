import { useEffect, useCallback } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^9.0.0
import { 
  login as loginAction,
  logout as logoutAction,
  refreshSession as refreshSessionAction,
  selectAuth
} from '../store/slices/authSlice';

// Constants
const SESSION_DURATION = 28800000; // 8 hours in milliseconds
const REFRESH_BUFFER = 300000; // 5 minutes in milliseconds

/**
 * Custom hook for managing authentication state and operations
 * Implements OAuth 2.0 with JWT and TOTP 2FA authentication
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user, error, isLoading, sessionExpiresAt } = useSelector(selectAuth);

  // Setup automatic session refresh
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;

    const setupRefreshTimer = () => {
      if (isAuthenticated && sessionExpiresAt) {
        const timeUntilRefresh = sessionExpiresAt - Date.now() - REFRESH_BUFFER;
        
        if (timeUntilRefresh > 0) {
          refreshTimer = setTimeout(async () => {
            try {
              await dispatch(refreshSessionAction()).unwrap();
              setupRefreshTimer(); // Setup next refresh after successful refresh
            } catch (error) {
              // Session refresh failed, user will need to re-authenticate
              dispatch(logoutAction());
            }
          }, timeUntilRefresh);
        }
      }
    };

    setupRefreshTimer();

    // Cleanup timer on unmount or when auth state changes
    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [dispatch, isAuthenticated, sessionExpiresAt]);

  /**
   * Handles user login with OAuth 2.0 and TOTP 2FA validation
   */
  const login = useCallback(async (
    email: string,
    password: string,
    totpCode: string
  ): Promise<void> => {
    try {
      await dispatch(loginAction({ email, password, totpCode })).unwrap();
    } catch (error) {
      // Login error is handled by the reducer
      throw error;
    }
  }, [dispatch]);

  /**
   * Handles secure logout and session cleanup
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await dispatch(logoutAction()).unwrap();
    } catch (error) {
      // Logout error is handled by the reducer
      throw error;
    }
  }, [dispatch]);

  /**
   * Checks if user has specific permission based on their role
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!isAuthenticated || !user?.permissions) {
      return false;
    }
    return user.permissions.includes(permission);
  }, [isAuthenticated, user]);

  /**
   * Manually trigger session refresh
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      await dispatch(refreshSessionAction()).unwrap();
    } catch (error) {
      // Refresh error is handled by the reducer
      throw error;
    }
  }, [dispatch]);

  /**
   * Calculate remaining session time in milliseconds
   */
  const getSessionTimeRemaining = useCallback((): number => {
    if (!sessionExpiresAt) return 0;
    return Math.max(0, sessionExpiresAt - Date.now());
  }, [sessionExpiresAt]);

  /**
   * Check if session is about to expire (within refresh buffer)
   */
  const isSessionExpiring = useCallback((): boolean => {
    const remainingTime = getSessionTimeRemaining();
    return remainingTime > 0 && remainingTime <= REFRESH_BUFFER;
  }, [getSessionTimeRemaining]);

  return {
    // Authentication state
    isAuthenticated,
    user,
    error,
    isLoading,
    
    // Session information
    sessionExpiresAt,
    getSessionTimeRemaining,
    isSessionExpiring,
    
    // Authentication operations
    login,
    logout,
    refreshSession,
    
    // Authorization
    hasPermission
  };
};

// Types for consuming components
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  error: string | null;
  isLoading: boolean;
  sessionExpiresAt: number | null;
}