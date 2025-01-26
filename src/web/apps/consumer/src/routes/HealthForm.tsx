import React, { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { useDebounce } from 'use-debounce'; // v9.0.0
import Input from '@shared/components/forms/Input';
import Select from '@shared/components/forms/Select';
import { useForm } from '../hooks/useForm';
import { useValidation } from '../hooks/useValidation';
import { InsuranceVertical } from '../../backend/services/lead-service/src/interfaces/lead.interface';

// Constants
const COVERAGE_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual Coverage' },
  { value: 'FAMILY', label: 'Family Coverage' },
  { value: 'MEDICARE', label: 'Medicare' },
  { value: 'MEDICARE_ADVANTAGE', label: 'Medicare Advantage' },
  { value: 'MEDICARE_SUPPLEMENT', label: 'Medicare Supplement' },
  { value: 'SHORT_TERM', label: 'Short Term' }
];

const DEDUCTIBLE_OPTIONS = [
  { value: '0-1000', label: '$0 - $1,000' },
  { value: '1001-2500', label: '$1,001 - $2,500' },
  { value: '2501-5000', label: '$2,501 - $5,000' },
  { value: '5001+', label: '$5,001+' }
];

const NETWORK_TYPES = [
  { value: 'HMO', label: 'HMO' },
  { value: 'PPO', label: 'PPO' },
  { value: 'EPO', label: 'EPO' },
  { value: 'POS', label: 'POS' }
];

// Styled Components
const FormContainer = styled.form`
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const FormSection = styled.section`
  margin-bottom: 32px;
  padding: 16px;
  border-radius: 8px;
  background-color: #f5f5f5;
`;

const FormTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #212121;
  margin-bottom: 24px;
  text-align: center;
`;

const FormActions = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  gap: 16px;
`;

const Button = styled.button`
  padding: 12px 24px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled(Button)`
  background-color: #2E7D32;
  color: #ffffff;
  border: none;
  
  &:hover:not(:disabled) {
    background-color: #1B5E20;
  }
`;

const BackButton = styled(Button)`
  background-color: transparent;
  border: 1px solid #757575;
  color: #757575;
  
  &:hover:not(:disabled) {
    background-color: #f5f5f5;
  }
`;

// Component
const HealthForm: React.FC = () => {
  const { formData, updateField, submitForm, isSubmitting } = useForm(InsuranceVertical.HEALTH);
  const { validateField, fieldError, isValidating } = useValidation({
    vertical: 'HEALTH',
    validateOnChange: true,
    validateOnBlur: true,
    validationPriority: 'high'
  });

  const [debouncedValidation] = useDebounce(validateField, 300);

  // Handle field changes with validation
  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    try {
      await updateField(fieldName, value, fieldName === 'preexisting_conditions' ? 'pii' : 'normal');
      await debouncedValidation(fieldName, value);
    } catch (error) {
      console.error('Field update error:', error);
    }
  }, [updateField, debouncedValidation]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidating) {
      await submitForm();
    }
  }, [submitForm, isValidating]);

  return (
    <FormContainer
      onSubmit={handleSubmit}
      role="form"
      aria-labelledby="health-form-title"
    >
      <FormTitle id="health-form-title">Health Insurance Information</FormTitle>

      <FormSection aria-labelledby="coverage-section">
        <h2 id="coverage-section">Coverage Details</h2>
        <Select
          options={COVERAGE_TYPES}
          value={formData.coverage_type}
          onChange={(value) => handleFieldChange('coverage_type', value)}
          label="Coverage Type"
          error={fieldError('coverage_type')}
          required
          fullWidth
          testId="coverage-type-select"
        />

        <Input
          id="household-size"
          name="household_size"
          type="number"
          value={formData.household_size}
          onChange={(e) => handleFieldChange('household_size', e.target.value)}
          label="Household Size"
          error={fieldError('household_size')}
          required
          min={1}
          max={10}
        />
      </FormSection>

      <FormSection aria-labelledby="health-section">
        <h2 id="health-section">Health Information</h2>
        <Input
          id="current-insurance"
          name="current_insurance"
          type="text"
          value={formData.current_insurance}
          onChange={(e) => handleFieldChange('current_insurance', e.target.value)}
          label="Current Insurance Provider (if any)"
          error={fieldError('current_insurance')}
        />

        <Select
          options={DEDUCTIBLE_OPTIONS}
          value={formData.preferred_deductible}
          onChange={(value) => handleFieldChange('preferred_deductible', value)}
          label="Preferred Deductible Range"
          error={fieldError('preferred_deductible')}
          required
          fullWidth
          testId="deductible-select"
        />

        <Select
          options={NETWORK_TYPES}
          value={formData.preferred_network}
          onChange={(value) => handleFieldChange('preferred_network', value)}
          label="Preferred Network Type"
          error={fieldError('preferred_network')}
          required
          fullWidth
          testId="network-select"
        />
      </FormSection>

      <FormSection aria-labelledby="medical-section">
        <h2 id="medical-section">Medical History</h2>
        <Input
          id="preexisting-conditions"
          name="preexisting_conditions"
          type="text"
          value={formData.preexisting_conditions}
          onChange={(e) => handleFieldChange('preexisting_conditions', e.target.value)}
          label="Pre-existing Conditions"
          error={fieldError('preexisting_conditions')}
          placeholder="List any pre-existing conditions"
          aria-describedby="conditions-note"
        />
        <small id="conditions-note">
          This information is protected under HIPAA privacy rules
        </small>

        <Input
          id="medications"
          name="prescription_coverage"
          type="checkbox"
          checked={formData.prescription_coverage}
          onChange={(e) => handleFieldChange('prescription_coverage', e.target.checked)}
          label="I need prescription drug coverage"
          error={fieldError('prescription_coverage')}
        />
      </FormSection>

      <FormSection aria-labelledby="budget-section">
        <h2 id="budget-section">Budget Information</h2>
        <Input
          id="monthly-budget"
          name="monthly_budget"
          type="text"
          value={formData.monthly_budget}
          onChange={(e) => handleFieldChange('monthly_budget', e.target.value)}
          label="Monthly Budget for Health Insurance"
          error={fieldError('monthly_budget')}
          placeholder="Enter your monthly budget"
          required
        />
      </FormSection>

      <FormActions>
        <BackButton type="button" onClick={() => window.history.back()}>
          Back
        </BackButton>
        <SubmitButton 
          type="submit" 
          disabled={isSubmitting || isValidating}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Continue'}
        </SubmitButton>
      </FormActions>
    </FormContainer>
  );
};

export default HealthForm;