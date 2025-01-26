import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux'; // ^8.1.0
import styled from '@emotion/styled'; // ^11.11.0
import { analytics } from '@segment/analytics-next'; // ^1.51.0

import Container from '@shared/components/layout/Container';
import Card from '@shared/components/layout/Card';
import { formActions } from '../store/slices/formSlice';
import { InsuranceVertical } from '../../../backend/services/lead-service/src/interfaces/lead.interface';
import { verticals } from '@shared/theme/colors';

// Interfaces
interface InsuranceType {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  vertical: InsuranceVertical;
  ariaLabel: string;
  description: string;
}

// Styled Components
const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${props => props.theme.spacing.md};
  padding: ${props => props.theme.spacing.md};
  
  @media (min-width: ${props => props.theme.breakpoints.tablet}) {
    grid-template-columns: 1fr 1fr;
  }
  
  @media (min-width: ${props => props.theme.breakpoints.desktop}) {
    grid-template-columns: 1fr 1fr 1fr;
  }
  
  role: list;
  aria-label: Insurance types;
`;

const InsuranceCard = styled(Card)<{ color: string }>`
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  text-align: center;
  padding: ${props => props.theme.spacing.lg};
  background-color: ${props => `${props.color}10`};
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: ${props => props.theme.shadows.md};
  }
  
  &:focus-visible {
    outline: 2px solid ${props => props.color};
    outline-offset: 2px;
  }
  
  role: listitem;
  tabIndex: 0;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: ${props => props.theme.spacing.xl};
  color: ${props => props.theme.colors.ui.text.primary};
`;

const Description = styled.p`
  margin-top: ${props => props.theme.spacing.sm};
  color: ${props => props.theme.colors.ui.text.secondary};
`;

const IconWrapper = styled.div`
  margin-bottom: ${props => props.theme.spacing.md};
  svg {
    width: 48px;
    height: 48px;
  }
`;

// Constants
const INSURANCE_TYPES: InsuranceType[] = [
  {
    id: 'auto',
    title: 'Auto Insurance',
    icon: <AutoIcon />,
    color: verticals.auto.primary,
    vertical: InsuranceVertical.AUTO,
    ariaLabel: 'Select Auto Insurance',
    description: 'Coverage for your vehicles'
  },
  {
    id: 'home',
    title: 'Home Insurance',
    icon: <HomeIcon />,
    color: verticals.home.primary,
    vertical: InsuranceVertical.HOME,
    ariaLabel: 'Select Home Insurance',
    description: 'Protection for your property'
  },
  {
    id: 'health',
    title: 'Health Insurance',
    icon: <HealthIcon />,
    color: verticals.health.primary,
    vertical: InsuranceVertical.HEALTH,
    ariaLabel: 'Select Health Insurance',
    description: 'Medical coverage for you and your family'
  },
  {
    id: 'life',
    title: 'Life Insurance',
    icon: <LifeIcon />,
    color: verticals.life.primary,
    vertical: InsuranceVertical.LIFE,
    ariaLabel: 'Select Life Insurance',
    description: 'Financial protection for your loved ones'
  },
  {
    id: 'renters',
    title: 'Renters Insurance',
    icon: <RentersIcon />,
    color: verticals.renters.primary,
    vertical: InsuranceVertical.RENTERS,
    ariaLabel: 'Select Renters Insurance',
    description: 'Coverage for your rental property'
  },
  {
    id: 'commercial',
    title: 'Commercial Insurance',
    icon: <CommercialIcon />,
    color: verticals.commercial.primary,
    vertical: InsuranceVertical.COMMERCIAL,
    ariaLabel: 'Select Commercial Insurance',
    description: 'Protection for your business'
  }
];

const LandingPage: React.FC = () => {
  const dispatch = useDispatch();

  const handleInsuranceSelect = useCallback((vertical: InsuranceVertical) => {
    // Track analytics event
    analytics.track('Insurance Vertical Selected', {
      vertical,
      timestamp: new Date().toISOString(),
      page: 'landing'
    });

    // Update form state
    dispatch(formActions.setCurrentVertical(vertical));
    dispatch(formActions.setCurrentStep('basic-info'));

    // Announce selection to screen readers
    const announcement = `Selected ${vertical.toLowerCase()} insurance. Proceeding to basic information.`;
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  }, [dispatch]);

  return (
    <Container maxWidth="1200px" role="main">
      <Title>Choose Your Insurance Type</Title>
      
      <Grid>
        {INSURANCE_TYPES.map((insurance) => (
          <InsuranceCard
            key={insurance.id}
            color={insurance.color}
            onClick={() => handleInsuranceSelect(insurance.vertical)}
            elevation={1}
            role="button"
            aria-label={insurance.ariaLabel}
          >
            <IconWrapper>
              {insurance.icon}
            </IconWrapper>
            <h2>{insurance.title}</h2>
            <Description>{insurance.description}</Description>
          </InsuranceCard>
        ))}
      </Grid>
    </Container>
  );
};

export default LandingPage;