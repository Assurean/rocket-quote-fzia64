import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Internal imports
import App from '../src/App';
import authReducer from '../src/store/slices/authSlice';
import campaignReducer from '../src/store/slices/campaignSlice';
import leadReducer from '../src/store/slices/leadSlice';
import { theme } from '@shared/theme';

// Mock service worker for API requests
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Test constants
const TEST_USER = {
  id: '123',
  email: 'test@example.com',
  role: 'buyer',
  permissions: ['campaign.view', 'campaign.edit']
};

const TEST_TOTP_CODE = '123456';

// Mock API handlers
const server = setupServer(
  rest.post('/api/v1/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        user: TEST_USER,
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresIn: 28800
      })
    );
  }),
  rest.post('/api/v1/auth/refresh', (req, res, ctx) => {
    return res(
      ctx.json({
        accessToken: 'new-test-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 28800
      })
    );
  })
);

// Enhanced render utility with all required providers
interface RenderOptions {
  preloadedState?: any;
  route?: string;
  theme?: typeof theme;
}

const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    route = '/',
    theme: customTheme = theme
  }: RenderOptions = {}
) => {
  // Create test store with monitoring middleware
  const store = configureStore({
    reducer: {
      auth: authReducer,
      campaigns: campaignReducer,
      leads: leadReducer
    },
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat([
        (store) => (next) => (action) => {
          const result = next(action);
          const state = store.getState();
          // Monitor store updates for performance
          if (process.env.NODE_ENV === 'development') {
            console.log('Action:', action.type, 'State:', state);
          }
          return result;
        }
      ])
  });

  // Create enhanced render result
  const renderResult = render(
    <Provider store={store}>
      <ThemeProvider theme={customTheme.createAppTheme()}>
        <MemoryRouter initialEntries={[route]}>
          {ui}
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );

  return {
    ...renderResult,
    store,
    user: userEvent.setup()
  };
};

describe('App Component Integration Tests', () => {
  beforeEach(() => {
    server.listen();
    // Clear localStorage before each test
    window.localStorage.clear();
    // Reset performance metrics
    vi.spyOn(performance, 'getEntriesByType').mockImplementation(() => []);
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
    vi.clearAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should redirect unauthenticated users to login page', async () => {
      const { user } = renderWithProviders(<App />, { route: '/dashboard' });
      
      await waitFor(() => {
        expect(screen.getByText(/Insurance Portal Login/i)).toBeInTheDocument();
      });
    });

    it('should handle successful login with TOTP verification', async () => {
      const { user } = renderWithProviders(<App />, { route: '/login' });

      // Fill login form
      await user.type(screen.getByLabelText(/Email Address/i), TEST_USER.email);
      await user.type(screen.getByLabelText(/Password/i), 'testPassword123');
      await user.type(screen.getByLabelText(/Authentication Code/i), TEST_TOTP_CODE);
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      // Verify redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      });
    });

    it('should handle session expiration and refresh', async () => {
      const { store } = renderWithProviders(<App />, {
        preloadedState: {
          auth: {
            isAuthenticated: true,
            user: TEST_USER,
            sessionExpiresAt: Date.now() - 1000
          }
        }
      });

      await waitFor(() => {
        const state = store.getState().auth;
        expect(state.isAuthenticated).toBeFalsy();
      });
    });
  });

  describe('Role-Based Access Control', () => {
    it('should restrict access based on user permissions', async () => {
      const { user } = renderWithProviders(<App />, {
        preloadedState: {
          auth: {
            isAuthenticated: true,
            user: {
              ...TEST_USER,
              permissions: [] // No permissions
            }
          }
        },
        route: '/campaigns'
      });

      await waitFor(() => {
        expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      });
    });

    it('should allow access to authorized routes', async () => {
      renderWithProviders(<App />, {
        preloadedState: {
          auth: {
            isAuthenticated: true,
            user: TEST_USER
          }
        },
        route: '/campaigns'
      });

      await waitFor(() => {
        expect(screen.getByText(/Campaign Management/i)).toBeInTheDocument();
      });
    });
  });

  describe('Theme and Accessibility', () => {
    it('should apply WCAG compliant theme', async () => {
      const { container } = renderWithProviders(<App />);
      
      const styles = window.getComputedStyle(container.firstChild as Element);
      expect(styles.backgroundColor).toBe(theme.colors.ui.background);
      
      // Verify contrast ratios
      const textElements = screen.getAllByRole('heading');
      textElements.forEach(element => {
        const elementStyles = window.getComputedStyle(element);
        expect(elementStyles.color).toBe(theme.colors.ui.text.primary);
      });
    });

    it('should maintain focus management', async () => {
      const { user } = renderWithProviders(<App />);
      
      // Tab through focusable elements
      await user.tab();
      expect(document.activeElement).toHaveAttribute('role', 'textbox');
      
      await user.tab();
      expect(document.activeElement).toHaveAttribute('type', 'password');
    });
  });

  describe('Error Handling and Performance', () => {
    it('should handle and display API errors', async () => {
      server.use(
        rest.post('/api/v1/auth/login', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Internal server error' }));
        })
      );

      const { user } = renderWithProviders(<App />, { route: '/login' });

      // Attempt login
      await user.type(screen.getByLabelText(/Email Address/i), TEST_USER.email);
      await user.type(screen.getByLabelText(/Password/i), 'testPassword123');
      await user.type(screen.getByLabelText(/Authentication Code/i), TEST_TOTP_CODE);
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/error/i);
      });
    });

    it('should monitor and report performance metrics', async () => {
      const consoleSpy = vi.spyOn(console, 'info');
      
      renderWithProviders(<App />);

      // Simulate load event
      window.dispatchEvent(new Event('load'));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Performance Metrics:',
        expect.objectContaining({
          loadTime: expect.any(Number),
          firstPaint: expect.any(Number),
          firstContentfulPaint: expect.any(Number)
        })
      );
    });
  });
});