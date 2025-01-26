import React, { useEffect, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import { Snackbar, Alert, AlertProps } from '@mui/material';
import { feedback } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

/**
 * Interface for Toast component props
 */
interface ToastProps {
  /** The message to display in the toast */
  message: string;
  /** The severity level of the toast */
  severity: 'success' | 'error' | 'warning' | 'info';
  /** Controls the visibility of the toast */
  open: boolean;
  /** Duration in milliseconds before auto-hiding. Set to null to disable auto-hide */
  autoHideDuration?: number;
  /** Callback function when toast is closed */
  onClose: () => void;
  /** Position of the toast on the screen */
  anchorOrigin?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'right' | 'center';
  };
  /** Enable sound notification for screen readers */
  enableSoundNotification?: boolean;
}

/**
 * Styled Snackbar component with enhanced positioning and animations
 */
const StyledSnackbar = styled(Snackbar)(({ theme }) => ({
  position: 'fixed',
  zIndex: theme.zIndex.snackbar,
  transition: 'all 0.3s ease-in-out',
  maxWidth: '90vw',
  minWidth: '288px',
  '@media (max-width: 600px)': {
    width: '100%',
    maxWidth: 'none',
  }
}));

/**
 * Styled Alert component with theme-consistent typography and spacing
 */
const StyledAlert = styled(Alert)<AlertProps>(({ theme, severity }) => ({
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.medium,
  lineHeight: typography.lineHeight.normal,
  padding: spacing.padding.sm,
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  backgroundColor: feedback[severity].main,
  color: feedback[severity].contrast,
  '& .MuiAlert-icon': {
    color: 'inherit',
    opacity: 0.9,
    marginRight: spacing.margin.sm
  },
  '& .MuiAlert-action': {
    padding: spacing.padding.xs,
    marginRight: spacing.margin.none
  }
}));

/**
 * Toast component for displaying temporary feedback messages
 * Implements WCAG 2.1 AA accessibility standards
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  severity,
  open,
  autoHideDuration = 6000,
  onClose,
  anchorOrigin = {
    vertical: 'bottom',
    horizontal: 'center'
  },
  enableSoundNotification = false
}) => {
  /**
   * Handle keyboard interactions for accessibility
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      onClose();
    }
  }, [open, onClose]);

  /**
   * Set up keyboard event listeners and screen reader announcements
   */
  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      
      // Announce to screen readers
      const announcement = `${severity} alert: ${message}`;
      if (enableSoundNotification) {
        const utterance = new SpeechSynthesisUtterance(announcement);
        window.speechSynthesis.speak(utterance);
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (enableSoundNotification) {
        window.speechSynthesis.cancel();
      }
    };
  }, [open, severity, message, handleKeyDown, enableSoundNotification]);

  /**
   * Handle toast close events
   */
  const handleClose = useCallback((event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    onClose();
  }, [onClose]);

  return (
    <StyledSnackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={anchorOrigin}
      role="alert"
      aria-live="polite"
    >
      <StyledAlert
        onClose={handleClose}
        severity={severity}
        variant="filled"
        elevation={6}
        iconMapping={{
          success: <span role="img" aria-label="success">✓</span>,
          error: <span role="img" aria-label="error">✕</span>,
          warning: <span role="img" aria-label="warning">⚠</span>,
          info: <span role="img" aria-label="info">ℹ</span>
        }}
      >
        {message}
      </StyledAlert>
    </StyledSnackbar>
  );
};

export default Toast;