/**
 * @fileoverview Defines responsive design breakpoints and media queries for the insurance lead generation platform.
 * Implements a mobile-first approach with specific breakpoints for mobile, tablet, and desktop views.
 * @version 1.0.0
 */

/**
 * Type definition for available breakpoint names.
 * Used for type-safe breakpoint references throughout the application.
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Pixel values for responsive breakpoints following mobile-first design principles.
 * - mobile: 0-767px (default/base)
 * - tablet: 768-1023px
 * - desktop: 1024px and above
 */
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
} as const;

/**
 * Media query strings for responsive styling with mobile-first approach.
 * Provides pre-defined media query strings for use with CSS-in-JS solutions.
 * 
 * Usage example with styled-components:
 * ```
 * const ResponsiveComponent = styled.div`
 *   ${mediaQueries.mobile} {
 *     // Mobile-specific styles
 *   }
 *   ${mediaQueries.tabletUp} {
 *     // Styles for tablet and above
 *   }
 * `
 * ```
 */
export const mediaQueries = {
  /**
   * Targets mobile devices specifically (0-767px)
   */
  mobile: '@media (max-width: 767px)',

  /**
   * Targets tablet devices specifically (768-1023px)
   */
  tablet: '@media (min-width: 768px) and (max-width: 1023px)',

  /**
   * Targets desktop devices specifically (1024px and above)
   */
  desktop: '@media (min-width: 1024px)',

  /**
   * Targets tablet and larger devices (768px and above)
   */
  tabletUp: '@media (min-width: 768px)',

  /**
   * Targets desktop and larger devices (1024px and above)
   */
  desktopUp: '@media (min-width: 1024px)',
} as const;