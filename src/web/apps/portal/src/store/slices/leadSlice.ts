// External imports with versions
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^2.0.0
import { createSelector } from 'reselect'; // ^4.1.0

// Internal imports
import { ApiService } from '../../services/api';

// Constants
const CACHE_DURATION = 30000; // 30 seconds
const QUALITY_THRESHOLD = 0.4; // 40% acceptance rate target

// Types
interface ILead {
  id: string;
  vertical: string;
  contactInfo: {
    name: string;
    email: string;
    phone: string;
  };
  mlScore: number;
  status: 'new' | 'accepted' | 'rejected' | 'pending';
  createdAt: string;
  qualityMetrics?: {
    responseTime: number;
    validationScore: number;
  };
}

interface ILeadQueueState {
  leads: ILead[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  lastUpdated: number | null;
  metrics: {
    acceptanceRate: number;
    averageResponseTime: number;
    totalLeads: number;
  };
  pendingUpdates: Map<string, any>;
}

interface ILeadQueueParams {
  page?: number;
  limit?: number;
  vertical?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

interface ILeadStatusUpdate {
  leadId: string;
  status: ILead['status'];
  qualityMetrics?: {
    responseTime: number;
    validationScore: number;
  };
}

// API service instance
const apiService = new ApiService();

// Async Thunks
export const fetchLeadQueue = createAsyncThunk(
  'leads/fetchQueue',
  async (params: ILeadQueueParams, { getState, signal }) => {
    const state = getState() as { leads: ILeadQueueState };
    
    // Check cache validity
    if (state.leads.lastUpdated && 
        Date.now() - state.leads.lastUpdated < CACHE_DURATION &&
        state.leads.status === 'succeeded') {
      return { leads: state.leads.leads };
    }

    // Create query string
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });

    try {
      const response = await apiService.withRetry(() => 
        apiService.get<{ leads: ILead[] }>(
          `/api/v1/leads?${queryParams.toString()}`,
          { signal }
        )
      );

      return response.data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      throw error;
    }
  }
);

export const updateLeadStatus = createAsyncThunk(
  'leads/updateStatus',
  async (update: ILeadStatusUpdate, { dispatch, getState }) => {
    const startTime = Date.now();

    try {
      // Optimistic update
      dispatch(leadSlice.actions.updateLeadStatusOptimistic(update));

      const response = await apiService.put<ILead>(
        `/api/v1/leads/${update.leadId}/status`,
        {
          status: update.status,
          qualityMetrics: {
            ...update.qualityMetrics,
            responseTime: Date.now() - startTime
          }
        }
      );

      return response.data;
    } catch (error) {
      // Revert optimistic update
      dispatch(leadSlice.actions.revertLeadStatusUpdate(update.leadId));
      throw error;
    }
  }
);

// Initial state
const initialState: ILeadQueueState = {
  leads: [],
  status: 'idle',
  error: null,
  lastUpdated: null,
  metrics: {
    acceptanceRate: 0,
    averageResponseTime: 0,
    totalLeads: 0
  },
  pendingUpdates: new Map()
};

// Slice
const leadSlice = createSlice({
  name: 'leads',
  initialState,
  reducers: {
    updateLeadStatusOptimistic(state, action: PayloadAction<ILeadStatusUpdate>) {
      const lead = state.leads.find(l => l.id === action.payload.leadId);
      if (lead) {
        state.pendingUpdates.set(lead.id, { ...lead });
        lead.status = action.payload.status;
        if (action.payload.qualityMetrics) {
          lead.qualityMetrics = action.payload.qualityMetrics;
        }
      }
    },
    revertLeadStatusUpdate(state, action: PayloadAction<string>) {
      const originalLead = state.pendingUpdates.get(action.payload);
      if (originalLead) {
        const index = state.leads.findIndex(l => l.id === action.payload);
        if (index !== -1) {
          state.leads[index] = originalLead;
        }
        state.pendingUpdates.delete(action.payload);
      }
    },
    updateMetrics(state) {
      const acceptedLeads = state.leads.filter(l => l.status === 'accepted').length;
      const totalLeads = state.leads.length;
      const responseTimes = state.leads
        .filter(l => l.qualityMetrics?.responseTime)
        .map(l => l.qualityMetrics!.responseTime);

      state.metrics = {
        acceptanceRate: totalLeads ? acceptedLeads / totalLeads : 0,
        averageResponseTime: responseTimes.length ? 
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
        totalLeads
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeadQueue.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchLeadQueue.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.leads = action.payload.leads;
        state.lastUpdated = Date.now();
        state.error = null;
        leadSlice.caseReducers.updateMetrics(state);
      })
      .addCase(fetchLeadQueue.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch leads';
      })
      .addCase(updateLeadStatus.fulfilled, (state, action) => {
        const index = state.leads.findIndex(l => l.id === action.payload.id);
        if (index !== -1) {
          state.leads[index] = action.payload;
          state.pendingUpdates.delete(action.payload.id);
        }
        leadSlice.caseReducers.updateMetrics(state);
      });
  }
});

// Selectors
export const selectLeadQueueWithMetrics = createSelector(
  [(state: { leads: ILeadQueueState }) => state.leads],
  (leadState) => ({
    leads: leadState.leads,
    metrics: leadState.metrics,
    isPerformanceOptimal: 
      leadState.metrics.acceptanceRate >= QUALITY_THRESHOLD &&
      leadState.metrics.averageResponseTime < 500
  })
);

export const selectLeadQueueStatus = (state: { leads: ILeadQueueState }) => ({
  status: state.leads.status,
  error: state.leads.error,
  lastUpdated: state.leads.lastUpdated
});

// Exports
export const { updateLeadStatusOptimistic, revertLeadStatusUpdate } = leadSlice.actions;
export default leadSlice.reducer;