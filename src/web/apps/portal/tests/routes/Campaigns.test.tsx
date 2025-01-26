/**
 * @fileoverview Comprehensive test suite for the Campaigns component
 * Verifies campaign management functionality, accessibility compliance,
 * performance metrics, and error handling across all insurance verticals
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import axe from '@axe-core/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Component under test
import Campaigns from '../../src/routes/Campaigns';

// Mock dependencies
vi.mock('../../src/hooks/useCampaign', () => ({
  useCampaign: vi.fn()
}));

// Test utilities
const createMockCampaignData = (vertical = 'AUTO', overrides = {}) => ({
  id: `test-${Math.random().toString(36).substr(2, 9)}`,
  buyerId: 'buyer-123',
  name: `Test Campaign ${vertical}`,
  vertical,
  filters: {
    rules: [],
    matchType: 'ALL'
  },
  maxCpl: 50,
  dailyBudget: 1000,
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  ...overrides
});

const setupTest = () => {
  // Mock store
  const store = configureStore({
    reducer: {
      campaigns: (state = { campaigns: [], loading: {}, error: {} }) => state
    }
  });

  // Mock campaign hook implementation
  const mockCampaigns = [
    createMockCampaignData('AUTO'),
    createMockCampaignData('HOME'),
    createMockCampaignData('HEALTH')
  ];

  const mockHook = {
    campaigns: mockCampaigns,
    loading: {
      list: false,
      create: false,
      update: false,
      delete: false
    },
    error: {
      list: null,
      create: null,
      update: null,
      delete: null
    },
    pagination: {
      page: 1,
      pageSize: 10,
      total: mockCampaigns.length
    },
    fetchCampaigns: vi.fn(),
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    deleteCampaign: vi.fn(),
    updatePagination: vi.fn()
  };

  vi.mocked(useCampaign).mockReturnValue(mockHook);

  const utils = render(
    <Provider store={store}>
      <Campaigns />
    </Provider>
  );

  return {
    ...utils,
    store,
    mockHook,
    mockCampaigns
  };
};

describe('Campaigns Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 AA standards', async () => {
      const { container } = setupTest();
      const results = await axe.run(container);
      expect(results.violations).toEqual([]);
    });

    it('should support keyboard navigation', async () => {
      setupTest();
      const user = userEvent.setup();

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByLabelText(/filter campaigns/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/create new campaign/i)).toHaveFocus();

      // Verify table row focus management
      await user.tab();
      const firstRow = screen.getAllByRole('row')[1];
      expect(within(firstRow).getByRole('checkbox')).toHaveFocus();
    });

    it('should have proper ARIA labels and roles', () => {
      setupTest();
      
      expect(screen.getByRole('heading', { name: /campaign management/i })).toBeInTheDocument();
      expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Campaign management table');
      expect(screen.getByRole('button', { name: /create new campaign/i })).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render initial content within performance budget', async () => {
      const startTime = performance.now();
      setupTest();
      const renderTime = performance.now() - startTime;
      
      expect(renderTime).toBeLessThan(200); // 200ms budget
    });

    it('should optimize re-renders', async () => {
      const { mockHook } = setupTest();
      const user = userEvent.setup();

      // Measure update performance
      const startTime = performance.now();
      await user.click(screen.getByLabelText(/create new campaign/i));
      const updateTime = performance.now() - startTime;

      expect(updateTime).toBeLessThan(100); // 100ms budget for updates
      expect(mockHook.fetchCampaigns).toHaveBeenCalledTimes(1);
    });
  });

  describe('Campaign Operations', () => {
    it('should handle campaign creation', async () => {
      const { mockHook } = setupTest();
      const user = userEvent.setup();

      // Open create dialog
      await user.click(screen.getByLabelText(/create new campaign/i));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Submit new campaign
      await user.click(screen.getByRole('button', { name: /create/i }));
      
      expect(mockHook.createCampaign).toHaveBeenCalled();
      expect(mockHook.fetchCampaigns).toHaveBeenCalled();
    });

    it('should handle campaign updates', async () => {
      const { mockHook, mockCampaigns } = setupTest();
      const user = userEvent.setup();

      // Click edit button on first campaign
      const editButton = screen.getAllByLabelText(/edit campaign/i)[0];
      await user.click(editButton);

      // Submit updates
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(mockHook.updateCampaign).toHaveBeenCalledWith(
        mockCampaigns[0].id,
        expect.any(Object)
      );
    });

    it('should handle campaign deletion with confirmation', async () => {
      const { mockHook, mockCampaigns } = setupTest();
      const user = userEvent.setup();

      // Mock confirmation dialog
      const confirmSpy = vi.spyOn(window, 'confirm');
      confirmSpy.mockImplementation(() => true);

      // Click delete button on first campaign
      const deleteButton = screen.getAllByLabelText(/delete campaign/i)[0];
      await user.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockHook.deleteCampaign).toHaveBeenCalledWith(mockCampaigns[0].id);
    });
  });

  describe('Error Handling', () => {
    it('should display error state appropriately', async () => {
      const { mockHook } = setupTest();
      mockHook.error.list = 'Failed to fetch campaigns';

      // Re-render with error
      const { rerender } = setupTest();
      
      expect(screen.getByText(/error loading campaigns/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to fetch campaigns/i)).toBeInTheDocument();
    });

    it('should handle network errors gracefully', async () => {
      const { mockHook } = setupTest();
      mockHook.fetchCampaigns.mockRejectedValueOnce(new Error('Network error'));

      // Trigger a refresh
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(mockHook.fetchCampaigns).toHaveBeenCalled();
      expect(screen.getByText(/error loading campaigns/i)).toBeInTheDocument();
    });
  });

  describe('Data Management', () => {
    it('should handle pagination correctly', async () => {
      const { mockHook } = setupTest();
      const user = userEvent.setup();

      // Navigate to next page
      await user.click(screen.getByRole('button', { name: /next page/i }));

      expect(mockHook.updatePagination).toHaveBeenCalledWith(2);
      expect(mockHook.fetchCampaigns).toHaveBeenCalled();
    });

    it('should apply filters correctly', async () => {
      const { mockHook } = setupTest();
      const user = userEvent.setup();

      // Open filter dialog
      await user.click(screen.getByLabelText(/filter campaigns/i));

      // Apply filters (implementation depends on filter UI)
      // This is a placeholder for the actual filter implementation
      expect(mockHook.fetchCampaigns).toHaveBeenCalled();
    });
  });
});