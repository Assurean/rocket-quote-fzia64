import React, { memo, useMemo } from 'react';
import { Chart as ChartJS, ChartData, ChartOptions } from 'chart.js'; // v4.4.0
import { Chart } from '../../../shared/src/components/data/Chart';
import { useAnalytics, AnalyticsState, AnalyticsError } from '../hooks/useAnalytics';
import { LeadMetrics, VerticalMetrics } from '../utils/metrics';
import { colors } from '../../../shared/src/theme/colors';
import { typography } from '../../../shared/src/theme/typography';

// Types for insurance verticals
type InsuranceVertical = 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';
type ChartType = 'line' | 'bar' | 'doughnut';

// Interface for responsive configuration
interface ResponsiveConfig {
  breakpoints: {
    sm?: number;
    md?: number;
    lg?: number;
  };
  options?: {
    [key: string]: Partial<ChartOptions>;
  };
}

// Props interface with comprehensive configuration options
interface LeadChartProps {
  vertical: InsuranceVertical;
  height?: string;
  width?: string;
  type?: ChartType;
  showLegend?: boolean;
  isLoading?: boolean;
  chartOptions?: ChartOptions;
  ariaLabel?: string;
  responsive?: ResponsiveConfig;
}

/**
 * Transforms lead metrics into Chart.js compatible format with theme integration
 */
const transformLeadData = memo((
  metrics: LeadMetrics,
  type: ChartType,
  vertical: InsuranceVertical
): ChartData => {
  const verticalColors = colors.verticals[vertical];
  
  // Validate metrics data
  if (!metrics || !metrics.acceptanceByVertical) {
    return {
      labels: [],
      datasets: []
    };
  }

  switch (type) {
    case 'line':
      return {
        labels: ['Day 7', 'Day 6', 'Day 5', 'Day 4', 'Day 3', 'Day 2', 'Day 1'],
        datasets: [{
          label: 'Quality Score Trend',
          data: metrics.qualityTrend,
          borderColor: verticalColors.primary,
          backgroundColor: verticalColors.light,
          fill: true,
          tension: 0.4
        }]
      };

    case 'bar':
      return {
        labels: Object.keys(metrics.acceptanceByVertical),
        datasets: [{
          label: 'Acceptance Rate by Vertical',
          data: Object.values(metrics.acceptanceByVertical),
          backgroundColor: Object.keys(metrics.acceptanceByVertical).map(
            v => colors.verticals[v as InsuranceVertical].primary
          ),
          borderColor: Object.keys(metrics.acceptanceByVertical).map(
            v => colors.verticals[v as InsuranceVertical].contrast
          ),
          borderWidth: 1
        }]
      };

    case 'doughnut':
      return {
        labels: Object.keys(metrics.verticalDistribution),
        datasets: [{
          data: Object.values(metrics.verticalDistribution),
          backgroundColor: Object.keys(metrics.verticalDistribution).map(
            v => colors.verticals[v as InsuranceVertical].primary
          ),
          borderColor: colors.ui.background,
          borderWidth: 2
        }]
      };

    default:
      return {
        labels: [],
        datasets: []
      };
  }
});

/**
 * LeadChart component for visualizing lead generation metrics with accessibility
 * and performance optimization
 */
export const LeadChart: React.FC<LeadChartProps> = memo(({
  vertical = 'auto',
  height = '300px',
  width = '100%',
  type = 'line',
  showLegend = true,
  isLoading = false,
  chartOptions = {},
  ariaLabel = 'Lead metrics visualization',
  responsive = {
    breakpoints: {
      sm: 576,
      md: 768,
      lg: 992
    }
  }
}) => {
  // Get analytics state using hook
  const { state: analyticsState } = useAnalytics({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    end: new Date()
  });

  // Memoize chart data transformation
  const chartData = useMemo(() => {
    if (!analyticsState.leadMetrics) return null;
    return transformLeadData(analyticsState.leadMetrics, type, vertical);
  }, [analyticsState.leadMetrics, type, vertical]);

  // Memoize chart options with theme integration
  const mergedOptions = useMemo(() => {
    const defaultOptions: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: showLegend,
          position: 'bottom',
          labels: {
            font: {
              family: typography.fontFamily,
              size: parseInt(typography.fontSize.base),
              weight: 500
            },
            padding: 16
          }
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          padding: 12,
          titleFont: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.sm),
            weight: 600
          },
          bodyFont: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.sm),
            weight: 400
          }
        }
      }
    };

    return {
      ...defaultOptions,
      ...chartOptions
    };
  }, [showLegend, chartOptions]);

  // Handle loading and error states
  if (analyticsState.error) {
    return (
      <div role="alert" aria-label="Chart error">
        Error loading chart data: {analyticsState.error}
      </div>
    );
  }

  if (!chartData) {
    return (
      <div role="status" aria-label="Loading chart">
        Loading chart data...
      </div>
    );
  }

  return (
    <Chart
      data={chartData}
      type={type}
      options={mergedOptions}
      height={height}
      width={width}
      responsive={true}
      vertical={vertical}
      loading={isLoading || analyticsState.loading}
      ariaLabel={ariaLabel}
    />
  );
});

LeadChart.displayName = 'LeadChart';

export default LeadChart;