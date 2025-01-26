import React, { useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { useDebounce } from 'use-debounce'; // v9.0.0
import useAnalytics from '@analytics/react'; // v1.0.0

import Input from '@shared/components/forms/Input';
import Select from '@shared/components/forms/Select';
import { useForm } from '../hooks/useForm';
import { useValidation } from '../hooks/useValidation';
import { InsuranceVertical } from '../../backend/services/lead-service/src/interfaces/lead.interface';

// Styled Components
const FormContainer = styled.div`
  padding: 24px;
  max-width: 600px;
  margin: 0 auto;
  background-color: ${props => props.theme.colors.background.primary};
  border-radius: ${props => props.theme.borderRadius.medium};
  box-shadow: ${props => props.theme.shadows.card};
`;

const FormSection = styled.div`
  margin-bottom: 32px;
  padding: 16px;
  border: 1px solid ${props => props.theme.colors.border.light};
  border-radius: ${props => props.theme.borderRadius.small};
`;

const SectionTitle = styled.h2`
  font-size: ${props => props.theme.typography.size.large};
  margin-bottom: 16px;
  color: ${props => props.theme.colors.text.primary};
  font-weight: ${props => props.theme.typography.weight.medium};
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.feedback.error.main};
  font-size: ${props => props.theme.typography.size.small};
  margin-top: 4px;
`;

// Constants
const COVERAGE_OPTIONS = [
  { value: '100000', label: '$100,000' },
  { value: '250000', label: '$250,000' },
  { value: '500000', label: '$500,000' },
  { value: '1000000', label: '$1,000,000' }
];

const INCOME_RANGES = [
  { value: '0-25000', label: '$0 - $25,000' },
  { value: '25001-50000', label: '$25,001 - $50,000' },
  { value: '50001-100000', label: '$50,001 - $100,000' },
  { value: '100001+', label: '$100,001+' }
];

const HEALTH_CONDITIONS = [
  { value: 'none', label: 'None' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'heart_disease', label: 'Heart Disease' },
  { value: 'cancer', label: 'Cancer' },
  { value: 'other', label: 'Other' }
];

// Component
const LifeForm: React.FC = () => {
  const analytics = useAnalytics();
  
  const {
    formData,
    updateField,
    validationState,
    isSubmitting,
    performanceMetrics
  } = useForm(InsuranceVertical.LIFE);

  const {
    validateField,
    validateSection,
    fieldError,
    isPIIField
  } = useValidation({
    vertical: 'LIFE',
    validateOnBlur: true,
    validateOnChange: true,
    validationPriority: 'high'
  });

  // Debounced field updates for performance
  const [debouncedUpdate] = useDebounce(
    (fieldName: string, value: any) => {
      updateField(fieldName, value);
    },
    300
  );

  // Field change handler with validation and analytics
  const handleFieldChange = useCallback(async (
    fieldName: string,
    value: any
  ) => {
    try {
      // Track field interaction
      analytics.track('form_field_interaction', {
        fieldName,
        formType: 'life_insurance',
        timestamp: new Date().toISOString()
      });

      // Handle PII fields with enhanced security
      if (isPIIField(fieldName)) {
        await validateField(fieldName, value);
      }

      // Update form state
      debouncedUpdate(fieldName, value);

    } catch (error) {
      console.error('Field update error:', error);
    }
  }, [debouncedUpdate, validateField, isPIIField, analytics]);

  // Section validation on mount
  useEffect(() => {
    const validateFormSection = async () => {
      await validateSection('life_insurance', formData);
    };
    validateFormSection();
  }, [validateSection, formData]);

  // Performance monitoring
  useEffect(() => {
    analytics.track('form_performance', {
      formType: 'life_insurance',
      metrics: performanceMetrics,
      timestamp: new Date().toISOString()
    });
  }, [performanceMetrics, analytics]);

  return (
    <FormContainer>
      <FormSection>
        <SectionTitle>Coverage Information</SectionTitle>
        <Select
          options={COVERAGE_OPTIONS}
          value={formData.coverageAmount}
          onChange={(value) => handleFieldChange('coverageAmount', value)}
          label="Coverage Amount"
          error={fieldError('coverageAmount')}
          required
          testId="life-coverage-amount"
        />
      </FormSection>

      <FormSection>
        <SectionTitle>Personal Information</SectionTitle>
        <Input
          id="birthDate"
          name="birthDate"
          type="date"
          value={formData.birthDate || ''}
          onChange={(e) => handleFieldChange('birthDate', e.target.value)}
          label="Date of Birth"
          error={fieldError('birthDate')}
          required
          aria-label="Date of Birth"
        />

        <Input
          id="ssn"
          name="ssn"
          type="password"
          value={formData.ssn || ''}
          onChange={(e) => handleFieldChange('ssn', e.target.value)}
          label="Social Security Number"
          error={fieldError('ssn')}
          required
          autoComplete="off"
          aria-label="Social Security Number"
        />

        <Select
          options={[
            { value: 'M', label: 'Male' },
            { value: 'F', label: 'Female' }
          ]}
          value={formData.gender}
          onChange={(value) => handleFieldChange('gender', value)}
          label="Gender"
          error={fieldError('gender')}
          required
          testId="life-gender"
        />
      </FormSection>

      <FormSection>
        <SectionTitle>Health Information</SectionTitle>
        <Select
          options={[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' }
          ]}
          value={formData.tobaccoUse}
          onChange={(value) => handleFieldChange('tobaccoUse', value)}
          label="Tobacco Use in Last 12 Months"
          error={fieldError('tobaccoUse')}
          required
          testId="life-tobacco-use"
        />

        <Select
          options={HEALTH_CONDITIONS}
          value={formData.healthConditions}
          onChange={(value) => handleFieldChange('healthConditions', value)}
          label="Pre-existing Conditions"
          error={fieldError('healthConditions')}
          required
          multiple
          testId="life-health-conditions"
        />
      </FormSection>

      <FormSection>
        <SectionTitle>Financial Information</SectionTitle>
        <Input
          id="occupation"
          name="occupation"
          type="text"
          value={formData.occupation || ''}
          onChange={(e) => handleFieldChange('occupation', e.target.value)}
          label="Occupation"
          error={fieldError('occupation')}
          required
          aria-label="Occupation"
        />

        <Select
          options={INCOME_RANGES}
          value={formData.annualIncome}
          onChange={(value) => handleFieldChange('annualIncome', value)}
          label="Annual Income"
          error={fieldError('annualIncome')}
          required
          testId="life-annual-income"
        />
      </FormSection>

      {validationState.hasErrors && (
        <ErrorMessage role="alert">
          Please correct the errors above before continuing.
        </ErrorMessage>
      )}
    </FormContainer>
  );
};

export default LifeForm;