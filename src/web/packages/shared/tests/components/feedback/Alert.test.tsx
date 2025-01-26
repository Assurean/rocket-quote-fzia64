import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, describe, it, jest, beforeEach, afterEach } from '@jest/globals';
import '@testing-library/jest-dom';
import Alert from '../../src/components/feedback/Alert';
import { feedback } from '../../src/theme/colors';

// Mock ResizeObserver for responsive testing
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// Helper function to render Alert with default test props
const renderAlert = (props: Partial<AlertProps> = {}) => {
  const user = userEvent.setup();
  const defaultProps = {
    severity: 'info' as const,
    message: 'Test alert message',
    ...props,
  };
  const result = render(<Alert {...defaultProps} />);
  return { ...result, user };
};

// Helper to verify accessibility requirements
const verifyAccessibility = (element: HTMLElement, severity: AlertSeverity) => {
  // Verify ARIA attributes
  expect(element).toHaveAttribute('role', severity === 'error' || severity === 'warning' ? 'alert' : 'status');
  expect(element).toHaveAttribute('aria-atomic', 'true');
  expect(element).toHaveAttribute('aria-live', severity === 'error' ? 'assertive' : 'polite');
  
  // Verify message accessibility
  const message = within(element).getByText('Test alert message');
  expect(message).toHaveAttribute('aria-label', `${severity} alert: Test alert message`);
};

describe('Alert Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Rendering and Styling', () => {
    it('renders with different severity levels', () => {
      const severities: AlertSeverity[] = ['success', 'error', 'warning', 'info'];
      
      severities.forEach(severity => {
        const { container } = renderAlert({ severity });
        const alert = container.firstChild as HTMLElement;
        
        // Verify styling
        expect(alert).toHaveStyle({
          backgroundColor: `${feedback[severity].main}14`,
          border: `1px solid ${feedback[severity].main}`,
        });
        
        // Verify message color
        const message = within(alert).getByText('Test alert message');
        expect(message).toHaveStyle({
          color: feedback[severity].main,
        });
      });
    });

    it('applies custom className when provided', () => {
      const { container } = renderAlert({ className: 'custom-alert' });
      expect(container.firstChild).toHaveClass('custom-alert');
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 AA requirements for all severities', () => {
      const severities: AlertSeverity[] = ['success', 'error', 'warning', 'info'];
      
      severities.forEach(severity => {
        const { container } = renderAlert({ severity });
        const alert = container.firstChild as HTMLElement;
        verifyAccessibility(alert, severity);
      });
    });

    it('supports keyboard navigation and focus management', async () => {
      const { container, user } = renderAlert({ onClose: jest.fn() });
      const alert = container.firstChild as HTMLElement;
      
      // Verify focusable
      expect(alert).toHaveAttribute('tabIndex', '0');
      
      // Verify focus visible styles
      await user.tab();
      expect(alert).toHaveFocus();
      
      // Verify close button accessibility
      const closeButton = screen.getByRole('button', { name: /close alert/i });
      await user.tab();
      expect(closeButton).toHaveFocus();
    });
  });

  describe('Interaction Handling', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = jest.fn();
      const { user } = renderAlert({ onClose });
      
      const closeButton = screen.getByRole('button', { name: /close alert/i });
      await user.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', async () => {
      const onClose = jest.fn();
      const { container, user } = renderAlert({ onClose });
      const alert = container.firstChild as HTMLElement;
      
      alert.focus();
      await user.keyboard('{Escape}');
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('auto-hides after specified duration', async () => {
      const onClose = jest.fn();
      renderAlert({ onClose, autoHideDuration: 3000 });
      
      // Fast-forward timers
      jest.advanceTimersByTime(3000);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('cleans up timer on unmount', () => {
      const onClose = jest.fn();
      const { unmount } = renderAlert({ onClose, autoHideDuration: 3000 });
      
      unmount();
      jest.advanceTimersByTime(3000);
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    it('maintains proper layout at different viewport sizes', () => {
      const { container } = renderAlert();
      const alert = container.firstChild as HTMLElement;
      
      // Verify flex layout
      expect(alert).toHaveStyle({
        display: 'flex',
        alignItems: 'center',
      });
      
      // Verify message wrapping
      const message = within(alert).getByText('Test alert message');
      expect(message).toHaveStyle({
        flex: 1,
      });
    });

    it('handles long messages gracefully', () => {
      const longMessage = 'A'.repeat(200);
      const { container } = renderAlert({ message: longMessage });
      const alert = container.firstChild as HTMLElement;
      
      expect(alert).toBeVisible();
      expect(within(alert).getByText(longMessage)).toBeVisible();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty message gracefully', () => {
      const { container } = renderAlert({ message: '' });
      const alert = container.firstChild as HTMLElement;
      
      expect(alert).toBeVisible();
      expect(alert).toHaveTextContent('');
    });

    it('handles missing onClose prop', () => {
      const { container } = renderAlert({ onClose: undefined });
      const alert = container.firstChild as HTMLElement;
      
      // Verify no close button rendered
      expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles custom role override', () => {
      const { container } = renderAlert({ role: 'log' });
      const alert = container.firstChild as HTMLElement;
      
      expect(alert).toHaveAttribute('role', 'log');
    });
  });
});