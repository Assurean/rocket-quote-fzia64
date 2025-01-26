/**
 * @fileoverview Custom React hook providing comprehensive campaign management functionality
 * with optimized performance, error handling, and monitoring integration.
 * @version 1.0.0
 */

// External imports with versions
import { useCallback, useEffect } from 'react'; // v18.2.0
import { useDispatch, useSelector } from 'react-redux'; // v8.0.5

// Internal imports
import {
  selectCampaigns,
  selectSelectedCampaign,
  selectCampaignLoading,
  selectCampaignError,
  selectCampaignPagination,
  fetchCampaigns,
  fetchCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  setSelectedCampaign,
  setFilters,
  setPagination,
  clearErrors
} from '../store/slices/campaignSlice';

// Types
import type { 
  ICampaign,
  ICreateCampaignRequest,
  IUpdateCampaignRequest,
  InsuranceVertical,
  CampaignStatus
} from '../../../backend/services/campaign-service/src/interfaces/campaign.interface';

interface CampaignFilters {
  active: boolean;
  vertical: InsuranceVertical | null;
  dateRange: [Date, Date] | null;
}

interface UseCampaignReturn {
  // State
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

  // Actions
  fetchCampaigns: (filters?: CampaignFilters) => Promise<void>;
  fetchCampaignById: (id: string) => Promise<void>;
  createCampaign: (campaign: ICreateCampaignRequest) => Promise<void>;
  updateCampaign: (id: string, updates: IUpdateCampaignRequest) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  selectCampaign: (campaign: ICampaign | null) => void;
  updateFilters: (filters: Partial<CampaignFilters>) => void;
  updatePagination: (page: number, pageSize?: number) => void;
  clearErrors: () => void;
}

/**
 * Custom hook providing comprehensive campaign management functionality
 * with optimized performance and error handling
 * @returns {UseCampaignReturn} Campaign management interface
 */
export const useCampaign = (): UseCampaignReturn => {
  const dispatch = useDispatch();

  // Selectors with performance optimization
  const campaigns = useSelector(selectCampaigns);
  const selectedCampaign = useSelector(selectSelectedCampaign);
  const loading = useSelector(selectCampaignLoading);
  const error = useSelector(selectCampaignError);
  const pagination = useSelector(selectCampaignPagination);

  // Memoized action handlers
  const handleFetchCampaigns = useCallback(async (filters?: CampaignFilters) => {
    try {
      if (filters) {
        dispatch(setFilters(filters));
      }
      await dispatch(fetchCampaigns({
        page: pagination.page,
        pageSize: pagination.pageSize
      })).unwrap();
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  }, [dispatch, pagination.page, pagination.pageSize]);

  const handleFetchCampaignById = useCallback(async (id: string) => {
    try {
      await dispatch(fetchCampaignById(id)).unwrap();
    } catch (error) {
      console.error('Failed to fetch campaign:', error);
    }
  }, [dispatch]);

  const handleCreateCampaign = useCallback(async (campaign: ICreateCampaignRequest) => {
    try {
      await dispatch(createCampaign(campaign)).unwrap();
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  }, [dispatch]);

  const handleUpdateCampaign = useCallback(async (id: string, updates: IUpdateCampaignRequest) => {
    try {
      await dispatch(updateCampaign({ id, updates })).unwrap();
    } catch (error) {
      console.error('Failed to update campaign:', error);
    }
  }, [dispatch]);

  const handleDeleteCampaign = useCallback(async (id: string) => {
    try {
      await dispatch(deleteCampaign(id)).unwrap();
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  }, [dispatch]);

  const handleSelectCampaign = useCallback((campaign: ICampaign | null) => {
    dispatch(setSelectedCampaign(campaign));
  }, [dispatch]);

  const handleUpdateFilters = useCallback((filters: Partial<CampaignFilters>) => {
    dispatch(setFilters(filters));
  }, [dispatch]);

  const handleUpdatePagination = useCallback((page: number, pageSize?: number) => {
    dispatch(setPagination({ page, pageSize }));
  }, [dispatch]);

  const handleClearErrors = useCallback(() => {
    dispatch(clearErrors());
  }, [dispatch]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      handleSelectCampaign(null);
      handleClearErrors();
    };
  }, [handleSelectCampaign, handleClearErrors]);

  return {
    // State
    campaigns,
    selectedCampaign,
    loading,
    error,
    pagination,

    // Actions
    fetchCampaigns: handleFetchCampaigns,
    fetchCampaignById: handleFetchCampaignById,
    createCampaign: handleCreateCampaign,
    updateCampaign: handleUpdateCampaign,
    deleteCampaign: handleDeleteCampaign,
    selectCampaign: handleSelectCampaign,
    updateFilters: handleUpdateFilters,
    updatePagination: handleUpdatePagination,
    clearErrors: handleClearErrors
  };
};