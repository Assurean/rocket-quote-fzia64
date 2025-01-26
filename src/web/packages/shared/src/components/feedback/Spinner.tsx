/**
 * @fileoverview Accessible loading spinner component for asynchronous operations
 * Implements WCAG 2.1 AA standards with theme integration
 * @version 1.0.0
 */

import React from 'react';
import { styled } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import { feedback, ui } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

/**
 * Size mappings in pixels following design system specifications
 */
const SPINNER_SIZES = {
  small: 24,
  medium: 40,
  large: 56
} as const;

/**
 * Props interface for the Spinner component
 */
interface SpinnerProps {
  /** Controls spinner diameter: small (24px), medium (40px), large (56px) */
  size?: keyof typeof SPINNER_SIZES;
  /** Color variant matching the platform's feedback system */
  color?: 'primary' | 'secondary' | 'info' | 'success' | 'error' | 'warning';
  /** Optional CSS class for custom styling */
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}

/**
 * Maps size prop to pixel values with validation
 */
const getSpinnerSize = (size: SpinnerProps['size']): number => {
  if (!size) return SPINNER_SIZES.medium;
  return SPINNER_SIZES[size] || SPINNER_SIZES.medium;
};

/**
 * Styled wrapper for CircularProgress with theme integration
 */
const StyledSpinner = styled(CircularProgress)(({ theme }) => ({
  margin: spacing.margin.xs,
  '@keyframes mui-spin': {
    '0%': {
      transform: 'rotate(0deg)',
    },
    '100%': {
      transform: 'rotate(360deg)',
    }
  },
  animation: 'mui-spin 1.4s linear infinite',
  // Optimize animation performance
  willChange: 'transform',
  // Support RTL layouts
  '[dir="rtl"] &': {
    animation: 'mui-spin 1.4s linear infinite reverse',
  },
  // Color mappings from theme
  '&.MuiCircularProgress-colorPrimary': {
    color: ui.primary,
  },
  '&.MuiCircularProgress-colorSecondary': {
    color: ui.secondary,
  },
  '&.MuiCircularProgress-colorInfo': {
    color: feedback.info.main,
  },
  '&.MuiCircularProgress-colorSuccess': {
    color: feedback.success.main,
  },
  '&.MuiCircularProgress-colorError': {
    color: feedback.error.main,
  },
  '&.MuiCircularProgress-colorWarning': {
    color: feedback.warning.main,
  }
}));

/**
 * Spinner component providing visual feedback during loading states
 * Implements WCAG 2.1 AA accessibility standards
 */
const Spinner: React.FC<SpinnerProps> = React.memo(({
  size = 'medium',
  color = 'primary',
  className,
  label = 'Loading...'
}) => {
  const sizeInPixels = getSpinnerSize(size);

  return (
    <StyledSpinner
      size={sizeInPixels}
      color={color}
      className={className}
      // Accessibility attributes
      role="progressbar"
      aria-busy="true"
      aria-label={label}
      // Improve performance by disabling shrink animation
      disableShrink={false}
      // Thickness ratio based on size
      thickness={size === 'small' ? 4 : 3.6}
      data-testid="loading-spinner"
    />
  );
});

// Display name for debugging
Spinner.displayName = 'Spinner';

export default Spinner;