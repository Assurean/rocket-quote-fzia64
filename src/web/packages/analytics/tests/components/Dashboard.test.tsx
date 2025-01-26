import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Dashboard from '../../src/components/Dashboard';
import { useAnalytics, AnalyticsState, TimeframeFilter } from '../../src/hooks/useAnalytics';

// Mock the analytics hook and chart components
vi.mock('../../src/hooks/useAnalytics');
vi.mock('../../src/components/LeadChart', () => ({
  default: ({ vertical, ariaLabel }: { vertical: string; ariaLabel: string }) => (
    <div role="img" aria-label={ariaLabel}>Lead Chart - {vertical}</div>
  )
}));
vi.mock('../../src/components/ConversionChart', () => ({
  default: ({ vertical }: { vertical: string }) => (
    <div role="img" aria-label="Conversion Chart">Conversion Chart - {vertical}</div>
  )
}));
vi.mock('../../src/components/RevenueChart', () => ({
  default: ({ vertical }: { vertical: string }) => (
    <div role="img" aria-label="Revenue Chart">Revenue Chart - {vertical}</div>
  )
}));

// Mock analytics state generator
const mockAnalyticsState = (overrides?: Partial<AnalyticsState>): AnalyticsState => ({
  leadMetrics: {
    acceptanceRate: 45.5,
    acceptanceByVertical: {
      AUTO: 48.2,
      HOME: 42.1,
      HEALTH: 44.8,
      LIFE: 46.3,
      RENTERS: 41.9,
      COMMERCIAL: 43.7
    },
    qualityScore: 85.5,
    totalLeads: 1234,
    qualityTrend: [41.2, 42.5, 43.8, 44.1, 44.9, 45.2, 45.5],
    verticalDistribution: {
      AUTO: 35,
      HOME: 25,
      HEALTH: 15,
      LIFE: 10,
      RENTERS: 10,
      COMMERCIAL: 5
    }
  },
  revenueMetrics: {
    totalRevenue: 125000,
    revenueByVertical: {
      AUTO: 45000,
      HOME: 35000,
      HEALTH: 20000,
      LIFE: 15000,
      RENTERS: 5000,
      COMMERCIAL: 5000
    },
    growthRate: 27.5,
    averageCPL: 101.3,
    rtbRevenue: 25000,
    monthOverMonthGrowth: 12.5,
    projectedRevenue: 150000
  },
  conversionMetrics: {
    overallRate: 32.5,
    rateByStep: {
      'Form Start': 100,
      'Basic Info': 85,
      'Vehicle Info': 65,
      'Coverage Selection': 45,
      'Submission': 32.5
    },
    rateByVertical: {
      AUTO: 35,
      HOME: 30,
      HEALTH: 28,
      LIFE: 25,
      RENTERS: 32,
      COMMERCIAL: 27
    },
    dropoffPoints: {
      'Basic Info': 15,
      'Vehicle Info': 20,
      'Coverage Selection': 20,
      'Submission': 12.5
    },
    deviceTypeConversion: {
      desktop: 35,
      mobile: 30,
      tablet: 32
    }
  },
  rtbMetrics: null,
  loading: false,
  error: null,
  timeframe: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
  refreshInterval: 300000,
  lastUpdated: new Date()
});

// Mock media query for responsive testing
const setupMediaQuery = (breakpoint: string) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: query === breakpoint,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAnalytics as jest.Mock).mockReturnValue({
      state: mockAnalyticsState(),
      actions: {
        refreshMetrics: vi.fn(),
        setTimeframe: vi.fn(),
        clearError: vi.fn()
      }
    });
  });

  describe('Rendering and Layout', () => {
    it('renders all KPI components with correct data', () => {
      render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="all"
        />
      );

      // Verify KPI components
      expect(screen.getByText('Lead Acceptance Rate')).toBeInTheDocument();
      expect(screen.getByText('45.5%')).toBeInTheDocument();
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('$125,000')).toBeInTheDocument();
      expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
      expect(screen.getByText('32.5%')).toBeInTheDocument();
      expect(screen.getByText('RTB Revenue')).toBeInTheDocument();
      expect(screen.getByText('$25,000')).toBeInTheDocument();
    });

    it('renders all chart components with correct props', () => {
      render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="auto"
        />
      );

      expect(screen.getByText('Lead Chart - auto')).toBeInTheDocument();
      expect(screen.getByText('Conversion Chart - auto')).toBeInTheDocument();
      expect(screen.getByText('Revenue Chart - auto')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('displays loading state correctly', () => {
      (useAnalytics as jest.Mock).mockReturnValue({
        state: { ...mockAnalyticsState(), loading: true },
        actions: { refreshMetrics: vi.fn() }
      });

      render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="all"
        />
      );

      expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();
    });

    it('displays error state correctly', () => {
      (useAnalytics as jest.Mock).mockReturnValue({
        state: { ...mockAnalyticsState(), error: 'Failed to load analytics data' },
        actions: { refreshMetrics: vi.fn() }
      });

      render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="all"
        />
      );

      expect(screen.getByText(/Failed to load analytics data/)).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('refreshes data at specified interval', async () => {
      const refreshMetrics = vi.fn();
      (useAnalytics as jest.Mock).mockReturnValue({
        state: mockAnalyticsState(),
        actions: { refreshMetrics }
      });

      vi.useFakeTimers();

      render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="all"
          refreshInterval={5000}
        />
      );

      vi.advanceTimersByTime(5000);
      expect(refreshMetrics).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5000);
      expect(refreshMetrics).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('stops refreshing when disabled', () => {
      const refreshMetrics = vi.fn();
      (useAnalytics as jest.Mock).mockReturnValue({
        state: mockAnalyticsState(),
        actions: { refreshMetrics }
      });

      render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="all"
          refreshEnabled={false}
        />
      );

      vi.advanceTimersByTime(5000);
      expect(refreshMetrics).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 AA standards', async () => {
      const { container } = render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="all"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA labels and roles', () => {
      render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="all"
        />
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(screen.getAllByRole('status')).toHaveLength(4); // KPI components
      expect(screen.getAllByRole('img')).toHaveLength(3); // Chart components
    });
  });

  describe('Responsive Behavior', () => {
    it('adjusts layout for mobile viewport', () => {
      setupMediaQuery('(max-width: 768px)');
      
      const { container } = render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="all"
        />
      );

      const kpiGrid = container.querySelector('.MuiGrid-container');
      expect(kpiGrid).toHaveStyle({ gap: '0.5rem' });
    });

    it('adjusts layout for tablet viewport', () => {
      setupMediaQuery('(min-width: 769px) and (max-width: 1024px)');
      
      const { container } = render(
        <Dashboard 
          timeframe={{ start: new Date('2024-01-01'), end: new Date('2024-01-31') }}
          vertical="all"
        />
      );

      const chartGrid = container.querySelector('.ChartGrid');
      expect(chartGrid).toHaveStyle({ 'min-height': '300px' });
    });
  });
});