import React, { useCallback, useEffect, useState, useMemo } from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import Input from './Input';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Interfaces
interface IAddressInfo {
  streetAddress: string;
  unitNumber?: string;
  city: string;
  state: string;
  zipCode: string;
}

interface ValidationDetails {
  isValid: boolean;
  standardizedAddress?: IAddressInfo;
  errors?: string[];
}

interface AddressInputProps {
  id: string;
  value: IAddressInfo;
  onChange: (address: IAddressInfo) => void;
  onValidation?: (isValid: boolean, details?: ValidationDetails) => void;
  error?: string;
  disabled?: boolean;
}

// Styled components with responsive design
const AddressContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.padding.sm};
  margin-bottom: ${spacing.margin.md};
  width: 100%;
`;

const StreetContainer = styled.div`
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: ${spacing.padding.sm};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const CityStateContainer = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: ${spacing.padding.sm};

  @media (max-width: 768px) {
    grid-template-columns: 2fr 1fr;
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

// Address validation function with debouncing
const validateAddress = debounce(async (
  address: IAddressInfo
): Promise<ValidationDetails> => {
  try {
    // Validate required fields
    const requiredFields = ['streetAddress', 'city', 'state', 'zipCode'];
    const missingFields = requiredFields.filter(field => !address[field as keyof IAddressInfo]);
    
    if (missingFields.length > 0) {
      return {
        isValid: false,
        errors: [`Missing required fields: ${missingFields.join(', ')}`]
      };
    }

    // Mock API call - replace with actual validation service
    const response = await fetch('/api/v1/validation/address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(address)
    });

    if (!response.ok) {
      throw new Error('Address validation failed');
    }

    const result = await response.json();
    return {
      isValid: result.isValid,
      standardizedAddress: result.standardizedAddress,
      errors: result.errors
    };
  } catch (error) {
    console.error('Address validation error:', error);
    return {
      isValid: false,
      errors: ['Unable to validate address. Please check your input.']
    };
  }
}, 300);

// Main component
const AddressInput: React.FC<AddressInputProps> = React.memo(({
  id,
  value,
  onChange,
  onValidation,
  error,
  disabled = false
}) => {
  const [validationState, setValidationState] = useState<ValidationDetails>({ isValid: true });

  // Handle individual field changes
  const handleFieldChange = useCallback((
    field: keyof IAddressInfo,
    fieldValue: string
  ) => {
    const newAddress = {
      ...value,
      [field]: fieldValue
    };
    onChange(newAddress);
  }, [value, onChange]);

  // Validate address when relevant fields change
  useEffect(() => {
    const validateAndUpdate = async () => {
      const validationResult = await validateAddress(value);
      setValidationState(validationResult);
      onValidation?.(validationResult.isValid, validationResult);
    };

    if (value.streetAddress && value.city && value.state && value.zipCode) {
      validateAndUpdate();
    }

    return () => {
      validateAddress.cancel();
    };
  }, [value, onValidation]);

  // Generate unique IDs for accessibility
  const fieldIds = useMemo(() => ({
    street: `${id}-street`,
    unit: `${id}-unit`,
    city: `${id}-city`,
    state: `${id}-state`,
    zip: `${id}-zip`
  }), [id]);

  return (
    <AddressContainer role="group" aria-labelledby={`${id}-label`}>
      <div id={`${id}-label`} className="sr-only">Address Information</div>
      
      <StreetContainer>
        <Input
          id={fieldIds.street}
          name="streetAddress"
          label="Street Address"
          value={value.streetAddress}
          onChange={(e) => handleFieldChange('streetAddress', e.target.value)}
          error={validationState.errors?.[0]}
          disabled={disabled}
          required
          aria-required="true"
        />
        <Input
          id={fieldIds.unit}
          name="unitNumber"
          label="Unit/Apt (Optional)"
          value={value.unitNumber || ''}
          onChange={(e) => handleFieldChange('unitNumber', e.target.value)}
          disabled={disabled}
          aria-required="false"
        />
      </StreetContainer>

      <CityStateContainer>
        <Input
          id={fieldIds.city}
          name="city"
          label="City"
          value={value.city}
          onChange={(e) => handleFieldChange('city', e.target.value)}
          error={error}
          disabled={disabled}
          required
          aria-required="true"
        />
        <Input
          id={fieldIds.state}
          name="state"
          label="State"
          value={value.state}
          onChange={(e) => handleFieldChange('state', e.target.value.toUpperCase())}
          maxLength={2}
          error={error}
          disabled={disabled}
          required
          aria-required="true"
        />
        <Input
          id={fieldIds.zip}
          name="zipCode"
          label="ZIP Code"
          value={value.zipCode}
          onChange={(e) => handleFieldChange('zipCode', e.target.value)}
          maxLength={5}
          error={error}
          disabled={disabled}
          required
          aria-required="true"
        />
      </CityStateContainer>
    </AddressContainer>
  );
});

AddressInput.displayName = 'AddressInput';

export default AddressInput;