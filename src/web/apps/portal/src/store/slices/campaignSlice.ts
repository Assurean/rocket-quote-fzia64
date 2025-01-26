/**
 * @fileoverview Redux slice for campaign management in the buyer portal
 * Implements comprehensive campaign state management with optimized performance
 * @version 1.0.0
 */

// External imports with versions
import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5

// Internal imports
import { 
  ICampaign, 
  IListCampaignsRequest, 
  IListCampaignsResponse,
  ICreateCampaignRequest,
  IUpdateCampaignRequest,
  InsuranceVertical,
  CampaignStatus 
} from '../../../backend/services/campaign-service/src/interfaces/campaign.interface';
import { CampaignService } from '../../services/campaign';

// Types
interface CampaignState {
  campaigns: ICampaign[];
  selectedCampaign: ICampaign | null;
  loading: {
    list: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  error: {
    list: string | null;
    create: string | null;
    update: string | null;
    delete: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  filters: {
    active: boolean;
    vertical: InsuranceVertical | null;
    dateRange: [Date, Date] | null;
  };
  lastUpdated: string | null;
}

// Initial state
const initialState: CampaignState = {
  campaigns: [],
  selectedCampaign: null,
  loading: {
    list: false,
    create: false,
    update: false,
    delete: false
  },
  error: {
    list: null,
    create: null,
    update: null,
    delete: null
  },
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0
  },
  filters: {
    active: true,
    vertical: null,
    dateRange: null
  },
  lastUpdated: null
};

// Async thunks
export const fetchCampaigns = createAsyncThunk(
  'campaigns/fetchCampaigns',
  async (request: IListCampaignsRequest, { rejectWithValue }) => {
    try {
      const campaignService = new CampaignService();
      const response = await campaignService.listCampaigns(request);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createCampaign = createAsyncThunk(
  'campaigns/createCampaign',
  async (campaign: ICreateCampaignRequest, { rejectWithValue }) => {
    try {
      const campaignService = new CampaignService();
      const response = await campaignService.createCampaign(campaign);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateCampaign = createAsyncThunk(
  'campaigns/updateCampaign',
  async ({ id, updates }: { id: string; updates: IUpdateCampaignRequest }, { rejectWithValue }) => {
    try {
      const campaignService = new CampaignService();
      const response = await campaignService.updateCampaign(id, updates);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteCampaign = createAsyncThunk(
  'campaigns/deleteCampaign',
  async (id: string, { rejectWithValue }) => {
    try {
      const campaignService = new CampaignService();
      await campaignService.deleteCampaign(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Campaign slice
const campaignSlice = createSlice({
  name: 'campaigns',
  initialState,
  reducers: {
    setSelectedCampaign: (state, action: PayloadAction<ICampaign | null>) => {
      state.selectedCampaign = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<CampaignState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1; // Reset pagination when filters change
    },
    setPagination: (state, action: PayloadAction<Partial<CampaignState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    clearErrors: (state) => {
      state.error = initialState.error;
    }
  },
  extraReducers: (builder) => {
    // Fetch campaigns
    builder.addCase(fetchCampaigns.pending, (state) => {
      state.loading.list = true;
      state.error.list = null;
    });
    builder.addCase(fetchCampaigns.fulfilled, (state, action) => {
      state.loading.list = false;
      state.campaigns = action.payload.campaigns;
      state.pagination.total = action.payload.total;
      state.lastUpdated = new Date().toISOString();
    });
    builder.addCase(fetchCampaigns.rejected, (state, action) => {
      state.loading.list = false;
      state.error.list = action.payload as string;
    });

    // Create campaign
    builder.addCase(createCampaign.pending, (state) => {
      state.loading.create = true;
      state.error.create = null;
    });
    builder.addCase(createCampaign.fulfilled, (state, action) => {
      state.loading.create = false;
      state.campaigns.unshift(action.payload);
      state.pagination.total += 1;
      state.lastUpdated = new Date().toISOString();
    });
    builder.addCase(createCampaign.rejected, (state, action) => {
      state.loading.create = false;
      state.error.create = action.payload as string;
    });

    // Update campaign
    builder.addCase(updateCampaign.pending, (state) => {
      state.loading.update = true;
      state.error.update = null;
    });
    builder.addCase(updateCampaign.fulfilled, (state, action) => {
      state.loading.update = false;
      const index = state.campaigns.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.campaigns[index] = action.payload;
      }
      if (state.selectedCampaign?.id === action.payload.id) {
        state.selectedCampaign = action.payload;
      }
      state.lastUpdated = new Date().toISOString();
    });
    builder.addCase(updateCampaign.rejected, (state, action) => {
      state.loading.update = false;
      state.error.update = action.payload as string;
    });

    // Delete campaign
    builder.addCase(deleteCampaign.pending, (state) => {
      state.loading.delete = true;
      state.error.delete = null;
    });
    builder.addCase(deleteCampaign.fulfilled, (state, action) => {
      state.loading.delete = false;
      state.campaigns = state.campaigns.filter(c => c.id !== action.payload);
      state.pagination.total -= 1;
      if (state.selectedCampaign?.id === action.payload) {
        state.selectedCampaign = null;
      }
      state.lastUpdated = new Date().toISOString();
    });
    builder.addCase(deleteCampaign.rejected, (state, action) => {
      state.loading.delete = false;
      state.error.delete = action.payload as string;
    });
  }
});

// Selectors
export const selectCampaignState = (state: { campaigns: CampaignState }) => state.campaigns;

export const selectFilteredCampaigns = createSelector(
  [selectCampaignState],
  (campaignState) => {
    let filtered = [...campaignState.campaigns];
    
    if (campaignState.filters.active) {
      filtered = filtered.filter(c => c.status === 'ACTIVE');
    }
    
    if (campaignState.filters.vertical) {
      filtered = filtered.filter(c => c.vertical === campaignState.filters.vertical);
    }
    
    if (campaignState.filters.dateRange) {
      const [start, end] = campaignState.filters.dateRange;
      filtered = filtered.filter(c => {
        const createdAt = new Date(c.createdAt);
        return createdAt >= start && createdAt <= end;
      });
    }
    
    return filtered;
  }
);

export const selectCampaignById = createSelector(
  [selectCampaignState, (_state: { campaigns: CampaignState }, id: string) => id],
  (campaignState, id) => campaignState.campaigns.find(c => c.id === id)
);

export const { setSelectedCampaign, setFilters, setPagination, clearErrors } = campaignSlice.actions;

export default campaignSlice.reducer;