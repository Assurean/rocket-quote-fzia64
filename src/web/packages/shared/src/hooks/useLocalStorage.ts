import { useState, useEffect, useCallback } from 'react'; // v18.2.0

// Error types for specific storage failures
type StorageError = {
  type: 'QuotaExceeded' | 'SecurityError' | 'SyntaxError' | 'TypeError' | 'Unknown';
  message: string;
  originalError?: Error;
};

/**
 * Safely parses a stored JSON value with type validation
 * @param storedValue The raw string value from localStorage
 * @returns Parsed and validated value or null if invalid
 */
function parseStoredValue<T>(storedValue: string | null): T | null {
  if (!storedValue) return null;
  
  try {
    const parsed = JSON.parse(storedValue);
    // Basic type validation - can be extended based on needs
    if (parsed === undefined) return null;
    return parsed as T;
  } catch (error) {
    handleStorageError({
      type: error instanceof SyntaxError ? 'SyntaxError' : 'Unknown',
      message: 'Failed to parse stored value',
      originalError: error as Error
    });
    return null;
  }
}

/**
 * Handles storage-related errors with appropriate fallbacks
 * @param error The storage error to handle
 */
function handleStorageError(error: StorageError): void {
  // Log errors in development mode
  if (process.env.NODE_ENV === 'development') {
    console.error('[useLocalStorage]', error.type, error.message, error.originalError);
  }

  // Track error metrics in production
  if (process.env.NODE_ENV === 'production') {
    // Here you could send to your error tracking service
  }
}

/**
 * Custom React hook for type-safe localStorage management with enhanced features
 * @param key The localStorage key to manage
 * @param initialValue The initial value or value factory function
 * @returns Tuple of [storedValue, setValue, removeValue]
 */
export default function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T)
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // Initialize state with lazy evaluation support
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        return typeof initialValue === 'function'
          ? (initialValue as () => T)()
          : initialValue;
      }

      const item = window.localStorage.getItem(key);
      const parsedItem = parseStoredValue<T>(item);
      
      if (parsedItem !== null) {
        return parsedItem;
      }

      // Initialize with provided value if nothing in storage
      const value = typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;
        
      window.localStorage.setItem(key, JSON.stringify(value));
      return value;
    } catch (error) {
      handleStorageError({
        type: 'Unknown',
        message: 'Error initializing localStorage value',
        originalError: error as Error
      });
      
      return typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue;
    }
  });

  // Memoized setter with error handling and quota management
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window === 'undefined') return;

      // Check available space before setting
      const serializedValue = JSON.stringify(valueToStore);
      const estimatedSize = new Blob([serializedValue]).size;
      
      if (estimatedSize > 5242880) { // 5MB limit
        throw new Error('Storage quota would be exceeded');
      }

      window.localStorage.setItem(key, serializedValue);

      // Dispatch storage event for cross-tab synchronization
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: serializedValue,
        storageArea: localStorage
      }));
    } catch (error) {
      handleStorageError({
        type: error instanceof Error && error.name === 'QuotaExceededError'
          ? 'QuotaExceeded'
          : 'Unknown',
        message: 'Failed to set localStorage value',
        originalError: error as Error
      });
    }
  }, [key, storedValue]);

  // Memoized removal function
  const removeValue = useCallback(() => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
      setStoredValue(typeof initialValue === 'function'
        ? (initialValue as () => T)()
        : initialValue);
    } catch (error) {
      handleStorageError({
        type: 'Unknown',
        message: 'Failed to remove localStorage value',
        originalError: error as Error
      });
    }
  }, [key, initialValue]);

  // Handle storage events for cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        const newValue = parseStoredValue<T>(event.newValue);
        if (newValue !== null) {
          setStoredValue(newValue);
        }
      } else if (event.key === key) {
        // Handle removal in other tabs
        setStoredValue(typeof initialValue === 'function'
          ? (initialValue as () => T)()
          : initialValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}