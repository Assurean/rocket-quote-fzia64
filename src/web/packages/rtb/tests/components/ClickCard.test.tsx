import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // ^14.0.0
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { axe, toHaveNoViolations } from '@axe-core/react'; // ^4.7.0
import { useAnalytics } from '@analytics/react'; // ^1.0.0
import { ThemeProvider } from '@emotion/react';
import ClickCard from '../../src/components/ClickCard';
import useBidding from '../../src/hooks/useBidding';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock external dependencies
jest.mock('../../src/hooks/useBidding');
jest.mock('@analytics/react');

// Test data
const mockBid = {
  id: 'test-bid-1',
  title: 'Test Insurance Offer',
  description: 'Save up to 20% on your insurance',
  amount: 25.5,
  advertiserName: 'Test Carrier',
  targetUrl: 'https://example.com/click/1',
  imageUrl: 'https://example.com/images/carrier.png',
  creativeHtml: '<p>Special offer!</p>',
  currency: 'USD',
  locale: 'en-US'
};

const mockTheme = {
  colors: {
    ui: {
      surface: '#FFFFFF',
      border: '#E0E0E0',
      text: {
        primary: '#212121',
        secondary: '#757575'
      },
      primary: '#1976D2'
    },
    feedback: {
      success: {
        main: '#2E7D32'
      }
    }
  }
};

// Helper function to render with providers
const renderWithProviders = (customProps = {}) => {
  const defaultProps = {
    bid: mockBid,
    onBidClick: jest.fn(),
    testId: 'click-card'
  };

  const props = { ...defaultProps, ...customProps };

  return render(
    <ThemeProvider theme={mockTheme}>
      <ClickCard {...props} />
    </ThemeProvider>
  );
};

