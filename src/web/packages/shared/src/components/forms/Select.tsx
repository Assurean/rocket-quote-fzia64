import React, { useCallback, useMemo, useState } from 'react';
import { styled } from '@mui/material/styles';
import Select, { SelectChangeEvent } from '@mui/material';
import FormControl from '@mui/material';
import MenuItem from '@mui/material';
import CircularProgress from '@mui/material';
import InputLabel from '@mui/material';
import FormHelperText from '@mui/material';

import { ui, feedback } from '../theme/colors';
import { fontSize, fontWeight, lineHeight } from '../theme/typography';
import { padding, margin } from '../theme/spacing';

// Generic interface for select options
interface SelectOption<T> {
  value: T;
  label: string;
}

// Props interface with generic type support
export interface SelectProps<T> {
  options: SelectOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  testId?: string;
  virtualized?: boolean;
  searchable?: boolean;
  maxHeight?: number;
}

// Styled components
const StyledFormControl = styled(FormControl)(({ theme, error, fullWidth }) => ({
  margin: margin.xs,
  minWidth: 120,
  width: fullWidth ? '100%' : 'auto',
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: error ? feedback.error.main : ui.border,
    },
    '&:hover fieldset': {
      borderColor: error ? feedback.error.dark : ui.primary,
    },
    '&.Mui-focused fieldset': {
      borderColor: error ? feedback.error.main : ui.primary,
    },
    '&.Mui-disabled fieldset': {
      borderColor: ui.text.disabled,
    },
  },
}));

const StyledSelect = styled(Select)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: fontSize.base,
  lineHeight: lineHeight.normal,
  padding: padding.xs,
  '& .MuiSelect-select': {
    padding: padding.sm,
  },
  '&.Mui-disabled': {
    backgroundColor: ui.surface,
    color: ui.text.disabled,
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  fontSize: fontSize.base,
  lineHeight: lineHeight.normal,
  padding: padding.sm,
  '&.Mui-selected': {
    backgroundColor: ui.primary,
    color: '#fff',
    '&:hover': {
      backgroundColor: ui.primary,
    },
  },
  '&:hover': {
    backgroundColor: ui.surface,
  },
}));

const LoadingWrapper = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: padding.sm,
});

// Main component implementation
export const Select = <T extends string | number>({
  options,
  value,
  defaultValue,
  onChange,
  label,
  placeholder,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = false,
  loading = false,
  testId,
  virtualized = false,
  searchable = false,
  maxHeight = 300,
}: SelectProps<T>): JSX.Element => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Memoize filtered options
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, searchable]);

  // Handle select change with type safety
  const handleChange = useCallback((event: SelectChangeEvent<T>) => {
    event.preventDefault();
    const newValue = event.target.value as T;
    onChange(newValue);
  }, [onChange]);

  // Handle search input
  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  return (
    <StyledFormControl 
      error={error}
      disabled={disabled}
      fullWidth={fullWidth}
      required={required}
      data-testid={testId}
    >
      {label && (
        <InputLabel id={`${testId}-label`}>
          {label}
          {required && ' *'}
        </InputLabel>
      )}
      
      <StyledSelect
        labelId={`${testId}-label`}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        disabled={disabled || loading}
        placeholder={placeholder}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight,
            },
          },
          ...(virtualized && {
            virtualized: true,
            itemSize: 48,
          }),
        }}
        {...(searchable && {
          onOpen: () => setSearchTerm(''),
          onClose: () => setSearchTerm(''),
          inputProps: {
            'aria-label': `Search ${label || 'options'}`,
            onChange: handleSearch,
          },
        })}
      >
        {loading ? (
          <LoadingWrapper>
            <CircularProgress size={20} />
          </LoadingWrapper>
        ) : (
          filteredOptions.map(option => (
            <StyledMenuItem
              key={option.value}
              value={option.value}
              data-testid={`${testId}-option-${option.value}`}
            >
              {option.label}
            </StyledMenuItem>
          ))
        )}
      </StyledSelect>

      {helperText && (
        <FormHelperText error={error}>
          {helperText}
        </FormHelperText>
      )}
    </StyledFormControl>
  );
};

export default Select;