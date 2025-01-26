// External imports with versions
import '@testing-library/jest-dom/extend-expect'; // v5.16.5
import { configure } from '@testing-library/react'; // v13.4.0
import 'whatwg-fetch'; // v3.6.2

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
});

// Type definitions for mocks
interface MediaQueryList {
  matches: boolean;
  media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null;
  addListener: (callback: ((this: MediaQueryList, ev: MediaQueryListEvent) => any)) => void;
  removeListener: (callback: ((this: MediaQueryList, ev: MediaQueryListEvent) => any)) => void;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  dispatchEvent: (event: Event) => boolean;
}

// Mock matchMedia implementation
const mockMatchMedia = (query: string): MediaQueryList => {
  const mediaQueryList: MediaQueryList = {
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn((listener) => {
      mediaQueryList.addEventListener('change', listener);
    }),
    removeListener: jest.fn((listener) => {
      mediaQueryList.removeEventListener('change', listener);
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };

  return mediaQueryList;
};

// Setup test environment
const setupTestEnvironment = (): void => {
  // Configure fetch API polyfill
  globalThis.fetch = window.fetch.bind(window);
  globalThis.Request = window.Request.bind(window);
  globalThis.Response = window.Response.bind(window);

  // Configure window mocks
  window.matchMedia = jest.fn().mockImplementation(mockMatchMedia);
  window.scrollTo = jest.fn();

  // Mock IntersectionObserver
  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      this.observe = jest.fn();
      this.unobserve = jest.fn();
      this.disconnect = jest.fn();
    }
    observe = (): void => {};
    unobserve = (): void => {};
    disconnect = (): void => {};
  }

  window.IntersectionObserver = MockIntersectionObserver;

  // Mock ResizeObserver
  class MockResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      this.observe = jest.fn();
      this.unobserve = jest.fn();
      this.disconnect = jest.fn();
    }
    observe = (): void => {};
    unobserve = (): void => {};
    disconnect = (): void => {};
  }

  window.ResizeObserver = MockResizeObserver;

  // Configure error handling
  const originalError = console.error;
  console.error = (...args: any[]): void => {
    if (
      /Warning.*not wrapped in act/.test(args[0]) ||
      /Warning.*Cannot update a component/.test(args[0])
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  // Mock local storage
  const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };

  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
  });

  // Mock session storage
  const mockSessionStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };

  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
  });

  // Configure responsive design testing utilities
  const mockViewport = (width: number, height: number): void => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
    window.dispatchEvent(new Event('resize'));
  };

  // Set default viewport
  mockViewport(1024, 768);

  // Mock clipboard API
  Object.defineProperty(window.navigator, 'clipboard', {
    value: {
      writeText: jest.fn(),
      readText: jest.fn(),
    },
  });

  // Configure default timeout
  jest.setTimeout(10000);
};

// Execute setup
setupTestEnvironment();

// Export for external usage
export { mockMatchMedia, setupTestEnvironment };