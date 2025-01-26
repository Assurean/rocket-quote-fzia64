import React, { useCallback, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { parsePhoneNumber, CountryCode } from 'libphonenumber-js';
import debounce from 'lodash/debounce';
import Input from './Input';
import { theme } from '../../theme';

// Constants
const DEBOUNCE_DELAY = 300;
const PHONE_REGEX = /^[0-9-+() ]*$/;

// Interfaces
interface PhoneInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValidation?: (result: ValidationResult) => void;
  error?: string;
  label?: string;
  countryCode?: CountryCode;
  disabled?: boolean;
  tcpaRequired?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  isTcpaCompliant: boolean;
  carrierInfo?: {
    name: string;
    type: string;
  };
  error?: string;
}

// Styled Components
const PhoneInputContainer = styled.div`
  position: relative;
  width: 100%;
  margin-bottom: ${theme.spacing.padding.md};

  &[aria-invalid="true"] {
    ${Input} {
      border-color: ${theme.colors.feedback.error.main};
    }
  }
`;

const ValidationIndicator = styled.span<{ status?: 'valid' | 'invalid' | 'validating' }>`
  position: absolute;
  right: ${theme.spacing.padding.sm};
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  color: ${props => {
    switch (props.status) {
      case 'valid':
        return theme.colors.feedback.success.main;
      case 'invalid':
        return theme.colors.feedback.error.main;
      default:
        return theme.colors.ui.text.hint;
    }
  }};
`;

// Helper Functions
const formatPhoneNumber = (value: string, countryCode: CountryCode = 'US'): string => {
  try {
    // Remove all non-numeric characters except + for international format
    const cleaned = value.replace(/[^\d+]/g, '');
    
    // Parse phone number
    const phoneNumber = parsePhoneNumber(cleaned, countryCode);
    
    if (phoneNumber) {
      return phoneNumber.formatInternational();
    }
    
    return value;
  } catch {
    return value;
  }
};

const validatePhoneNumber = async (
  value: string,
  countryCode: CountryCode = 'US',
  tcpaRequired: boolean = true
): Promise<ValidationResult> => {
  try {
    // Basic format validation
    if (!value) {
      return {
        isValid: false,
        isTcpaCompliant: false,
        error: 'Phone number is required'
      };
    }

    const phoneNumber = parsePhoneNumber(value, countryCode);

    if (!phoneNumber || !phoneNumber.isValid()) {
      return {
        isValid: false,
        isTcpaCompliant: false,
        error: 'Invalid phone number format'
      };
    }

    // Mock carrier validation - in production, this would call an actual validation service
    const carrierInfo = {
      name: 'Sample Carrier',
      type: 'mobile'
    };

    // Mock TCPA validation - in production, this would check against a real TCPA compliance service
    const isTcpaCompliant = tcpaRequired ? value.length === 12 : true;

    return {
      isValid: true,
      isTcpaCompliant,
      carrierInfo,
      error: isTcpaCompliant ? undefined : 'Phone number is not TCPA compliant'
    };
  } catch (error) {
    return {
      isValid: false,
      isTcpaCompliant: false,
      error: 'Unable to validate phone number'
    };
  }
};

// Main Component
const PhoneInput: React.FC<PhoneInputProps> = React.memo(({
  id,
  name,
  value,
  onChange,
  onValidation,
  error,
  label = 'Phone Number',
  countryCode = 'US',
  disabled = false,
  tcpaRequired = true
}) => {
  const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | 'validating'>();

  // Memoized validation handler
  const debouncedValidation = useMemo(
    () => debounce(async (phoneNumber: string) => {
      setValidationStatus('validating');
      const result = await validatePhoneNumber(phoneNumber, countryCode, tcpaRequired);
      setValidationStatus(result.isValid ? 'valid' : 'invalid');
      onValidation?.(result);
    }, DEBOUNCE_DELAY),
    [countryCode, tcpaRequired, onValidation]
  );

  // Handle input change with formatting
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Only allow valid phone number characters
    if (!PHONE_REGEX.test(newValue)) {
      return;
    }

    // Format the phone number
    const formattedValue = formatPhoneNumber(newValue, countryCode);
    
    // Create new event with formatted value
    const formattedEvent = {
      ...e,
      target: {
        ...e.target,
        value: formattedValue
      }
    };

    onChange(formattedEvent);
    debouncedValidation(formattedValue);
  }, [onChange, debouncedValidation, countryCode]);

  return (
    <PhoneInputContainer aria-invalid={!!error}>
      <Input
        id={id}
        name={name}
        type="tel"
        value={value}
        onChange={handleChange}
        error={error}
        label={label}
        disabled={disabled}
        required
        autoComplete="tel"
        aria-label={label}
        aria-describedby={`${id}-validation`}
        placeholder="+1 (555) 555-5555"
      />
      <ValidationIndicator 
        status={validationStatus}
        id={`${id}-validation`}
        aria-live="polite"
      >
        {validationStatus === 'valid' && '✓'}
        {validationStatus === 'invalid' && '✗'}
        {validationStatus === 'validating' && '...'}
      </ValidationIndicator>
    </PhoneInputContainer>
  );
});

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;