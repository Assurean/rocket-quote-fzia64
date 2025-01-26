import React, { useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { Input } from '@shared/components/forms/Input';
import { Select } from '@shared/components/forms/Select';
import { useForm } from '../hooks/useForm';
import { useValidation } from '../hooks/useValidation';
import { InsuranceVertical } from '../../backend/services/lead-service/src/interfaces/lead.interface';

// Constants
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_RANGE = 30;
const VIN_LENGTH = 17;

// Types
type VehicleUseType = 'PERSONAL' | 'BUSINESS' | 'RIDESHARE';

interface VehicleFormData {
  year: string;
  make: string;
  model: string;
  vin?: string;
  primaryUse: VehicleUseType;
}

// Styled Components
const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  background: ${props => props.theme.colors.ui.background};
  border-radius: ${props => props.theme.borderRadius.medium};
  box-shadow: ${props => props.theme.shadows.card};

  @media (max-width: 768px) {
    padding: 1rem;
    margin: 0 1rem;
  }
`;

const FormSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: ${props => props.theme.typography.fontSize.base};
  color: ${props => props.theme.colors.ui.text.primary};
`;

const HelpText = styled.p`
  font-size: ${props => props.theme.typography.fontSize.sm};
  color: ${props => props.theme.colors.ui.text.secondary};
  margin-top: 0.25rem;
`;

// Generate year options
const generateYearOptions = () => {
  const years = [];
  for (let i = 0; i <= YEAR_RANGE; i++) {
    const year = CURRENT_YEAR - i;
    years.push({ value: year.toString(), label: year.toString() });
  }
  return years;
};

const vehicleUseOptions: Array<{ value: VehicleUseType; label: string }> = [
  { value: 'PERSONAL', label: 'Personal Use' },
  { value: 'BUSINESS', label: 'Business Use' },
  { value: 'RIDESHARE', label: 'Rideshare' }
];

const AutoForm: React.FC = () => {
  // Initialize hooks with security and validation configuration
  const { formData, updateField, validationState } = useForm(InsuranceVertical.AUTO);
  const { validateField, fieldError, isValidating } = useValidation({
    vertical: 'AUTO',
    validateOnChange: true,
    validateOnBlur: true,
    validationPriority: 'high'
  });

  // Memoized year options for performance
  const yearOptions = useMemo(() => generateYearOptions(), []);

  // Secure field change handler with validation
  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    try {
      await updateField(fieldName, value);
      await validateField(fieldName, value);
    } catch (error) {
      console.error(`Field update failed for ${fieldName}:`, error);
    }
  }, [updateField, validateField]);

  // Effect for VIN validation
  useEffect(() => {
    if (formData.vin && formData.vin.length === VIN_LENGTH) {
      handleFieldChange('vin', formData.vin);
    }
  }, [formData.vin, handleFieldChange]);

  return (
    <FormContainer role="form" aria-labelledby="vehicle-form-title">
      <h1 id="vehicle-form-title">Vehicle Information</h1>
      
      <FormSection aria-label="Vehicle Details">
        <Select
          id="vehicle-year"
          label="Vehicle Year"
          options={yearOptions}
          value={formData.year || ''}
          onChange={(value) => handleFieldChange('year', value)}
          error={fieldError('year')}
          required
          testId="vehicle-year-select"
          aria-describedby="year-help-text"
        />
        <HelpText id="year-help-text">Select the model year of your vehicle</HelpText>

        <Select
          id="vehicle-make"
          label="Vehicle Make"
          options={formData.year ? [] : []} // Would be populated from API
          value={formData.make || ''}
          onChange={(value) => handleFieldChange('make', value)}
          error={fieldError('make')}
          required
          disabled={!formData.year}
          testId="vehicle-make-select"
        />

        <Select
          id="vehicle-model"
          label="Vehicle Model"
          options={formData.make ? [] : []} // Would be populated from API
          value={formData.model || ''}
          onChange={(value) => handleFieldChange('model', value)}
          error={fieldError('model')}
          required
          disabled={!formData.make}
          testId="vehicle-model-select"
        />

        <Input
          id="vehicle-vin"
          name="vin"
          label="VIN (Optional)"
          value={formData.vin || ''}
          onChange={(e) => handleFieldChange('vin', e.target.value)}
          error={fieldError('vin')}
          maxLength={VIN_LENGTH}
          placeholder="Enter 17-character VIN"
          aria-describedby="vin-help-text"
        />
        <HelpText id="vin-help-text">
          The Vehicle Identification Number can be found on your registration or dashboard
        </HelpText>

        <fieldset>
          <legend>Primary Vehicle Use</legend>
          <RadioGroup role="radiogroup">
            {vehicleUseOptions.map((option) => (
              <RadioLabel key={option.value}>
                <input
                  type="radio"
                  name="primaryUse"
                  value={option.value}
                  checked={formData.primaryUse === option.value}
                  onChange={(e) => handleFieldChange('primaryUse', e.target.value)}
                  aria-describedby={`${option.value}-description`}
                />
                {option.label}
              </RadioLabel>
            ))}
          </RadioGroup>
        </fieldset>
      </FormSection>

      {isValidating && (
        <div role="status" aria-live="polite">
          Validating your information...
        </div>
      )}
    </FormContainer>
  );
};

export default AutoForm;