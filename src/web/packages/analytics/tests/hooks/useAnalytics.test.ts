// External imports
import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { jest } from '@jest/globals'; // v29.0.0
import dayjs from 'dayjs'; // v1.11.0

// Internal imports
import useAnalytics, { AnalyticsState, UseAnalyticsReturn } from '../../src/hooks/useAnalytics';
import { calculateLeadAcceptanceRate, LeadMetrics } from '../../src/utils/metrics';
import { generateReport, ReportConfig } from '../../src/services/reporting';
import { InsuranceVertical, LeadStatus } from '../../../../backend/services/lead-service/src/interfaces/lead.interface';

// Mock implementations
jest.mock('../../src/utils/metrics');
jest.mock('../../src/services/reporting');

describe('useAnalytics', () => {
  // Test configuration
  const mockTimeframe = {
    start: dayjs().subtract(7, 'day').toDate(),
    end: dayjs().toDate()
  };

  const mockLeadMetrics: LeadMetrics = {
    acceptanceRate: 45.5,
    acceptanceByVertical: {
      [InsuranceVertical.AUTO]: 48.2,
      [InsuranceVertical.HOME]: 42.1,
      [InsuranceVertical.HEALTH]: 44.8,
      [InsuranceVertical.LIFE]: 46.3,
      [InsuranceVertical.RENTERS]: 41.9,
      [InsuranceVertical.COMMERCIAL]: 43.7
    },
    qualityScore: 85.5,
    totalLeads: 1000,
    qualityTrend: [41.2, 42.5, 43.8, 45.1, 44.9, 45.5, 45.8],
    verticalDistribution: {
      [InsuranceVertical.AUTO]: 30,
      [InsuranceVertical.HOME]: 25,
      [InsuranceVertical.HEALTH]: 20,
      [InsuranceVertical.LIFE]: 10,
      [InsuranceVertical.RENTERS]: 10,
      [InsuranceVertical.COMMERCIAL]: 5
    }
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.resetAllMocks();
    (calculateLeadAcceptanceRate as jest.Mock).mockResolvedValue(mockLeadMetrics);
    (generateReport as jest.Mock).mockResolvedValue({
      id: 'test-report',
      generatedAt: new Date(),
      metrics: mockLeadMetrics
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAnalytics(mockTimeframe));

    expect(result.current.state).toEqual({
      leadMetrics: null,
      revenueMetrics: null,
      conversionMetrics: null,
      rtbMetrics: null,
      loading: true,
      error: null,
      timeframe: mockTimeframe,
      refreshInterval: 300000,
      lastUpdated: expect.any(Date)
    });
  });

  it('should handle metric calculations', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useAnalytics(mockTimeframe, 300000)
    );

    // Initial loading state
    expect(result.current.state.loading).toBe(true);

    // Wait for metrics calculation
    await waitForNextUpdate();

    // Verify metrics were calculated
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.leadMetrics).toEqual(mockLeadMetrics);
    expect(result.current.state.error).toBeNull();
    expect(calculateLeadAcceptanceRate).toHaveBeenCalledWith(
      [],
      mockTimeframe
    );
  });

  it('should handle errors gracefully', async () => {
    const testError = new Error('API Error');
    (calculateLeadAcceptanceRate as jest.Mock).mockRejectedValue(testError);

    const { result, waitForNextUpdate } = renderHook(() => 
      useAnalytics(mockTimeframe)
    );

    await waitForNextUpdate();

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBe(`Failed to fetch metrics: ${testError.message}`);
    expect(result.current.state.leadMetrics).toBeNull();
  });

  it('should validate timeframe inputs', async () => {
    const invalidTimeframe = {
      start: dayjs().toDate(),
      end: dayjs().subtract(1, 'day').toDate() // End before start
    };

    const { result } = renderHook(() => useAnalytics(invalidTimeframe));

    expect(result.current.state.error).toBe('Invalid timeframe specified');
  });

  it('should handle report generation', async () => {
    const { result } = renderHook(() => useAnalytics(mockTimeframe));

    const reportConfig: ReportConfig = {
      timeframe: mockTimeframe,
      metrics: ['leadQuality', 'revenue'],
      verticals: [InsuranceVertical.AUTO, InsuranceVertical.HOME],
      format: 'xlsx',
      compression: true,
      styling: {
        theme: 'default',
        branding: true,
        charts: true
      },
      security: {
        encryptOutput: true,
        redactPII: true,
        auditLog: true,
        accessControl: ['admin']
      },
      caching: {
        enabled: true,
        ttl: 3600,
        compression: true
      }
    };

    await act(async () => {
      await result.current.actions.generateReport(reportConfig);
    });

    expect(generateReport).toHaveBeenCalledWith(reportConfig);
  });

  it('should update timeframe and refresh metrics', async () => {
    const { result, waitForNextUpdate } = renderHook(() => 
      useAnalytics(mockTimeframe)
    );

    const newTimeframe = {
      start: dayjs().subtract(30, 'day').toDate(),
      end: dayjs().toDate()
    };

    await act(async () => {
      result.current.actions.setTimeframe(newTimeframe);
    });

    await waitForNextUpdate();

    expect(result.current.state.timeframe).toEqual(newTimeframe);
    expect(calculateLeadAcceptanceRate).toHaveBeenCalledWith(
      [],
      newTimeframe
    );
  });

  it('should handle refresh interval updates', () => {
    const { result } = renderHook(() => useAnalytics(mockTimeframe));

    act(() => {
      result.current.actions.setRefreshInterval(600000); // 10 minutes
    });

    expect(result.current.state.refreshInterval).toBe(600000);
  });

  it('should prevent invalid refresh intervals', () => {
    const { result } = renderHook(() => useAnalytics(mockTimeframe));

    act(() => {
      result.current.actions.setRefreshInterval(1000); // Too short
    });

    expect(result.current.state.error).toBe('Refresh interval too short');
    expect(result.current.state.refreshInterval).toBe(300000); // Unchanged
  });

  it('should clear errors when requested', async () => {
    const { result } = renderHook(() => useAnalytics(mockTimeframe));

    act(() => {
      // Set an error
      result.current.actions.setRefreshInterval(1000);
      // Clear it
      result.current.actions.clearError();
    });

    expect(result.current.state.error).toBeNull();
  });

  it('should cleanup interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => useAnalytics(mockTimeframe));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});