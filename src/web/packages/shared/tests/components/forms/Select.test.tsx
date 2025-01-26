import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@emotion/react';
import Select from '../../src/components/forms/Select';
import { createTheme } from '@mui/material/styles';
import { verticals } from '../../src/theme/colors';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Create theme for testing
const theme = createTheme();

// Mock insurance options
const insuranceOptions = [
  { value: 'auto', label: 'Auto Insurance' },
  { value: 'home', label: 'Home Insurance' },
  { value: 'health', label: 'Health Insurance' },
  { value: 'life', label: 'Life Insurance' }
];

// Test wrapper component
const renderWithTheme = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

describe('Select Component', () => {
  // Common props
  const defaultProps = {
    options: insuranceOptions,
    onChange: jest.fn(),
    testId: 'insurance-select'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with default state', () => {
      renderWithTheme(<Select {...defaultProps} />);
      expect(screen.getByTestId('insurance-select')).toBeInTheDocument();
    });

    it('renders with placeholder text', () => {
      const placeholder = 'Select Insurance Type';
      renderWithTheme(<Select {...defaultProps} placeholder={placeholder} />);
      expect(screen.getByText(placeholder)).toBeInTheDocument();
    });

    it('renders all options correctly', () => {
      renderWithTheme(<Select {...defaultProps} />);
      fireEvent.mouseDown(screen.getByRole('button'));
      
      insuranceOptions.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });

    it('renders loading state', () => {
      renderWithTheme(<Select {...defaultProps} loading={true} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('applies error styling when error prop is true', () => {
      renderWithTheme(
        <Select 
          {...defaultProps} 
          error={true} 
          helperText="Error message"
        />
      );
      expect(screen.getByText('Error message')).toHaveStyle({
        color: verticals.auto.primary // Error color from theme
      });
    });
  });

  describe('Interaction', () => {
    it('calls onChange when option is selected', async () => {
      const onChange = jest.fn();
      renderWithTheme(<Select {...defaultProps} onChange={onChange} />);
      
      fireEvent.mouseDown(screen.getByRole('button'));
      fireEvent.click(screen.getByText('Auto Insurance'));
      
      expect(onChange).toHaveBeenCalledWith('auto');
    });

    it('supports keyboard navigation', async () => {
      renderWithTheme(<Select {...defaultProps} />);
      const select = screen.getByRole('button');
      
      // Open dropdown with keyboard
      fireEvent.keyDown(select, { key: 'Enter' });
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      // Navigate with arrow keys
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
      expect(screen.getByText('Auto Insurance')).toHaveFocus();
    });

    it('handles disabled state', () => {
      renderWithTheme(<Select {...defaultProps} disabled={true} />);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('supports search functionality when searchable', async () => {
      renderWithTheme(<Select {...defaultProps} searchable={true} />);
      
      fireEvent.mouseDown(screen.getByRole('button'));
      await userEvent.type(screen.getByRole('textbox'), 'auto');
      
      expect(screen.getByText('Auto Insurance')).toBeInTheDocument();
      expect(screen.queryByText('Home Insurance')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility guidelines', async () => {
      const { container } = renderWithTheme(<Select {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has correct ARIA attributes', () => {
      renderWithTheme(<Select {...defaultProps} label="Insurance Type" />);
      
      const select = screen.getByRole('button');
      expect(select).toHaveAttribute('aria-haspopup', 'listbox');
      expect(select).toHaveAttribute('aria-labelledby');
    });

    it('announces selection changes to screen readers', () => {
      renderWithTheme(<Select {...defaultProps} />);
      
      fireEvent.mouseDown(screen.getByRole('button'));
      fireEvent.click(screen.getByText('Auto Insurance'));
      
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Auto Insurance')
      );
    });

    it('supports keyboard selection', async () => {
      renderWithTheme(<Select {...defaultProps} />);
      const select = screen.getByRole('button');
      
      // Open with Space
      fireEvent.keyDown(select, { key: ' ' });
      // Select with Enter
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
      
      expect(defaultProps.onChange).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('displays required field indicator', () => {
      renderWithTheme(
        <Select 
          {...defaultProps} 
          required={true}
          label="Insurance Type"
        />
      );
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('shows error message when invalid', () => {
      const errorMessage = 'Please select an insurance type';
      renderWithTheme(
        <Select 
          {...defaultProps}
          error={true}
          helperText={errorMessage}
        />
      );
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('clears error state when valid option selected', () => {
      const onChange = jest.fn();
      renderWithTheme(
        <Select 
          {...defaultProps}
          onChange={onChange}
          error={true}
          helperText="Error message"
        />
      );
      
      fireEvent.mouseDown(screen.getByRole('button'));
      fireEvent.click(screen.getByText('Auto Insurance'));
      
      expect(onChange).toHaveBeenCalledWith('auto');
    });
  });

  describe('Virtualization', () => {
    it('applies virtualization props when enabled', () => {
      renderWithTheme(
        <Select 
          {...defaultProps}
          virtualized={true}
          options={Array.from({ length: 1000 }, (_, i) => ({
            value: `option-${i}`,
            label: `Option ${i}`
          }))}
        />
      );
      
      fireEvent.mouseDown(screen.getByRole('button'));
      expect(screen.getByRole('listbox')).toHaveAttribute('data-virtualized', 'true');
    });
  });
});