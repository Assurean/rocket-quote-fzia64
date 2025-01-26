/**
 * @fileoverview Campaign service interface definitions for the Multi-Vertical Insurance Lead Generation Platform.
 * Provides comprehensive type safety and validation for campaign management operations.
 * @version 1.0.0
 */

// External imports
import { Document } from 'mongoose'; // v7.5.0

/**
 * Supported insurance verticals in the platform
 */
export type InsuranceVertical = 'AUTO' | 'HOME' | 'HEALTH' | 'LIFE' | 'RENTERS' | 'COMMERCIAL';

/**
 * Valid campaign status values
 */
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DELETED';

/**
 * Campaign filter comparison operators
 */
export type CampaignFilterOperator = 
  | 'EQUALS' 
  | 'NOT_EQUALS' 
  | 'GREATER_THAN' 
  | 'LESS_THAN' 
  | 'IN' 
  | 'NOT_IN' 
  | 'CONTAINS' 
  | 'NOT_CONTAINS';

/**
 * Individual campaign filter rule structure
 */
export type CampaignFilterRule = {
  field: string;
  operator: CampaignFilterOperator;
  value: any;
};

/**
 * Core campaign interface defining all required fields and types
 */
export interface ICampaign {
  id: string;
  buyerId: string;
  name: string;
  vertical: InsuranceVertical;
  filters: {
    rules: CampaignFilterRule[];
    matchType: 'ALL' | 'ANY';
  };
  maxCpl: number;
  dailyBudget: number;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * MongoDB document interface extending the base campaign interface
 */
export interface ICampaignDocument extends ICampaign, Document {}

/**
 * Interface for campaign creation requests
 */
export interface ICreateCampaignRequest {
  buyerId: string;
  name: string;
  vertical: InsuranceVertical;
  filters: {
    rules: CampaignFilterRule[];
    matchType: 'ALL' | 'ANY';
  };
  maxCpl: number;
  dailyBudget: number;
}

/**
 * Interface for campaign update requests with optional fields
 */
export interface IUpdateCampaignRequest {
  id: string;
  name?: string;
  filters?: {
    rules: CampaignFilterRule[];
    matchType: 'ALL' | 'ANY';
  };
  maxCpl?: number;
  dailyBudget?: number;
  status?: CampaignStatus;
}

/**
 * Interface for campaign listing requests with pagination and filtering
 */
export interface IListCampaignsRequest {
  buyerId?: string;
  vertical?: InsuranceVertical;
  status?: CampaignStatus[];
  page: number;
  pageSize: number;
  sortBy?: keyof ICampaign;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for paginated campaign list responses
 */
export interface IListCampaignsResponse {
  campaigns: ICampaign[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}