/**
 * @fileoverview Accessible checkbox component following WCAG 2.1 AA standards
 * Supports different states, validation, and custom styling based on design system
 * @version 1.0.0
 */

import React, { useCallback, memo, forwardRef } from 'react';
import styled from '@emotion/styled';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Constants for accessibility and styling
const TOUCH_TARGET_SIZE = '44px';
const CHECKBOX_SIZE = '20px';
const TRANSITION_DURATION = '200ms';

// Props interface with comprehensive type definitions
export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

// Styled components with state-based styling
const CheckboxContainer = styled.div`
  display: inline-flex;
  align-items: center;
  position: relative;
  min-height: ${TOUCH_TARGET_SIZE};
  padding: ${spacing.padding.xs};
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
`;

const StyledCheckbox = styled.div<{
  checked: boolean;
  disabled?: boolean;
  error?: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${CHECKBOX_SIZE};
  height: ${CHECKBOX_SIZE};
  border: 2px solid ${({ error }) => 
    error ? colors.feedback.error.main : colors.ui.border
  };
  border-radius: 4px;
  background-color: ${({ checked, disabled }) => 
    checked ? (disabled ? colors.ui.text.disabled : colors.ui.primary) : colors.ui.background
  };
  transition: all ${TRANSITION_DURATION} ease-in-out;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  
  &:hover {
    border-color: ${({ disabled, error }) => 
      disabled ? colors.ui.border : 
      error ? colors.feedback.error.main : 
      colors.ui.primary
    };
  }

  /* Focus styles for keyboard navigation */
  input:focus-visible + & {
    outline: none;
    box-shadow: 0 0 0 2px ${colors.ui.background}, 
                0 0 0 4px ${colors.ui.primary};
  }
`;

const CheckMark = styled.svg`
  width: 12px;
  height: 12px;
  fill: none;
  stroke: ${colors.ui.background};
  stroke-width: 2px;
  visibility: ${({ visible }: { visible: boolean }) => 
    visible ? 'visible' : 'hidden'
  };
`;

const Label = styled.label<{ disabled?: boolean; error?: boolean }>`
  margin-left: ${spacing.padding.sm};
  color: ${({ disabled, error }) => 
    disabled ? colors.ui.text.disabled :
    error ? colors.feedback.error.main :
    colors.ui.text.primary
  };
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  user-select: none;
`;

const ErrorMessage = styled.span`
  display: block;
  margin-top: ${spacing.margin.xs};
  color: ${colors.feedback.error.main};
  font-size: 0.875rem;
`;

// Main Checkbox component with ref forwarding
export const Checkbox = memo(forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked,
      onChange,
      label,
      disabled = false,
      error = false,
      errorMessage,
      required = false,
      className,
      id
    },
    ref
  ) => {
    // Memoized change handler
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        if (!disabled) {
          onChange(event.target.checked);
        }
      },
      [disabled, onChange]
    );

    // Generate unique ID if not provided
    const inputId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <CheckboxContainer className={className}>
        <HiddenInput
          ref={ref}
          type="checkbox"
          id={inputId}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-checked={checked}
          aria-disabled={disabled}
          aria-invalid={error}
          aria-required={required}
          aria-describedby={error && errorMessage ? `${inputId}-error` : undefined}
          data-testid="checkbox-input"
        />
        <StyledCheckbox
          checked={checked}
          disabled={disabled}
          error={error}
        >
          <CheckMark
            visible={checked}
            viewBox="0 0 12 12"
            role="presentation"
          >
            <path d="M2 6l3 3 5-6" />
          </CheckMark>
        </StyledCheckbox>
        <Label
          htmlFor={inputId}
          disabled={disabled}
          error={error}
        >
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </Label>
        {error && errorMessage && (
          <ErrorMessage
            id={`${inputId}-error`}
            role="alert"
          >
            {errorMessage}
          </ErrorMessage>
        )}
      </CheckboxContainer>
    );
  }
));

// Display name for debugging
Checkbox.displayName = 'Checkbox';

export default Checkbox;