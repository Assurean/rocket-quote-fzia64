import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { useBidding, UseBiddingConfig, UseBiddingResult } from '../../src/hooks/useBidding';
import { BiddingService } from '../../src/services/bidding';

// Mock BiddingService
jest.mock('../../src/services/bidding');

describe('useBidding', () => {
  // Test data setup
  const mockBid = {
    id: 'bid-123',
    advertiserId: 'adv-456',
    amount: 25.50,
    targetUrl: 'https://example.com',
    creativeHtml: '<div>Ad Content</div>',
    expiresAt: Date.now() + 300000,
    metadata: {},
    currency: 'USD',
    locale: 'en-US',
    securityMetadata: {
      signature: 'valid-signature',
      certificateId: 'cert-789',
      encryptionVersion: '2.0',
      securityFlags: ['verified']
    }
  };

  const mockConfig: UseBiddingConfig = {
    leadId: 'lead-123',
    vertical: 'auto',
    leadScore: 0.85,
    userData: {
      age: 30,
      state: 'CA'
    },
    refreshInterval: 30000,
    maxRetries: 3,
    bidExpirationTime: 300000
  };

  // Mock implementations
  let mockRequestBids: jest.Mock;
  let mockSelectOptimalBids: jest.Mock;
  let mockTrackBidSelection: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Reset mocks
    mockRequestBids = jest.fn();
    mockSelectOptimalBids = jest.fn();
    mockTrackBidSelection = jest.fn();

    // Setup mock implementations
    (BiddingService as jest.Mock).mockImplementation(() => ({
      requestBids: mockRequestBids,
      selectOptimalBids: mockSelectOptimalBids,
      trackBidSelection: mockTrackBidSelection
    }));

    // Default successful responses
    mockRequestBids.mockResolvedValue([mockBid]);
    mockSelectOptimalBids.mockResolvedValue([mockBid]);
    mockTrackBidSelection.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should initialize with default state', async () => {
    const { result } = renderHook(() => useBidding(mockConfig));

    expect(result.current).toEqual(expect.objectContaining({
      bids: [],
      isLoading: true,
      error: null,
      isStale: false,
      lastRefreshTime: 0
    }));
  });

  it('should fetch bids on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useBidding(mockConfig));

    await waitForNextUpdate();

    expect(mockRequestBids).toHaveBeenCalledWith(
      mockConfig.leadId,
      mockConfig.vertical,
      mockConfig.userData
    );
    expect(result.current.bids).toEqual([mockBid]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle bid refresh cycles', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useBidding(mockConfig));

    await waitForNextUpdate();
    expect(result.current.bids).toEqual([mockBid]);

    // Advance timer to trigger refresh
    act(() => {
      jest.advanceTimersByTime(mockConfig.refreshInterval!);
    });

    await waitForNextUpdate();
    expect(mockRequestBids).toHaveBeenCalledTimes(2);
    expect(result.current.isStale).toBe(false);
  });

  it('should implement error recovery', async () => {
    const error = new Error('Network error');
    mockRequestBids.mockRejectedValueOnce(error);

    const { result, waitForNextUpdate } = renderHook(() => useBidding(mockConfig));

    await waitForNextUpdate();
    expect(result.current.error).toBeTruthy();

    // Should retry automatically
    mockRequestBids.mockResolvedValueOnce([mockBid]);
    await waitForNextUpdate();

    expect(result.current.error).toBeNull();
    expect(result.current.bids).toEqual([mockBid]);
  });

  it('should handle concurrent requests', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useBidding(mockConfig));

    // Trigger multiple refreshes
    act(() => {
      result.current.refreshBids();
      result.current.refreshBids();
      result.current.refreshBids();
    });

    await waitForNextUpdate();

    // Should deduplicate requests
    expect(mockRequestBids).toHaveBeenCalledTimes(1);
  });

  it('should track bid clicks', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useBidding(mockConfig));

    await waitForNextUpdate();

    await act(async () => {
      await result.current.handleBidClick(mockBid);
    });

    expect(mockTrackBidSelection).toHaveBeenCalledWith(
      mockBid,
      mockConfig.leadId,
      expect.objectContaining({
        vertical: mockConfig.vertical,
        leadScore: mockConfig.leadScore
      })
    );
  });

  it('should handle bid expiration', async () => {
    const expiredBid = {
      ...mockBid,
      expiresAt: Date.now() - 1000
    };

    mockRequestBids.mockResolvedValueOnce([expiredBid]);
    const { result, waitForNextUpdate } = renderHook(() => useBidding(mockConfig));

    await waitForNextUpdate();

    // Should mark as stale and trigger refresh
    expect(result.current.isStale).toBe(true);
    expect(mockRequestBids).toHaveBeenCalledTimes(2);
  });

  it('should cleanup resources on unmount', async () => {
    const { result, waitForNextUpdate, unmount } = renderHook(() => useBidding(mockConfig));

    await waitForNextUpdate();

    unmount();

    // Advance timer to verify no more refreshes
    act(() => {
      jest.advanceTimersByTime(mockConfig.refreshInterval! * 2);
    });

    expect(mockRequestBids).toHaveBeenCalledTimes(1);
  });

  it('should optimize bid selection', async () => {
    mockRequestBids.mockResolvedValueOnce([mockBid, { ...mockBid, id: 'bid-456', amount: 30.00 }]);

    const { result, waitForNextUpdate } = renderHook(() => useBidding(mockConfig));

    await waitForNextUpdate();

    expect(mockSelectOptimalBids).toHaveBeenCalledWith(
      expect.any(Array),
      mockConfig.leadScore,
      expect.objectContaining({
        timestamp: expect.any(Number),
        vertical: mockConfig.vertical
      })
    );
  });

  it('should handle rate limiting', async () => {
    mockRequestBids
      .mockRejectedValueOnce(new Error('Rate limit exceeded'))
      .mockResolvedValueOnce([mockBid]);

    const { result, waitForNextUpdate } = renderHook(() => useBidding(mockConfig));

    await waitForNextUpdate();
    expect(result.current.error).toBeTruthy();

    // Wait for backoff
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitForNextUpdate();
    expect(result.current.error).toBeNull();
    expect(result.current.bids).toEqual([mockBid]);
  });

  it('should reset error state', async () => {
    mockRequestBids.mockRejectedValueOnce(new Error('Test error'));

    const { result, waitForNextUpdate } = renderHook(() => useBidding(mockConfig));

    await waitForNextUpdate();
    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.resetError();
    });

    expect(result.current.error).toBeNull();
  });
});