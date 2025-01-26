import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { AuthService } from '../services/auth';

// Constants
const SESSION_DURATION = 28800000; // 8 hours in milliseconds
const REFRESH_THRESHOLD = 300000; // 5 minutes in milliseconds
const MAX_REFRESH_ATTEMPTS = 3;

// Types
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  } | null;
  sessionExpiresAt: number | null;
  refreshAttempts: number;
  error: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
  totpCode: string;
}

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  sessionExpiresAt: null,
  refreshAttempts: 0,
  error: null
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, totpCode }: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await AuthService.login({ email, password }, totpCode);
      const sessionExpiresAt = Date.now() + SESSION_DURATION;

      // Schedule session refresh
      const refreshTimeout = sessionExpiresAt - Date.now() - REFRESH_THRESHOLD;
      setTimeout(() => {
        AuthService.refreshSession();
      }, refreshTimeout);

      return {
        user: response.user,
        sessionExpiresAt
      };
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await AuthService.logout();
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Logout failed');
    }
  }
);

export const refreshSession = createAsyncThunk(
  'auth/refreshSession',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState };
    
    if (state.auth.refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
      return rejectWithValue('Max refresh attempts exceeded');
    }

    try {
      const response = await AuthService.refreshSession();
      const sessionExpiresAt = Date.now() + SESSION_DURATION;

      return {
        user: response.user,
        sessionExpiresAt
      };
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Session refresh failed');
    }
  }
);

// Auth slice
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetRefreshAttempts: (state) => {
      state.refreshAttempts = 0;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<{ user: AuthState['user']; sessionExpiresAt: number }>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.sessionExpiresAt = action.payload.sessionExpiresAt;
        state.error = null;
        state.refreshAttempts = 0;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = action.payload as string;
      })
      // Logout cases
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        return { ...initialState };
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Refresh session cases
      .addCase(refreshSession.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshSession.fulfilled, (state, action: PayloadAction<{ user: AuthState['user']; sessionExpiresAt: number }>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.sessionExpiresAt = action.payload.sessionExpiresAt;
        state.error = null;
        state.refreshAttempts = 0;
      })
      .addCase(refreshSession.rejected, (state, action) => {
        state.isLoading = false;
        state.refreshAttempts += 1;
        if (state.refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
          state.isAuthenticated = false;
          state.user = null;
          state.sessionExpiresAt = null;
        }
        state.error = action.payload as string;
      });
  }
});

// Selectors
export const selectAuth = (state: { auth: AuthState }) => ({
  isAuthenticated: state.auth.isAuthenticated,
  isLoading: state.auth.isLoading,
  user: state.auth.user,
  sessionExpiresAt: state.auth.sessionExpiresAt,
  error: state.auth.error
});

// Actions
export const { clearError, resetRefreshAttempts } = authSlice.actions;

// Reducer
export default authSlice.reducer;