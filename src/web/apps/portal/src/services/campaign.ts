/**
 * @fileoverview Enhanced campaign service implementation for the buyer portal
 * Provides comprehensive CRUD operations with validation, retry logic, and monitoring
 * @version 1.0.0
 */

// External imports with versions
import { injectable } from 'inversify'; // ^6.1.0
import { z } from 'zod'; // ^3.22.0
import axiosRetry from 'axios-retry'; // ^3.8.0

// Internal imports
import { ApiService } from './api';
import {
  ICampaign,
  IListCampaignsRequest,
  IListCampaignsResponse,
  InsuranceVertical,
  CampaignStatus,
  ICreateCampaignRequest,
  IUpdateCampaignRequest
} from '../../../backend/services/campaign-service/src/interfaces/campaign.interface';

// Constants
const CAMPAIGN_API_PATH = '/api/v1/campaigns';

// Validation schemas using zod
const campaignFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS']),
  value: z.any()
});

const listCampaignsRequestSchema = z.object({
  buyerId: z.string().optional(),
  vertical: z.enum(['AUTO', 'HOME', 'HEALTH', 'LIFE', 'RENTERS', 'COMMERCIAL']).optional(),
  status: z.array(z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'DELETED'])).optional(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

const createCampaignSchema = z.object({
  buyerId: z.string().uuid(),
  name: z.string().min(1).max(100),
  vertical: z.enum(['AUTO', 'HOME', 'HEALTH', 'LIFE', 'RENTERS', 'COMMERCIAL']),
  filters: z.object({
    rules: z.array(campaignFilterSchema),
    matchType: z.enum(['ALL', 'ANY'])
  }),
  maxCpl: z.number().positive(),
  dailyBudget: z.number().positive()
});

/**
 * Enhanced campaign service with comprehensive error handling, validation, and monitoring
 */
@injectable()
export class CampaignService {
  private readonly retryConfig: axiosRetry.IAxiosRetryConfig;

  constructor(
    private readonly apiService: ApiService
  ) {
    // Configure retry strategy
    this.retryConfig = {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 ||
          error.response?.status >= 500;
      }
    };
  }

  /**
   * Retrieves a paginated list of campaigns with enhanced error handling
   * @param request - List campaigns request parameters
   * @returns Promise with validated campaign list response
   */
  public async listCampaigns(request: IListCampaignsRequest): Promise<IListCampaignsResponse> {
    try {
      // Validate request parameters
      const validatedRequest = listCampaignsRequestSchema.parse(request);

      // Build query parameters
      const params = new URLSearchParams();
      Object.entries(validatedRequest).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, Array.isArray(value) ? value.join(',') : value.toString());
        }
      });

      // Make API request with retry logic and monitoring
      const response = await this.apiService.get<IListCampaignsResponse>(
        `${CAMPAIGN_API_PATH}?${params.toString()}`,
        { 
          ...this.retryConfig,
          headers: { 'x-request-source': 'buyer-portal' }
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError('Failed to list campaigns', error);
    }
  }

  /**
   * Retrieves a single campaign by ID with validation
   * @param id - Campaign ID
   * @returns Promise with campaign details
   */
  public async getCampaign(id: string): Promise<ICampaign> {
    try {
      // Validate campaign ID format
      if (!z.string().uuid().safeParse(id).success) {
        throw new Error('Invalid campaign ID format');
      }

      const response = await this.apiService.get<ICampaign>(
        `${CAMPAIGN_API_PATH}/${id}`,
        this.retryConfig
      );

      return response.data;
    } catch (error) {
      throw this.handleError('Failed to retrieve campaign', error);
    }
  }

  /**
   * Creates a new campaign with comprehensive validation
   * @param campaign - Campaign creation request
   * @returns Promise with created campaign
   */
  public async createCampaign(campaign: ICreateCampaignRequest): Promise<ICampaign> {
    try {
      // Validate campaign data
      const validatedCampaign = createCampaignSchema.parse(campaign);

      const response = await this.apiService.post<ICampaign>(
        CAMPAIGN_API_PATH,
        validatedCampaign,
        this.retryConfig
      );

      return response.data;
    } catch (error) {
      throw this.handleError('Failed to create campaign', error);
    }
  }

  /**
   * Updates an existing campaign with partial data
   * @param id - Campaign ID
   * @param updates - Campaign update data
   * @returns Promise with updated campaign
   */
  public async updateCampaign(id: string, updates: Partial<IUpdateCampaignRequest>): Promise<ICampaign> {
    try {
      // Validate campaign ID
      if (!z.string().uuid().safeParse(id).success) {
        throw new Error('Invalid campaign ID format');
      }

      const response = await this.apiService.put<ICampaign>(
        `${CAMPAIGN_API_PATH}/${id}`,
        updates,
        this.retryConfig
      );

      return response.data;
    } catch (error) {
      throw this.handleError('Failed to update campaign', error);
    }
  }

  /**
   * Deletes a campaign by ID
   * @param id - Campaign ID
   * @returns Promise<void>
   */
  public async deleteCampaign(id: string): Promise<void> {
    try {
      // Validate campaign ID
      if (!z.string().uuid().safeParse(id).success) {
        throw new Error('Invalid campaign ID format');
      }

      await this.apiService.delete(
        `${CAMPAIGN_API_PATH}/${id}`,
        this.retryConfig
      );
    } catch (error) {
      throw this.handleError('Failed to delete campaign', error);
    }
  }

  /**
   * Enhanced error handler with detailed error information
   * @param message - Error context message
   * @param error - Original error object
   * @returns Formatted error with additional context
   */
  private handleError(message: string, error: any): Error {
    const errorMessage = error.response?.data?.message || error.message;
    const errorDetails = {
      message: `${message}: ${errorMessage}`,
      status: error.response?.status,
      code: error.code,
      timestamp: new Date().toISOString(),
      requestId: error.config?.headers?.['x-request-id']
    };

    console.error('Campaign Service Error:', errorDetails);
    return new Error(errorDetails.message);
  }
}