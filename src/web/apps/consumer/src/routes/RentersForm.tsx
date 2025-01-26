import React, { useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { useDebounce } from 'use-debounce'; // v9.0.0
import { analytics } from '@segment/analytics-next'; // v1.51.0

import Input from '@shared/components/forms/Input';
import Select from '@shared/components/forms/Select';
import { useForm } from '../hooks/useForm';
import { useValidation } from '../hooks/useValidation';
import { InsuranceVertical } from '../../backend/services/lead-service/src/interfaces/lead.interface';

// Constants
const PROPERTY_TYPES = ['Apartment', 'Condo', 'House', 'Townhouse', 'Mobile Home'];
const LIABILITY_LIMITS = [100000, 300000, 500000, 1000000];
const SECURITY_FEATURES = [
  'Smoke Detectors',
  'Security System',
  'Deadbolts',
  'Fire Extinguisher',
  'Sprinkler System'
];
const VALIDATION_DEBOUNCE_MS = 300;
const PARTIAL_LEAD_THRESHOLD = 3;

// Interfaces
interface RentersFormData {
  propertyType: string;
  monthlyRent: number;
  personalPropertyValue: number;
  liabilityLimit: number;
  securityFeatures: string[];
  petInfo: {
    hasPets: boolean;
    petTypes?: string[];
    breedInfo?: string;
  };
  crossSellData: {
    hasVehicle: boolean;
    lifeEvents: string[];
    creditScore?: number;
  };
}

// Styled Components
const FormContainer = styled.div`
  max-width: min(600px, 100%);
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const FormSection = styled.section`
  margin-bottom: 32px;
  
  &[aria-labelledby="section-title"] {
    border-radius: 8px;
    padding: 20px;
    background: #f8f9fa;
  }
`;

const FormRow = styled.div`
  margin-bottom: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
`;

const SecurityFeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 16px;
`;

// Main Component
const RentersForm: React.FC = () => {
  const { formData, updateField, submitForm, savePartialLead } = useForm(InsuranceVertical.RENTERS);
  const { validateField, fieldError, isValidating } = useValidation({
    vertical: 'RENTERS',
    debounceMs: VALIDATION_DEBOUNCE_MS,
    validateOnChange: true,
    validationPriority: 'high'
  });

  // Debounced validation handler
  const [debouncedValidation] = useDebounce(
    (fieldName: string, value: any) => validateField(fieldName, value),
    VALIDATION_DEBOUNCE_MS
  );

  // Memoized form data
  const rentersData = useMemo(() => formData as RentersFormData, [formData]);

  // Handle input changes with validation
  const handleInputChange = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value, type } = event.target;
    const processedValue = type === 'number' ? parseFloat(value) : value;

    try {
      await updateField(name, processedValue);
      debouncedValidation(name, processedValue);

      // Track field completion
      analytics.track('Form Field Completed', {
        fieldName: name,
        vertical: 'RENTERS',
        value: processedValue
      });

      // Check for partial lead save
      const completedFields = Object.keys(formData).length;
      if (completedFields >= PARTIAL_LEAD_THRESHOLD) {
        await savePartialLead();
      }
    } catch (error) {
      console.error('Field update failed:', error);
    }
  }, [updateField, debouncedValidation, formData, savePartialLead]);

  // Handle select changes
  const handleSelectChange = useCallback(async (
    name: string,
    value: string | number
  ) => {
    try {
      await updateField(name, value);
      debouncedValidation(name, value);

      analytics.track('Form Selection Made', {
        fieldName: name,
        vertical: 'RENTERS',
        value
      });
    } catch (error) {
      console.error('Selection update failed:', error);
    }
  }, [updateField, debouncedValidation]);

  // Handle security features selection
  const handleSecurityFeatureToggle = useCallback((feature: string) => {
    const currentFeatures = rentersData.securityFeatures || [];
    const updatedFeatures = currentFeatures.includes(feature)
      ? currentFeatures.filter(f => f !== feature)
      : [...currentFeatures, feature];

    updateField('securityFeatures', updatedFeatures);
  }, [rentersData.securityFeatures, updateField]);

  // Track form view
  useEffect(() => {
    analytics.page('Renters Insurance Form', {
      vertical: 'RENTERS',
      formStep: 'VERTICAL_SPECIFIC'
    });
  }, []);

  return (
    <FormContainer>
      <FormSection aria-labelledby="property-section-title">
        <h2 id="property-section-title">Property Information</h2>
        <FormRow>
          <Select
            id="propertyType"
            name="propertyType"
            label="Property Type"
            value={rentersData.propertyType}
            onChange={(value) => handleSelectChange('propertyType', value)}
            options={PROPERTY_TYPES.map(type => ({ value: type, label: type }))}
            error={fieldError}
            required
            testId="renters-property-type"
          />
          <Input
            id="monthlyRent"
            name="monthlyRent"
            type="number"
            label="Monthly Rent"
            value={rentersData.monthlyRent?.toString()}
            onChange={handleInputChange}
            error={fieldError}
            required
            placeholder="Enter monthly rent amount"
          />
        </FormRow>
      </FormSection>

      <FormSection aria-labelledby="coverage-section-title">
        <h2 id="coverage-section-title">Coverage Details</h2>
        <FormRow>
          <Input
            id="personalPropertyValue"
            name="personalPropertyValue"
            type="number"
            label="Personal Property Value"
            value={rentersData.personalPropertyValue?.toString()}
            onChange={handleInputChange}
            error={fieldError}
            required
            placeholder="Estimated value of belongings"
          />
          <Select
            id="liabilityLimit"
            name="liabilityLimit"
            label="Liability Coverage"
            value={rentersData.liabilityLimit}
            onChange={(value) => handleSelectChange('liabilityLimit', value)}
            options={LIABILITY_LIMITS.map(limit => ({
              value: limit,
              label: `$${limit.toLocaleString()}`
            }))}
            error={fieldError}
            required
            testId="renters-liability-limit"
          />
        </FormRow>
      </FormSection>

      <FormSection aria-labelledby="security-section-title">
        <h2 id="security-section-title">Security Features</h2>
        <SecurityFeaturesGrid>
          {SECURITY_FEATURES.map(feature => (
            <Input
              key={feature}
              id={`security-${feature}`}
              name="securityFeatures"
              type="checkbox"
              label={feature}
              checked={rentersData.securityFeatures?.includes(feature)}
              onChange={() => handleSecurityFeatureToggle(feature)}
            />
          ))}
        </SecurityFeaturesGrid>
      </FormSection>

      <FormSection aria-labelledby="pets-section-title">
        <h2 id="pets-section-title">Pet Information</h2>
        <FormRow>
          <Input
            id="hasPets"
            name="petInfo.hasPets"
            type="checkbox"
            label="Do you have pets?"
            checked={rentersData.petInfo?.hasPets}
            onChange={handleInputChange}
          />
          {rentersData.petInfo?.hasPets && (
            <Input
              id="petTypes"
              name="petInfo.petTypes"
              type="text"
              label="Type of Pets"
              value={rentersData.petInfo?.petTypes?.join(', ')}
              onChange={handleInputChange}
              placeholder="e.g., Dog, Cat"
            />
          )}
        </FormRow>
      </FormSection>

      <FormSection aria-labelledby="cross-sell-section-title">
        <h2 id="cross-sell-section-title">Additional Information</h2>
        <FormRow>
          <Input
            id="hasVehicle"
            name="crossSellData.hasVehicle"
            type="checkbox"
            label="Do you own a vehicle?"
            checked={rentersData.crossSellData?.hasVehicle}
            onChange={handleInputChange}
          />
          <Input
            id="creditScore"
            name="crossSellData.creditScore"
            type="number"
            label="Credit Score (Optional)"
            value={rentersData.crossSellData?.creditScore?.toString()}
            onChange={handleInputChange}
            placeholder="Enter your credit score"
          />
        </FormRow>
      </FormSection>
    </FormContainer>
  );
};

export default RentersForm;