import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Component under test
import Dashboard from '../../src/routes/Dashboard';

// Hooks and utilities
import { useAuth } from '../../src/hooks/useAuth';
import { useCampaign } from '../../src/hooks/useCampaign';

// Mock data interfaces
interface MockCampaignData {
  id: string;
  vertical: string;
  activeLeads: number;
  dailySpend: number;
  conversionRate: number;
  leadQuality: number;
  lastUpdated: Date;
  recentActivity: RecentActivity[];
}

interface RecentActivity {
  id: string;
  type: string;
  status: string;
  cost: number;
  timestamp: Date;
}

// Mock the hooks
vi.mock('../../src/hooks/useAuth');
vi.mock('../../src/hooks/useCampaign');

// Mock chart components
vi.mock('@analytics/components/LeadChart', () => ({
  default: vi.fn(() => <div data-testid="lead-chart">Lead Chart</div>)
}));

vi.mock('@analytics/components/ConversionChart', () => ({
  default: vi.fn(() => <div data-testid="conversion-chart">Conversion Chart</div>)
}));

vi.mock('@analytics/components/RevenueChart', () => ({
  default: vi.fn(() => <div data-testid="revenue-chart">Revenue Chart</div>)
}));

describe('Dashboard Component', () => {
  // Mock campaign data
  const mockCampaigns: MockCampaignData[] = [
    {
      id: '1',
      vertical: 'AUTO',
      activeLeads: 1234,
      dailySpend: 12345,
      conversionRate: 42,
      leadQuality: 85,
      lastUpdated: new Date(),
      recentActivity: [
        {
          id: '1',
          type: 'AUTO',
          status: 'Accepted',
          cost: 24,
          timestamp: new Date()
        }
      ]
    }
  ];

  // Setup function for common test environment
  const setupTestEnvironment = (
    campaigns = mockCampaigns,
    isAuthenticated = true,
    options = {}
  ) => {
    // Mock auth hook
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated,
      user: isAuthenticated ? {
        id: 'test-user',
        email: 'test@example.com',
        role: 'buyer',
        permissions: ['view_dashboard']
      } : null,
      error: null,
      isLoading: false
    });

    // Mock campaign hook
    (useCampaign as jest.Mock).mockReturnValue({
      campaigns,
      loading: { list: false },
      error: { list: null },
      fetchCampaigns: vi.fn()
    });

    // Render component with Redux provider
    return render(
      <Provider store={configureStore({
        reducer: {
          auth: (state = {}) => state,
          campaigns: (state = {}) => state
        }
      })}>
        <Dashboard />
      </Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders loading state with accessibility considerations', async () => {
    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: [],
      loading: { list: true },
      error: { list: null },
      fetchCampaigns: vi.fn()
    });

    setupTestEnvironment();

    // Verify loading indicators
    const loadingElements = screen.getAllByRole('alert');
    expect(loadingElements.length).toBeGreaterThan(0);

    // Check loading state accessibility
    loadingElements.forEach(element => {
      expect(element).toHaveAttribute('aria-busy', 'true');
    });
  });

  it('displays KPI metrics with proper formatting and accessibility', async () => {
    setupTestEnvironment();

    // Verify KPI cards are rendered with correct data
    await waitFor(() => {
      // Active Leads KPI
      const activeLeadsKPI = screen.getByLabelText('Active leads count');
      expect(activeLeadsKPI).toBeInTheDocument();
      expect(within(activeLeadsKPI).getByText('1,234')).toBeInTheDocument();

      // Daily Spend KPI
      const dailySpendKPI = screen.getByLabelText('Daily spend amount');
      expect(dailySpendKPI).toBeInTheDocument();
      expect(within(dailySpendKPI).getByText('$12,345')).toBeInTheDocument();

      // Conversion Rate KPI
      const conversionRateKPI = screen.getByLabelText('Lead conversion rate');
      expect(conversionRateKPI).toBeInTheDocument();
      expect(within(conversionRateKPI).getByText('42%')).toBeInTheDocument();
    });

    // Verify ARIA labels and roles
    expect(screen.getByRole('region', { name: 'Key Performance Indicators' })).toBeInTheDocument();
  });

  it('renders interactive charts with proper data integration', async () => {
    setupTestEnvironment();

    // Verify chart components are rendered
    await waitFor(() => {
      expect(screen.getByTestId('lead-chart')).toBeInTheDocument();
      expect(screen.getByTestId('conversion-chart')).toBeInTheDocument();
      expect(screen.getByTestId('revenue-chart')).toBeInTheDocument();
    });

    // Verify chart container accessibility
    expect(screen.getByRole('region', { name: 'Analytics Charts' })).toBeInTheDocument();
  });

  it('handles authentication state correctly', async () => {
    setupTestEnvironment(mockCampaigns, false);

    // Verify unauthenticated state message
    expect(screen.getByText('Please log in to view the dashboard.')).toBeInTheDocument();
  });

  it('handles error states appropriately', async () => {
    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: [],
      loading: { list: false },
      error: { list: 'Failed to fetch campaigns' },
      fetchCampaigns: vi.fn()
    });

    setupTestEnvironment();

    // Verify error message is displayed
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch campaigns');
  });

  it('updates metrics on refresh interval', async () => {
    const fetchCampaigns = vi.fn();
    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: mockCampaigns,
      loading: { list: false },
      error: { list: null },
      fetchCampaigns
    });

    setupTestEnvironment();

    // Fast-forward timers and verify refresh
    vi.advanceTimersByTime(300000); // 5 minutes
    expect(fetchCampaigns).toHaveBeenCalled();
  });

  it('maintains accessibility during data updates', async () => {
    const { rerender } = setupTestEnvironment();

    // Update campaign data
    const updatedCampaigns = [...mockCampaigns];
    updatedCampaigns[0].activeLeads = 2000;

    // Rerender with new data
    (useCampaign as jest.Mock).mockReturnValue({
      campaigns: updatedCampaigns,
      loading: { list: false },
      error: { list: null },
      fetchCampaigns: vi.fn()
    });

    rerender(
      <Provider store={configureStore({
        reducer: {
          auth: (state = {}) => state,
          campaigns: (state = {}) => state
        }
      })}>
        <Dashboard />
      </Provider>
    );

    // Verify updated value is accessible
    const activeLeadsKPI = screen.getByLabelText('Active leads count');
    expect(within(activeLeadsKPI).getByText('2,000')).toBeInTheDocument();
  });
});