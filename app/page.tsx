'use client';

import { useState } from 'react';
import { ScanResult, A11yViolation, FixSuggestion } from '@/types';
import { getImpactColor, getImpactLabel } from '@/lib/helpers';
import { ScanForm } from '@/components/ScanForm';
import { ViolationCard } from '@/components/ViolationCard';
import { ReportDownload } from '@/components/ReportDownload';
import { Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function Home() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (url: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Scan fehlgeschlagen');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const criticalCount = result?.violations.filter(v => v.impact === 'critical').length || 0;
  const seriousCount = result?.violations.filter(v => v.impact === 'serious').length || 0;
  const moderateCount = result?.violations.filter(v => v.impact === 'moderate').length || 0;
  const minorCount = result?.violations.filter(v => v.impact === 'minor').length || 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔍 A11y Scanner
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Überprüfe deine Website auf WCAG-Konformität mit KI-gestützten Fix-Vorschlägen.
          </p>
        </div>

        {/* Scan Form */}
        <ScanForm onScan={handleScan} loading={loading} />

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-12 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="mt-4 text-gray-600">Website wird analysiert...</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="mt-12 space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    Scan-Ergebnisse
                  </h2>
                  <p className="text-gray-500 mt-1">{result.url}</p>
                </div>
                <ReportDownload result={result} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                  <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
                  <div className="text-sm text-red-700">Kritisch</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="text-2xl font-bold text-orange-600">{seriousCount}</div>
                  <div className="text-sm text-orange-700">Ernst</div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                  <div className="text-2xl font-bold text-yellow-600">{moderateCount}</div>
                  <div className="text-sm text-yellow-700">Mittel</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="text-2xl font-bold text-blue-600">{minorCount}</div>
                  <div className="text-sm text-blue-700">Gering</div>
                </div>
              </div>

              {/* Success Message */}
              {result.violations.length === 0 && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-green-700">
                    🎉 Keine Verstöße gefunden! Deine Website ist vollständig barrierefrei.
                  </p>
                </div>
              )}
            </div>

            {/* Violations */}
            {result.violations.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Gefundene Verstöße ({result.violations.length})
                </h3>
                
                {result.violations.map((violation) => (
                  <ViolationCard key={violation.id} violation={violation} />
                ))}
              </div>
            )}

            {/* Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Hinweis</p>
                <p>
                  Dieser Scan prüft automatisierte WCAG-Kriterien. Manuelle Prüfungen 
                  (z.B. Tastaturbedienbarkeit, Screenreader-Tests) sind weiterhin erforderlich 
                  für vollständige Konformität.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
