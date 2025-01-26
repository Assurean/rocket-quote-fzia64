import React from 'react'; // ^18.2.0
import styled from '@emotion/styled'; // ^11.11.0
import { ui } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Interface for component props with full typing support
interface CardProps {
  children: React.ReactNode;
  elevation?: 0 | 1 | 2 | 3 | 4;
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  ariaLabel?: string;
}

// Shadow values for different elevation levels
const ELEVATION_SHADOWS = [
  'none',
  '0 2px 4px rgba(0, 0, 0, 0.1)',
  '0 4px 8px rgba(0, 0, 0, 0.12)',
  '0 8px 16px rgba(0, 0, 0, 0.14)',
  '0 16px 24px rgba(0, 0, 0, 0.16)'
];

// Helper function to get elevation shadow
const getElevation = (elevation: number = 0): string => {
  const validElevation = Math.max(0, Math.min(elevation, 4));
  return ELEVATION_SHADOWS[validElevation];
};

// Helper function to get padding based on theme spacing
const getPadding = (paddingSize: string = 'md'): string => {
  return spacing.padding[paddingSize as keyof typeof spacing.padding];
};

// Helper function for mobile-responsive padding
const getMobilePadding = (paddingSize: string = 'md'): string => {
  const currentPadding = parseInt(spacing.padding[paddingSize as keyof typeof spacing.padding]);
  return `${Math.max(8, currentPadding * 0.75)}px`;
};

// Styled component for the card with configurable styles
const StyledCard = styled.div<{
  elevation: number;
  padding: string;
  interactive: boolean;
}>`
  background-color: ${ui.surface};
  border-radius: 4px;
  box-shadow: ${props => getElevation(props.elevation)};
  transition: all 0.3s ease;
  padding: ${props => getPadding(props.padding)};
  border: 1px solid ${ui.border};
  position: relative;
  cursor: ${props => props.interactive ? 'pointer' : 'default'};
  outline: none;

  /* Interactive states */
  ${props => props.interactive && `
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${getElevation(props.elevation + 1)};
    }
  `}

  /* Accessibility focus styles */
  &:focus-visible {
    outline: 2px solid ${ui.primary};
    outline-offset: 2px;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    padding: ${props => getMobilePadding(props.padding)};
  }
`;

/**
 * Card component that provides a material design inspired container
 * with configurable elevation, padding, and interactive states.
 */
const Card: React.FC<CardProps> = ({
  children,
  elevation = 1,
  padding = 'md',
  className,
  onClick,
  role = 'region',
  tabIndex,
  ariaLabel,
}) => {
  // Handle keyboard interactions for accessibility
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <StyledCard
      elevation={elevation}
      padding={padding}
      interactive={!!onClick}
      className={className}
      onClick={onClick}
      onKeyPress={handleKeyPress}
      role={role}
      tabIndex={onClick ? (tabIndex ?? 0) : tabIndex}
      aria-label={ariaLabel}
    >
      {children}
    </StyledCard>
  );
};

export default Card;