import React, { useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers'; // v6.0+
import { LocalizationProvider } from '@mui/x-date-pickers'; // v6.0+
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'; // v6.0+
import { theme } from '../../theme';

/**
 * Type definition for insurance verticals
 */
type InsuranceVertical = 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';

/**
 * Type definition for different date field types in insurance forms
 */
type DateFieldType = 'birth' | 'policy' | 'purchase' | 'property';

/**
 * Props interface for the DatePicker component
 */
interface DatePickerProps {
  id: string;
  name: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  label: string;
  error?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  required?: boolean;
  vertical: InsuranceVertical;
  dateType: DateFieldType;
}

/**
 * Styled container for the date picker with responsive layout
 */
const DatePickerContainer = styled.div`
  margin-bottom: ${theme.spacing.padding.sm};
  position: relative;
  width: 100%;

  ${theme.mediaQueries.mobile} {
    margin-bottom: ${theme.spacing.padding.xs};
  }
`;

/**
 * Styled date picker component with enhanced accessibility and mobile optimization
 */
const StyledDatePicker = styled(MuiDatePicker)`
  width: 100%;

  & .MuiInputBase-root {
    font-family: ${theme.typography.body1.fontFamily};
    font-size: ${theme.typography.fontSize.base};
    line-height: ${theme.typography.lineHeight.normal};
    padding: ${theme.spacing.padding.xs};
    color: ${theme.colors.ui.text.primary};
  }

  & .MuiInputBase-input {
    &::placeholder {
      color: ${theme.colors.ui.text.hint};
    }
  }

  & .MuiOutlinedInput-root {
    &.Mui-focused {
      & .MuiOutlinedInput-notchedOutline {
        border-color: ${props => theme.colors.verticals[props.vertical].primary};
      }
    }

    &.Mui-error {
      & .MuiOutlinedInput-notchedOutline {
        border-color: ${theme.colors.feedback.error.main};
      }
    }
  }

  ${theme.mediaQueries.mobile} {
    & .MuiInputBase-root {
      font-size: ${theme.typography.fontSize.sm};
    }
  }
`;

/**
 * Helper function to get date constraints based on insurance vertical and field type
 */
const getDateConstraints = (vertical: InsuranceVertical, dateType: DateFieldType): { min: Date; max: Date } => {
  const today = new Date();
  const constraints = {
    min: new Date(),
    max: new Date()
  };

  switch (dateType) {
    case 'birth':
      constraints.min = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
      constraints.max = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
      break;
    case 'policy':
      constraints.min = today;
      constraints.max = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
      break;
    case 'purchase':
      constraints.min = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
      constraints.max = today;
      break;
    case 'property':
      constraints.min = new Date(today.getFullYear() - 150, today.getMonth(), today.getDate());
      constraints.max = today;
      break;
  }

  return constraints;
};

/**
 * Enhanced date picker component for insurance applications
 */
const DatePicker: React.FC<DatePickerProps> = ({
  id,
  name,
  value,
  onChange,
  label,
  error,
  minDate,
  maxDate,
  disabled = false,
  required = false,
  vertical,
  dateType,
}) => {
  // Get date constraints based on insurance vertical and field type
  const dateConstraints = useMemo(
    () => getDateConstraints(vertical, dateType),
    [vertical, dateType]
  );

  // Handle date change with validation
  const handleDateChange = useCallback(
    (newDate: Date | null) => {
      if (!newDate) {
        onChange(null);
        return;
      }

      const min = minDate || dateConstraints.min;
      const max = maxDate || dateConstraints.max;

      if (newDate >= min && newDate <= max) {
        onChange(newDate);
      }
    },
    [onChange, minDate, maxDate, dateConstraints]
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DatePickerContainer>
        <StyledDatePicker
          value={value}
          onChange={handleDateChange}
          vertical={vertical}
          slotProps={{
            textField: {
              id,
              name,
              label,
              error: !!error,
              helperText: error,
              required,
              disabled,
              inputProps: {
                'aria-label': label,
                'aria-required': required,
                'aria-invalid': !!error,
                'aria-describedby': error ? `${id}-error` : undefined,
              },
            },
          }}
          minDate={minDate || dateConstraints.min}
          maxDate={maxDate || dateConstraints.max}
          disableFuture={dateType !== 'policy'}
          disablePast={dateType === 'policy'}
          format="MM/dd/yyyy"
          views={['year', 'month', 'day']}
        />
      </DatePickerContainer>
    </LocalizationProvider>
  );
};

export default DatePicker;