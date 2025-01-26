import React from 'react';
import { render, screen } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^7.0.0
import { ThemeProvider } from '@emotion/react';
import mediaQuery from 'react-responsive'; // ^8.0.0
import { ui } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import Card from '../../../src/components/layout/Card';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock react-responsive
jest.mock('react-responsive', () => ({
  useMediaQuery: jest.fn()
}));

// Test theme provider wrapper
const renderWithTheme = (component: React.ReactNode) => {
  return render(
    <ThemeProvider theme={{ colors: { ui }, spacing }}>
      {component}
    </ThemeProvider>
  );
};

describe('Card', () => {
  // Mock handlers
  const mockClick = jest.fn();
  const mockKeyDown = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders children correctly', () => {
      renderWithTheme(
        <Card>
          <div data-testid="child">Test Content</div>
        </Card>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = renderWithTheme(
        <Card className="custom-class">Content</Card>
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('matches snapshot', () => {
      const { container } = renderWithTheme(
        <Card elevation={2} padding="md">
          Test Content
        </Card>
      );
      expect(container).toMatchSnapshot();
    });
  });

  describe('styling', () => {
    it.each([0, 1, 2, 3, 4])('applies correct elevation %i', (elevation) => {
      const { container } = renderWithTheme(
        <Card elevation={elevation as 0 | 1 | 2 | 3 | 4}>Content</Card>
      );
      expect(container.firstChild).toHaveStyle({
        boxShadow: expect.stringContaining('rgba(0, 0, 0,')
      });
    });

    it.each(['none', 'xs', 'sm', 'md', 'lg'])('applies correct padding %s', (padding) => {
      const { container } = renderWithTheme(
        <Card padding={padding as 'none' | 'xs' | 'sm' | 'md' | 'lg'}>Content</Card>
      );
      expect(container.firstChild).toHaveStyle({
        padding: spacing.padding[padding]
      });
    });

    it('applies correct background color', () => {
      const { container } = renderWithTheme(<Card>Content</Card>);
      expect(container.firstChild).toHaveStyle({
        backgroundColor: ui.surface
      });
    });

    it('applies interactive styles when onClick provided', () => {
      const { container } = renderWithTheme(
        <Card onClick={mockClick}>Content</Card>
      );
      expect(container.firstChild).toHaveStyle({
        cursor: 'pointer'
      });
    });
  });

  describe('accessibility', () => {
    it('meets WCAG accessibility standards', async () => {
      const { container } = renderWithTheme(<Card>Content</Card>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation when interactive', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <Card onClick={mockClick} tabIndex={0}>
          Interactive Content
        </Card>
      );

      const card = screen.getByRole('region');
      await user.tab();
      expect(card).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockClick).toHaveBeenCalledTimes(1);

      await user.keyboard(' ');
      expect(mockClick).toHaveBeenCalledTimes(2);
    });

    it('applies correct ARIA attributes', () => {
      renderWithTheme(
        <Card ariaLabel="Test Card" role="button">
          Content
        </Card>
      );
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('aria-label', 'Test Card');
    });
  });

  describe('responsive behavior', () => {
    beforeEach(() => {
      // Reset media query mock
      (mediaQuery.useMediaQuery as jest.Mock).mockReset();
    });

    it('adjusts padding for mobile viewport', () => {
      (mediaQuery.useMediaQuery as jest.Mock).mockReturnValue(true); // is mobile
      const { container } = renderWithTheme(
        <Card padding="md">Content</Card>
      );
      expect(container.firstChild).toHaveStyle({
        padding: expect.stringMatching(/\d+px/)
      });
    });

    it('maintains original padding for desktop viewport', () => {
      (mediaQuery.useMediaQuery as jest.Mock).mockReturnValue(false); // is desktop
      const { container } = renderWithTheme(
        <Card padding="md">Content</Card>
      );
      expect(container.firstChild).toHaveStyle({
        padding: spacing.padding.md
      });
    });
  });

  describe('interaction handling', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <Card onClick={mockClick}>
          Clickable Content
        </Card>
      );

      await user.click(screen.getByRole('region'));
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('applies hover styles when interactive', async () => {
      const user = userEvent.setup();
      const { container } = renderWithTheme(
        <Card onClick={mockClick}>
          Hover Content
        </Card>
      );

      await user.hover(container.firstChild as Element);
      expect(container.firstChild).toHaveStyle({
        transform: 'translateY(-2px)'
      });
    });
  });
});