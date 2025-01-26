/**
 * @fileoverview Enhanced responsive grid system component extending Material-UI Grid
 * Implements insurance-specific layout patterns with 8px grid system and mobile-first design
 * @version 1.0.0
 */

import React from 'react'; // v18.2+
import { Grid as MuiGrid } from '@mui/material'; // v5.0+
import { styled } from '@mui/material/styles'; // v5.0+
import { spacing } from '../../theme/spacing';
import { mediaQueries } from '../../theme/breakpoints';

/**
 * Extended props interface for Grid component with insurance-specific layout options
 */
export interface GridProps {
  children: React.ReactNode;
  container?: boolean;
  item?: boolean;
  spacing?: number | {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
  xs?: number | 'auto' | boolean;
  sm?: number | 'auto' | boolean;
  md?: number | 'auto' | boolean;
  lg?: number | 'auto' | boolean;
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  formLayout?: 'auto' | 'home' | 'health' | 'life';
  role?: string;
  'aria-label'?: string;
}

/**
 * Styled wrapper for MUI Grid with insurance-specific layout presets
 */
const StyledGrid = styled(MuiGrid, {
  shouldForwardProp: (prop) => !['formLayout'].includes(String(prop)),
})<GridProps>(({ theme, container, item, formLayout }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  boxSizing: 'border-box',
  margin: '0 auto',

  // Base mobile styles
  [mediaQueries.mobile]: {
    gap: spacing.margin.xs,
    padding: spacing.padding.xs,
  },

  // Tablet styles
  [mediaQueries.tablet]: {
    gap: spacing.margin.sm,
    padding: spacing.padding.sm,
  },

  // Desktop styles
  [mediaQueries.desktop]: {
    gap: spacing.margin.md,
    padding: spacing.padding.md,
  },

  // Container styles
  ...(container && {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
  }),

  // Item styles
  ...(item && {
    flexGrow: 0,
  }),

  // Form layout presets
  ...(formLayout && {
    ...(formLayout === 'home' && {
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: spacing.margin.md,
    }),
    ...(formLayout === 'health' && {
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: spacing.margin.sm,
    }),
    ...(formLayout === 'life' && {
      gridTemplateColumns: '1fr',
      maxWidth: '600px',
      margin: '0 auto',
    }),
  }),
}));

/**
 * Enhanced responsive grid component with insurance form layout optimizations
 * and accessibility features
 */
const Grid = React.memo<GridProps>(({
  children,
  container = false,
  item = false,
  spacing,
  xs,
  sm,
  md,
  lg,
  direction,
  justifyContent,
  alignItems,
  formLayout,
  role,
  'aria-label': ariaLabel,
  ...props
}) => {
  // Calculate spacing based on 8px grid system
  const getSpacing = (value: number) => value * spacing.base;

  // Convert spacing prop to MUI format
  const gridSpacing = typeof spacing === 'number' 
    ? getSpacing(spacing)
    : spacing 
      ? Object.entries(spacing).reduce((acc, [key, value]) => ({
          ...acc,
          [key]: value ? getSpacing(value) : 0
        }), {})
      : undefined;

  return (
    <StyledGrid
      container={container}
      item={item}
      spacing={gridSpacing}
      xs={xs}
      sm={sm}
      md={md}
      lg={lg}
      direction={direction}
      justifyContent={justifyContent}
      alignItems={alignItems}
      formLayout={formLayout}
      role={role || (container ? 'group' : undefined)}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </StyledGrid>
  );
});

// Display name for debugging
Grid.displayName = 'Grid';

export default Grid;