import React, { useMemo, useCallback } from 'react';
import dayjs from 'dayjs'; // v1.11.0
import { Chart } from '@shared/components/data/Chart';
import { useAnalytics, AnalyticsState } from '../hooks/useAnalytics';
import { RevenueMetrics } from '../utils/metrics';
import { colors } from '@shared/theme/colors';
import { typography } from '@shared/theme/typography';
import { InsuranceVertical } from '../../../../backend/services/lead-service/src/interfaces/lead.interface';

interface RevenueChartProps {
  height?: string;
  width?: string;
  timeframe: { start: Date; end: Date };
  vertical?: InsuranceVertical | 'all';
  showComparison?: boolean;
  showGrowthRate?: boolean;
  interactionMode?: 'hover' | 'click';
  onDataPointClick?: (point: { value: number; date: Date; vertical: string }) => void;
}

const formatChartData = (
  metrics: RevenueMetrics | null,
  showComparison: boolean,
  showGrowthRate: boolean
) => {
  if (!metrics) return null;

  const datasets = [];
  const verticalColors = colors.verticals;

  // Main revenue dataset
  datasets.push({
    label: 'Total Revenue',
    data: Object.values(metrics.revenueByVertical),
    backgroundColor: Object.values(verticalColors).map(c => c.primary),
    borderColor: Object.values(verticalColors).map(c => c.primary),
    borderWidth: 2,
    fill: false,
    tension: 0.4
  });

  // Growth rate overlay if enabled
  if (showGrowthRate) {
    datasets.push({
      label: 'Growth Rate',
      data: [metrics.monthOverMonthGrowth],
      backgroundColor: colors.feedback.success.light,
      borderColor: colors.feedback.success.main,
      borderDash: [5, 5],
      borderWidth: 2,
      fill: false,
      yAxisID: 'growth'
    });
  }

  // Comparison with previous period if enabled
  if (showComparison) {
    datasets.push({
      label: 'Previous Period',
      data: Object.values(metrics.revenueByVertical).map(v => v * 0.75), // Example comparison
      backgroundColor: 'rgba(0,0,0,0.1)',
      borderColor: colors.ui.secondary,
      borderWidth: 1,
      fill: false
    });
  }

  return {
    labels: Object.keys(metrics.revenueByVertical),
    datasets
  };
};

const getChartOptions = (
  vertical: InsuranceVertical | 'all',
  interactionMode: 'hover' | 'click'
) => {
  const verticalColor = vertical !== 'all' ? colors.verticals[vertical].primary : colors.ui.primary;

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: interactionMode,
      intersect: false
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.sm),
            weight: 500
          },
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: colors.ui.surface,
        titleColor: colors.ui.text.primary,
        bodyColor: colors.ui.text.secondary,
        borderColor: colors.ui.border,
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            return `$${context.raw.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.sm)
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: colors.ui.divider
        },
        ticks: {
          font: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.sm)
          },
          callback: (value: number) => `$${value.toLocaleString()}`
        }
      },
      growth: {
        position: 'right' as const,
        beginAtZero: true,
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.sm)
          },
          callback: (value: number) => `${value}%`
        }
      }
    }
  };
};

export const RevenueChart: React.FC<RevenueChartProps> = ({
  height = '400px',
  width = '100%',
  timeframe,
  vertical = 'all',
  showComparison = false,
  showGrowthRate = true,
  interactionMode = 'hover',
  onDataPointClick
}) => {
  // Get analytics data with memoized hook
  const { state: analyticsState } = useAnalytics(timeframe);

  // Memoize chart data formatting
  const chartData = useMemo(() => {
    return formatChartData(
      analyticsState.revenueMetrics,
      showComparison,
      showGrowthRate
    );
  }, [analyticsState.revenueMetrics, showComparison, showGrowthRate]);

  // Memoize chart options
  const chartOptions = useMemo(() => {
    return getChartOptions(vertical, interactionMode);
  }, [vertical, interactionMode]);

  // Handle chart click events
  const handleClick = useCallback((event: any, elements: any[]) => {
    if (!onDataPointClick || !elements.length) return;

    const dataIndex = elements[0].index;
    const dataset = chartData?.datasets[elements[0].datasetIndex];
    if (!dataset) return;

    onDataPointClick({
      value: dataset.data[dataIndex],
      date: new Date(),
      vertical: chartData?.labels[dataIndex] || 'unknown'
    });
  }, [chartData, onDataPointClick]);

  // Enhanced options with click handler
  const enhancedOptions = useMemo(() => ({
    ...chartOptions,
    onClick: interactionMode === 'click' ? handleClick : undefined
  }), [chartOptions, interactionMode, handleClick]);

  if (!chartData) {
    return (
      <div 
        style={{ 
          height, 
          width, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: colors.ui.text.secondary
        }}
      >
        No revenue data available
      </div>
    );
  }

  return (
    <Chart
      type="line"
      data={chartData}
      options={enhancedOptions}
      height={height}
      width={width}
      loading={analyticsState.loading}
      vertical={vertical !== 'all' ? vertical : undefined}
      ariaLabel="Revenue metrics chart showing total revenue and growth trends"
    />
  );
};

export default RevenueChart;