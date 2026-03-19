import { A11yViolation } from '@/types';

export function getImpactColor(impact: string | null): string {
  switch (impact) {
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'serious':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'moderate':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'minor':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function getImpactLabel(impact: string | null): string {
  switch (impact) {
    case 'critical':
      return 'Kritisch';
    case 'serious':
      return 'Ernst';
    case 'moderate':
      return 'Mittel';
    case 'minor':
      return 'Gering';
    default:
      return 'Unbekannt';
  }
}
