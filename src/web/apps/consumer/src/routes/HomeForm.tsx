import React, { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import Input from '@shared/components/forms/Input';
import Select from '@shared/components/forms/Select';
import { validateField } from '../utils/validators';
import { actions as formActions } from '../store/slices/formSlice';
import { colors } from '@shared/theme/colors';
import { spacing } from '@shared/theme/spacing';
import { typography } from '@shared/theme/typography';
import { InsuranceVertical } from '../../../backend/services/lead-service/src/interfaces/lead.interface';

// Constants
const PROPERTY_TYPES = ["Single Family", "Condo", "Townhouse", "Mobile Home"];
const CONSTRUCTION_TYPES = ["Frame", "Masonry", "Brick", "Stone"];
const ROOF_TYPES = ["Asphalt Shingle", "Metal", "Tile", "Slate"];
const MIN_YEAR_BUILT = 1900;
const MAX_SQUARE_FOOTAGE = 15000;
const VALIDATION_DEBOUNCE_MS = 300;

// Styled components
const FormContainer = styled.form`
  max-width: 600px;
  margin: 0 auto;
  padding: ${spacing.padding.lg};
`;

const FormSection = styled.div`
  margin-bottom: ${spacing.margin.lg};
`;

const SectionTitle = styled.h2`
  font-size: ${typography.fontSize['2xl']};
  color: ${colors.verticals.home.primary};
  margin-bottom: ${spacing.margin.md};
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${spacing.padding.md};
  margin-bottom: ${spacing.margin.md};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${spacing.margin.xl};
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${spacing.padding.md} ${spacing.padding.lg};
  background-color: ${props => 
    props.variant === 'primary' ? colors.verticals.home.primary : 'transparent'
  };
  color: ${props => 
    props.variant === 'primary' ? colors.verticals.home.contrast : colors.verticals.home.primary
  };
  border: 2px solid ${colors.verticals.home.primary};
  border-radius: 4px;
  font-weight: ${typography.fontWeight.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => 
      props.variant === 'primary' ? colors.verticals.home.dark : colors.verticals.home.light
    };
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${colors.verticals.home.light}40;
  }
`;

// Interface for form data
interface HomeFormData {
  propertyType: string;
  yearBuilt: string;
  squareFootage: string;
  constructionType: string;
  roofType: string;
  estimatedValue: string;
  securitySystem: string;
}

const HomeForm: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const formData = useSelector((state: any) => state.form.formData);
  const validationState = useSelector((state: any) => state.form.validationState);

  // Initialize form data with defaults
  useEffect(() => {
    if (!formData.vertical) {
      dispatch(formActions.setVertical(InsuranceVertical.HOME));
    }
  }, [dispatch, formData.vertical]);

  // Handle input changes with validation
  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Update form data
    dispatch(formActions.updateFormData({ 
      field: name, 
      value,
      securityLevel: name === 'estimatedValue' ? 'sensitive' : 'normal'
    }));

    // Validate field
    const validationResult = await validateField(name, value, {
      validatePII: false,
      securityLevel: 'medium'
    });

    dispatch(formActions.setValidationState({ 
      field: name, 
      status: validationResult 
    }));

    // Check for cross-sell opportunities
    if (name === 'estimatedValue' && parseInt(value) > 500000) {
      dispatch(formActions.updateCrossSellOpportunities([{
        vertical: InsuranceVertical.LIFE,
        score: 0.8,
        reason: 'High-value property owner'
      }]));
    }
  }, [dispatch]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const isValid = Object.values(validationState).every(state => state.isValid);

    if (isValid) {
      await dispatch(formActions.submitForm());
      navigate('/cross-sell');
    }
  }, [dispatch, navigate, validationState]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/basic-info');
  }, [navigate]);

  return (
    <FormContainer onSubmit={handleSubmit} noValidate>
      <SectionTitle>Property Information</SectionTitle>

      <FormSection>
        <FormRow>
          <Select
            id="propertyType"
            name="propertyType"
            label="Property Type"
            value={formData.propertyType || ''}
            onChange={value => handleInputChange({ 
              target: { name: 'propertyType', value }
            } as React.ChangeEvent<HTMLInputElement>)}
            options={PROPERTY_TYPES.map(type => ({ value: type, label: type }))}
            error={validationState.propertyType?.errors?.[0]?.message}
            required
            testId="home-property-type"
          />

          <Input
            id="yearBuilt"
            name="yearBuilt"
            type="number"
            label="Year Built"
            value={formData.yearBuilt || ''}
            onChange={handleInputChange}
            error={validationState.yearBuilt?.errors?.[0]?.message}
            min={MIN_YEAR_BUILT}
            max={new Date().getFullYear()}
            required
          />
        </FormRow>

        <FormRow>
          <Input
            id="squareFootage"
            name="squareFootage"
            type="number"
            label="Square Footage"
            value={formData.squareFootage || ''}
            onChange={handleInputChange}
            error={validationState.squareFootage?.errors?.[0]?.message}
            min={100}
            max={MAX_SQUARE_FOOTAGE}
            required
          />

          <Select
            id="constructionType"
            name="constructionType"
            label="Construction Type"
            value={formData.constructionType || ''}
            onChange={value => handleInputChange({ 
              target: { name: 'constructionType', value }
            } as React.ChangeEvent<HTMLInputElement>)}
            options={CONSTRUCTION_TYPES.map(type => ({ value: type, label: type }))}
            error={validationState.constructionType?.errors?.[0]?.message}
            required
            testId="home-construction-type"
          />
        </FormRow>

        <FormRow>
          <Select
            id="roofType"
            name="roofType"
            label="Roof Type"
            value={formData.roofType || ''}
            onChange={value => handleInputChange({ 
              target: { name: 'roofType', value }
            } as React.ChangeEvent<HTMLInputElement>)}
            options={ROOF_TYPES.map(type => ({ value: type, label: type }))}
            error={validationState.roofType?.errors?.[0]?.message}
            required
            testId="home-roof-type"
          />

          <Input
            id="estimatedValue"
            name="estimatedValue"
            type="number"
            label="Estimated Property Value"
            value={formData.estimatedValue || ''}
            onChange={handleInputChange}
            error={validationState.estimatedValue?.errors?.[0]?.message}
            min={0}
            required
          />
        </FormRow>

        <FormRow>
          <Select
            id="securitySystem"
            name="securitySystem"
            label="Security System Installed?"
            value={formData.securitySystem || ''}
            onChange={value => handleInputChange({ 
              target: { name: 'securitySystem', value }
            } as React.ChangeEvent<HTMLInputElement>)}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' }
            ]}
            error={validationState.securitySystem?.errors?.[0]?.message}
            required
            testId="home-security-system"
          />
        </FormRow>
      </FormSection>

      <ButtonContainer>
        <Button type="button" onClick={handleBack}>
          Back
        </Button>
        <Button type="submit" variant="primary">
          Continue
        </Button>
      </ButtonContainer>
    </FormContainer>
  );
};

export default HomeForm;