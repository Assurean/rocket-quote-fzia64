import { renderHook, act } from '@testing-library/react-hooks';
import { breakpoints } from '../../src/theme/breakpoints';
import useBreakpoint from '../../src/hooks/useBreakpoint';

// Mock ResizeObserver
class ResizeObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

// Mock performance.now
const performanceNow = jest.fn(() => Date.now());

describe('useBreakpoint', () => {
  // Store original window properties
  const originalInnerWidth = window.innerWidth;
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;
  const originalResizeObserver = window.ResizeObserver;
  const originalPerformanceNow = window.performance.now;

  beforeAll(() => {
    // Mock window methods
    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
    window.ResizeObserver = ResizeObserverMock as any;
    window.performance.now = performanceNow;
  });

  afterAll(() => {
    // Restore original window methods
    window.innerWidth = originalInnerWidth;
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    window.ResizeObserver = originalResizeObserver;
    window.performance.now = originalPerformanceNow;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle SSR environment', () => {
    // Mock window as undefined for SSR
    const windowSpy = jest.spyOn(global, 'window', 'get');
    windowSpy.mockReturnValue(undefined as any);

    const { result } = renderHook(() => useBreakpoint());

    // Should default to mobile in SSR
    expect(result.current).toBe('mobile');

    // Verify no client-side APIs were called
    expect(window.addEventListener).not.toHaveBeenCalled();
    expect(window.ResizeObserver).not.toHaveBeenCalled();

    windowSpy.mockRestore();
  });

  it('should detect viewport breakpoints accurately', () => {
    // Test mobile breakpoint (0-767px)
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    const { result, rerender } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');

    // Test tablet breakpoint (768-1023px)
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
      window.dispatchEvent(new Event('resize'));
    });
    rerender();
    expect(result.current).toBe('tablet');

    // Test desktop breakpoint (1024px+)
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      window.dispatchEvent(new Event('resize'));
    });
    rerender();
    expect(result.current).toBe('desktop');

    // Test edge cases
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: breakpoints.tablet - 1, configurable: true });
      window.dispatchEvent(new Event('resize'));
    });
    rerender();
    expect(result.current).toBe('mobile');

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: breakpoints.desktop - 1, configurable: true });
      window.dispatchEvent(new Event('resize'));
    });
    rerender();
    expect(result.current).toBe('tablet');
  });

  it('should optimize resize performance', async () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => 
      useBreakpoint({ 
        onChange,
        debounceDelay: 100 
      })
    );

    // Trigger multiple rapid resize events
    for (let i = 0; i < 10; i++) {
      act(() => {
        Object.defineProperty(window, 'innerWidth', { 
          value: i % 2 === 0 ? breakpoints.mobile : breakpoints.desktop,
          configurable: true 
        });
        window.dispatchEvent(new Event('resize'));
      });
    }

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    // Verify onChange was not called for every resize event
    expect(onChange).toHaveBeenCalledTimes(1);

    // Verify response time
    const startTime = performance.now();
    act(() => {
      Object.defineProperty(window, 'innerWidth', { 
        value: breakpoints.tablet,
        configurable: true 
      });
      window.dispatchEvent(new Event('resize'));
    });
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(500); // Performance requirement
  });

  it('should handle cleanup properly', () => {
    const { unmount } = renderHook(() => useBreakpoint());

    // Verify listeners were added
    expect(window.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
      { passive: true }
    );

    // Unmount and verify cleanup
    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });

  it('should throw error for invalid initialWidth', () => {
    expect(() => {
      renderHook(() => useBreakpoint({ initialWidth: -1 }));
    }).toThrow('initialWidth must be a positive number');
  });

  it('should use ResizeObserver when available', () => {
    const { unmount } = renderHook(() => useBreakpoint());

    // Verify ResizeObserver was used
    expect(ResizeObserverMock.prototype.observe).toHaveBeenCalledWith(
      document.documentElement
    );

    // Verify cleanup
    unmount();
    expect(ResizeObserverMock.prototype.disconnect).toHaveBeenCalled();
  });
});