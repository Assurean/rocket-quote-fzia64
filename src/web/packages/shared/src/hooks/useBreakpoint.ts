import { useState, useEffect, useCallback, useMemo } from 'react'; // v18.2.0
import { breakpoints } from '../theme/breakpoints';
import useDebounce from './useDebounce';

/**
 * Type definition for available breakpoint values
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Configuration options for useBreakpoint hook
 */
interface UseBreakpointOptions {
  /** Initial width to use for SSR or testing */
  initialWidth?: number;
  /** Callback fired when breakpoint changes */
  onChange?: (breakpoint: Breakpoint) => void;
  /** Delay in ms for debouncing resize events (default: 100) */
  debounceDelay?: number;
}

/**
 * Pure function to calculate breakpoint from window width
 * @throws {Error} If width is not a positive number
 */
const getBreakpoint = (width: number): Breakpoint => {
  if (typeof width !== 'number' || width < 0) {
    throw new Error('Width must be a positive number');
  }

  if (width >= breakpoints.desktop) {
    return 'desktop';
  }
  if (width >= breakpoints.tablet) {
    return 'tablet';
  }
  return 'mobile';
};

/**
 * Safely get initial window width with SSR consideration
 */
const getInitialWidth = (): number => {
  if (typeof window === 'undefined') {
    return 0;
  }
  return window.innerWidth;
};

/**
 * A production-ready custom React hook that provides responsive breakpoint detection
 * with performance optimization, SSR compatibility, and comprehensive error handling.
 * 
 * Features:
 * - Mobile-first design principles
 * - SSR compatibility
 * - Debounced resize handling
 * - ResizeObserver support
 * - Passive event listeners
 * - Cleanup on unmount
 * 
 * @param options Configuration options for the hook
 * @returns Current breakpoint value
 * 
 * @example
 * ```tsx
 * const breakpoint = useBreakpoint();
 * // Use with options
 * const breakpoint = useBreakpoint({
 *   onChange: (newBreakpoint) => console.log(newBreakpoint),
 *   debounceDelay: 150
 * });
 * ```
 * 
 * @throws {Error} When used outside React component
 * @throws {Error} When options are invalid
 */
const useBreakpoint = (options: UseBreakpointOptions = {}): Breakpoint => {
  const {
    initialWidth = getInitialWidth(),
    onChange,
    debounceDelay = 100
  } = options;

  // Validate options
  if (initialWidth < 0) {
    throw new Error('initialWidth must be a positive number');
  }

  // Initialize state with memoized initial calculation
  const initialBreakpoint = useMemo(
    () => getBreakpoint(initialWidth),
    [initialWidth]
  );
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(initialBreakpoint);

  // Create memoized resize handler
  const handleResize = useCallback(() => {
    try {
      const newBreakpoint = getBreakpoint(window.innerWidth);
      if (newBreakpoint !== breakpoint) {
        setBreakpoint(newBreakpoint);
        onChange?.(newBreakpoint);
      }
    } catch (error) {
      console.error('Error handling resize:', error);
    }
  }, [breakpoint, onChange]);

  // Debounce the resize handler for performance
  const debouncedHandleResize = useDebounce(handleResize, debounceDelay);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Use ResizeObserver if available
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        debouncedHandleResize();
      });
      resizeObserver.observe(document.documentElement);
    }

    // Fallback to window resize event
    window.addEventListener('resize', debouncedHandleResize, { passive: true });

    // Initial check
    handleResize();

    // Cleanup
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', debouncedHandleResize);
    };
  }, [debouncedHandleResize, handleResize]);

  return breakpoint;
};

export default useBreakpoint;
export type { UseBreakpointOptions };