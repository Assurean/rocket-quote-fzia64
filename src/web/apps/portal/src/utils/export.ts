// External imports with versions
import { Parser } from 'json2csv'; // v6.0.0
import * as XLSX from 'xlsx'; // v0.18.0
import dayjs from 'dayjs'; // v1.11.0
import * as pako from 'pako'; // v2.1.0

// Internal imports
import { calculateLeadAcceptanceRate, calculateRevenueMetrics } from '../../../../packages/analytics/src/utils/metrics';
import { CampaignService } from '../services/campaign';
import { InsuranceVertical } from '../../../../backend/services/lead-service/src/interfaces/lead.interface';

// Constants
const CHUNK_SIZE = 1000;
const MAX_RETRIES = 3;
const COMPRESSION_THRESHOLD = 1024 * 1024; // 1MB

/**
 * Enum for supported export formats
 */
export enum ExportFormat {
  CSV = 'CSV',
  EXCEL = 'EXCEL',
  JSON = 'JSON',
  COMPRESSED_JSON = 'COMPRESSED_JSON'
}

/**
 * Interface for export configuration options
 */
export interface ExportOptions {
  format: ExportFormat;
  dateRange: {
    start: Date;
    end: Date;
  };
  includeMetrics: boolean;
  fileName: string;
  compression?: boolean;
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  fieldMapping?: Record<string, string>;
  fileNamePattern?: string;
}

/**
 * Exports campaign data with enhanced performance and error handling
 * @param options Export configuration options
 * @returns Promise<Blob> Exported data file as blob
 */
export async function exportCampaignData(options: ExportOptions): Promise<Blob> {
  try {
    validateExportOptions(options);

    const campaignService = new CampaignService();
    let allData: any[] = [];
    let currentPage = 1;
    let hasMoreData = true;

    // Fetch data in chunks with progress tracking
    while (hasMoreData) {
      const response = await campaignService.listCampaigns({
        page: currentPage,
        pageSize: options.chunkSize || CHUNK_SIZE,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      if (response.campaigns.length === 0) {
        hasMoreData = false;
      } else {
        allData = [...allData, ...response.campaigns];
        currentPage++;

        if (options.onProgress) {
          const progress = Math.min((currentPage * CHUNK_SIZE) / response.total * 100, 100);
          options.onProgress(progress);
        }
      }
    }

    // Apply field mapping if specified
    if (options.fieldMapping) {
      allData = mapFields(allData, options.fieldMapping);
    }

    // Generate file based on format
    const blob = await generateFile(allData, options);
    return blob;
  } catch (error) {
    console.error('Export error:', error);
    throw new Error(`Failed to export campaign data: ${error.message}`);
  }
}

/**
 * Exports enhanced analytics metrics report with trend analysis
 * @param options Export configuration options
 * @returns Promise<Blob> Exported report file as blob
 */
export async function exportMetricsReport(options: ExportOptions): Promise<Blob> {
  try {
    validateExportOptions(options);

    const campaignService = new CampaignService();
    const campaigns = await campaignService.listCampaigns({
      page: 1,
      pageSize: 1000,
      dateRange: options.dateRange
    });

    // Calculate metrics
    const metrics = {
      leadMetrics: await calculateLeadAcceptanceRate(campaigns.campaigns, options.dateRange),
      revenueMetrics: await calculateRevenueMetrics(campaigns.campaigns, options.dateRange),
      verticalBreakdown: calculateVerticalBreakdown(campaigns.campaigns)
    };

    // Format report data
    const reportData = formatMetricsReport(metrics);

    // Generate file based on format
    const blob = await generateFile(reportData, options);
    return blob;
  } catch (error) {
    console.error('Metrics export error:', error);
    throw new Error(`Failed to export metrics report: ${error.message}`);
  }
}

/**
 * Validates export options
 * @param options Export options to validate
 */
function validateExportOptions(options: ExportOptions): void {
  if (!options.format || !Object.values(ExportFormat).includes(options.format)) {
    throw new Error('Invalid export format specified');
  }

  if (!options.dateRange?.start || !options.dateRange?.end) {
    throw new Error('Invalid date range specified');
  }

  if (options.chunkSize && (options.chunkSize < 1 || options.chunkSize > 10000)) {
    throw new Error('Invalid chunk size specified');
  }
}

/**
 * Maps fields according to provided mapping
 * @param data Data to map
 * @param mapping Field mapping configuration
 * @returns Mapped data
 */
function mapFields(data: any[], mapping: Record<string, string>): any[] {
  return data.map(item => {
    const mapped: any = {};
    Object.entries(mapping).forEach(([from, to]) => {
      mapped[to] = item[from];
    });
    return mapped;
  });
}

/**
 * Calculates vertical breakdown metrics
 * @param campaigns Campaign data
 * @returns Vertical breakdown metrics
 */
function calculateVerticalBreakdown(campaigns: any[]): Record<InsuranceVertical, number> {
  const breakdown: Partial<Record<InsuranceVertical, number>> = {};
  campaigns.forEach(campaign => {
    breakdown[campaign.vertical] = (breakdown[campaign.vertical] || 0) + 1;
  });
  return breakdown as Record<InsuranceVertical, number>;
}

/**
 * Formats metrics report data
 * @param metrics Metrics data to format
 * @returns Formatted report data
 */
function formatMetricsReport(metrics: any): any {
  return {
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    summary: {
      totalLeads: metrics.leadMetrics.totalLeads,
      averageAcceptanceRate: metrics.leadMetrics.acceptanceRate.toFixed(2) + '%',
      totalRevenue: `$${metrics.revenueMetrics.totalRevenue.toFixed(2)}`,
      averageCPL: `$${metrics.revenueMetrics.averageCPL.toFixed(2)}`
    },
    verticalBreakdown: metrics.verticalBreakdown,
    trends: {
      qualityTrend: metrics.leadMetrics.qualityTrend,
      revenueTrend: metrics.revenueMetrics.monthOverMonthGrowth
    }
  };
}

/**
 * Generates export file in specified format
 * @param data Data to export
 * @param options Export options
 * @returns Promise<Blob> Generated file as blob
 */
async function generateFile(data: any[], options: ExportOptions): Promise<Blob> {
  let content: any;
  let type: string;

  switch (options.format) {
    case ExportFormat.CSV:
      const parser = new Parser();
      content = parser.parse(data);
      type = 'text/csv';
      break;

    case ExportFormat.EXCEL:
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      content = XLSX.write(workbook, { type: 'array' });
      type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;

    case ExportFormat.JSON:
    case ExportFormat.COMPRESSED_JSON:
      content = JSON.stringify(data);
      if (options.compression || 
          (options.format === ExportFormat.COMPRESSED_JSON && content.length > COMPRESSION_THRESHOLD)) {
        content = pako.deflate(content);
        type = 'application/x-compressed';
      } else {
        type = 'application/json';
      }
      break;

    default:
      throw new Error('Unsupported export format');
  }

  return new Blob([content], { type });
}