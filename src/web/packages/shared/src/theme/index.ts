/**
 * @fileoverview Main theme configuration for the insurance lead generation platform
 * Aggregates colors, typography, spacing, and breakpoints into a cohesive theme system
 * Ensures WCAG 2.1 AA compliance and mobile-first responsive design
 * @version 1.0.0
 */

import { createTheme, Theme, ThemeOptions } from '@mui/material'; // v5.0+
import { colors, verticals, ui, feedback } from './colors';
import typography from './typography';
import spacing from './spacing';
import { breakpoints, mediaQueries } from './breakpoints';

/**
 * Type definition for supported insurance verticals
 */
export type InsuranceVertical = 'auto' | 'home' | 'health' | 'life' | 'renters' | 'commercial';

/**
 * Accessibility mixins for ensuring WCAG 2.1 AA compliance
 */
const accessibilityMixins = {
  focusRing: {
    outline: `3px solid ${ui.primary}`,
    outlineOffset: '2px',
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    border: '0',
  },
  highContrast: {
    color: ui.text.primary,
    backgroundColor: ui.background,
  },
};

/**
 * Component-specific style overrides for consistent theming
 */
const componentOverrides = {
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: spacing.base / 2,
        padding: `${spacing.padding.sm} ${spacing.padding.md}`,
        '&:focus-visible': accessibilityMixins.focusRing,
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: spacing.base / 2,
          '&:focus-within': accessibilityMixins.focusRing,
        },
      },
    },
  },
  MuiFormLabel: {
    styleOverrides: {
      root: typography.formLabel,
    },
  },
};

/**
 * Creates a customized theme for a specific insurance vertical
 * @param vertical - Insurance vertical for theme customization
 * @returns Material-UI theme with vertical-specific styling
 */
export const createAppTheme = (vertical?: InsuranceVertical): Theme => {
  const verticalColors = vertical ? verticals[vertical] : verticals.auto;

  const themeOptions: ThemeOptions = {
    palette: {
      primary: {
        main: verticalColors.primary,
        light: verticalColors.light,
        dark: verticalColors.dark,
        contrastText: verticalColors.contrast,
      },
      background: {
        default: ui.background,
        paper: ui.surface,
      },
      text: ui.text,
      error: feedback.error,
      warning: feedback.warning,
      success: feedback.success,
      info: feedback.info,
    },
    typography,
    spacing: spacing.base,
    breakpoints: {
      values: breakpoints,
    },
    components: componentOverrides,
    mixins: accessibilityMixins,
  };

  return createTheme(themeOptions);
};

/**
 * Default theme configuration with base styling
 */
export const defaultTheme = createAppTheme();

/**
 * Export complete theme system
 */
export const theme = {
  colors,
  typography,
  spacing,
  breakpoints,
  mediaQueries,
  components: componentOverrides,
  mixins: accessibilityMixins,
  createAppTheme,
};

// Type exports for theme system
export type AppTheme = typeof theme;
export type ThemeColors = typeof colors;
export type ThemeTypography = typeof typography;
export type ThemeSpacing = typeof spacing;
export type ThemeBreakpoints = typeof breakpoints;