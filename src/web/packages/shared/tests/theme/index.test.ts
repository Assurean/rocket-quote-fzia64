import { describe, it, expect } from '@jest/globals'; // v29+
import chroma from 'chroma-js'; // v2.4+
import { calculateContrastRatio } from 'wcag-contrast'; // v3.0.0
import { theme } from '../../src/theme';

// WCAG 2.1 AA minimum contrast ratios
const WCAG_CONTRAST_RATIOS = {
  NORMAL_TEXT: 4.5,
  LARGE_TEXT: 3.0
};

describe('Theme Configuration', () => {
  // Color System Tests
  describe('Color System', () => {
    it('should have correct insurance vertical colors', () => {
      // Verify primary colors for each vertical
      expect(theme.colors.verticals.auto.primary).toBe('#1976D2');
      expect(theme.colors.verticals.home.primary).toBe('#2E7D32');
      expect(theme.colors.verticals.health.primary).toBe('#D32F2F');
      expect(theme.colors.verticals.life.primary).toBe('#7B1FA2');
      expect(theme.colors.verticals.renters.primary).toBe('#00796B');
      expect(theme.colors.verticals.commercial.primary).toBe('#283593');

      // Test contrast ratios against white background
      Object.values(theme.colors.verticals).forEach(vertical => {
        const contrastRatio = calculateContrastRatio(vertical.primary, '#FFFFFF');
        expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_CONTRAST_RATIOS.NORMAL_TEXT);
      });

      // Verify light/dark variants exist for each vertical
      Object.values(theme.colors.verticals).forEach(vertical => {
        expect(vertical).toHaveProperty('light');
        expect(vertical).toHaveProperty('dark');
        expect(vertical).toHaveProperty('contrast');
      });
    });

    it('should have accessible feedback colors', () => {
      const feedbackStates = ['success', 'error', 'warning', 'info'];
      feedbackStates.forEach(state => {
        const color = theme.colors.feedback[state].main;
        const contrast = theme.colors.feedback[state].contrast;
        const contrastRatio = calculateContrastRatio(color, contrast);
        expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_CONTRAST_RATIOS.NORMAL_TEXT);
      });
    });

    it('should have proper UI color hierarchy', () => {
      const { text, background } = theme.colors.ui;
      // Test text color contrast ratios
      expect(calculateContrastRatio(text.primary, background))
        .toBeGreaterThanOrEqual(WCAG_CONTRAST_RATIOS.NORMAL_TEXT);
      expect(calculateContrastRatio(text.secondary, background))
        .toBeGreaterThanOrEqual(WCAG_CONTRAST_RATIOS.NORMAL_TEXT);
    });
  });

  // Typography System Tests
  describe('Typography System', () => {
    it('should have correct font family configuration', () => {
      const systemFonts = [
        '-apple-system',
        'BlinkMacSystemFont',
        "'Segoe UI'",
        'Roboto',
        "'Helvetica Neue'",
        'Arial'
      ];
      
      systemFonts.forEach(font => {
        expect(theme.typography.fontFamily).toContain(font);
      });
    });

    it('should have correct font weights', () => {
      const weights = [400, 500, 700];
      const variants = ['body1', 'body2', 'button', 'h1', 'h2', 'h3'];
      
      variants.forEach(variant => {
        expect(weights).toContain(theme.typography[variant].fontWeight);
      });
    });

    it('should have correct base font size and scaling', () => {
      expect(theme.typography.fontSize).toBe(16);
      expect(theme.typography.htmlFontSize).toBe(16);
      expect(theme.typography.body1.fontSize).toBe('1rem');
      expect(theme.typography.h1.fontSize).toBe('2.25rem');
    });

    it('should have proper line heights', () => {
      expect(theme.typography.body1.lineHeight).toBe(1.5);
      expect(theme.typography.body2.lineHeight).toBe(1.5);
      expect(theme.typography.h1.lineHeight).toBe(1.25);
    });
  });

  // Spacing System Tests
  describe('Spacing System', () => {
    it('should follow 8px grid system', () => {
      expect(theme.spacing.base).toBe(8);
    });

    it('should have correct margin scale', () => {
      const marginScale = theme.spacing.margin;
      expect(marginScale.none).toBe('0');
      expect(marginScale.xs).toBe('8px');
      expect(marginScale.sm).toBe('16px');
      expect(marginScale.md).toBe('24px');
      expect(marginScale.lg).toBe('32px');
      expect(marginScale.xl).toBe('40px');
    });

    it('should have correct padding scale', () => {
      const paddingScale = theme.spacing.padding;
      expect(paddingScale.none).toBe('0');
      expect(paddingScale.xs).toBe('8px');
      expect(paddingScale.sm).toBe('16px');
      expect(paddingScale.md).toBe('24px');
      expect(paddingScale.lg).toBe('32px');
    });
  });

  // Breakpoint System Tests
  describe('Breakpoint System', () => {
    it('should have correct breakpoint values', () => {
      expect(theme.breakpoints.mobile).toBe(0);
      expect(theme.breakpoints.tablet).toBe(768);
      expect(theme.breakpoints.desktop).toBe(1024);
    });

    it('should generate correct media queries', () => {
      expect(theme.mediaQueries.mobile).toBe('@media (max-width: 767px)');
      expect(theme.mediaQueries.tablet).toBe('@media (min-width: 768px) and (max-width: 1023px)');
      expect(theme.mediaQueries.desktop).toBe('@media (min-width: 1024px)');
      expect(theme.mediaQueries.tabletUp).toBe('@media (min-width: 768px)');
      expect(theme.mediaQueries.desktopUp).toBe('@media (min-width: 1024px)');
    });

    it('should not have overlapping breakpoints', () => {
      const breakpoints = Object.values(theme.breakpoints);
      for (let i = 1; i < breakpoints.length; i++) {
        expect(breakpoints[i]).toBeGreaterThan(breakpoints[i - 1]);
      }
    });
  });
});