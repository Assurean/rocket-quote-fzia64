import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

import App from '../src/App';
import formReducer from '../src/store/slices/formSlice';
import sessionReducer from '../src/store/slices/sessionSlice';
import validationReducer from '../src/store/slices/validationSlice';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock Sentry
jest.mock('@sentry/react', () => ({
  init: jest.fn(),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  BrowserTracing: jest.fn(),
  reactRouterV6Instrumentation: jest.fn()
}));

// Helper function to render with all required providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialState = {},
    route = '/',
    store = configureStore({
      reducer: {
        form: formReducer,
        session: sessionReducer,
        validation: validationReducer
      },
      preloadedState: initialState
    })
  } = {}
) => {
  window.history.pushState({}, 'Test page', route);

  return {
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <ErrorBoundary fallback={<div>Error Boundary Fallback</div>}>
            <MemoryRouter initialEntries={[route]}>
              {ui}
            </MemoryRouter>
          </ErrorBoundary>
        </ThemeProvider>
      </Provider>
    ),
    store
  };
};

describe('App Component Integration', () => {
  beforeEach(() => {
    // Reset mocks and storage before each test
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should render without crashing and initialize providers correctly', () => {
    const { container } = renderWithProviders(<App />);
    expect(container).toBeInTheDocument();
  });

  it('should initialize Redux store with correct initial state', () => {
    const { store } = renderWithProviders(<App />);
    const state = store.getState();
    
    expect(state.form).toBeDefined();
    expect(state.session).toBeDefined();
    expect(state.validation).toBeDefined();
  });

  it('should render skip navigation for accessibility', () => {
    renderWithProviders(<App />);
    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeInTheDocument();
  });

  it('should handle route changes correctly', async () => {
    const { store } = renderWithProviders(<App />, { route: '/basic-info' });
    
    await waitFor(() => {
      const state = store.getState();
      expect(state.session.behaviorData.navigationPattern).toContain('/basic-info');
    });
  });

  it('should handle error boundaries gracefully', () => {
    const ThrowError = () => {
      throw new Error('Test error');
      return null;
    };

    const { container } = renderWithProviders(
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(container).toHaveTextContent('Error occurred');
  });
});

describe('Accessibility Compliance', () => {
  it('should pass axe accessibility tests', async () => {
    const { container } = renderWithProviders(<App />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should maintain focus management for keyboard navigation', () => {
    renderWithProviders(<App />);
    const skipLink = screen.getByText('Skip to main content');
    
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(skipLink).toHaveFocus();
  });

  it('should have proper ARIA labels and roles', () => {
    renderWithProviders(<App />);
    const mainContent = screen.getByRole('main');
    expect(mainContent).toBeInTheDocument();
  });
});

describe('Performance Monitoring', () => {
  it('should initialize performance monitoring', () => {
    const { store } = renderWithProviders(<App />);
    
    expect(store.getState().session.behaviorData.startTime).toBeDefined();
  });

  it('should track core web vitals', async () => {
    const mockReportWebVitals = jest.fn();
    window.reportWebVitals = mockReportWebVitals;

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(mockReportWebVitals).toHaveBeenCalled();
    });
  });
});

describe('Responsive Design', () => {
  it('should render correctly on mobile viewport', () => {
    global.innerWidth = 375;
    global.innerHeight = 667;
    global.dispatchEvent(new Event('resize'));

    const { container } = renderWithProviders(<App />);
    expect(container).toMatchSnapshot();
  });

  it('should render correctly on tablet viewport', () => {
    global.innerWidth = 768;
    global.innerHeight = 1024;
    global.dispatchEvent(new Event('resize'));

    const { container } = renderWithProviders(<App />);
    expect(container).toMatchSnapshot();
  });

  it('should render correctly on desktop viewport', () => {
    global.innerWidth = 1440;
    global.innerHeight = 900;
    global.dispatchEvent(new Event('resize'));

    const { container } = renderWithProviders(<App />);
    expect(container).toMatchSnapshot();
  });
});

describe('Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    const mockFetch = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(mockConsoleError).toHaveBeenCalled();
    });

    mockConsoleError.mockRestore();
    mockFetch.mockRestore();
  });

  it('should handle Redux store errors', () => {
    const mockStore = configureStore({
      reducer: {
        form: () => { throw new Error('Store error'); }
      }
    });

    expect(() => renderWithProviders(<App />, { store: mockStore }))
      .not.toThrow();
  });
});

describe('Security Features', () => {
  it('should initialize Sentry with correct configuration', () => {
    const mockSentryInit = require('@sentry/react').init;
    renderWithProviders(<App />);
    
    expect(mockSentryInit).toHaveBeenCalledWith(expect.objectContaining({
      environment: expect.any(String),
      tracesSampleRate: 1.0
    }));
  });

  it('should sanitize PII data before sending to Sentry', () => {
    const mockSentryInit = require('@sentry/react').init;
    renderWithProviders(<App />);
    
    const initConfig = mockSentryInit.mock.calls[0][0];
    const sanitizedEvent = initConfig.beforeSend({
      extra: { email: 'test@test.com', phone: '1234567890' }
    });
    
    expect(sanitizedEvent.extra.email).toBeUndefined();
    expect(sanitizedEvent.extra.phone).toBeUndefined();
  });
});