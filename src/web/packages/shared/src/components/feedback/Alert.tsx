import React, { useEffect, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { feedback } from '../theme/colors';
import { fontSize, lineHeight } from '../theme/typography';

// Alert severity types matching the feedback color system
type AlertSeverity = 'success' | 'error' | 'warning' | 'info';

// Props interface with full accessibility support
interface AlertProps {
  severity: AlertSeverity;
  message: string;
  onClose?: () => void;
  autoHideDuration?: number;
  className?: string;
  role?: string;
}

// Styled container with proper accessibility focus states
const AlertContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'severity',
})<{ severity: AlertSeverity }>(({ severity, theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  borderRadius: '4px',
  marginBottom: '16px',
  backgroundColor: `${feedback[severity].main}14`, // 8% opacity
  border: `1px solid ${feedback[severity].main}`,
  transition: 'opacity 200ms ease-in-out',
  position: 'relative',
  outline: 'none',

  // Accessibility focus styles
  '&:focus-visible': {
    boxShadow: `0 0 0 2px ${feedback[severity].main}`,
  },

  // Ensure proper contrast for all states
  '@media (prefers-color-scheme: dark)': {
    backgroundColor: `${feedback[severity].dark}14`,
    border: `1px solid ${feedback[severity].dark}`,
  },
}));

// Styled message text with proper typography
const AlertMessage = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'severity',
})<{ severity: AlertSeverity }>(({ severity }) => ({
  flex: 1,
  fontSize: fontSize.sm,
  lineHeight: lineHeight.normal,
  color: feedback[severity].main,
  margin: 0,
  padding: 0,
}));

// Map severity to appropriate ARIA roles
const severityToRole: Record<AlertSeverity, string> = {
  error: 'alert',
  warning: 'alert',
  success: 'status',
  info: 'status',
};

// Memoized Alert component for performance
const Alert = React.memo<AlertProps>(({
  severity,
  message,
  onClose,
  autoHideDuration,
  className,
  role: customRole,
}) => {
  // Handle auto-hide functionality
  useEffect(() => {
    if (autoHideDuration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [autoHideDuration, onClose]);

  // Keyboard event handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && onClose) {
      onClose();
    }
  }, [onClose]);

  // Determine appropriate ARIA role
  const alertRole = customRole || severityToRole[severity];

  return (
    <AlertContainer
      severity={severity}
      className={className}
      role={alertRole}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-atomic="true"
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
    >
      <AlertMessage
        severity={severity}
        component="p"
        aria-label={`${severity} alert: ${message}`}
      >
        {message}
      </AlertMessage>
      
      {onClose && (
        <IconButton
          size="small"
          aria-label="Close alert"
          onClick={onClose}
          sx={{
            marginLeft: '8px',
            padding: '4px',
            color: feedback[severity].main,
            '&:hover': {
              backgroundColor: `${feedback[severity].main}14`,
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </AlertContainer>
  );
});

// Display name for debugging
Alert.displayName = 'Alert';

export default Alert;