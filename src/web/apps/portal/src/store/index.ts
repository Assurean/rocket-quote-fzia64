/**
 * @fileoverview Root Redux store configuration with enhanced security, monitoring and persistence
 * @version 1.0.0
 */

// External imports with versions
import { configureStore, combineReducers, Middleware } from '@reduxjs/toolkit'; // ^2.0.0
import { persistStore, persistReducer, createTransform, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'; // ^6.0.0
import storage from 'redux-persist/lib/storage'; // ^6.0.0
import { createLogger } from 'redux-logger'; // ^4.0.0
import { AES, enc } from 'crypto-js'; // ^4.2.0

// Internal imports
import authReducer from './slices/authSlice';
import campaignReducer from './slices/campaignSlice';
import leadReducer from './slices/leadSlice';

// Constants
const ENCRYPTION_KEY = process.env.REACT_APP_STATE_ENCRYPTION_KEY || 'default-dev-key';
const PERFORMANCE_THRESHOLDS = {
  actionProcessing: 100, // ms
  stateUpdate: 50, // ms
  totalLatency: 500 // ms
};

// Types
export interface RootState {
  auth: ReturnType<typeof authReducer>;
  campaigns: ReturnType<typeof campaignReducer>;
  leads: ReturnType<typeof leadReducer>;
}

// Create encryption transform for sensitive data
const encryptTransform = createTransform(
  // Encrypt on state serialization
  (inboundState: any, key: string) => {
    if (key === 'auth') {
      return AES.encrypt(JSON.stringify(inboundState), ENCRYPTION_KEY).toString();
    }
    return inboundState;
  },
  // Decrypt on state rehydration
  (outboundState: any, key: string) => {
    if (key === 'auth') {
      const decrypted = AES.decrypt(outboundState, ENCRYPTION_KEY);
      return JSON.parse(decrypted.toString(enc.Utf8));
    }
    return outboundState;
  }
);

// Configure persist options with security measures
const persistConfig = {
  key: 'portal',
  storage,
  whitelist: ['auth'], // Only persist auth state
  blacklist: ['campaign.selectedCampaign', 'lead.queue'], // Exclude volatile data
  transforms: [encryptTransform],
  timeout: 10000,
  debug: process.env.NODE_ENV === 'development'
};

// Combine reducers with proper typing
const rootReducer = combineReducers({
  auth: authReducer,
  campaigns: campaignReducer,
  leads: leadReducer
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Performance monitoring middleware
const performanceMiddleware: Middleware = store => next => action => {
  const startTime = performance.now();
  
  const result = next(action);
  
  const endTime = performance.now();
  const actionTime = endTime - startTime;

  if (actionTime > PERFORMANCE_THRESHOLDS.actionProcessing) {
    console.warn(`Slow action processing detected: ${action.type} took ${actionTime}ms`);
  }

  return result;
};

// Error tracking middleware
const errorTrackingMiddleware: Middleware = () => next => action => {
  try {
    return next(action);
  } catch (error) {
    console.error('Redux error:', {
      action,
      error,
      timestamp: new Date().toISOString()
    });
    
    // Re-throw error for error boundary handling
    throw error;
  }
};

/**
 * Configures and creates the Redux store with security and monitoring features
 * @returns Configured store instance with proper typing
 */
const setupStore = () => {
  const middlewares: Middleware[] = [
    performanceMiddleware,
    errorTrackingMiddleware
  ];

  // Add logger in development
  if (process.env.NODE_ENV === 'development') {
    middlewares.push(createLogger({
      collapsed: true,
      duration: true,
      timestamp: false
    }));
  }

  const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => 
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
        },
        thunk: true
      }).concat(middlewares),
    devTools: process.env.NODE_ENV === 'development'
  });

  // Setup store health monitoring
  monitorStoreHealth(store);

  return store;
};

/**
 * Monitors store performance and health metrics
 * @param store Redux store instance
 */
const monitorStoreHealth = (store: ReturnType<typeof setupStore>) => {
  let lastUpdateTime = Date.now();
  let updateCount = 0;

  store.subscribe(() => {
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - lastUpdateTime;

    // Track update frequency
    updateCount++;
    if (timeSinceLastUpdate > 1000) {
      if (updateCount > 100) {
        console.warn(`High store update frequency: ${updateCount} updates/second`);
      }
      updateCount = 0;
      lastUpdateTime = currentTime;
    }

    // Monitor memory usage
    if (global.performance?.memory) {
      const { usedJSHeapSize, jsHeapSizeLimit } = global.performance.memory;
      const memoryUsage = (usedJSHeapSize / jsHeapSizeLimit) * 100;
      
      if (memoryUsage > 80) {
        console.warn(`High memory usage in store: ${memoryUsage.toFixed(2)}%`);
      }
    }
  });
};

// Create store instance
export const store = setupStore();
export const persistor = persistStore(store);

// Export typed versions of dispatch and state
export type AppDispatch = typeof store.dispatch;
export type AppStore = ReturnType<typeof setupStore>;