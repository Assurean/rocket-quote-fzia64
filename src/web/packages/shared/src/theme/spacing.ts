/**
 * @file spacing.ts
 * Core spacing system implementation using 8px base grid
 * Provides standardized margins and padding values for consistent component spacing
 * @version 1.0.0
 */

/**
 * Type definition for semantic spacing scale values
 */
export type SpacingScale = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Interface defining the structure of the spacing configuration
 */
export interface SpacingConfig {
  base: number;
  margin: Record<SpacingScale, string>;
  padding: Record<SpacingScale, string>;
}

/**
 * Base spacing unit in pixels that forms the foundation of the grid system
 * Used as multiplier for calculating other spacing values
 */
const BASE_SPACING = 8;

/**
 * Core spacing configuration object implementing the 8px grid system
 * Provides semantic naming for consistent spacing across components
 */
export const spacing: SpacingConfig = {
  // Base spacing unit (8px)
  base: BASE_SPACING,

  // Standardized margin values with semantic naming
  margin: {
    none: '0',
    xs: `${BASE_SPACING}px`,      // 8px
    sm: `${BASE_SPACING * 2}px`,  // 16px
    md: `${BASE_SPACING * 3}px`,  // 24px
    lg: `${BASE_SPACING * 4}px`,  // 32px
    xl: `${BASE_SPACING * 5}px`,  // 40px
  },

  // Standardized padding values with semantic naming
  padding: {
    none: '0',
    xs: `${BASE_SPACING}px`,      // 8px
    sm: `${BASE_SPACING * 2}px`,  // 16px
    md: `${BASE_SPACING * 3}px`,  // 24px
    lg: `${BASE_SPACING * 4}px`,  // 32px
  }
} as const;

// Default export for convenient importing
export default spacing;