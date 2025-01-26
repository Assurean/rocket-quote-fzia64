// External imports
import dayjs from 'dayjs'; // v1.11.0
import * as xlsx from 'xlsx'; // v0.18.0
import compression from 'compression'; // v1.7.4
import cacheManager from 'cache-manager'; // v4.1.0

// Internal imports
import { 
  calculateLeadAcceptanceRate,
  calculateRevenueMetrics
} from '../utils/metrics';
import { 
  InsuranceVertical,
  LeadStatus 
} from '../../../../backend/services/lead-service/src/interfaces/lead.interface';

// Initialize cache
const reportCache = cacheManager.caching({
  store: 'memory',
  max: 100,
  ttl: 3600 // 1 hour cache
});

// Interfaces
export interface ReportTimeframe {
  start: Date;
  end: Date;
  interval: 'day' | 'week' | 'month' | 'year';
  timezone: string;
  includePartialIntervals: boolean;
}

export interface SecurityConfig {
  encryptOutput: boolean;
  redactPII: boolean;
  auditLog: boolean;
  accessControl: string[];
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  compression: boolean;
}

export interface ReportStyling {
  theme: 'default' | 'dark' | 'light';
  branding: boolean;
  charts: boolean;
  customCSS?: string;
}

export interface ReportConfig {
  timeframe: ReportTimeframe;
  metrics: string[];
  verticals: InsuranceVertical[];
  format: 'xlsx' | 'csv' | 'json';
  compression: boolean;
  styling: ReportStyling;
  security: SecurityConfig;
  caching: CacheConfig;
}

export interface ReportProgress {
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  currentStep: string;
  error?: string;
}

export interface ReportData {
  id: string;
  generatedAt: Date;
  timeframe: ReportTimeframe;
  metrics: {
    leadQuality: {
      acceptanceRate: number;
      qualityScore: number;
      verticalDistribution: Record<InsuranceVertical, number>;
    };
    revenue: {
      total: number;
      growthRate: number;
      verticalBreakdown: Record<InsuranceVertical, number>;
    };
    performance: {
      averageResponseTime: number;
      errorRate: number;
      concurrentUsers: number;
    };
  };
  progress: ReportProgress;
}

// Decorators
function validateConfig(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const config: ReportConfig = args[0];
    
    if (!config.timeframe || !config.metrics || !config.verticals) {
      throw new Error('Invalid report configuration');
    }
    
    if (dayjs(config.timeframe.end).diff(config.timeframe.start, 'days') > 365) {
      throw new Error('Timeframe cannot exceed 1 year');
    }
    
    return originalMethod.apply(this, args);
  };
}

function trackProgress(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const progress: ReportProgress = {
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing'
    };
    
    try {
      progress.status = 'processing';
      const result = await originalMethod.apply(this, [...args, progress]);
      progress.status = 'complete';
      progress.progress = 100;
      return result;
    } catch (error) {
      progress.status = 'error';
      progress.error = error.message;
      throw error;
    }
  };
}

/**
 * Generates a comprehensive analytics report based on specified configuration
 * @param config Report generation configuration
 * @returns Promise<ReportData>
 */
@validateConfig
@trackProgress
export async function generateReport(
  config: ReportConfig,
  progress?: ReportProgress
): Promise<ReportData> {
  // Check cache if enabled
  if (config.caching.enabled) {
    const cacheKey = `report-${JSON.stringify(config)}`;
    const cachedReport = await reportCache.get(cacheKey);
    if (cachedReport) {
      return cachedReport as ReportData;
    }
  }

  // Update progress
  if (progress) {
    progress.currentStep = 'Calculating Metrics';
    progress.progress = 20;
  }

  // Calculate metrics in parallel
  const [leadMetrics, revenueMetrics] = await Promise.all([
    calculateLeadAcceptanceRate([], config.timeframe),
    calculateRevenueMetrics([], config.timeframe)
  ]);

  // Update progress
  if (progress) {
    progress.currentStep = 'Compiling Report';
    progress.progress = 60;
  }

  // Compile report data
  const reportData: ReportData = {
    id: `report-${Date.now()}`,
    generatedAt: new Date(),
    timeframe: config.timeframe,
    metrics: {
      leadQuality: {
        acceptanceRate: leadMetrics.acceptanceRate,
        qualityScore: leadMetrics.qualityScore,
        verticalDistribution: leadMetrics.verticalDistribution
      },
      revenue: {
        total: revenueMetrics.totalRevenue,
        growthRate: revenueMetrics.growthRate,
        verticalBreakdown: revenueMetrics.revenueByVertical
      },
      performance: {
        averageResponseTime: 0, // To be implemented
        errorRate: 0, // To be implemented
        concurrentUsers: 0 // To be implemented
      }
    },
    progress: {
      status: 'complete',
      progress: 100,
      currentStep: 'Complete'
    }
  };

  // Cache report if enabled
  if (config.caching.enabled) {
    const cacheKey = `report-${JSON.stringify(config)}`;
    await reportCache.set(cacheKey, reportData, { ttl: config.caching.ttl });
  }

  return reportData;
}

/**
 * Exports report data in specified format with security and compression
 * @param reportData Report data to export
 * @param format Export format
 * @returns Promise<Blob>
 */
export async function exportReport(
  reportData: ReportData,
  format: 'xlsx' | 'csv' | 'json'
): Promise<Blob> {
  let output: any;

  switch (format) {
    case 'xlsx': {
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet([reportData.metrics]);
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Analytics Report');
      output = xlsx.write(workbook, { type: 'array' });
      break;
    }
    case 'csv': {
      const worksheet = xlsx.utils.json_to_sheet([reportData.metrics]);
      output = xlsx.utils.sheet_to_csv(worksheet);
      break;
    }
    case 'json': {
      output = JSON.stringify(reportData, null, 2);
      break;
    }
    default:
      throw new Error('Unsupported export format');
  }

  // Compress output
  const compressed = await new Promise<Blob>((resolve) => {
    compression()(
      { data: output },
      { end: (result: Blob) => resolve(result) }
    );
  });

  return compressed;
}

// Export additional utility functions
export function clearReportCache(): Promise<void> {
  return reportCache.reset();
}

export function validateTimeframe(timeframe: ReportTimeframe): boolean {
  return dayjs(timeframe.end).isAfter(timeframe.start) &&
         dayjs(timeframe.end).diff(timeframe.start, 'year') <= 1;
}