import React, { useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

// Type for supported input types
type InputType = 'text' | 'email' | 'tel' | 'number' | 'password' | 'search' | 'url';

// Props interface with comprehensive type definitions
interface InputProps {
  id: string;
  name: string;
  type?: InputType;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  autoComplete?: string;
  'aria-label'?: string;
}

// Styled components with enterprise-grade styling
const InputContainer = styled.div`
  margin-bottom: ${spacing.padding.sm};
  position: relative;
  width: 100%;
`;

const Label = styled.label<{ required?: boolean }>`
  display: block;
  margin-bottom: ${spacing.padding.xs};
  font-size: ${typography.fontSize.sm};
  line-height: ${typography.lineHeight.normal};
  color: ${colors.ui.text.primary};
  font-weight: 500;

  ${props => props.required && `
    &::after {
      content: '*';
      color: ${colors.feedback.error.main};
      margin-left: ${spacing.padding.xs};
    }
  `}
`;

const StyledInput = styled.input<{ hasError?: boolean }>`
  width: 100%;
  padding: ${spacing.padding.md};
  font-size: ${typography.fontSize.base};
  line-height: ${typography.lineHeight.normal};
  color: ${colors.ui.text.primary};
  background-color: ${colors.ui.background};
  border: 1px solid ${props => props.hasError ? colors.feedback.error.main : colors.ui.border};
  border-radius: 4px;
  transition: all 0.2s ease;
  min-height: 44px; // Ensure mobile touch target size
  touch-action: manipulation; // Optimize for touch

  &:hover:not(:disabled) {
    border-color: ${props => props.hasError ? colors.feedback.error.dark : colors.ui.text.secondary};
  }

  &:focus {
    outline: none;
    border-color: ${props => props.hasError ? colors.feedback.error.main : colors.ui.primary};
    box-shadow: 0 0 0 2px ${props => props.hasError ? 
      `${colors.feedback.error.light}40` : 
      `${colors.ui.primary}40`
    };
  }

  &:disabled {
    background-color: ${colors.ui.surface};
    color: ${colors.ui.text.disabled};
    cursor: not-allowed;
  }

  &::placeholder {
    color: ${colors.ui.text.hint};
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  margin-top: ${spacing.padding.xs};
  color: ${colors.feedback.error.main};
  font-size: ${typography.fontSize.sm};
  line-height: ${typography.lineHeight.normal};
`;

// Input component with performance optimization
const Input = React.memo(({
  id,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  label,
  placeholder,
  disabled = false,
  required = false,
  readOnly = false,
  maxLength,
  autoComplete,
  'aria-label': ariaLabel,
}: InputProps) => {
  // Generate unique IDs for accessibility
  const errorId = useMemo(() => `${id}-error`, [id]);
  const descriptionId = useMemo(() => `${id}-description`, [id]);

  // Debounced onChange handler for performance
  const debouncedOnChange = useMemo(
    () => debounce(onChange, 150),
    [onChange]
  );

  // Cleanup debounced handler
  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  // Memoized change handler
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.persist();
      debouncedOnChange(e);
    },
    [debouncedOnChange]
  );

  return (
    <InputContainer>
      {label && (
        <Label 
          htmlFor={id}
          required={required}
        >
          {label}
        </Label>
      )}
      <StyledInput
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        maxLength={maxLength}
        autoComplete={autoComplete}
        hasError={!!error}
        aria-label={ariaLabel || label}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={
          error ? errorId : descriptionId
        }
      />
      {error && (
        <ErrorMessage
          id={errorId}
          role="alert"
        >
          {error}
        </ErrorMessage>
      )}
    </InputContainer>
  );
});

// Display name for debugging
Input.displayName = 'Input';

export default Input;