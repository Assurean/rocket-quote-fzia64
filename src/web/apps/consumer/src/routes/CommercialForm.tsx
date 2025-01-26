import React, { useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { debounce } from 'lodash'; // v4.17.21
import { SecurityProvider } from '@auth0/security-provider'; // v1.0.0

// Internal imports
import { useForm } from '../../hooks/useForm';
import { useValidation } from '../../hooks/useValidation';
import Input from '@shared/components/forms/Input';

// Constants
const BUSINESS_TYPES = ['LLC', 'Corporation', 'Sole Proprietorship', 'Partnership', 'Non-Profit', 'S-Corporation'];
const COVERAGE_TYPES = [
  'General Liability',
  'Professional Liability',
  'Workers Compensation',
  'Business Property',
  'Cyber Liability',
  'EPLI',
  'D&O'
];

const VALIDATION_RULES = {
  businessName: '^[a-zA-Z0-9\\s]{2,100}$',
  employeeCount: '^[0-9]{1,5}$',
  annualRevenue: '^[0-9]{1,10}$'
};

// Styled Components
const FormContainer = styled.div`
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  background: var(--form-bg);

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const FormSection = styled.div`
  margin-bottom: 32px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 24px;
  background: #fff;
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  margin-bottom: 16px;
  color: var(--text-primary);
  font-weight: 500;
`;

const CoverageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

const CoverageOption = styled.div<{ selected: boolean }>`
  padding: 12px;
  border: 1px solid ${props => props.selected ? '#1976D2' : '#E0E0E0'};
  border-radius: 4px;
  cursor: pointer;
  background: ${props => props.selected ? '#E3F2FD' : '#fff'};
  transition: all 0.2s ease;

  &:hover {
    border-color: #1976D2;
  }
`;

// Interface for form data
interface CommercialFormData {
  businessName: string;
  businessType: string;
  employeeCount: number;
  annualRevenue: number;
  industryCode: string;
  yearsInBusiness: number;
  coverageTypes: string[];
  businessOwnerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  locationCount: number;
  riskFactors: string[];
}

// Main Component
const CommercialForm: React.FC = () => {
  const {
    formData,
    updateField,
    submitForm,
    validationState
  } = useForm('COMMERCIAL');

  const {
    validateField,
    validateSection,
    fieldError,
    isValidating
  } = useValidation({
    vertical: 'COMMERCIAL',
    validateOnBlur: true,
    validateOnChange: true,
    validationPriority: 'high'
  });

  // Debounced validation handler
  const debouncedValidation = useCallback(
    debounce(async (fieldName: string, value: any) => {
      await validateField(fieldName, value);
    }, 300),
    [validateField]
  );

  // Field change handler with security measures
  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    try {
      // Update form state
      await updateField(fieldName, value);

      // Trigger validation
      await debouncedValidation(fieldName, value);
    } catch (error) {
      console.error('Field update failed:', error);
    }
  }, [updateField, debouncedValidation]);

  // Coverage type toggle handler
  const handleCoverageToggle = useCallback((coverageType: string) => {
    const currentCoverages = formData.coverageTypes || [];
    const updatedCoverages = currentCoverages.includes(coverageType)
      ? currentCoverages.filter(type => type !== coverageType)
      : [...currentCoverages, coverageType];

    handleFieldChange('coverageTypes', updatedCoverages);
  }, [formData.coverageTypes, handleFieldChange]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = await validateSection('commercial', formData);
    if (isValid) {
      await submitForm();
    }
  };

  return (
    <SecurityProvider
      encryptionLevel="high"
      validateCerts={true}
      fieldLevelEncryption={true}
    >
      <FormContainer>
        <form onSubmit={handleSubmit}>
          <FormSection>
            <SectionTitle>Business Information</SectionTitle>
            <Input
              id="businessName"
              name="businessName"
              label="Business Name"
              value={formData.businessName || ''}
              onChange={e => handleFieldChange('businessName', e.target.value)}
              error={fieldError('businessName')}
              required
              autoComplete="organization"
            />

            <Input
              id="businessType"
              name="businessType"
              label="Business Type"
              type="text"
              value={formData.businessType || ''}
              onChange={e => handleFieldChange('businessType', e.target.value)}
              error={fieldError('businessType')}
              required
            />

            <Input
              id="employeeCount"
              name="employeeCount"
              label="Number of Employees"
              type="number"
              value={formData.employeeCount || ''}
              onChange={e => handleFieldChange('employeeCount', parseInt(e.target.value))}
              error={fieldError('employeeCount')}
              required
            />

            <Input
              id="annualRevenue"
              name="annualRevenue"
              label="Annual Revenue"
              type="number"
              value={formData.annualRevenue || ''}
              onChange={e => handleFieldChange('annualRevenue', parseInt(e.target.value))}
              error={fieldError('annualRevenue')}
              required
            />
          </FormSection>

          <FormSection>
            <SectionTitle>Coverage Selection</SectionTitle>
            <CoverageGrid>
              {COVERAGE_TYPES.map(coverage => (
                <CoverageOption
                  key={coverage}
                  selected={formData.coverageTypes?.includes(coverage) || false}
                  onClick={() => handleCoverageToggle(coverage)}
                  role="checkbox"
                  aria-checked={formData.coverageTypes?.includes(coverage) || false}
                >
                  {coverage}
                </CoverageOption>
              ))}
            </CoverageGrid>
          </FormSection>

          <FormSection>
            <SectionTitle>Business Owner Information</SectionTitle>
            <Input
              id="ownerName"
              name="ownerName"
              label="Owner Name"
              value={formData.businessOwnerInfo?.name || ''}
              onChange={e => handleFieldChange('businessOwnerInfo.name', e.target.value)}
              error={fieldError('businessOwnerInfo.name')}
              required
              autoComplete="name"
            />

            <Input
              id="ownerEmail"
              name="ownerEmail"
              type="email"
              label="Owner Email"
              value={formData.businessOwnerInfo?.email || ''}
              onChange={e => handleFieldChange('businessOwnerInfo.email', e.target.value)}
              error={fieldError('businessOwnerInfo.email')}
              required
              autoComplete="email"
            />

            <Input
              id="ownerPhone"
              name="ownerPhone"
              type="tel"
              label="Owner Phone"
              value={formData.businessOwnerInfo?.phone || ''}
              onChange={e => handleFieldChange('businessOwnerInfo.phone', e.target.value)}
              error={fieldError('businessOwnerInfo.phone')}
              required
              autoComplete="tel"
            />
          </FormSection>

          <button
            type="submit"
            disabled={isValidating || Object.keys(validationState).some(key => !validationState[key]?.isValid)}
          >
            {isValidating ? 'Validating...' : 'Continue'}
          </button>
        </form>
      </FormContainer>
    </SecurityProvider>
  );
};

export default CommercialForm;