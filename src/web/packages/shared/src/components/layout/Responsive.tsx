import { type FC, type ReactNode, memo } from 'react'; // v18.2.0
import useBreakpoint from '../../hooks/useBreakpoint';

/**
 * Props interface for the Responsive component defining optional content
 * for each breakpoint following mobile-first design principles
 */
interface ResponsiveProps {
  /** Content to render on mobile viewport (0-767px) */
  mobile?: ReactNode;
  /** Content to render on tablet viewport (768-1023px) */
  tablet?: ReactNode;
  /** Content to render on desktop viewport (1024px+) */
  desktop?: ReactNode;
}

/**
 * A responsive layout component that conditionally renders content based on
 * the current viewport breakpoint. Implements mobile-first design with SSR
 * compatibility and accessibility features.
 *
 * Features:
 * - Mobile-first breakpoint detection
 * - SSR compatibility with mobile-first fallback
 * - Optimized performance through memoization
 * - Accessible content updates
 * - Graceful fallback behavior
 *
 * @example
 * ```tsx
 * <Responsive
 *   mobile={<MobileView />}
 *   tablet={<TabletView />}
 *   desktop={<DesktopView />}
 * />
 * ```
 */
const Responsive: FC<ResponsiveProps> = memo(({ mobile, tablet, desktop }) => {
  // Get current breakpoint using memoized hook
  const breakpoint = useBreakpoint({
    debounceDelay: 100, // Optimize performance with debouncing
  });

  /**
   * Helper function to determine content based on current breakpoint
   * with mobile-first cascading fallback behavior
   */
  const getContent = (): ReactNode => {
    switch (breakpoint) {
      case 'desktop':
        // Desktop: show desktop content or fall back to tablet/mobile
        return desktop || tablet || mobile;
      case 'tablet':
        // Tablet: show tablet content or fall back to mobile
        return tablet || mobile;
      case 'mobile':
      default:
        // Mobile or SSR: show mobile content
        return mobile;
    }
  };

  // Get the appropriate content for current breakpoint
  const content = getContent();

  // Return null if no content is available
  if (!content) {
    return null;
  }

  // Wrap content in fragment with aria-live for accessibility
  return (
    <div 
      role="region" 
      aria-live="polite"
      data-breakpoint={breakpoint}
    >
      {content}
    </div>
  );
});

// Set display name for debugging
Responsive.displayName = 'Responsive';

export default Responsive;
export type { ResponsiveProps };