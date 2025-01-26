// External imports
import { Chart, ChartType, ChartData, ChartOptions } from 'chart.js'; // v4.4.0

// Internal imports
import { LeadMetrics, RevenueMetrics } from '@analytics/utils/metrics';
import { InsuranceVertical } from '@backend/services/lead-service/src/interfaces/lead.interface';

// Type definitions for enhanced chart configuration
export interface ChartConfig {
  type: ChartType;
  options: ChartOptions;
  data: ChartData;
  accessibility: AccessibilityConfig;
  responsive: ResponsiveConfig;
}

interface AccessibilityConfig {
  ariaLabel: string;
  description?: string;
  keyboardNavigation: boolean;
  announceDataPoints: boolean;
}

interface ResponsiveConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  options: Record<string, Partial<ChartOptions>>;
}

// Vertical-specific color configuration
const chartColors: ChartColors = {
  primary: {
    [InsuranceVertical.AUTO]: '#1976D2',
    [InsuranceVertical.HOME]: '#2E7D32',
    [InsuranceVertical.HEALTH]: '#D32F2F',
    [InsuranceVertical.LIFE]: '#7B1FA2',
    [InsuranceVertical.RENTERS]: '#F57C00',
    [InsuranceVertical.COMMERCIAL]: '#0288D1'
  },
  secondary: {
    [InsuranceVertical.AUTO]: '#90CAF9',
    [InsuranceVertical.HOME]: '#A5D6A7',
    [InsuranceVertical.HEALTH]: '#EF9A9A',
    [InsuranceVertical.LIFE]: '#CE93D8',
    [InsuranceVertical.RENTERS]: '#FFCC80',
    [InsuranceVertical.COMMERCIAL]: '#81D4FA'
  },
  highlight: {
    [InsuranceVertical.AUTO]: '#2196F3',
    [InsuranceVertical.HOME]: '#4CAF50',
    [InsuranceVertical.HEALTH]: '#F44336',
    [InsuranceVertical.LIFE]: '#9C27B0',
    [InsuranceVertical.RENTERS]: '#FF9800',
    [InsuranceVertical.COMMERCIAL]: '#03A9F4'
  },
  theme: {
    background: '#FFFFFF',
    text: '#212121',
    grid: '#E0E0E0'
  }
};

/**
 * Formats lead metrics data for Chart.js visualization with accessibility support
 * @param metrics Lead performance metrics by vertical
 * @param config Chart configuration including accessibility options
 * @returns Formatted chart data with accessibility attributes
 */
export const formatLeadChartData = (
  metrics: LeadMetrics,
  config: Partial<ChartConfig>
): ChartData => {
  if (!metrics || !metrics.acceptanceByVertical) {
    throw new Error('Invalid lead metrics data provided');
  }

  const labels = Object.keys(metrics.acceptanceByVertical);
  const data = Object.values(metrics.acceptanceByVertical);

  return {
    labels,
    datasets: [{
      label: 'Lead Acceptance Rate (%)',
      data,
      backgroundColor: labels.map(vertical => chartColors.primary[vertical as InsuranceVertical]),
      borderColor: labels.map(vertical => chartColors.highlight[vertical as InsuranceVertical]),
      borderWidth: 1,
      hoverBackgroundColor: labels.map(vertical => chartColors.highlight[vertical as InsuranceVertical]),
      barPercentage: 0.8,
      categoryPercentage: 0.9,
      borderRadius: 4,
      // Accessibility metadata
      accessibilityData: {
        label: 'Lead acceptance rates by insurance vertical',
        description: `Overall acceptance rate: ${metrics.acceptanceRate.toFixed(1)}%`
      }
    }]
  };
};

/**
 * Formats revenue metrics data for Chart.js visualization with accessibility support
 * @param metrics Revenue performance metrics by vertical
 * @param config Chart configuration including accessibility options
 * @returns Formatted chart data with accessibility attributes
 */
export const formatRevenueChartData = (
  metrics: RevenueMetrics,
  config: Partial<ChartConfig>
): ChartData => {
  if (!metrics || !metrics.revenueByVertical) {
    throw new Error('Invalid revenue metrics data provided');
  }

  const labels = Object.keys(metrics.revenueByVertical);
  const data = Object.values(metrics.revenueByVertical);

  return {
    labels,
    datasets: [{
      label: 'Revenue by Vertical ($)',
      data,
      backgroundColor: labels.map(vertical => chartColors.primary[vertical as InsuranceVertical]),
      borderColor: labels.map(vertical => chartColors.highlight[vertical as InsuranceVertical]),
      borderWidth: 1,
      hoverBackgroundColor: labels.map(vertical => chartColors.highlight[vertical as InsuranceVertical]),
      barPercentage: 0.8,
      categoryPercentage: 0.9,
      borderRadius: 4,
      // Accessibility metadata
      accessibilityData: {
        label: 'Revenue distribution by insurance vertical',
        description: `Total revenue: $${metrics.totalRevenue.toLocaleString()}`
      }
    }]
  };
};

/**
 * Generates comprehensive chart options with validation and defaults
 * @param type Chart type identifier
 * @param overrides Custom option overrides
 * @returns Complete Chart.js options configuration
 */
export const getChartOptions = (
  type: ChartType,
  overrides: Partial<ChartOptions> = {}
): ChartOptions => {
  const baseOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuart'
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: chartColors.theme.text,
          font: {
            size: 12,
            weight: '500'
          },
          padding: 16
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: chartColors.theme.background,
        titleColor: chartColors.theme.text,
        titleFont: {
          size: 14,
          weight: '600'
        },
        bodyColor: chartColors.theme.text,
        bodyFont: {
          size: 12
        },
        borderColor: chartColors.theme.grid,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 4
      }
    },
    scales: {
      x: {
        grid: {
          color: chartColors.theme.grid,
          drawBorder: false
        },
        ticks: {
          color: chartColors.theme.text,
          font: {
            size: 12
          }
        }
      },
      y: {
        grid: {
          color: chartColors.theme.grid,
          drawBorder: false
        },
        ticks: {
          color: chartColors.theme.text,
          font: {
            size: 12
          },
          callback: (value: number) => {
            return type === 'bar' ? `${value}%` : `$${value.toLocaleString()}`;
          }
        },
        beginAtZero: true
      }
    },
    // Accessibility configurations
    accessibility: {
      enabled: true,
      announceDataPoints: true,
      description: 'Interactive chart displaying insurance metrics',
      keyboardNavigation: true
    },
    // Responsive configurations
    responsive: {
      rules: [{
        condition: {
          maxWidth: 768
        },
        chartOptions: {
          scales: {
            x: {
              ticks: {
                maxRotation: 45,
                minRotation: 45
              }
            }
          },
          legend: {
            display: false
          }
        }
      }]
    }
  };

  return {
    ...baseOptions,
    ...overrides
  };
};

// Export interfaces for external use
export type { ChartConfig, AccessibilityConfig, ResponsiveConfig };