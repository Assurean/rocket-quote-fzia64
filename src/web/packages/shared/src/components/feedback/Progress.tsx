import React from 'react';
import { styled } from '@mui/material/styles';
import LinearProgress from '@mui/material/LinearProgress';
import { feedback, ui } from '../../theme/colors';
import { margin } from '../../theme/spacing';

// Props interface for the Progress component
interface ProgressProps {
  variant: 'linear' | 'steps';
  value: number;
  maxValue?: number;
  status?: 'default' | 'success' | 'error';
  showLabel?: boolean;
  className?: string;
  height?: number;
  stepSize?: number;
  labelFormat?: (value: number) => string;
  direction?: 'ltr' | 'rtl';
}

// Helper function to determine progress color based on status
const getProgressColor = (status: 'default' | 'success' | 'error' = 'default'): string => {
  try {
    switch (status) {
      case 'success':
        return feedback.success.main;
      case 'error':
        return feedback.error.main;
      default:
        return ui.primary;
    }
  } catch (error) {
    console.error('Error determining progress color:', error);
    return ui.primary; // Fallback color
  }
};

// Styled components
const StyledLinearProgress = styled(LinearProgress, {
  shouldForwardProp: (prop) => prop !== 'height' && prop !== 'direction'
})<{ height?: number; direction?: 'ltr' | 'rtl' }>(({ theme, height = 4, direction = 'ltr' }) => ({
  height: height,
  borderRadius: height / 2,
  direction: direction,
  '& .MuiLinearProgress-bar': {
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.standard,
    }),
  },
}));

const StyledStepContainer = styled('div')<{ direction?: 'ltr' | 'rtl' }>(({ direction = 'ltr' }) => ({
  display: 'flex',
  flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
  alignItems: 'center',
  gap: margin.sm,
}));

const StyledStep = styled('div')<{ 
  completed: boolean; 
  active: boolean; 
  status?: 'default' | 'success' | 'error';
  size?: number;
}>(({ completed, active, status = 'default', size = 24 }) => ({
  width: size,
  height: size,
  borderRadius: '50%',
  backgroundColor: completed 
    ? getProgressColor(status)
    : active 
      ? ui.surface
      : ui.border,
  border: `2px solid ${completed || active ? getProgressColor(status) : ui.border}`,
  transition: 'all 0.3s ease',
}));

const StyledLabel = styled('span')(({ theme }) => ({
  color: ui.text.primary,
  marginLeft: margin.xs,
  fontSize: '0.875rem',
}));

// Main Progress component
export const Progress: React.FC<ProgressProps> = React.memo(({
  variant = 'linear',
  value,
  maxValue = 100,
  status = 'default',
  showLabel = false,
  className,
  height = 4,
  stepSize = 24,
  labelFormat,
  direction = 'ltr',
}) => {
  // Ensure value is within bounds
  const normalizedValue = Math.min(Math.max(0, value), maxValue);
  const percentage = (normalizedValue / maxValue) * 100;

  // Format label text
  const getLabelText = () => {
    if (labelFormat) {
      return labelFormat(normalizedValue);
    }
    return `${Math.round(percentage)}%`;
  };

  // Render linear progress variant
  const renderLinearProgress = () => (
    <div role="progressbar" aria-valuenow={normalizedValue} aria-valuemax={maxValue}>
      <StyledLinearProgress
        variant="determinate"
        value={percentage}
        height={height}
        direction={direction}
        className={className}
        sx={{
          '& .MuiLinearProgress-bar': {
            backgroundColor: getProgressColor(status),
          },
        }}
      />
      {showLabel && <StyledLabel>{getLabelText()}</StyledLabel>}
    </div>
  );

  // Render step progress variant
  const renderStepProgress = () => {
    const totalSteps = Math.ceil(maxValue);
    const currentStep = Math.ceil(normalizedValue);

    return (
      <StyledStepContainer 
        role="progressbar" 
        aria-valuenow={currentStep} 
        aria-valuemax={totalSteps}
        direction={direction}
        className={className}
      >
        {Array.from({ length: totalSteps }, (_, index) => (
          <StyledStep
            key={index}
            completed={index < currentStep}
            active={index === currentStep}
            status={status}
            size={stepSize}
            aria-label={`Step ${index + 1} of ${totalSteps}`}
          />
        ))}
        {showLabel && <StyledLabel>{getLabelText()}</StyledLabel>}
      </StyledStepContainer>
    );
  };

  try {
    return variant === 'linear' ? renderLinearProgress() : renderStepProgress();
  } catch (error) {
    console.error('Error rendering Progress component:', error);
    return null;
  }
});

Progress.displayName = 'Progress';

export default Progress;