import { configureStore, ThunkAction, createListenerMiddleware } from '@reduxjs/toolkit'; // v1.9.7
import { createPerformanceMiddleware } from 'redux-performance-middleware'; // v1.0.0
import { createMultiTabSyncMiddleware } from 'redux-multi-tab-sync'; // v1.0.0

// Import reducers
import formReducer from './slices/formSlice';
import sessionReducer from './slices/sessionSlice';
import validationReducer from './slices/validationSlice';

// Constants
const PERFORMANCE_THRESHOLD_MS = 500;
const isDevelopment = process.env.NODE_ENV === 'development';

// Performance monitoring middleware configuration
const performanceMiddleware = createPerformanceMiddleware({
  actionLatencyThreshold: PERFORMANCE_THRESHOLD_MS,
  metricsUpdateInterval: 5000,
  enableStateSize: true,
  excludedActions: ['@@INIT', '@performance/UPDATE_METRICS'],
  onLatencyViolation: (action, latency) => {
    console.warn(`Performance threshold exceeded for ${action.type}: ${latency}ms`);
  }
});

// Multi-tab synchronization middleware configuration
const multiTabSyncMiddleware = createMultiTabSyncMiddleware({
  channel: 'insurance-lead-form',
  whitelist: ['form/updateFormData', 'session/updateBehaviorData'],
  blacklist: ['validation/setFieldError'],
  broadcastChannelOptions: {
    type: 'localStorage'
  }
});

// Listener middleware for side effects
const listenerMiddleware = createListenerMiddleware();

// Configure listeners
listenerMiddleware.startListening({
  predicate: (action) => action.type.startsWith('form/'),
  effect: async (action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    // Track form interactions in session
    if (state.session.sessionId) {
      listenerApi.dispatch({
        type: 'session/updateBehaviorData',
        payload: {
          lastAction: action.type,
          timestamp: Date.now()
        }
      });
    }
  }
});

// Interface for performance metrics
interface PerformanceMetrics {
  actionLatencies: Record<string, number>;
  stateSize: number;
  lastUpdated: Date;
}

// Root state interface with strict null checks
export interface RootState {
  form: ReturnType<typeof formReducer>;
  session: ReturnType<typeof sessionReducer>;
  validation: ReturnType<typeof validationReducer>;
  performance: PerformanceMetrics;
}

// Type for async thunk actions with enhanced error handling
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  undefined,
  Action<string>
>;

// Configure and create store with security and performance features
const configureAppStore = () => {
  const store = configureStore({
    reducer: {
      form: formReducer,
      session: sessionReducer,
      validation: validationReducer
    },
    middleware: (getDefaultMiddleware) => 
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore non-serializable date values in specific paths
          ignoredPaths: ['session.behaviorData.startTime'],
          warnAfter: 100
        },
        thunk: {
          extraArgument: undefined
        },
        immutableCheck: {
          warnAfter: 100
        }
      })
      .prepend(listenerMiddleware.middleware)
      .concat(performanceMiddleware)
      .concat(multiTabSyncMiddleware),
    devTools: isDevelopment ? {
      // Configure DevTools with security in mind
      maxAge: 50,
      actionSanitizer: (action) => ({
        ...action,
        // Remove sensitive data from DevTools
        payload: action.type.includes('PII') ? '[REDACTED]' : action.payload
      }),
      stateSanitizer: (state) => ({
        ...state,
        // Remove sensitive data from DevTools
        form: {
          ...state.form,
          formData: Object.fromEntries(
            Object.entries(state.form.formData).map(([key, value]) => [
              key,
              state.form.securityMetadata[key] === 'pii' ? '[REDACTED]' : value
            ])
          )
        }
      })
    } : false,
    enhancers: []
  });

  // Enable hot module replacement for reducers in development
  if (isDevelopment && module.hot) {
    module.hot.accept('./slices/formSlice', () => store.replaceReducer(formReducer));
    module.hot.accept('./slices/sessionSlice', () => store.replaceReducer(sessionReducer));
    module.hot.accept('./slices/validationSlice', () => store.replaceReducer(validationReducer));
  }

  return store;
};

// Create store instance
export const store = configureAppStore();

// Export typed versions of store methods
export type AppDispatch = typeof store.dispatch;
export type GetState = typeof store.getState;

// Export store instance and types
export default store;