import React from 'react';
import { FormControl, FormControlLabel, Radio, RadioGroup as MuiRadioGroup, FormHelperText } from '@mui/material';
import { styled } from '@mui/material/styles';
import { theme } from '../../theme';

// Props interface with comprehensive type safety
interface RadioGroupProps {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  vertical?: 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';
}

// Styled components with enhanced accessibility and mobile optimization
const StyledFormControl = styled(FormControl)(({ theme }) => ({
  marginBottom: theme.spacing.margin.md,
  width: '100%',
  
  // Proper spacing between radio options
  '& .MuiFormGroup-root': {
    gap: theme.spacing.margin.sm,
  },
  
  // Mobile-optimized touch targets (44px minimum)
  '& .MuiFormControlLabel-root': {
    minHeight: '44px',
    marginLeft: '0',
    marginRight: theme.spacing.margin.md,
  },
  
  // Focus state for keyboard navigation
  '&:focus-within': {
    outline: `2px solid ${theme.colors.ui.primary}`,
    outlineOffset: '2px',
  },
}));

// Styled radio button with enhanced visual feedback
const StyledRadio = styled(Radio)(({ theme }) => ({
  color: theme.colors.ui.primary,
  padding: theme.spacing.padding.xs,
  transition: 'all 0.2s ease-in-out',
  
  '&.Mui-checked': {
    color: theme.colors.ui.primary,
  },
  
  '&.Mui-disabled': {
    color: theme.colors.ui.text.disabled,
  },
  
  // Hover state with subtle background
  '&:hover': {
    backgroundColor: `rgba(${theme.colors.ui.primary}, 0.04)`,
  },
  
  // Focus visible state for keyboard navigation
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.colors.ui.primary}`,
    outlineOffset: '2px',
  },
}));

// Styled label with proper contrast and typography
const StyledLabel = styled('legend')(({ theme }) => ({
  ...theme.typography.formLabel,
  color: theme.colors.ui.text.primary,
  marginBottom: theme.spacing.margin.xs,
}));

/**
 * RadioGroup component providing accessible, styled radio button selections
 * with insurance-specific theming and mobile optimization.
 */
const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  label,
  options,
  value,
  onChange,
  error,
  helperText,
  disabled = false,
  required = false,
  vertical,
}) => {
  // Handle radio selection changes
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  // Get vertical-specific colors if provided
  const verticalColor = vertical ? theme.colors.verticals[vertical].primary : theme.colors.ui.primary;

  return (
    <StyledFormControl
      error={!!error}
      required={required}
      component="fieldset"
      data-testid={`radio-group-${name}`}
    >
      <StyledLabel>
        {label}
        {required && (
          <span
            aria-hidden="true"
            style={{ color: theme.colors.feedback.error.main, marginLeft: '4px' }}
          >
            *
          </span>
        )}
      </StyledLabel>
      
      <MuiRadioGroup
        name={name}
        value={value}
        onChange={handleChange}
        aria-label={label}
        aria-describedby={error ? `${name}-error` : helperText ? `${name}-helper` : undefined}
      >
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={
              <StyledRadio
                disabled={disabled}
                sx={{ color: verticalColor }}
                inputProps={{
                  'aria-label': option.label,
                }}
              />
            }
            label={option.label}
            disabled={disabled}
          />
        ))}
      </MuiRadioGroup>
      
      {/* Error or helper text with proper ARIA attributes */}
      {(error || helperText) && (
        <FormHelperText
          id={error ? `${name}-error` : `${name}-helper`}
          error={!!error}
          sx={{ margin: theme.spacing.margin.xs }}
        >
          {error || helperText}
        </FormHelperText>
      )}
    </StyledFormControl>
  );
};

export default RadioGroup;