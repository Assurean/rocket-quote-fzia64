import '@testing-library/jest-dom'; // v5.0.0
import { vi, expect } from 'vitest'; // v1.0.0
import { cleanup } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0

/**
 * Mock implementation of IntersectionObserver for scroll-based testing
 */
const mockIntersectionObserver = (): void => {
  class IntersectionObserverMock {
    private readonly callback: IntersectionObserverCallback;
    private elements: Set<Element>;

    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      this.callback = callback;
      this.elements = new Set();
    }

    observe(element: Element): void {
      this.elements.add(element);
      this.callback([{
        target: element,
        isIntersecting: true,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRatio: 1,
        intersectionRect: element.getBoundingClientRect(),
        rootBounds: null,
        time: Date.now()
      }], this);
    }

    unobserve(element: Element): void {
      this.elements.delete(element);
    }

    disconnect(): void {
      this.elements.clear();
    }
  }

  global.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
};

/**
 * Mock implementation of window.matchMedia for responsive design testing
 */
const mockMatchMedia = (query: string): MediaQueryList => {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  };
};

/**
 * Mock implementation of ResizeObserver for layout change testing
 */
const mockResizeObserver = (): void => {
  class ResizeObserverMock {
    private readonly callback: ResizeObserverCallback;
    private elements: Set<Element>;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      this.elements = new Set();
    }

    observe(element: Element): void {
      this.elements.add(element);
      this.callback([{
        target: element,
        contentRect: element.getBoundingClientRect(),
        borderBoxSize: [],
        contentBoxSize: [],
        devicePixelContentBoxSize: []
      }], this);
    }

    unobserve(element: Element): void {
      this.elements.delete(element);
    }

    disconnect(): void {
      this.elements.clear();
    }
  }

  global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
};

/**
 * Configure the global test environment with required settings and mocks
 */
const setupTestEnvironment = (): void => {
  // Configure global fetch mock
  global.fetch = vi.fn().mockImplementation(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      formData: () => Promise.resolve(new FormData())
    })
  );

  // Setup DOM mocks
  mockIntersectionObserver();
  mockResizeObserver();
  global.matchMedia = mockMatchMedia;

  // Configure console mocks
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('React.createFactory()') || 
       args[0].includes('Warning:'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' && 
      args[0].includes('Warning:')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };

  // Configure cleanup
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
};

// Initialize test environment
setupTestEnvironment();

// Export test utilities for use in test files
export {
  vi,
  expect,
  userEvent
};

// Declare global types for mocked APIs
declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
  
  var IntersectionObserver: {
    new (
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit
    ): IntersectionObserver;
  };
  
  var ResizeObserver: {
    new (
      callback: ResizeObserverCallback
    ): ResizeObserver;
  };
}