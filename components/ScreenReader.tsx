'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { ScreenReaderResult, ARIAIssue, MissingLabel, EmptyHeading, LinkIssue } from '@/types';
import { 
  Volume2, 
  X, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Play,
  StopCircle,
  FileText,
  Download
} from 'lucide-react';

interface ScreenReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  url?: string;
}

export function ScreenReaderModal({ isOpen, onClose, url: initialUrl }: ScreenReaderModalProps) {
  const { session } = useAuth();
  const [url, setUrl] = useState(initialUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreenReaderResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'aria' | 'headings' | 'forms' | 'links'>('overview');
  const [simulationActive, setSimulationActive] = useState(false);
  const [currentElementIndex, setCurrentElementIndex] = useState(0);

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
    }
  }, [initialUrl]);

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
      const response = await fetch('/api/screen-reader', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Screen-Reader-Analyse fehlgeschlagen');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const startSimulation = () => {
    setSimulationActive(true);
    setCurrentElementIndex(0);
  };

  const stopSimulation = () => {
    setSimulationActive(false);
    setCurrentElementIndex(0);
  };

  const downloadReport = () => {
    if (!result) return;

    const report = {
      url: result.url,
      timestamp: result.timestamp,
      screenReaderScore: result.screenReaderScore,
      summary: result.summary,
      ariaIssues: result.ariaIssues,
      missingLabels: result.missingLabels,
      emptyHeadings: result.emptyHeadings,
      headingStructureIssues: result.headingStructureIssues,
      formIssues: result.formIssues,
      linkIssues: result.linkIssues,
      landmarkIssues: result.landmarkIssues,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `screen-reader-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    if (score >= 40) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
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
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Screen Reader Simulation
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={downloadReport}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Report herunterladen"
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
                  URL analysieren
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Info Box */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-400">
                    <p className="font-medium mb-1">Was wird analysiert?</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>ARIA-Attribute und ihre korrekte Verwendung</li>
                      <li>Fehlende Labels bei Formularfeldern</li>
                      <li>Überschriftenstruktur (H1-H6)</li>
                      <li>Leere oder generische Links</li>
                      <li>Landmark-Regionen (header, nav, main, etc.)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !url}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analysiere...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    Screen Reader Analyse starten
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Score Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">URL</p>
                    <p className="font-medium text-gray-900 dark:text-white">{result.url}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-lg ${getScoreBg(result.screenReaderScore)}`}>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Score</span>
                    <div className={`text-3xl font-bold ${getScoreColor(result.screenReaderScore)}`}>
                      {result.screenReaderScore}%
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <StatBox 
                    label="Kritisch" 
                    value={result.summary.criticalCount} 
                    color="text-red-600" 
                  />
                  <StatBox 
                    label="Warnungen" 
                    value={result.summary.warningCount} 
                    color="text-yellow-600" 
                  />
                  <StatBox 
                    label="Info" 
                    value={result.summary.infoCount} 
                    color="text-blue-600" 
                  />
                  <StatBox 
                    label="Gesamt" 
                    value={result.summary.totalIssues} 
                    color="text-gray-600" 
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex overflow-x-auto">
                  {[
                    { id: 'overview', label: 'Übersicht', count: null },
                    { id: 'aria', label: 'ARIA', count: result.ariaIssues.length },
                    { id: 'headings', label: 'Überschriften', count: result.emptyHeadings.length + result.headingStructureIssues.length },
                    { id: 'forms', label: 'Formulare', count: result.missingLabels.length + result.formIssues.length },
                    { id: 'links', label: 'Links', count: result.linkIssues.length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {tab.label}
                      {tab.count !== null && tab.count > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <OverviewTab result={result} />
                )}
                {activeTab === 'aria' && (
                  <ARIATab issues={result.ariaIssues} />
                )}
                {activeTab === 'headings' && (
                  <HeadingsTab 
                    emptyHeadings={result.emptyHeadings} 
                    structureIssues={result.headingStructureIssues} 
                  />
                )}
                {activeTab === 'forms' && (
                  <FormsTab 
                    missingLabels={result.missingLabels} 
                    formIssues={result.formIssues} 
                  />
                )}
                {activeTab === 'links' && (
                  <LinksTab issues={result.linkIssues} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function OverviewTab({ result }: { result: ScreenReaderResult }) {
  return (
    <div className="space-y-6">
      {/* Landmark Issues */}
      {result.landmarkIssues.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Landmark-Struktur</h3>
          <div className="space-y-2">
            {result.landmarkIssues.map((issue, index) => (
              <div 
                key={index} 
                className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
              >
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">{issue.issue}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">{issue.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <QuickStat 
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          label="ARIA-Attribute"
          value={result.ariaIssues.length === 0 ? 'Keine Probleme' : `${result.ariaIssues.length} Probleme`}
          status={result.ariaIssues.length === 0 ? 'good' : 'warning'}
        />
        <QuickStat 
          icon={<FileText className="w-5 h-5 text-blue-600" />}
          label="Überschriften"
          value={result.emptyHeadings.length === 0 ? 'OK' : `${result.emptyHeadings.length} leer`}
          status={result.emptyHeadings.length === 0 ? 'good' : 'warning'}
        />
        <QuickStat 
          icon={<AlertCircle className="w-5 h-5 text-orange-600" />}
          label="Formular-Labels"
          value={result.missingLabels.length === 0 ? 'Vollständig' : `${result.missingLabels.length} fehlend`}
          status={result.missingLabels.length === 0 ? 'good' : 'warning'}
        />
        <QuickStat 
          icon={<Eye className="w-5 h-5 text-purple-600" />}
          label="Link-Texte"
          value={result.linkIssues.length === 0 ? 'Beschreibend' : `${result.linkIssues.length} Probleme`}
          status={result.linkIssues.length === 0 ? 'good' : 'warning'}
        />
      </div>
    </div>
  );
}

function QuickStat({ 
  icon, 
  label, 
  value, 
  status 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  status: 'good' | 'warning' | 'error';
}) {
  const statusColors = {
    good: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  return (
    <div className={`p-4 border rounded-lg ${statusColors[status]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <p className="font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function ARIATab({ issues }: { issues: ARIAIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Keine ARIA-Probleme gefunden!</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Alle ARIA-Attribute sind korrekt verwendet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue, index) => (
        <div 
          key={index} 
          className={`p-4 border rounded-lg ${
            issue.severity === 'critical' 
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
              : issue.severity === 'warning'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className="flex items-start gap-3">
            {issue.severity === 'critical' ? (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            ) : issue.severity === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">{issue.issue}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{issue.suggestion}</p>
              <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                {issue.html.substring(0, 200)}{issue.html.length > 200 ? '...' : ''}
              </code>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HeadingsTab({ 
  emptyHeadings, 
  structureIssues 
}: { 
  emptyHeadings: EmptyHeading[]; 
  structureIssues: any[];
}) {
  const hasIssues = emptyHeadings.length > 0 || structureIssues.length > 0;

  if (!hasIssues) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Überschriftenstruktur ist korrekt!</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Alle Überschriften sind korrekt hierarchisch angeordnet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {emptyHeadings.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Leere Überschriften</h3>
          <div className="space-y-2">
            {emptyHeadings.map((heading, index) => (
              <div 
                key={index} 
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 text-xs font-medium rounded">
                    H{heading.level}
                  </span>
                  <span className="text-sm text-red-800 dark:text-red-400">Leere Überschrift gefunden</span>
                </div>
                <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300">
                  {heading.html.substring(0, 150)}{heading.html.length > 150 ? '...' : ''}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {structureIssues.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Struktur-Probleme</h3>
          <div className="space-y-2">
            {structureIssues.map((issue, index) => (
              <div 
                key={index} 
                className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
              >
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">{issue.issue}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">{issue.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FormsTab({ 
  missingLabels, 
  formIssues 
}: { 
  missingLabels: MissingLabel[]; 
  formIssues: any[];
}) {
  const hasIssues = missingLabels.length > 0 || formIssues.length > 0;

  if (!hasIssues) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Alle Formularfelder sind korrekt beschriftet!</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Alle Eingabefelder haben zugeordnete Labels.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {missingLabels.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Fehlende Labels</h3>
          <div className="space-y-2">
            {missingLabels.map((label, index) => (
              <div 
                key={index} 
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800 dark:text-red-400">
                    {label.element} ohne Label
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Kontext: {label.context}</p>
                <code className="block p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                  {label.html.substring(0, 200)}{label.html.length > 200 ? '...' : ''}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {formIssues.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Weitere Formular-Probleme</h3>
          <div className="space-y-2">
            {formIssues.map((issue, index) => (
              <div 
                key={index} 
                className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
              >
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">{issue.issue}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-500 mt-1">{issue.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LinksTab({ issues }: { issues: LinkIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Alle Links sind beschreibend!</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Keine leeren oder generischen Link-Texte gefunden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue, index) => (
        <div 
          key={index} 
          className={`p-4 border rounded-lg ${
            issue.issue === 'empty' 
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          }`}
        >
          <div className="flex items-start gap-3">
            {issue.issue === 'empty' ? (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                {issue.issue === 'empty' ? 'Leerer Link' : 
                 issue.issue === 'generic' ? 'Generischer Link-Text' : 'Unklarer Kontext'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Text: "{issue.text || '(leer)'}"
              </p>
              <code className="block mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                {issue.html.substring(0, 200)}{issue.html.length > 200 ? '...' : ''}
              </code>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Button component for the dashboard
interface ScreenReaderButtonProps {
  onClick: () => void;
  className?: string;
}

export function ScreenReaderButton({ onClick, className = '' }: ScreenReaderButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${className}`}
      title="Screen Reader Simulation"
    >
      <Volume2 className="w-4 h-4" />
      <span className="text-sm hidden sm:inline">Screen Reader</span>
    </button>
  );
}

// Feature Card for the dashboard
interface ScreenReaderFeatureCardProps {
  onClick: () => void;
}

export function ScreenReaderFeatureCard({ onClick }: ScreenReaderFeatureCardProps) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all text-left w-full"
    >
      <Volume2 className="w-8 h-8 text-blue-600 mb-3" />
      <h3 className="font-semibold text-gray-900 dark:text-white">Screen Reader</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Simuliere Screen Reader Erfahrung und finde ARIA-Probleme
      </p>
    </button>
  );
}
