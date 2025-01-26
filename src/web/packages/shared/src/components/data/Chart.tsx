import React, { useRef, useEffect, useState } from 'react';
import { Chart as ChartJS, ChartData, ChartOptions, ChartType, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { merge } from 'lodash';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

// Register Chart.js components
ChartJS.register(...registerables);

// Types for insurance verticals
type InsuranceVertical = 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';
type ThemeMode = 'light' | 'dark';

// Props interface for the Chart component
interface ChartProps {
  data: ChartData;
  type: ChartType;
  options?: ChartOptions;
  height?: string;
  width?: string;
  responsive?: boolean;
  vertical?: InsuranceVertical;
  loading?: boolean;
  ariaLabel?: string;
}

/**
 * Generates default chart options with theme integration and accessibility features
 */
const getDefaultOptions = (vertical: InsuranceVertical = 'auto', mode: ThemeMode = 'light'): ChartOptions => {
  const verticalColors = colors.verticals[vertical];
  const uiColors = colors.ui;

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750,
      easing: 'easeInOutQuart'
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          font: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.base),
            weight: 500
          },
          color: uiColors.text.primary,
          padding: 16
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: mode === 'light' ? uiColors.surface : uiColors.secondary,
        titleColor: uiColors.text.primary,
        bodyColor: uiColors.text.secondary,
        borderColor: uiColors.border,
        borderWidth: 1,
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
    },
    scales: {
      x: {
        grid: {
          color: uiColors.divider,
          drawBorder: false
        },
        ticks: {
          font: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.sm)
          },
          color: uiColors.text.secondary
        }
      },
      y: {
        grid: {
          color: uiColors.divider,
          drawBorder: false
        },
        ticks: {
          font: {
            family: typography.fontFamily,
            size: parseInt(typography.fontSize.sm)
          },
          color: uiColors.text.secondary
        }
      }
    },
    elements: {
      line: {
        borderColor: verticalColors.primary,
        tension: 0.4
      },
      point: {
        backgroundColor: verticalColors.primary,
        borderColor: verticalColors.contrast,
        borderWidth: 2,
        radius: 4,
        hoverRadius: 6
      },
      bar: {
        backgroundColor: verticalColors.primary,
        borderColor: verticalColors.contrast,
        borderWidth: 1
      }
    }
  };
};

/**
 * Merges custom options with default theme options safely
 */
const mergeOptions = (defaultOptions: ChartOptions, customOptions?: ChartOptions): ChartOptions => {
  return merge({}, defaultOptions, customOptions);
};

/**
 * A reusable React chart component that provides a consistent interface for data visualization
 * across the insurance lead generation platform.
 */
export const Chart: React.FC<ChartProps> = ({
  data,
  type,
  options: customOptions,
  height = '300px',
  width = '100%',
  responsive = true,
  vertical = 'auto',
  loading = false,
  ariaLabel = 'Chart'
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const [resizeObserver] = useState(() => new ResizeObserver(() => {
    if (chartInstance.current) {
      chartInstance.current.resize();
    }
  }));

  useEffect(() => {
    if (!chartRef.current) return;

    // Clean up previous chart instance
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Create new chart instance
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const defaultOptions = getDefaultOptions(vertical);
    const mergedOptions = mergeOptions(defaultOptions, customOptions);

    chartInstance.current = new ChartJS(ctx, {
      type,
      data,
      options: mergedOptions
    });

    // Observe size changes
    resizeObserver.observe(chartRef.current);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      resizeObserver.disconnect();
    };
  }, [data, type, customOptions, vertical, resizeObserver]);

  return (
    <div
      style={{
        position: 'relative',
        height,
        width,
        opacity: loading ? 0.5 : 1,
        transition: 'opacity 0.2s ease-in-out'
      }}
    >
      <canvas
        ref={chartRef}
        role="img"
        aria-label={ariaLabel}
        style={{ visibility: loading ? 'hidden' : 'visible' }}
      />
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          Loading...
        </div>
      )}
    </div>
  );
};

export default Chart;