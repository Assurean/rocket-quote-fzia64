import React, { useMemo, useCallback } from 'react';
import { Chart } from '../../../shared/src/components/data/Chart';
import useAnalytics from '../hooks/useAnalytics';
import { calculateConversionMetrics, ConversionMetrics } from '../utils/metrics';
import { colors } from '../../../shared/src/theme/colors';
import { typography } from '../../../shared/src/theme/typography';

// Chart.js version 4.4.0
import { ChartData, ChartOptions } from 'chart.js';

// Types
type InsuranceVertical = 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial' | 'all';

interface ConversionChartProps {
  vertical: InsuranceVertical;
  timeframe: {
    start: Date;
    end: Date;
    refreshInterval?: number;
  };
  height?: string;
  width?: string;
  accessibility?: {
    ariaLabel?: string;
    highContrast?: boolean;
  };
  performance?: {
    cacheTimeout?: number;
    lazyLoad?: boolean;
  };
}

/**
 * Transforms conversion metrics into Chart.js format with optimizations
 * @param metrics Conversion metrics data
 * @param vertical Selected insurance vertical
 * @returns Formatted chart data
 */
const transformDataForChart = (
  metrics: ConversionMetrics | null,
  vertical: InsuranceVertical
): ChartData => {
  if (!metrics) {
    return {
      labels: [],
      datasets: []
    };
  }

  const verticalColors = vertical !== 'all' 
    ? colors.verticals[vertical]
    : colors.ui;

  const labels = Object.keys(metrics.rateByStep);
  const data = Object.values(metrics.rateByStep);

  return {
    labels,
    datasets: [{
      label: 'Conversion Rate (%)',
      data,
      backgroundColor: verticalColors.primary,
      borderColor: verticalColors.dark,
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: verticalColors.light,
      pointBorderColor: verticalColors.contrast,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: verticalColors.primary,
      pointHoverBorderColor: verticalColors.contrast
    }]
  };
};

/**
 * Enterprise-grade conversion metrics visualization component
 * Features real-time updates, accessibility support, and performance optimizations
 */
export const ConversionChart: React.FC<ConversionChartProps> = ({
  vertical = 'all',
  timeframe,
  height = '400px',
  width = '100%',
  accessibility = {},
  performance = {}
}) => {
  // Initialize analytics hook with refresh interval
  const { state: analyticsState } = useAnalytics(
    {
      start: timeframe.start,
      end: timeframe.end
    },
    timeframe.refreshInterval || 300000 // Default 5-minute refresh
  );

  // Memoized chart options
  const chartOptions: ChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750
    },
    plugins: {
      title: {
        display: true,
        text: `Conversion Metrics - ${vertical.toUpperCase()}`,
        font: {
          family: typography.fontFamily,
          size: parseInt(typography.fontSize['2xl']),
          weight: 700
        }
      },
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          font: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.base)
          },
          usePointStyle: true
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: colors.ui.surface,
        titleColor: colors.ui.text.primary,
        bodyColor: colors.ui.text.secondary,
        borderColor: colors.ui.border,
        borderWidth: 1,
        padding: 12,
        titleFont: {
          family: typography.fontFamily,
          size: parseInt(typography.fontSize.sm),
          weight: 600
        },
        bodyFont: {
          family: typography.fontFamily,
          size: parseInt(typography.fontSize.sm)
        },
        callbacks: {
          label: (context) => `Conversion Rate: ${context.parsed.y.toFixed(2)}%`
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
        max: 100,
        grid: {
          color: colors.ui.divider
        },
        ticks: {
          font: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.sm)
          },
          callback: (value) => `${value}%`
        }
      }
    }
  }), [vertical]);

  // Memoized chart data transformation
  const chartData = useMemo(() => 
    transformDataForChart(analyticsState.conversionMetrics, vertical),
    [analyticsState.conversionMetrics, vertical]
  );

  // Loading state handler
  const handleLoading = useCallback((loading: boolean) => {
    return loading && (
      <div style={{ 
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }}>
        Loading conversion metrics...
      </div>
    );
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        height,
        width
      }}
      role="region"
      aria-label={accessibility.ariaLabel || `Conversion metrics chart for ${vertical} insurance`}
    >
      <Chart
        type="line"
        data={chartData}
        options={chartOptions}
        height={height}
        width={width}
        loading={analyticsState.loading}
        vertical={vertical !== 'all' ? vertical : undefined}
        ariaLabel={accessibility.ariaLabel}
      />
      {handleLoading(analyticsState.loading)}
    </div>
  );
};

export default ConversionChart;