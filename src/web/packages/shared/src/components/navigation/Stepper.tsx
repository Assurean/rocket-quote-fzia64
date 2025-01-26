import React, { useCallback, useEffect, useMemo } from 'react';
import styled from '@mui/material/styles/styled';
import { Stepper as MuiStepper, MobileStepper } from '@mui/material';
import { useSwipeable } from 'react-swipeable'; // v7.0+
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import useBreakpoint from '../../hooks/useBreakpoint';

// Types for insurance verticals
type InsuranceVertical = 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';

// Step interface
interface Step {
  label: string;
  completed: boolean;
  current: boolean;
  disabled?: boolean;
}

// Component props interface
interface StepperProps {
  steps: Step[];
  activeStep: number;
  vertical?: InsuranceVertical;
  onStepClick?: (index: number) => void;
  className?: string;
  persistState?: boolean;
}

// Styled components
const StyledDesktopStepper = styled(MuiStepper)(({ theme }) => ({
  backgroundColor: 'transparent',
  padding: spacing.padding.md,
  [theme.breakpoints.down('md')]: {
    display: 'none'
  }
}));

const StyledMobileStepper = styled(MobileStepper)(({ theme }) => ({
  backgroundColor: 'transparent',
  padding: spacing.padding.sm,
  [theme.breakpoints.up('md')]: {
    display: 'none'
  }
}));

const StyledStepLabel = styled('span')<{ completed: boolean; current: boolean; disabled?: boolean }>(
  ({ completed, current, disabled }) => ({
    color: getStepColor(completed, current, undefined, disabled ?? false),
    fontSize: '0.875rem',
    fontWeight: current ? 600 : 400,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'color 0.2s ease-in-out',
    '&:hover': {
      color: !disabled ? colors.ui.primary : undefined
    }
  })
);

const StyledDot = styled('div')<{
  completed: boolean;
  current: boolean;
  vertical?: InsuranceVertical;
  disabled?: boolean;
}>(({ completed, current, vertical, disabled }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: getStepColor(completed, current, vertical, disabled ?? false),
  transition: 'background-color 0.2s ease-in-out'
}));

// Helper function to determine step color
const getStepColor = (
  completed: boolean,
  current: boolean,
  vertical?: InsuranceVertical,
  disabled: boolean = false
): string => {
  if (disabled) {
    return colors.ui.text.disabled;
  }
  if (completed) {
    return colors.feedback.success.main;
  }
  if (current && vertical) {
    return colors.verticals[vertical].primary;
  }
  return colors.ui.text.secondary;
};

// Custom hook for stepper state management
const useStepperState = (initialStep: number, persist: boolean = false) => {
  const storageKey = 'insurance-stepper-state';

  const getInitialState = useCallback(() => {
    if (!persist) return initialStep;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : initialStep;
    } catch {
      return initialStep;
    }
  }, [initialStep, persist]);

  const [currentStep, setCurrentStep] = React.useState(getInitialState());

  useEffect(() => {
    if (persist) {
      localStorage.setItem(storageKey, JSON.stringify(currentStep));
    }
    return () => {
      if (persist) {
        localStorage.removeItem(storageKey);
      }
    };
  }, [currentStep, persist]);

  return [currentStep, setCurrentStep] as const;
};

export const InsuranceStepper: React.FC<StepperProps> = ({
  steps,
  activeStep,
  vertical,
  onStepClick,
  className,
  persistState = false
}) => {
  const breakpoint = useBreakpoint();
  const [currentStep, setCurrentStep] = useStepperState(activeStep, persistState);

  // Handle step navigation
  const handleStepClick = useCallback(
    (index: number) => {
      if (steps[index].disabled) return;
      setCurrentStep(index);
      onStepClick?.(index);
    },
    [steps, onStepClick, setCurrentStep]
  );

  // Swipe handlers for mobile
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentStep < steps.length - 1) {
        handleStepClick(currentStep + 1);
      }
    },
    onSwipedRight: () => {
      if (currentStep > 0) {
        handleStepClick(currentStep - 1);
      }
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (currentStep < steps.length - 1) handleStepClick(currentStep + 1);
      } else if (e.key === 'ArrowLeft') {
        if (currentStep > 0) handleStepClick(currentStep - 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentStep, steps.length, handleStepClick]);

  // Desktop stepper renderer
  const renderDesktopStepper = useMemo(
    () => (
      <StyledDesktopStepper
        activeStep={currentStep}
        alternativeLabel
        className={className}
        role="navigation"
        aria-label="Form progress"
      >
        {steps.map((step, index) => (
          <div
            key={step.label}
            role="button"
            tabIndex={step.disabled ? -1 : 0}
            onClick={() => handleStepClick(index)}
            onKeyPress={(e) => e.key === 'Enter' && handleStepClick(index)}
            aria-current={step.current ? 'step' : undefined}
            aria-disabled={step.disabled}
          >
            <StyledStepLabel
              completed={step.completed}
              current={step.current}
              disabled={step.disabled}
            >
              {step.label}
            </StyledStepLabel>
          </div>
        ))}
      </StyledDesktopStepper>
    ),
    [steps, currentStep, className, handleStepClick]
  );

  // Mobile stepper renderer
  const renderMobileStepper = useMemo(
    () => (
      <StyledMobileStepper
        {...swipeHandlers}
        variant="dots"
        steps={steps.length}
        position="static"
        activeStep={currentStep}
        className={className}
        role="navigation"
        aria-label="Form progress"
        backButton={null}
        nextButton={null}
        LinearProgressProps={{
          'aria-label': 'Form completion progress'
        }}
      />
    ),
    [steps.length, currentStep, className, swipeHandlers]
  );

  return breakpoint === 'mobile' ? renderMobileStepper : renderDesktopStepper;
};

export default InsuranceStepper;