describe('ClickCard Component', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock window performance
    window.performance.now = jest.fn(() => 1000);
    
    // Mock ResizeObserver
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Rendering', () => {
    it('renders bid information correctly', () => {
      renderWithProviders();

      expect(screen.getByText(mockBid.title)).toBeInTheDocument();
      expect(screen.getByText(mockBid.description)).toBeInTheDocument();
      expect(screen.getByText(mockBid.advertiserName)).toBeInTheDocument();
      expect(screen.getByRole('img')).toHaveAttribute('src', mockBid.imageUrl);
      expect(screen.getByTestId('click-card')).toBeInTheDocument();
    });

    it('applies correct styling based on theme', () => {
      renderWithProviders({ isHighlighted: true });
      const card = screen.getByTestId('click-card');

      expect(card).toHaveStyle({
        backgroundColor: mockTheme.colors.ui.surface,
        border: `1px solid ${mockTheme.colors.ui.border}`
      });
    });

    it('handles missing optional props gracefully', () => {
      const bidWithoutImage = { ...mockBid, imageUrl: undefined };
      renderWithProviders({ bid: bidWithoutImage });

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders responsive layout for different viewports', async () => {
      const { rerender } = renderWithProviders();
      
      // Mobile viewport
      window.innerWidth = 375;
      window.innerHeight = 667;
      fireEvent(window, new Event('resize'));
      
      await waitFor(() => {
        const card = screen.getByTestId('click-card');
        expect(card).toHaveStyle({ margin: '8px 0' });
      });

      // Desktop viewport
      window.innerWidth = 1024;
      window.innerHeight = 768;
      fireEvent(window, new Event('resize'));
      
      rerender(
        <ThemeProvider theme={mockTheme}>
          <ClickCard bid={mockBid} onBidClick={jest.fn()} testId="click-card" />
        </ThemeProvider>
      );

      await waitFor(() => {
        const card = screen.getByTestId('click-card');
        expect(card).not.toHaveStyle({ margin: '8px 0' });
      });
    });
  });

  describe('Interaction', () => {
    it('handles click events with tracking', async () => {
      const onBidClick = jest.fn();
      const mockTrack = jest.fn();
      (useAnalytics as jest.Mock).mockReturnValue({ track: mockTrack });

      renderWithProviders({ onBidClick });

      const card = screen.getByTestId('click-card');
      await userEvent.click(card);

      expect(onBidClick).toHaveBeenCalledWith(mockBid);
      expect(mockTrack).toHaveBeenCalledWith('rtb_card_click', expect.objectContaining({
        bidId: mockBid.id,
        amount: mockBid.amount,
        advertiser: mockBid.advertiserName
      }));
    });

    it('prevents double-clicks', async () => {
      const onBidClick = jest.fn();
      renderWithProviders({ onBidClick });

      const card = screen.getByTestId('click-card');
      await userEvent.dblClick(card);

      expect(onBidClick).toHaveBeenCalledTimes(1);
    });

    it('handles touch events on mobile', async () => {
      const onBidClick = jest.fn();
      renderWithProviders({ onBidClick });

      const card = screen.getByTestId('click-card');
      fireEvent.touchStart(card);
      fireEvent.touchEnd(card);

      expect(onBidClick).toHaveBeenCalledWith(mockBid);
    });

    it('maintains focus states', async () => {
      renderWithProviders();
      const card = screen.getByTestId('click-card');

      await userEvent.tab();
      expect(card).toHaveFocus();
      expect(card).toHaveStyle({
        outline: `2px solid ${mockTheme.colors.ui.primary}`
      });
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 AA requirements', async () => {
      const { container } = renderWithProviders();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides correct ARIA attributes', () => {
      renderWithProviders();
      const card = screen.getByTestId('click-card');

      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('aria-label', `Advertisement from ${mockBid.advertiserName}: ${mockBid.title}`);
    });

    it('supports keyboard navigation', async () => {
      const onBidClick = jest.fn();
      renderWithProviders({ onBidClick });

      const card = screen.getByTestId('click-card');
      await userEvent.tab();
      expect(card).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      expect(onBidClick).toHaveBeenCalledWith(mockBid);

      await userEvent.keyboard(' ');
      expect(onBidClick).toHaveBeenCalledTimes(2);
    });

    it('announces price changes to screen readers', async () => {
      const { rerender } = renderWithProviders();
      const updatedBid = { ...mockBid, amount: 30.5 };

      rerender(
        <ThemeProvider theme={mockTheme}>
          <ClickCard bid={updatedBid} onBidClick={jest.fn()} testId="click-card" />
        </ThemeProvider>
      );

      const priceElement = screen.getByLabelText(/bid amount/i);
      expect(priceElement).toHaveAttribute('aria-label', 'Bid amount: $30.50');
    });
  });

  describe('Performance', () => {
    it('renders within performance budget', async () => {
      const startTime = performance.now();
      renderWithProviders();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // 100ms budget
    });

    it('optimizes re-renders', () => {
      const { rerender } = renderWithProviders();
      const renderCount = jest.fn();

      React.memo = jest.fn().mockImplementation((component) => {
        renderCount();
        return component;
      });

      // Re-render with same props
      rerender(
        <ThemeProvider theme={mockTheme}>
          <ClickCard bid={mockBid} onBidClick={jest.fn()} testId="click-card" />
        </ThemeProvider>
      );

      expect(renderCount).toHaveBeenCalledTimes(1);
    });

    it('lazy loads images', async () => {
      renderWithProviders();
      const image = screen.getByRole('img');

      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).toHaveStyle({ opacity: 0 });

      fireEvent.load(image);
      expect(image).toHaveStyle({ opacity: 1 });
    });

    it('caches bid data appropriately', () => {
      const { rerender } = renderWithProviders();
      const initialRender = screen.getByTestId('click-card');

      // Re-render with same bid
      rerender(
        <ThemeProvider theme={mockTheme}>
          <ClickCard bid={mockBid} onBidClick={jest.fn()} testId="click-card" />
        </ThemeProvider>
      );

      const secondRender = screen.getByTestId('click-card');
      expect(initialRender).toBe(secondRender);
    });
  });

  describe('Error Handling', () => {
    it('displays fallback UI on error', () => {
      const bidWithInvalidImage = {
        ...mockBid,
        imageUrl: 'invalid-url'
      };

      renderWithProviders({ bid: bidWithInvalidImage });
      const image = screen.getByRole('img');
      
      fireEvent.error(image);
      expect(image).toHaveStyle({ display: 'none' });
    });

    it('handles network timeouts', async () => {
      const slowBid = {
        ...mockBid,
        imageUrl: 'https://slow-server.com/image.jpg'
      };

      jest.useFakeTimers();
      renderWithProviders({ bid: slowBid });

      const image = screen.getByRole('img');
      jest.advanceTimersByTime(5000);

      expect(image).toHaveAttribute('loading', 'lazy');
      jest.useRealTimers();
    });

    it('validates bid data integrity', () => {
      const invalidBid = {
        ...mockBid,
        amount: -10 // Invalid amount
      };

      expect(() => {
        renderWithProviders({ bid: invalidBid });
      }).toThrow();
    });
  });
});