// @ts-nocheck
import { Document } from 'mongoose'; // v7.0.0

/**
 * Enum representing supported insurance verticals in the system
 */
export enum InsuranceVertical {
  AUTO = 'AUTO',
  HOME = 'HOME',
  HEALTH = 'HEALTH',
  LIFE = 'LIFE',
  RENTERS = 'RENTERS',
  COMMERCIAL = 'COMMERCIAL'
}

/**
 * Enum representing all possible lead statuses throughout the processing pipeline
 */
export enum LeadStatus {
  CREATED = 'CREATED',         // Initial lead creation
  VALIDATING = 'VALIDATING',   // Data validation in progress
  VALIDATED = 'VALIDATED',     // Data validation complete
  SCORING = 'SCORING',         // ML scoring in progress
  SCORED = 'SCORED',          // ML scoring complete
  MATCHED = 'MATCHED',        // Matched to buyer campaign
  SOLD = 'SOLD',             // Successfully sold to buyer
  REJECTED = 'REJECTED',      // Failed validation or scoring
  ERROR = 'ERROR',           // System error during processing
  PARTIAL = 'PARTIAL'        // Incomplete form submission
}

/**
 * Interface for contact information with PII handling considerations
 */
export interface IContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: IAddress;
  dateOfBirth: Date;
  ssn?: string; // Optional SSN field, requires encryption
}

/**
 * Interface for address information with validation tracking
 */
export interface IAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  validatedAt?: Date;
  geocode?: {
    lat: number;
    lng: number;
  };
}

/**
 * Interface for vertical-specific data with validation results
 */
export interface IVerticalData {
  vertical: InsuranceVertical;
  data: IAutoData | IHomeData | IHealthData | ILifeData | IRentersData | ICommercialData;
  validationResults: Record<string, boolean>;
  enrichmentData: Record<string, any>;
}

/**
 * Main interface for lead document with comprehensive tracking
 */
export interface ILead {
  id: string;
  vertical: InsuranceVertical;
  contact_info: IContactInfo;
  vertical_data: IVerticalData;
  traffic_source: string;
  ml_score: number;
  status: LeadStatus;
  created_at: Date;
  updated_at: Date;
  validation_history: Array<{
    timestamp: Date;
    status: LeadStatus;
    message?: string;
  }>;
  encryption_status: {
    pii: boolean;
    sensitive: boolean;
  };
}

/**
 * Combined interface for lead document with Mongoose methods
 */
export interface ILeadDocument extends ILead, Document {}

/**
 * Vertical-specific interfaces for type safety
 */
export interface IAutoData {
  vehicleYear: number;
  make: string;
  model: string;
  vin?: string;
  primaryUse: 'PERSONAL' | 'BUSINESS' | 'RIDESHARE';
  currentInsurance?: string;
  driverLicense?: string;
  accidents?: number;
  violations?: number;
}

export interface IHomeData {
  propertyType: string;
  yearBuilt: number;
  squareFeet: number;
  constructionType: string;
  roofAge: number;
  securitySystem: boolean;
  currentInsurance?: string;
  claims?: number;
}

export interface IHealthData {
  coverageType: 'INDIVIDUAL' | 'FAMILY';
  preExistingConditions: boolean;
  tobacco: boolean;
  currentInsurance?: string;
  medications?: number;
  preferredDeductible?: number;
}

export interface ILifeData {
  coverageAmount: number;
  beneficiaries: number;
  tobacco: boolean;
  occupation: string;
  income: number;
  existingPolicy?: string;
  medicalConditions?: string[];
}

export interface IRentersData {
  propertyType: string;
  personalProperty: number;
  pets: boolean;
  securitySystem: boolean;
  currentInsurance?: string;
  claims?: number;
}

export interface ICommercialData {
  businessType: string;
  revenue: number;
  employees: number;
  yearsInBusiness: number;
  industry: string;
  currentInsurance?: string;
  claims?: number;
  coverageTypes: string[];
}