import { Theme, TypographyOptions } from '@mui/material/styles';

// System font stack optimized for cross-platform consistency
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

// Standard font weights per design system
const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  bold: 700,
} as const;

// Line height scale for optimal readability
const LINE_HEIGHTS = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// Comprehensive font size scale
const FONT_SIZES = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem',// 30px
  '4xl': '2.25rem', // 36px
} as const;

// Utility function to convert pixels to rem
const pxToRem = (size: number): string => `${size / 16}rem`;

// Typography configuration for the theme system
export const typography: TypographyOptions = {
  fontFamily: FONT_FAMILY,
  fontSize: 16, // Base font size in pixels
  htmlFontSize: 16,
  
  // Main headings
  h1: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES['4xl'],
    lineHeight: LINE_HEIGHTS.tight,
    letterSpacing: '-0.02em',
    marginBottom: '0.5em',
  },
  
  h2: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES['3xl'],
    lineHeight: LINE_HEIGHTS.tight,
    letterSpacing: '-0.01em',
    marginBottom: '0.5em',
  },
  
  h3: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES['2xl'],
    lineHeight: LINE_HEIGHTS.tight,
    letterSpacing: '-0.01em',
    marginBottom: '0.5em',
  },
  
  // Body text styles
  body1: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.regular,
    fontSize: FONT_SIZES.base,
    lineHeight: LINE_HEIGHTS.normal,
    letterSpacing: '0.00938em',
  },
  
  body2: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.regular,
    fontSize: FONT_SIZES.sm,
    lineHeight: LINE_HEIGHTS.normal,
    letterSpacing: '0.00938em',
  },
  
  // Utility text styles
  caption: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.regular,
    fontSize: FONT_SIZES.xs,
    lineHeight: LINE_HEIGHTS.normal,
    letterSpacing: '0.00938em',
  },
  
  // Form-specific typography
  formLabel: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.medium,
    fontSize: FONT_SIZES.sm,
    lineHeight: LINE_HEIGHTS.normal,
    letterSpacing: '0.00938em',
    marginBottom: '0.5em',
  },
  
  // Legal text and disclaimers
  disclaimer: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.regular,
    fontSize: FONT_SIZES.xs,
    lineHeight: LINE_HEIGHTS.relaxed,
    letterSpacing: '0.00938em',
    color: 'rgba(0, 0, 0, 0.6)',
  },
  
  // Override default Material-UI styles
  button: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.medium,
    fontSize: FONT_SIZES.sm,
    lineHeight: LINE_HEIGHTS.normal,
    letterSpacing: '0.02857em',
    textTransform: 'none', // Prevent all-caps transformation
  },
  
  // Additional overrides for consistent spacing
  overline: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.medium,
    fontSize: FONT_SIZES.xs,
    lineHeight: LINE_HEIGHTS.normal,
    letterSpacing: '0.08333em',
    textTransform: 'uppercase',
  },
  
  subtitle1: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.medium,
    fontSize: FONT_SIZES.lg,
    lineHeight: LINE_HEIGHTS.normal,
    letterSpacing: '0.00938em',
  },
  
  subtitle2: {
    fontFamily: FONT_FAMILY,
    fontWeight: FONT_WEIGHTS.medium,
    fontSize: FONT_SIZES.base,
    lineHeight: LINE_HEIGHTS.normal,
    letterSpacing: '0.00714em',
  }
} as const;

export default typography;