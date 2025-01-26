import { useState, useEffect } from 'react'; // v18.2.0

/**
 * A custom React hook that provides debounced value updates for optimizing performance
 * in form inputs, search fields, and API calls.
 * 
 * @template T The type of value being debounced
 * @param value The value to debounce
 * @param delay The delay in milliseconds before the value updates
 * @returns The debounced value of type T
 * 
 * @example
 * // Usage in a search input component
 * const searchTerm = useDebounce(inputValue, 500);
 * 
 * @example
 * // Usage with specific type
 * const score = useDebounce<number>(calculatedScore, 300);
 */
function useDebounce<T>(value: T, delay: number): T {
  // Initialize state with initial value while maintaining type safety
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Store the timeout ID for cleanup
    let timeoutId: number | undefined;

    /**
     * Update the debounced value after the specified delay
     * This helps prevent excessive API calls and improves performance
     */
    timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    /**
     * Cleanup function to prevent memory leaks and ensure proper timeout handling
     * Runs on component unmount or when value/delay changes
     */
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [value, delay]); // Only re-run effect if value or delay changes

  return debouncedValue;
}

export default useDebounce;