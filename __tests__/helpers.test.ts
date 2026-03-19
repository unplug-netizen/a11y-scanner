import { getImpactColor, getImpactLabel } from '../lib/helpers';

describe('helpers', () => {
  describe('getImpactColor', () => {
    it('returns correct color for critical impact', () => {
      const result = getImpactColor('critical');
      expect(result).toContain('red');
    });

    it('returns correct color for serious impact', () => {
      const result = getImpactColor('serious');
      expect(result).toContain('orange');
    });

    it('returns correct color for moderate impact', () => {
      const result = getImpactColor('moderate');
      expect(result).toContain('yellow');
    });

    it('returns correct color for minor impact', () => {
      const result = getImpactColor('minor');
      expect(result).toContain('blue');
    });

    it('returns default color for null impact', () => {
      const result = getImpactColor(null);
      expect(result).toContain('gray');
    });

    it('returns default color for unknown impact', () => {
      const result = getImpactColor('unknown');
      expect(result).toContain('gray');
    });
  });

  describe('getImpactLabel', () => {
    it('returns correct label for critical impact', () => {
      expect(getImpactLabel('critical')).toBe('Kritisch');
    });

    it('returns correct label for serious impact', () => {
      expect(getImpactLabel('serious')).toBe('Ernst');
    });

    it('returns correct label for moderate impact', () => {
      expect(getImpactLabel('moderate')).toBe('Mittel');
    });

    it('returns correct label for minor impact', () => {
      expect(getImpactLabel('minor')).toBe('Gering');
    });

    it('returns default label for null impact', () => {
      expect(getImpactLabel(null)).toBe('Unbekannt');
    });

    it('returns default label for unknown impact', () => {
      expect(getImpactLabel('unknown')).toBe('Unbekannt');
    });
  });
});
