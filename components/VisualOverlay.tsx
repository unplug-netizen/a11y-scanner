'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { VisualOverlayResult, ViolationHighlight } from '@/types';
import { 
  Eye, 
  X, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Download,
  Monitor,
  Smartphone,
  Tablet,
  Image as ImageIcon,
  AlertTriangle,
  Info
} from 'lucide-react';

interface VisualOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  url?: string;
  violations?: any[];
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

const VIEWPORTS: Record<ViewportSize, { width: number; height: number; label: string }> = {
  desktop: { width: 1920, height: 1080, label: 'Desktop (1920×1080)' },
  tablet: { width: 768, height: 1024, label: 'Tablet (768×1024)' },
  mobile: { width: 375, height: 667, label: 'Mobile (375×667)' },
};

export function VisualOverlayModal({ isOpen, onClose, url: initialUrl, violations: initialViolations }: VisualOverlayModalProps) {
  const { session } = useAuth();
  const [url, setUrl] = useState(initialUrl || '');
  const [violations, setViolations] = useState<any[]>(initialViolations || []);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VisualOverlayResult | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<ViolationHighlight | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
    if (initialViolations) setViolations(initialViolations);
  }, [initialUrl, initialViolations]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    if (!url) {
      setError('Bitte gib eine URL ein');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/visual-overlay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({ 
          url, 
          violations: violations.length > 0 ? violations : undefined,
          viewport: VIEWPORTS[viewport]
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Visual Overlay Generierung fehlgeschlagen');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const downloadScreenshot = () => {
    if (!result?.screenshotBase64) return;

    const link = document.createElement('a');
    link.href = `data:image/png;base64,${result.screenshotBase64}`;
    link.download = `a11y-overlay-${viewport}-${new Date().toISOString().split('T')[0]}.png`;
    link.click();
  };

  const getSeverityColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-red-500';
      case 'serious':
        return 'bg-orange-500';
      case 'moderate':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getSeverityTextColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'text-red-600';
      case 'serious':
        return 'text-orange-600';
      case 'moderate':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  const getViewportIcon = (vp: ViewportSize) => {
    switch (vp) {
      case 'desktop':
        return <Monitor className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Visual Overlay
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={downloadScreenshot}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Screenshot herunterladen"
              >
                <Download className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {!result ? (
            <div className="p-6 space-y-6">
              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Viewport Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Viewport
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(VIEWPORTS) as ViewportSize[]).map((vp) => (
                    <button
                      key={vp}
                      onClick={() => setViewport(vp)}
                      className={`flex items-center gap-2 px-4 py-3 border rounded-lg transition-colors ${
                        viewport === vp
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {getViewportIcon(vp)}
                      <span className="text-sm capitalize">{vp}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Info Box */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div className="text-sm text-purple-700 dark:text-purple-400">
                    <p className="font-medium mb-1">Was ist das Visual Overlay?</p>
                    <p>
                      Erstellt einen Screenshot der Website mit markierten Accessibility-Verstößen. 
                      Kritische Probleme werden rot, ernste orange und moderate gelb hervorgehoben.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !url}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Erstelle Overlay...
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    Visual Overlay erstellen
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row">
              {/* Sidebar with highlights */}
              <div className="lg:w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Zusammenfassung</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded">
                      <span className="text-red-700 dark:text-red-400 font-medium">{result.summary.criticalCount}</span>
                      <span className="text-red-600 dark:text-red-500 ml-1">Kritisch</span>
                    </div>
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded">
                      <span className="text-orange-700 dark:text-orange-400 font-medium">{result.summary.seriousCount}</span>
                      <span className="text-orange-600 dark:text-orange-500 ml-1">Ernst</span>
                    </div>
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                      <span className="text-yellow-700 dark:text-yellow-400 font-medium">{result.summary.moderateCount}</span>
                      <span className="text-yellow-600 dark:text-yellow-500 ml-1">Mittel</span>
                    </div>
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                      <span className="text-blue-700 dark:text-blue-400 font-medium">{result.summary.minorCount}</span>
                      <span className="text-blue-600 dark:text-blue-500 ml-1">Gering</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={showHeatmap}
                      onChange={(e) => setShowHeatmap(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Heatmap anzeigen
                  </label>
                </div>

                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Markierungen</h3>
                <div className="space-y-2">
                  {result.highlights.map((highlight, index) => (
                    <button
                      key={highlight.id}
                      onClick={() => setSelectedHighlight(highlight)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedHighlight?.id === highlight.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${getSeverityColor(highlight.type)}`} />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">
                        {highlight.message}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Screenshot */}
              <div className="flex-1 p-4 overflow-auto">
                <div className="relative inline-block">
                  {result.screenshotBase64 ? (
                    <>
                      <img
                        src={`data:image/png;base64,${result.screenshotBase64}`}
                        alt="Visual Overlay"
                        className="max-w-full h-auto rounded-lg shadow-lg"
                      />
                      {showHeatmap && (
                        <div className="absolute inset-0 pointer-events-none">
                          {result.highlights.map((highlight, index) => (
                            <div
                              key={highlight.id}
                              className={`absolute border-2 ${
                                selectedHighlight?.id === highlight.id
                                  ? 'border-white ring-2 ring-purple-500'
                                  : `border-white/80 ${getSeverityColor(highlight.type)}`
                              }`}
                              style={{
                                left: `${(highlight.x / result.viewport.width) * 100}%`,
                                top: `${(highlight.y / result.viewport.height) * 100}%`,
                                width: `${(highlight.width / result.viewport.width) * 100}%`,
                                height: `${(highlight.height / result.viewport.height) * 100}%`,
                              }}
                            >
                              <span className={`absolute -top-5 left-0 px-1.5 py-0.5 text-xs font-bold text-white rounded ${getSeverityColor(highlight.type)}`}>
                                {index + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <div className="text-center">
                        <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 dark:text-gray-400">Kein Screenshot verfügbar</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Highlight Details */}
                {selectedHighlight && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-3">
                      <span className={`w-4 h-4 rounded-full mt-0.5 ${getSeverityColor(selectedHighlight.type)}`} />
                      <div className="flex-1">
                        <p className={`font-medium ${getSeverityTextColor(selectedHighlight.type)}`}>
                          {selectedHighlight.type === 'critical' ? 'Kritisch' :
                           selectedHighlight.type === 'serious' ? 'Ernst' :
                           selectedHighlight.type === 'moderate' ? 'Mittel' : 'Gering'}
                        </p>
                        <p className="text-gray-700 dark:text-gray-300 mt-1">{selectedHighlight.message}</p>
                        {selectedHighlight.helpUrl && (
                          <a
                            href={selectedHighlight.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-purple-600 hover:text-purple-700 mt-2 inline-block"
                          >
                            Mehr erfahren →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Button component for the dashboard
interface VisualOverlayButtonProps {
  onClick: () => void;
  className?: string;
}

export function VisualOverlayButton({ onClick, className = '' }: VisualOverlayButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${className}`}
      title="Visual Overlay"
    >
      <Eye className="w-4 h-4" />
      <span className="text-sm hidden sm:inline">Visual Overlay</span>
    </button>
  );
}

// Feature Card for the dashboard
interface VisualOverlayFeatureCardProps {
  onClick: () => void;
}

export function VisualOverlayFeatureCard({ onClick }: VisualOverlayFeatureCardProps) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md transition-all text-left w-full"
    >
      <Eye className="w-8 h-8 text-purple-600 mb-3" />
      <h3 className="font-semibold text-gray-900 dark:text-white">Visual Overlay</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Screenshot mit markierten Accessibility-Problemen
      </p>
    </button>
  );
}
