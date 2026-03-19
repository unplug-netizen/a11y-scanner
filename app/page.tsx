'use client';

import { useState, useEffect } from 'react';
import { ScanResult, A11yViolation, FixSuggestion } from '@/types';
import { getImpactColor, getImpactLabel } from '@/lib/helpers';
import { ScanForm } from '@/components/ScanForm';
import { ViolationCard } from '@/components/ViolationCard';
import { ReportDownload } from '@/components/ReportDownload';
import { UserMenu, AuthModal } from '@/components/AuthModal';
import { ScanHistory } from '@/components/ScanHistory';
import { useAuth } from '@/components/AuthProvider';
import { ComplianceBadge } from '@/components/ComplianceBadge';
import { BulkScanModal, BulkScanHistory } from '@/components/BulkScan';
import { ScheduledScanModal } from '@/components/ScheduledScan';
import { ApiKeysModal } from '@/components/ApiKeys';
import { IntegrationsModal } from '@/components/Integrations';
import { DashboardModal } from '@/components/Dashboard';
import { OnboardingModal } from '@/components/Onboarding';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Shield, 
  History, 
  Layers, 
  Zap,
  BarChart3,
  Calendar,
  Key,
  Bell,
  LayoutDashboard,
  Volume2,
  Eye,
  Activity
} from 'lucide-react';
import { Footer } from '@/components/Footer';
import { ScreenReaderModal, ScreenReaderButton } from '@/components/ScreenReader';
import { VisualOverlayModal, VisualOverlayButton } from '@/components/VisualOverlay';
import { RegressionModal, RegressionButton } from '@/components/RegressionTracking';

