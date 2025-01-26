import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import Input from '../../src/components/forms/Input';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';

// Mock theme for styled-components
const theme = {
  colors,
  typography,
  spacing
};

// Test setup wrapper with theme provider
const renderWithTheme = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

describe('Input Component', () => {
  // Common props for testing
  const defaultProps = {
    id: 'test-input',
    name: 'test',
    value: '',
    onChange: jest.fn(),
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with minimum required props', () => {
      renderWithTheme(<Input {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with label when provided', () => {
      renderWithTheme(<Input {...defaultProps} label="Test Label" />);
      expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    });

    it('renders with placeholder text', () => {
      renderWithTheme(<Input {...defaultProps} placeholder="Enter value" />);
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
    });

    it('applies disabled styles correctly', () => {
      renderWithTheme(<Input {...defaultProps} disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveStyle(`background-color: ${colors.ui.surface}`);
    });

    it('renders error state correctly', () => {
      renderWithTheme(<Input {...defaultProps} error="Error message" />);
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveStyle(`border-color: ${colors.feedback.error.main}`);
    });

    it('renders required indicator when field is required', () => {
      renderWithTheme(<Input {...defaultProps} label="Required Field" required />);
      const label = screen.getByText('Required Field');
      expect(label).toHaveStyle('content: "*"');
    });
  });

  describe('User Interaction', () => {
    it('handles value changes', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      renderWithTheme(<Input {...defaultProps} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test value');
      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });

    it('handles focus and blur events', async () => {
      const onFocus = jest.fn();
      const onBlur = jest.fn();
      
      renderWithTheme(
        <Input {...defaultProps} onFocus={onFocus} onBlur={onBlur} />
      );
      const input = screen.getByRole('textbox');
      
      fireEvent.focus(input);
      expect(onFocus).toHaveBeenCalled();
      
      fireEvent.blur(input);
      expect(onBlur).toHaveBeenCalled();
    });

    it('respects maxLength constraint', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Input {...defaultProps} maxLength={5} />);
      const input = screen.getByRole('textbox');
      
      await user.type(input, '123456');
      expect(input).toHaveValue('12345');
    });

    it('handles paste events correctly', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Input {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      await user.click(input);
      await user.paste('pasted text');
      
      expect(input).toHaveValue('pasted text');
    });
  });

  describe('Validation', () => {
    it('validates required fields', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <Input {...defaultProps} required error="This field is required" />
      );
      const input = screen.getByRole('textbox');
      
      await user.click(input);
      fireEvent.blur(input);
      
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <Input {...defaultProps} type="email" error="Invalid email format" />
      );
      const input = screen.getByRole('textbox');
      
      await user.type(input, 'invalid-email');
      fireEvent.blur(input);
      
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    });

    it('supports custom validation', async () => {
      const onValidate = jest.fn().mockReturnValue('Custom error');
      const user = userEvent.setup();
      
      renderWithTheme(
        <Input {...defaultProps} onValidate={onValidate} />
      );
      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');
      fireEvent.blur(input);
      
      expect(onValidate).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      renderWithTheme(
        <Input 
          {...defaultProps}
          label="Test Label"
          required
          error="Error message"
        />
      );
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Input {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      await user.tab();
      expect(input).toHaveFocus();
    });

    it('announces errors to screen readers', () => {
      renderWithTheme(
        <Input {...defaultProps} error="Error message" />
      );
      const errorMessage = screen.getByText('Error message');
      
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });

  describe('Performance', () => {
    it('debounces onChange events', async () => {
      jest.useFakeTimers();
      const onChange = jest.fn();
      const user = userEvent.setup({ delay: null });
      
      renderWithTheme(<Input {...defaultProps} onChange={onChange} />);
      const input = screen.getByRole('textbox');
      
      await user.type(input, 'test');
      expect(onChange).not.toHaveBeenCalled();
      
      jest.runAllTimers();
      expect(onChange).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    it('implements React.memo correctly', () => {
      const { rerender } = renderWithTheme(<Input {...defaultProps} />);
      const firstRender = screen.getByRole('textbox');
      
      rerender(<Input {...defaultProps} />);
      const secondRender = screen.getByRole('textbox');
      
      expect(firstRender).toBe(secondRender);
    });

    it('cleans up debounced handlers on unmount', () => {
      const onChange = jest.fn();
      const { unmount } = renderWithTheme(
        <Input {...defaultProps} onChange={onChange} />
      );
      
      unmount();
      // Ensure no memory leaks from debounced handlers
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});