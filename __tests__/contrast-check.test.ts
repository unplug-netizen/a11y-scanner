import { 
  calculateContrastRatio, 
  parseColor, 
  getRelativeLuminance,
  isLargeText,
  suggestContrastColors
} from '../lib/contrast-check';

describe('Contrast Check', () => {
  describe('parseColor', () => {
    it('should parse hex colors', () => {
      expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    });

    it('should parse rgb colors', () => {
      expect(parseColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('rgb(0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('rgb(128, 64, 32)')).toEqual({ r: 128, g: 64, b: 32, a: 1 });
    });

    it('should parse rgba colors', () => {
      expect(parseColor('rgba(255, 255, 255, 0.5)')).toEqual({ r: 255, g: 255, b: 255, a: 0.5 });
      expect(parseColor('rgba(0, 0, 0, 1)')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    });

    it('should parse named colors', () => {
      expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('black')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('red')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });

    it('should return null for invalid colors', () => {
      expect(parseColor('invalid')).toBeNull();
      expect(parseColor('')).toBeNull();
      expect(parseColor('#gggggg')).toBeNull();
    });
  });

  describe('getRelativeLuminance', () => {
    it('should calculate luminance for white', () => {
      expect(getRelativeLuminance(255, 255, 255)).toBeCloseTo(1, 3);
    });

    it('should calculate luminance for black', () => {
      expect(getRelativeLuminance(0, 0, 0)).toBeCloseTo(0, 3);
    });

    it('should calculate luminance for mid-gray', () => {
      const lum = getRelativeLuminance(128, 128, 128);
      expect(lum).toBeGreaterThan(0.2);
      expect(lum).toBeLessThan(0.3);
    });
  });

  describe('calculateContrastRatio', () => {
    it('should return 21:1 for black on white', () => {
      expect(calculateContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    });

    it('should return 1:1 for same colors', () => {
      expect(calculateContrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 1);
      expect(calculateContrastRatio('#000000', '#000000')).toBeCloseTo(1, 1);
    });

    it('should return same ratio regardless of order', () => {
      const ratio1 = calculateContrastRatio('#000000', '#ffffff');
      const ratio2 = calculateContrastRatio('#ffffff', '#000000');
      expect(ratio1).toBeCloseTo(ratio2, 3);
    });

    it('should calculate correct ratio for gray on white', () => {
      const ratio = calculateContrastRatio('#808080', '#ffffff');
      expect(ratio).toBeGreaterThan(3);
      expect(ratio).toBeLessThan(4);
    });

    it('should handle transparency', () => {
      const ratio = calculateContrastRatio('rgba(0, 0, 0, 0.5)', '#ffffff');
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(21);
    });
  });

  describe('isLargeText', () => {
    it('should identify large text correctly', () => {
      expect(isLargeText('24px', 'normal')).toBe(true);
      expect(isLargeText('19px', 'bold')).toBe(true);
      expect(isLargeText('19px', '700')).toBe(true);
    });

    it('should identify normal text correctly', () => {
      expect(isLargeText('16px', 'normal')).toBe(false);
      expect(isLargeText('18px', 'normal')).toBe(false);
      expect(isLargeText('14px', 'normal')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isLargeText('18px', 'bold')).toBe(false); // Just below threshold
      expect(isLargeText('18.5px', 'normal')).toBe(false); // Not bold, needs 24px
    });

    it('should handle different units', () => {
      expect(isLargeText('18pt', 'normal')).toBe(true); // 18pt = 24px
      expect(isLargeText('1.5em', 'normal')).toBe(true); // ~24px if base is 16px
    });
  });

  describe('suggestContrastColors', () => {
    it('should suggest darker color for light text on light background', () => {
      const suggestion = suggestContrastColors('#cccccc', '#ffffff', 4.5);
      expect(suggestion.foreground || suggestion.background).toBeDefined();
    });

    it('should suggest lighter color for dark text on dark background', () => {
      const suggestion = suggestContrastColors('#333333', '#000000', 4.5);
      expect(suggestion.foreground || suggestion.background).toBeDefined();
    });

    it('should return empty object if no suggestion possible', () => {
      // Edge case: extreme colors
      const suggestion = suggestContrastColors('#000000', '#ffffff', 25);
      expect(suggestion).toEqual({});
    });
  });
});