export default function Home() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBulkScanModal, setShowBulkScanModal] = useState(false);
  const [showScheduledScanModal, setShowScheduledScanModal] = useState(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showScreenReaderModal, setShowScreenReaderModal] = useState(false);
  const [showVisualOverlayModal, setShowVisualOverlayModal] = useState(false);
  const [showRegressionModal, setShowRegressionModal] = useState(false);
  const { isAuthenticated, user, session } = useAuth();

  // Show onboarding for new users
  useEffect(() => {
    if (isAuthenticated) {
      const hasSeenOnboarding = localStorage.getItem('a11y-onboarding-seen');
      const isNewUser = localStorage.getItem('a11y-new-user');
      if (!hasSeenOnboarding && isNewUser === 'true') {
        setShowOnboarding(true);
      }
    }
  }, [isAuthenticated]);

  // Load scan count from localStorage on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(`scanCount_${today}`);
    setScanCount(stored ? parseInt(stored, 10) : 0);
  }, []);

  // Update scan count
  const incrementScanCount = () => {
    const today = new Date().toISOString().split('T')[0];
    const newCount = scanCount + 1;
    localStorage.setItem(`scanCount_${today}`, newCount.toString());
    setScanCount(newCount);
  };

  const handleScan = async (url: string, mode: 'quick' | 'deep') => {
    // Rate limiting: 3 scans/day for non-authenticated users
    const DAILY_LIMIT = 3;
    if (!isAuthenticated && scanCount >= DAILY_LIMIT) {
      setError(`Tageslimit erreicht. Melde dich an für unbegrenzte Scans.`);
      setShowLimitWarning(true);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setShowLimitWarning(false);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Scan fehlgeschlagen');
      }

      setResult(data);
      if (!isAuthenticated) {
        incrementScanCount();
      } else {
        // Save scan to history
        saveScanToHistory(url, data);
      }
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

  const remainingScans = Math.max(0, 3 - scanCount);

  const saveScanToHistory = async (url: string, scanResult: ScanResult) => {
    if (!session?.access_token) return;
    
    try {
      await fetch('/api/scans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url, result: scanResult }),
      });
    } catch (err) {
      console.error('Error saving scan:', err);
    }
  };

  const handleLoadScan = (scanResult: ScanResult) => {
    setResult(scanResult);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with User Menu */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="font-semibold text-gray-900 dark:text-white">A11y Scanner</span>
          </div>
          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <span className="text-sm text-gray-500 hidden sm:block mr-4">
                {remainingScans} von 3 Scans übrig heute
              </span>
            )}
            {isAuthenticated && (
              <>
                <ScreenReaderButton onClick={() => setShowScreenReaderModal(true)} />
                <VisualOverlayButton onClick={() => setShowVisualOverlayModal(true)} />
                <RegressionButton onClick={() => setShowRegressionModal(true)} />
                <button
                  onClick={() => setShowBulkScanModal(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Bulk Scan"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-sm">Bulk</span>
                </button>
                <button
                  onClick={() => setShowScheduledScanModal(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Geplante Scans"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Geplant</span>
                </button>
                <button
                  onClick={() => setShowApiKeysModal(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="API Keys"
                >
                  <Key className="w-4 h-4" />
                  <span className="text-sm">API</span>
                </button>
                <button
                  onClick={() => setShowIntegrationsModal(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Integrationen"
                >
                  <Bell className="w-4 h-4" />
                  <span className="text-sm">Integrationen</span>
                </button>
                <button
                  onClick={() => setShowDashboardModal(true)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Dashboard"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="text-sm">Dashboard</span>
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block" />
              </>
            )}
            <ScanHistory onLoadScan={handleLoadScan} />
            {isAuthenticated && <BulkScanHistory />}
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔍 A11y Scanner
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Überprüfe deine Website auf WCAG-Konformität mit KI-gestützten Fix-Vorschlägen.
          </p>
          {!isAuthenticated && (
            <div className="mt-4">
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Shield className="w-4 h-4" />
                Melde dich an für unbegrenzte Scans & Scan-History
              </button>
            </div>
          )}
          
          {/* Feature Cards for authenticated users */}
          {isAuthenticated && (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <button
                onClick={() => setShowScreenReaderModal(true)}
                className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left"
              >
                <Volume2 className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900">Screen Reader</h3>
                <p className="text-sm text-gray-500 mt-1">Simuliere Screen Reader Erfahrung</p>
              </button>
              <button
                onClick={() => setShowVisualOverlayModal(true)}
                className="p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all text-left"
              >
                <Eye className="w-8 h-8 text-purple-600 mb-3" />
                <h3 className="font-semibold text-gray-900">Visual Overlay</h3>
                <p className="text-sm text-gray-500 mt-1">Screenshot mit markierten Problemen</p>
              </button>
              <button
                onClick={() => setShowRegressionModal(true)}
                className="p-4 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all text-left"
              >
                <Activity className="w-8 h-8 text-green-600 mb-3" />
                <h3 className="font-semibold text-gray-900">Regression Tracking</h3>
                <p className="text-sm text-gray-500 mt-1">Verfolge Änderungen über Zeit</p>
              </button>
              <button
                onClick={() => setShowBulkScanModal(true)}
                className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left"
              >
                <BarChart3 className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900">Bulk Scan</h3>
                <p className="text-sm text-gray-500 mt-1">Bis zu 50 URLs auf einmal scannen</p>
              </button>
              <button
                onClick={() => setShowScheduledScanModal(true)}
                className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left"
              >
                <Calendar className="w-8 h-8 text-green-600 mb-3" />
                <h3 className="font-semibold text-gray-900">Geplante Scans</h3>
                <p className="text-sm text-gray-500 mt-1">Automatisch täglich/wöchentlich/monatlich</p>
              </button>
              <button
                onClick={() => setShowApiKeysModal(true)}
                className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left"
              >
                <Key className="w-8 h-8 text-purple-600 mb-3" />
                <h3 className="font-semibold text-gray-900">Developer API</h3>
                <p className="text-sm text-gray-500 mt-1">API-Key basierter Zugriff</p>
              </button>
            </div>
          )}
        </div>

        {/* Scan Form */}
        <ScanForm onScan={handleScan} loading={loading} disabled={!isAuthenticated && remainingScans === 0} />

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <p className="text-red-700">{error}</p>
              {showLimitWarning && (
                <p className="text-sm text-red-600 mt-1">
                  Erstelle einen kostenlosen Account für unbegrenzte Scans.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-12 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="mt-4 text-gray-600">Website wird analysiert...</p>
            {result?.scanMode === 'deep' && (
              <p className="mt-2 text-sm text-gray-500">
                Deep Scan kann bis zu 2 Minuten dauern...
              </p>
            )}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="mt-12 space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    Scan-Ergebnisse
                  </h2>
                  <p className="text-gray-500 mt-1">{result.url}</p>
                  {result.scanMode && (
                    <div className="flex items-center gap-2 mt-2">
                      {result.scanMode === 'quick' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                          <Zap className="w-3 h-3" />
                          Quick Scan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                          <Layers className="w-3 h-3" />
                          Deep Scan
                        </span>
                      )}
                      {result.pagesScanned && result.pagesScanned > 1 && (
                        <span className="text-xs text-gray-500">
                          ({result.pagesScanned} Seiten geprüft)
                        </span>
                      )}
                    </div>
                  )}
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

            {/* Compliance Badge */}
            {result.compliance && (
              <ComplianceBadge compliance={result.compliance} />
            )}

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

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <BulkScanModal isOpen={showBulkScanModal} onClose={() => setShowBulkScanModal(false)} />
      <ScheduledScanModal isOpen={showScheduledScanModal} onClose={() => setShowScheduledScanModal(false)} />
      <ApiKeysModal isOpen={showApiKeysModal} onClose={() => setShowApiKeysModal(false)} />
      <IntegrationsModal isOpen={showIntegrationsModal} onClose={() => setShowIntegrationsModal(false)} />
      <DashboardModal isOpen={showDashboardModal} onClose={() => setShowDashboardModal(false)} />
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <ScreenReaderModal isOpen={showScreenReaderModal} onClose={() => setShowScreenReaderModal(false)} />
      <VisualOverlayModal isOpen={showVisualOverlayModal} onClose={() => setShowVisualOverlayModal(false)} />
      <RegressionModal isOpen={showRegressionModal} onClose={() => setShowRegressionModal(false)} />

      <Footer />
    </main>
  );
}
