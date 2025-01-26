import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import VerticalSelection from '../../src/routes/VerticalSelection';
import { actions as formActions } from '../../src/store/slices/formSlice';
import { analytics } from '../../utils/analytics';

// Mock analytics module
jest.mock('../../utils/analytics');

// Mock ResizeObserver for responsive testing
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

global.ResizeObserver = mockResizeObserver;

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: {
        form: (state = preloadedState) => state
      }
    }),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <MemoryRouter>{children}</MemoryRouter>
    </Provider>
  );

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
};

describe('VerticalSelection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Layout', () => {
    it('renders all six insurance vertical options with correct labels', () => {
      renderWithProviders(<VerticalSelection />);

      const verticals = [
        'Auto Insurance',
        'Home Insurance',
        'Health Insurance',
        'Life Insurance',
        'Renters Insurance',
        'Commercial Insurance'
      ];

      verticals.forEach(vertical => {
        expect(screen.getByText(vertical)).toBeInTheDocument();
      });
    });

    it('displays proper layout at mobile breakpoint', () => {
      window.innerWidth = 375;
      renderWithProviders(<VerticalSelection />);
      
      const grid = screen.getByRole('list');
      expect(grid).toHaveStyle({
        'grid-template-columns': '1fr'
      });
    });

    it('displays proper layout at tablet breakpoint', () => {
      window.innerWidth = 800;
      renderWithProviders(<VerticalSelection />);
      
      const grid = screen.getByRole('list');
      expect(grid).toHaveStyle({
        'grid-template-columns': 'repeat(2, 1fr)'
      });
    });

    it('displays proper layout at desktop breakpoint', () => {
      window.innerWidth = 1200;
      renderWithProviders(<VerticalSelection />);
      
      const grid = screen.getByRole('list');
      expect(grid).toHaveStyle({
        'grid-template-columns': 'repeat(auto-fit, minmax(280px, 1fr))'
      });
    });

    it('shows correct progress step indicator', () => {
      renderWithProviders(<VerticalSelection />);
      
      const stepper = screen.getByRole('navigation');
      expect(stepper).toBeInTheDocument();
      expect(screen.getByText('Select Insurance')).toHaveAttribute('aria-current', 'step');
    });
  });

  describe('Interaction Handling', () => {
    it('handles vertical selection with mouse click', async () => {
      const { store } = renderWithProviders(<VerticalSelection />);
      
      const autoCard = screen.getByRole('listitem', { name: /select auto insurance/i });
      await userEvent.click(autoCard);

      expect(store.getState().form.currentVertical).toBe('AUTO');
    });

    it('supports keyboard navigation between verticals', async () => {
      renderWithProviders(<VerticalSelection />);
      
      const cards = screen.getAllByRole('listitem');
      await userEvent.tab();
      
      expect(cards[0]).toHaveFocus();
      
      await userEvent.keyboard('{ArrowRight}');
      expect(cards[1]).toHaveFocus();
      
      await userEvent.keyboard('{ArrowLeft}');
      expect(cards[0]).toHaveFocus();
    });

    it('maintains focus state during keyboard navigation', async () => {
      renderWithProviders(<VerticalSelection />);
      
      const firstCard = screen.getAllByRole('listitem')[0];
      await userEvent.tab();
      
      expect(firstCard).toHaveFocus();
      expect(firstCard).toHaveStyleRule('outline', expect.stringContaining('3px solid'));
    });

    it('triggers proper navigation on selection', async () => {
      const { store } = renderWithProviders(<VerticalSelection />);
      
      const homeCard = screen.getByRole('listitem', { name: /select home insurance/i });
      await userEvent.click(homeCard);

      expect(store.getState().form.currentStep).toBe('basic-info');
    });
  });

  describe('Redux Integration', () => {
    it('dispatches setCurrentVertical with correct vertical', async () => {
      const { store } = renderWithProviders(<VerticalSelection />);
      const mockDispatch = jest.spyOn(store, 'dispatch');

      const autoCard = screen.getByRole('listitem', { name: /select auto insurance/i });
      await userEvent.click(autoCard);

      expect(mockDispatch).toHaveBeenCalledWith(
        formActions.setVertical('AUTO')
      );
    });

    it('dispatches setCurrentStep to advance progress', async () => {
      const { store } = renderWithProviders(<VerticalSelection />);
      const mockDispatch = jest.spyOn(store, 'dispatch');

      const autoCard = screen.getByRole('listitem', { name: /select auto insurance/i });
      await userEvent.click(autoCard);

      expect(mockDispatch).toHaveBeenCalledWith(
        formActions.setStep('basic-info')
      );
    });

    it('handles cross-sell opportunity tracking', async () => {
      const { store } = renderWithProviders(<VerticalSelection />);
      const mockDispatch = jest.spyOn(store, 'dispatch');

      const autoCard = screen.getByRole('listitem', { name: /select auto insurance/i });
      await userEvent.click(autoCard);

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('updateCrossSellOpportunities')
        })
      );
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels for all interactive elements', () => {
      renderWithProviders(<VerticalSelection />);
      
      const cards = screen.getAllByRole('listitem');
      cards.forEach(card => {
        expect(card).toHaveAttribute('aria-label');
      });

      expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Insurance types');
    });

    it('maintains proper focus management', async () => {
      renderWithProviders(<VerticalSelection />);
      
      await userEvent.tab();
      expect(document.activeElement).toHaveAttribute('role', 'listitem');
      
      await userEvent.keyboard('{Enter}');
      expect(analytics.trackFormStep).toHaveBeenCalled();
    });

    it('supports screen reader announcements', () => {
      renderWithProviders(<VerticalSelection />);
      
      const list = screen.getByRole('list');
      expect(list).toHaveAttribute('aria-label');
      
      const items = within(list).getAllByRole('listitem');
      items.forEach(item => {
        expect(item).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Analytics', () => {
    it('tracks page view on component mount', () => {
      renderWithProviders(<VerticalSelection />);
      
      expect(analytics.trackPageView).toHaveBeenCalledWith(
        '/vertical-selection',
        'Insurance Vertical Selection',
        expect.any(Object)
      );
    });

    it('tracks vertical selection events', async () => {
      renderWithProviders(<VerticalSelection />);
      
      const autoCard = screen.getByRole('listitem', { name: /select auto insurance/i });
      await userEvent.click(autoCard);

      expect(analytics.trackFormStep).toHaveBeenCalledWith(
        'vertical-selection',
        expect.objectContaining({
          stepName: 'vertical-selection',
          isComplete: true,
          vertical: 'AUTO'
        })
      );
    });

    it('includes proper metadata in tracking calls', async () => {
      renderWithProviders(<VerticalSelection />);
      
      const autoCard = screen.getByRole('listitem', { name: /select auto insurance/i });
      await userEvent.click(autoCard);

      expect(analytics.trackFormStep).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          duration: expect.any(Number),
          formData: expect.any(Object)
        })
      );
    });

    it('handles tracking errors gracefully', async () => {
      (analytics.trackFormStep as jest.Mock).mockRejectedValueOnce(new Error());
      
      renderWithProviders(<VerticalSelection />);
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      const autoCard = screen.getByRole('listitem', { name: /select auto insurance/i });
      await userEvent.click(autoCard);

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});