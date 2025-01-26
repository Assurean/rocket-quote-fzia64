import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.7
import { StorageError } from '@types/storage-errors'; // v1.0.0
import useLocalStorage from '@shared/hooks/useLocalStorage';

// Interfaces
interface FieldInteraction {
  focusCount: number;
  blurCount: number;
  changeCount: number;
  totalDuration: number;
  errorCount: number;
}

interface SessionState {
  sessionId: string;
  deviceInfo: {
    userAgent: string;
    screenSize: string;
    platform: string;
    isMobile: boolean;
    orientation: string;
    browserFingerprint: string;
    colorDepth: number;
    deviceMemory: number;
  };
  behaviorData: {
    startTime: Date;
    formStepsCompleted: number;
    timeOnPage: number;
    exitIntentCount: number;
    fieldInteractions: Record<string, FieldInteraction>;
    stepDurations: Record<string, number>;
    errorCounts: Record<string, number>;
    navigationPattern: string[];
  };
  privacySettings: {
    doNotTrack: boolean;
    consentGiven: boolean;
    dataRetention: number;
  };
  trafficSource: string | null;
  referrer: string | null;
}

// Constants
const INITIAL_STATE: SessionState = {
  sessionId: '',
  deviceInfo: {
    userAgent: '',
    screenSize: '',
    platform: '',
    isMobile: false,
    orientation: '',
    browserFingerprint: '',
    colorDepth: 0,
    deviceMemory: 0
  },
  behaviorData: {
    startTime: new Date(),
    formStepsCompleted: 0,
    timeOnPage: 0,
    exitIntentCount: 0,
    fieldInteractions: {},
    stepDurations: {},
    errorCounts: {},
    navigationPattern: []
  },
  privacySettings: {
    doNotTrack: false,
    consentGiven: false,
    dataRetention: 90
  },
  trafficSource: null,
  referrer: null
};

const STORAGE_CONFIG = {
  quotaLimit: '5MB',
  retryAttempts: 3,
  cleanupThreshold: '4MB'
};

// Helper Functions
const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomStr}`;
};

const getDeviceInfo = (): SessionState['deviceInfo'] => {
  return {
    userAgent: navigator.userAgent,
    screenSize: `${window.screen.width}x${window.screen.height}`,
    platform: navigator.platform,
    isMobile: /Mobile|Android|iOS/.test(navigator.userAgent),
    orientation: screen.orientation.type,
    browserFingerprint: window.navigator.userAgent.replace(/\D+/g, ''),
    colorDepth: window.screen.colorDepth,
    deviceMemory: (navigator as any).deviceMemory || 0
  };
};

const handleStorageError = (error: StorageError): void => {
  if (error.type === 'QuotaExceeded') {
    // Attempt to clean up old data
    try {
      const oldSessions = Object.keys(localStorage)
        .filter(key => key.startsWith('session_'))
        .sort();
      
      while (oldSessions.length > 0 && localStorage.length > STORAGE_CONFIG.cleanupThreshold) {
        const oldestSession = oldSessions.shift();
        if (oldestSession) localStorage.removeItem(oldestSession);
      }
    } catch (cleanupError) {
      console.error('Storage cleanup failed:', cleanupError);
    }
  }
  
  // Log error for monitoring
  console.error('Session storage error:', error);
};

// Create Slice
const sessionSlice = createSlice({
  name: 'session',
  initialState: INITIAL_STATE,
  reducers: {
    initSession: (state) => {
      state.sessionId = generateSessionId();
      state.deviceInfo = getDeviceInfo();
      state.behaviorData.startTime = new Date();
      state.referrer = document.referrer || null;
      state.trafficSource = new URLSearchParams(window.location.search).get('utm_source');
      state.privacySettings.doNotTrack = navigator.doNotTrack === '1';
    },
    
    updateBehaviorData: (state, action: PayloadAction<Partial<SessionState['behaviorData']>>) => {
      state.behaviorData = {
        ...state.behaviorData,
        ...action.payload
      };
    },
    
    trackFieldInteraction: (state, action: PayloadAction<{
      fieldId: string;
      interactionType: keyof FieldInteraction;
      duration?: number;
    }>) => {
      const { fieldId, interactionType, duration } = action.payload;
      const field = state.behaviorData.fieldInteractions[fieldId] || {
        focusCount: 0,
        blurCount: 0,
        changeCount: 0,
        totalDuration: 0,
        errorCount: 0
      };
      
      field[interactionType]++;
      if (duration) {
        field.totalDuration += duration;
      }
      
      state.behaviorData.fieldInteractions[fieldId] = field;
    },
    
    recordExitIntent: (state) => {
      state.behaviorData.exitIntentCount++;
    },
    
    updatePrivacySettings: (state, action: PayloadAction<Partial<SessionState['privacySettings']>>) => {
      state.privacySettings = {
        ...state.privacySettings,
        ...action.payload
      };
    },
    
    syncCrossTabs: (state, action: PayloadAction<SessionState>) => {
      return {
        ...state,
        ...action.payload,
        deviceInfo: {
          ...action.payload.deviceInfo,
          orientation: screen.orientation.type // Update with current orientation
        }
      };
    }
  }
});

// Exports
export const {
  initSession,
  updateBehaviorData,
  trackFieldInteraction,
  recordExitIntent,
  updatePrivacySettings,
  syncCrossTabs
} = sessionSlice.actions;

export default sessionSlice.reducer;