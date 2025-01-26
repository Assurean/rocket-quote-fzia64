import React, { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux'; // ^8.1.0
import { useNavigate } from 'react-router-dom'; // ^6.14.0
import styled from '@emotion/styled'; // ^11.11.0
import Card from '../../../../packages/shared/src/components/layout/Card';
import InsuranceStepper from '../../../../packages/shared/src/components/navigation/Stepper';
import { formActions } from '../../store/slices/formSlice';
import { analytics } from '../../utils/analytics';
import { colors } from '../../../../packages/shared/src/theme/colors';
import { breakpoints } from '../../../../packages/shared/src/theme/breakpoints';

// Types
type InsuranceVertical = 'AUTO' | 'HOME' | 'HEALTH' | 'LIFE' | 'RENTERS' | 'COMMERCIAL';

interface InsuranceOption {
  vertical: InsuranceVertical;
  label: string;
  description: string;
  ariaLabel: string;
  crossSellPriority: number;
  color: string;
}

// Constants
const INSURANCE_OPTIONS: InsuranceOption[] = [
  {
    vertical: 'AUTO',
    label: 'Auto Insurance',
    description: 'Coverage for your vehicles',
    ariaLabel: 'Select Auto Insurance',
    crossSellPriority: 1,
    color: colors.verticals.auto.primary
  },
  {
    vertical: 'HOME',
    label: 'Home Insurance',
    description: 'Protect your home and property',
    ariaLabel: 'Select Home Insurance',
    crossSellPriority: 2,
    color: colors.verticals.home.primary
  },
  {
    vertical: 'HEALTH',
    label: 'Health Insurance',
    description: 'Medical coverage for you and your family',
    ariaLabel: 'Select Health Insurance',
    crossSellPriority: 3,
    color: colors.verticals.health.primary
  },
  {
    vertical: 'LIFE',
    label: 'Life Insurance',
    description: 'Financial protection for your loved ones',
    ariaLabel: 'Select Life Insurance',
    crossSellPriority: 4,
    color: colors.verticals.life.primary
  },
  {
    vertical: 'RENTERS',
    label: 'Renters Insurance',
    description: 'Coverage for your rental property',
    ariaLabel: 'Select Renters Insurance',
    crossSellPriority: 5,
    color: colors.verticals.renters.primary
  },
  {
    vertical: 'COMMERCIAL',
    label: 'Commercial Insurance',
    description: 'Business coverage solutions',
    ariaLabel: 'Select Commercial Insurance',
    crossSellPriority: 6,
    color: colors.verticals.commercial.primary
  }
];

// Styled Components
const VerticalGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: ${breakpoints.mobile}px) {
    grid-template-columns: 1fr;
    padding: 16px;
  }

  @media (min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.desktop - 1}px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const VerticalCard = styled(Card)<{ color: string }>`
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: ${props => props.color};
  }

  &:focus-visible {
    outline: 3px solid ${props => props.color};
    outline-offset: 2px;
  }
`;

const CardTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: ${colors.ui.text.primary};
`;

const CardDescription = styled.p`
  font-size: 1rem;
  color: ${colors.ui.text.secondary};
  margin: 0;
`;

const StepperContainer = styled.div`
  margin-bottom: 24px;
  padding: 0 24px;

  @media (max-width: ${breakpoints.mobile}px) {
    padding: 0 16px;
  }
`;

// Component
const VerticalSelection: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Initialize analytics tracking
  useEffect(() => {
    analytics.trackPageView('/vertical-selection', 'Insurance Vertical Selection', {
      sessionId: crypto.randomUUID(),
      startTime: new Date(),
      deviceInfo: {
        type: 'web',
        os: navigator.platform,
        browser: navigator.userAgent
      },
      trafficSource: document.referrer
    });
  }, []);

  const handleVerticalSelect = useCallback(async (vertical: InsuranceVertical) => {
    try {
      // Track vertical selection
      await analytics.trackFormStep('vertical-selection', {
        stepName: 'vertical-selection',
        duration: 0,
        isComplete: true,
        vertical,
        formData: { selectedVertical: vertical }
      });

      // Update form state
      dispatch(formActions.setVertical(vertical));
      dispatch(formActions.setStep('basic-info'));

      // Identify cross-sell opportunities
      const crossSellOpportunities = INSURANCE_OPTIONS
        .filter(option => option.vertical !== vertical)
        .sort((a, b) => a.crossSellPriority - b.crossSellPriority)
        .slice(0, 2)
        .map(option => ({
          vertical: option.vertical,
          score: 1 - option.crossSellPriority / INSURANCE_OPTIONS.length,
          reason: `Common bundle with ${vertical}`
        }));

      dispatch(formActions.updateCrossSellOpportunities(crossSellOpportunities));

      // Navigate to next step
      navigate('/basic-info');
    } catch (error) {
      console.error('Error handling vertical selection:', error);
    }
  }, [dispatch, navigate]);

  return (
    <>
      <StepperContainer>
        <InsuranceStepper
          steps={[
            { label: 'Select Insurance', completed: false, current: true },
            { label: 'Basic Info', completed: false, current: false },
            { label: 'Coverage Details', completed: false, current: false },
            { label: 'Review', completed: false, current: false }
          ]}
          activeStep={0}
          persistState={true}
        />
      </StepperContainer>

      <VerticalGrid role="list" aria-label="Insurance types">
        {INSURANCE_OPTIONS.map((option) => (
          <VerticalCard
            key={option.vertical}
            color={option.color}
            onClick={() => handleVerticalSelect(option.vertical)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleVerticalSelect(option.vertical);
              }
            }}
            role="listitem"
            tabIndex={0}
            aria-label={option.ariaLabel}
            elevation={1}
          >
            <CardTitle>{option.label}</CardTitle>
            <CardDescription>{option.description}</CardDescription>
          </VerticalCard>
        ))}
      </VerticalGrid>
    </>
  );
};

export default VerticalSelection;