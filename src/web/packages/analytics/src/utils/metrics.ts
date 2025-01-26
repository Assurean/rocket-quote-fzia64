// External imports
import dayjs from 'dayjs'; // v1.11.0

// Internal imports
import { 
  ILead, 
  InsuranceVertical, 
  LeadStatus 
} from '../../../../backend/services/lead-service/src/interfaces/lead.interface';

// Interfaces for metric calculations
export interface LeadMetrics {
  acceptanceRate: number;
  acceptanceByVertical: Record<InsuranceVertical, number>;
  qualityScore: number;
  totalLeads: number;
  qualityTrend: number[];
  verticalDistribution: Record<InsuranceVertical, number>;
}

export interface RevenueMetrics {
  totalRevenue: number;
  revenueByVertical: Record<InsuranceVertical, number>;
  growthRate: number;
  averageCPL: number;
  rtbRevenue: number;
  monthOverMonthGrowth: number;
  projectedRevenue: number;
}

export interface ConversionMetrics {
  overallRate: number;
  rateByStep: Record<string, number>;
  rateByVertical: Record<InsuranceVertical, number>;
  dropoffPoints: Record<string, number>;
  deviceTypeConversion: Record<string, number>;
}

export interface RTBMetrics {
  averageBid: number;
  clickThroughRate: number;
  revenuePerClick: number;
  totalClicks: number;
  bidTrends: Array<{timestamp: Date, avgBid: number}>;
  competitorAnalysis: Record<string, number>;
}

// Cache interface for metric calculations
interface MetricCache {
  timestamp: Date;
  metrics: LeadMetrics;
}

// Cache duration in minutes
const CACHE_DURATION = 15;

// In-memory cache store
const metricCache: Map<string, MetricCache> = new Map();

/**
 * Calculates comprehensive lead acceptance rate metrics with caching and validation
 * @param leads Array of leads to analyze
 * @param timeframe Analysis period
 * @returns LeadMetrics object containing calculated metrics
 */
export const calculateLeadAcceptanceRate = (
  leads: ILead[],
  timeframe: { start: Date; end: Date }
): LeadMetrics => {
  // Input validation
  if (!leads?.length) {
    throw new Error('Lead array cannot be empty');
  }
  if (!timeframe?.start || !timeframe?.end) {
    throw new Error('Invalid timeframe provided');
  }

  // Generate cache key
  const cacheKey = `${timeframe.start.getTime()}-${timeframe.end.getTime()}`;

  // Check cache
  const cachedResult = metricCache.get(cacheKey);
  if (cachedResult && dayjs().diff(cachedResult.timestamp, 'minute') < CACHE_DURATION) {
    return cachedResult.metrics;
  }

  // Filter leads by timeframe
  const filteredLeads = leads.filter(lead => {
    const leadDate = dayjs(lead.created_at);
    return leadDate.isAfter(timeframe.start) && leadDate.isBefore(timeframe.end);
  });

  // Initialize vertical tracking
  const verticalCounts: Record<InsuranceVertical, number> = {
    [InsuranceVertical.AUTO]: 0,
    [InsuranceVertical.HOME]: 0,
    [InsuranceVertical.HEALTH]: 0,
    [InsuranceVertical.LIFE]: 0,
    [InsuranceVertical.RENTERS]: 0,
    [InsuranceVertical.COMMERCIAL]: 0
  };

  const acceptedByVertical: Record<InsuranceVertical, number> = { ...verticalCounts };

  // Calculate metrics
  let totalAccepted = 0;
  filteredLeads.forEach(lead => {
    verticalCounts[lead.vertical]++;
    if (lead.status === LeadStatus.SOLD) {
      totalAccepted++;
      acceptedByVertical[lead.vertical]++;
    }
  });

  // Calculate acceptance rates by vertical
  const acceptanceByVertical: Record<InsuranceVertical, number> = {};
  Object.keys(verticalCounts).forEach(vertical => {
    const verticalKey = vertical as InsuranceVertical;
    acceptanceByVertical[verticalKey] = verticalCounts[verticalKey] > 0
      ? (acceptedByVertical[verticalKey] / verticalCounts[verticalKey]) * 100
      : 0;
  });

  // Calculate overall acceptance rate
  const acceptanceRate = (totalAccepted / filteredLeads.length) * 100;

  // Calculate quality score (weighted average of acceptance rates)
  const qualityScore = Object.values(acceptanceByVertical).reduce((acc, rate) => acc + rate, 0) / 
    Object.keys(acceptanceByVertical).length;

  // Calculate vertical distribution
  const verticalDistribution: Record<InsuranceVertical, number> = {};
  Object.keys(verticalCounts).forEach(vertical => {
    const verticalKey = vertical as InsuranceVertical;
    verticalDistribution[verticalKey] = (verticalCounts[verticalKey] / filteredLeads.length) * 100;
  });

  // Generate quality trend (last 7 days)
  const qualityTrend: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = dayjs(timeframe.end).subtract(i, 'day').startOf('day');
    const dayEnd = dayjs(timeframe.end).subtract(i, 'day').endOf('day');
    
    const dayLeads = filteredLeads.filter(lead => {
      const leadDate = dayjs(lead.created_at);
      return leadDate.isAfter(dayStart) && leadDate.isBefore(dayEnd);
    });

    const dayAccepted = dayLeads.filter(lead => lead.status === LeadStatus.SOLD).length;
    const dayRate = dayLeads.length > 0 ? (dayAccepted / dayLeads.length) * 100 : 0;
    qualityTrend.push(dayRate);
  }

  // Compile metrics
  const metrics: LeadMetrics = {
    acceptanceRate,
    acceptanceByVertical,
    qualityScore,
    totalLeads: filteredLeads.length,
    qualityTrend,
    verticalDistribution
  };

  // Cache results
  metricCache.set(cacheKey, {
    timestamp: new Date(),
    metrics
  });

  return metrics;
};

/**
 * Clears the metric calculation cache
 */
export const clearMetricCache = (): void => {
  metricCache.clear();
};

/**
 * Validates timeframe input for metric calculations
 * @param timeframe Timeframe object to validate
 * @returns boolean indicating validity
 */
export const isValidTimeframe = (timeframe: { start: Date; end: Date }): boolean => {
  if (!timeframe?.start || !timeframe?.end) {
    return false;
  }
  
  const start = dayjs(timeframe.start);
  const end = dayjs(timeframe.end);
  
  return start.isValid() && 
         end.isValid() && 
         end.isAfter(start) && 
         end.diff(start, 'year') <= 1; // Limit to 1 year of data
};