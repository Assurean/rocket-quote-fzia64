import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@mui/material';
import { theme } from '@mui/material';

import LandingPage from '../../src/routes/LandingPage';
import { formActions } from '../../src/store/slices/formSlice';
import { InsuranceVertical } from '../../../backend/services/lead-service/src/interfaces/lead.interface';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock analytics
jest.mock('@segment/analytics-next', () => ({
  analytics: {
    track: jest.fn()
  }
}));

// Helper function to render with Redux store
const renderWithRedux = (
  component: React.ReactElement,
  {
    initialState = {},
    store = configureStore({
      reducer: {
        form: (state = initialState, action) => state
      }
    })
  } = {}
) => {
  const user = userEvent.setup();
  return {
    user,
    store,
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          {component}
        </ThemeProvider>
      </Provider>
    )
  };
};

// Mock window.matchMedia for responsive tests
const setViewport = (width: number) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: width >= parseInt(query.match(/\d+/)?.[0] || '0'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
  
  window.dispatchEvent(new Event('resize'));
};

describe('LandingPage Component', () => {
  describe('rendering', () => {
    it('renders all six insurance type cards with correct content', () => {
      renderWithRedux(<LandingPage />);
      
      const insuranceTypes = [
        { title: 'Auto Insurance', description: 'Coverage for your vehicles' },
        { title: 'Home Insurance', description: 'Protection for your property' },
        { title: 'Health Insurance', description: 'Medical coverage for you and your family' },
        { title: 'Life Insurance', description: 'Financial protection for your loved ones' },
        { title: 'Renters Insurance', description: 'Coverage for your rental property' },
        { title: 'Commercial Insurance', description: 'Protection for your business' }
      ];

      insuranceTypes.forEach(({ title, description }) => {
        const card = screen.getByRole('button', { name: new RegExp(title, 'i') });
        expect(card).toBeInTheDocument();
        expect(within(card).getByText(description)).toBeInTheDocument();
      });
    });

    it('displays vertical-specific icons and colors', () => {
      renderWithRedux(<LandingPage />);
      
      const cards = screen.getAllByRole('button');
      expect(cards).toHaveLength(6);

      // Verify each card has an icon and correct color
      cards.forEach(card => {
        expect(within(card).getByRole('img', { hidden: true })).toBeInTheDocument();
        expect(card).toHaveStyle({ backgroundColor: expect.stringContaining('rgba') });
      });
    });

    it('maintains visual hierarchy and spacing', () => {
      renderWithRedux(<LandingPage />);
      
      const title = screen.getByRole('heading', { level: 1 });
      const grid = screen.getByRole('list', { name: /insurance types/i });
      
      expect(title).toHaveStyle({ marginBottom: expect.any(String) });
      expect(grid).toHaveStyle({ gap: expect.any(String) });
    });
  });

  describe('interaction', () => {
    it('handles mouse click selection of insurance type', async () => {
      const { store } = renderWithRedux(<LandingPage />);
      
      const autoCard = screen.getByRole('button', { name: /select auto insurance/i });
      fireEvent.click(autoCard);

      await waitFor(() => {
        expect(store.getState().form.currentVertical).toBe(InsuranceVertical.AUTO);
        expect(store.getState().form.currentStep).toBe('basic-info');
      });
    });

    it('supports keyboard navigation and selection', async () => {
      const { store } = renderWithRedux(<LandingPage />);
      
      const cards = screen.getAllByRole('button');
      cards[0].focus();
      
      fireEvent.keyPress(document.activeElement!, { key: 'Enter' });

      await waitFor(() => {
        expect(store.getState().form.currentStep).toBe('basic-info');
      });
    });

    it('updates Redux store with selected vertical', async () => {
      const { store } = renderWithRedux(<LandingPage />);
      const dispatchSpy = jest.spyOn(store, 'dispatch');
      
      const homeCard = screen.getByRole('button', { name: /select home insurance/i });
      fireEvent.click(homeCard);

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(
          formActions.setCurrentVertical(InsuranceVertical.HOME)
        );
      });
    });
  });

  describe('accessibility', () => {
    it('meets WCAG 2.1 AA requirements', async () => {
      const { container } = renderWithRedux(<LandingPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides correct ARIA labels and roles', () => {
      renderWithRedux(<LandingPage />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Insurance types');
      
      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        expect(card).toHaveAttribute('aria-label');
      });
    });

    it('supports screen reader announcements', async () => {
      renderWithRedux(<LandingPage />);
      
      const autoCard = screen.getByRole('button', { name: /select auto insurance/i });
      fireEvent.click(autoCard);

      await waitFor(() => {
        const announcement = document.querySelector('[aria-live="polite"]');
        expect(announcement).toHaveTextContent(/selected auto insurance/i);
      });
    });
  });

  describe('responsive', () => {
    it('adapts layout for mobile viewport', () => {
      setViewport(375);
      renderWithRedux(<LandingPage />);
      
      const grid = screen.getByRole('list');
      expect(grid).toHaveStyle({
        'grid-template-columns': '1fr'
      });
    });

    it('adjusts to tablet breakpoint', () => {
      setViewport(768);
      renderWithRedux(<LandingPage />);
      
      const grid = screen.getByRole('list');
      expect(grid).toHaveStyle({
        'grid-template-columns': '1fr 1fr'
      });
    });

    it('optimizes for desktop display', () => {
      setViewport(1024);
      renderWithRedux(<LandingPage />);
      
      const grid = screen.getByRole('list');
      expect(grid).toHaveStyle({
        'grid-template-columns': '1fr 1fr 1fr'
      });
    });

    it('maintains touch targets on mobile', () => {
      setViewport(375);
      renderWithRedux(<LandingPage />);
      
      const cards = screen.getAllByRole('button');
      cards.forEach(card => {
        const { height } = card.getBoundingClientRect();
        expect(height).toBeGreaterThanOrEqual(44); // Minimum touch target size
      });
    });
  });
});