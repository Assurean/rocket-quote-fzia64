import React, { useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { useDebounce } from 'use-debounce'; // v9.0.0
import Input from '@shared/components/forms/Input';
import PhoneInput from '@shared/components/forms/PhoneInput';
import { useForm } from '../hooks/useForm';
import { theme } from '@shared/theme';

// Styled components with accessibility and responsive design
const FormContainer = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: ${theme.spacing.padding.md};
  background-color: ${theme.colors.ui.background};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  ${theme.mediaQueries.mobile} {
    padding: ${theme.spacing.padding.sm};
    margin: ${theme.spacing.margin.xs};
  }

  &[aria-busy="true"] {
    opacity: 0.7;
    pointer-events: none;
  }
`;

const FormHeader = styled.div`
  margin-bottom: ${theme.spacing.margin.lg};
  text-align: center;
`;

const FormTitle = styled.h1`
  font-size: ${theme.typography.h3.fontSize};
  color: ${theme.colors.ui.text.primary};
  margin-bottom: ${theme.spacing.margin.sm};
`;

const FormDescription = styled.p`
  color: ${theme.colors.ui.text.secondary};
  font-size: ${theme.typography.body2.fontSize};
  line-height: ${theme.typography.body2.lineHeight};
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${theme.spacing.margin.xl};
  gap: ${theme.spacing.padding.md};

  ${theme.mediaQueries.mobile} {
    flex-direction: column;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${theme.spacing.padding.sm} ${theme.spacing.padding.lg};
  border-radius: 4px;
  font-weight: ${theme.typography.button.fontWeight};
  font-size: ${theme.typography.button.fontSize};
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;

  ${props => props.variant === 'primary' ? `
    background-color: ${theme.colors.ui.primary};
    color: ${theme.colors.ui.background};
    border: none;

    &:hover:not(:disabled) {
      background-color: ${theme.colors.verticals.auto.dark};
    }
  ` : `
    background-color: transparent;
    color: ${theme.colors.ui.text.primary};
    border: 1px solid ${theme.colors.ui.border};

    &:hover:not(:disabled) {
      background-color: ${theme.colors.ui.surface};
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    ${theme.mixins.focusRing}
  }
`;

// Interface for form data with PII markers
interface BasicInfoFormData {
  fullName: string;
  email: string;
  phone: string;
  zipCode: string;
}

const BasicInfo: React.FC = () => {
  const {
    formData,
    updateField,
    goToStep,
    isSubmitting,
    validationState
  } = useForm('AUTO');

  // Debounced form data for performance optimization
  const [debouncedFormData] = useDebounce(formData, 300);

  // Auto-save effect when form data changes
  useEffect(() => {
    if (Object.keys(debouncedFormData).length > 0) {
      // Auto-save logic is handled by useForm hook
    }
  }, [debouncedFormData]);

  // Form field change handler with validation
  const handleInputChange = useCallback(async (fieldName: string, value: any) => {
    try {
      await updateField(fieldName, value, fieldName === 'email' || fieldName === 'phone' ? 'pii' : 'normal');
    } catch (error) {
      console.error('Field update failed:', error);
    }
  }, [updateField]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    goToStep('vertical-selection');
  }, [goToStep]);

  const handleNext = useCallback(async () => {
    goToStep('vertical-specific');
  }, [goToStep]);

  // Validation status checks
  const isFormValid = useCallback(() => {
    const requiredFields = ['fullName', 'email', 'phone', 'zipCode'];
    return requiredFields.every(field => 
      formData[field] && 
      (!validationState[field] || validationState[field].isValid)
    );
  }, [formData, validationState]);

  return (
    <FormContainer
      role="form"
      aria-label="Basic Information Form"
      aria-busy={isSubmitting}
    >
      <FormHeader>
        <FormTitle>Basic Information</FormTitle>
        <FormDescription>
          Please provide your contact details. Your information is encrypted and secure.
        </FormDescription>
      </FormHeader>

      <Input
        id="fullName"
        name="fullName"
        label="Full Name"
        value={formData.fullName || ''}
        onChange={(e) => handleInputChange('fullName', e.target.value)}
        error={validationState.fullName?.errors?.[0]?.message}
        required
        aria-required="true"
        autoComplete="name"
      />

      <Input
        id="email"
        name="email"
        type="email"
        label="Email Address"
        value={formData.email || ''}
        onChange={(e) => handleInputChange('email', e.target.value)}
        error={validationState.email?.errors?.[0]?.message}
        required
        aria-required="true"
        autoComplete="email"
      />

      <PhoneInput
        id="phone"
        name="phone"
        value={formData.phone || ''}
        onChange={(e) => handleInputChange('phone', e.target.value)}
        error={validationState.phone?.errors?.[0]?.message}
        tcpaRequired
      />

      <Input
        id="zipCode"
        name="zipCode"
        label="ZIP Code"
        value={formData.zipCode || ''}
        onChange={(e) => handleInputChange('zipCode', e.target.value)}
        error={validationState.zipCode?.errors?.[0]?.message}
        required
        aria-required="true"
        autoComplete="postal-code"
        maxLength={5}
      />

      <ButtonContainer>
        <Button
          type="button"
          onClick={handleBack}
          variant="secondary"
          aria-label="Go back to previous step"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          variant="primary"
          disabled={!isFormValid() || isSubmitting}
          aria-label="Continue to next step"
        >
          Continue
        </Button>
      </ButtonContainer>
    </FormContainer>
  );
};

export default BasicInfo;