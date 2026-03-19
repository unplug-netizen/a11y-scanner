'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { RegressionAnalysis, URLTrackingStatus, A11yViolation } from '@/types';
import { 
  TrendingUp, 
  TrendingDown, 
  X, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Plus,
  Trash2,
  Bell,
  History,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ExternalLink,
  RefreshCw,
  BarChart3,
  Info
} from 'lucide-react';

interface RegressionModalProps {
  isOpen: boolean;
  onClose: () => void;
  url?: string;
}

export function RegressionModal({ isOpen, onClose, url: initialUrl }: RegressionModalProps) {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'tracked' | 'history' | 'alerts'>('tracked');
  const [trackedUrls, setTrackedUrls] = useState<URLTrackingStatus[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [urlHistory, setUrlHistory] = useState<any[]>([]);
  const [trendAnalysis, setTrendAnalysis] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [showAddUrl, setShowAddUrl] = useState(false);

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
      loadTrackedUrls();
      loadAlerts();
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (initialUrl) {
      setNewUrl(initialUrl);
    }
  }, [initialUrl]);

  const loadTrackedUrls = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/regression?action=tracked-urls', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTrackedUrls(data.trackedUrls || []);
      }
    } catch (error) {
      console.error('Error loading tracked URLs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUrlHistory = async (url: string) => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const [historyRes, trendRes] = await Promise.all([
        fetch(`/api/regression?action=history&url=${encodeURIComponent(url)}&days=30`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch(`/api/regression?action=trend&url=${encodeURIComponent(url)}&days=30`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
      ]);

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setUrlHistory(historyData.history || []);
      }

      if (trendRes.ok) {
        const trendData = await trendRes.json();
        setTrendAnalysis(trendData);
      }

      setSelectedUrl(url);
    } catch (error) {
      console.error('Error loading URL history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch('/api/regression?action=alerts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const startTracking = async () => {
    if (!newUrl || !session?.access_token) return;

    setLoading(true);
    try {
      const response = await fetch('/api/regression', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'start-tracking',
          url: newUrl,
        }),
      });

      if (response.ok) {
        setNewUrl('');
        setShowAddUrl(false);
        loadTrackedUrls();
      } else {
        const data = await response.json();
        setError(data.error || 'Fehler beim Hinzufügen');
      }
    } catch (error) {
      setError('Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const stopTracking = async (url: string) => {
    if (!session?.access_token) return;
    if (!confirm('Möchtest du die Überwachung dieser URL wirklich beenden?')) return;

    setLoading(true);
    try {
      const response = await fetch('/api/regression', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'stop-tracking',
          url,
        }),
      });

      if (response.ok) {
        loadTrackedUrls();
        if (selectedUrl === url) {
          setSelectedUrl(null);
        }
      }
    } catch (error) {
      console.error('Error stopping tracking:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAlertAsRead = async (alertId: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/regression', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ alertId }),
      });

      if (response.ok) {
        loadAlerts();
      }
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving':
        return <TrendingDown className="w-4 h-4 text-green-600" />;
      case 'worsening':
        return <TrendingUp className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'improving':
        return 'text-green-600';
      case 'worsening':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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
            <Activity className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Regression Tracking
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadTrackedUrls();
                loadAlerts();
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex gap-6">
            {[
              { id: 'tracked', label: 'Überwachte URLs', count: trackedUrls.length },
              { id: 'history', label: 'Verlauf', count: null },
              { id: 'alerts', label: 'Alerts', count: alerts.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSelectedUrl(null);
                }}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600 dark:text-green-400'
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

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === 'tracked' && (
            <div className="p-6">
              {/* Add URL Button */}
              <div className="mb-6">
                {!showAddUrl ? (
                  <button
                    onClick={() => setShowAddUrl(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    URL überwachen
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      onClick={startTracking}
                      disabled={loading || !newUrl}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hinzufügen'}
                    </button>
                    <button
                      onClick={() => setShowAddUrl(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
              </div>

              {/* Tracked URLs List */}
              {trackedUrls.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Keine URLs überwacht</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Füge URLs hinzu, um Änderungen über Zeit zu verfolgen.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trackedUrls.map((urlStatus) => (
                    <div
                      key={urlStatus.urlHash}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-300 dark:hover:border-green-600 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                              {urlStatus.url}
                            </h3>
                            {urlStatus.trendDirection && (
                              <span className={`flex items-center gap-1 text-xs ${getTrendColor(urlStatus.trendDirection)}`}>
                                {getTrendIcon(urlStatus.trendDirection)}
                                {urlStatus.trendPercentage && `${urlStatus.trendPercentage}%`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>{urlStatus.totalScans} Scans</span>
                            {urlStatus.lastScanAt && (
                              <span>Letzter: {new Date(urlStatus.lastScanAt).toLocaleDateString()}</span>
                            )}
                            {urlStatus.lastViolationCount !== undefined && (
                              <span className={urlStatus.lastViolationCount === 0 ? 'text-green-600' : 'text-red-600'}>
                                {urlStatus.lastViolationCount} Verstöße
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => loadUrlHistory(urlStatus.url)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Verlauf anzeigen"
                          >
                            <History className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => stopTracking(urlStatus.url)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Überwachung beenden"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-6">
              {!selectedUrl ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Wähle eine URL</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Gehe zu "Überwachte URLs" und wähle eine URL aus, um den Verlauf zu sehen.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <button
                      onClick={() => setSelectedUrl(null)}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      ← Zurück
                    </button>
                    <h3 className="font-medium text-gray-900 dark:text-white">{selectedUrl}</h3>
                  </div>

                  {trendAnalysis && (
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Trend (30 Tage)</p>
                          <div className="flex items-center gap-2 mt-1">
                            {trendAnalysis.trend === 'improving' ? (
                              <>
                                <TrendingDown className="w-5 h-5 text-green-600" />
                                <span className="text-lg font-medium text-green-600">Verbessernd</span>
                              </>
                            ) : trendAnalysis.trend === 'worsening' ? (
                              <>
                                <TrendingUp className="w-5 h-5 text-red-600" />
                                <span className="text-lg font-medium text-red-600">Verschlechternd</span>
                              </>
                            ) : (
                              <>
                                <Minus className="w-5 h-5 text-gray-600" />
                                <span className="text-lg font-medium text-gray-600">Stabil</span>
                              </>
                            )}
                          </div>
                        </div>
                        {trendAnalysis.totalChange !== undefined && (
                          <div className="text-right">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Veränderung</p>
                            <p className={`text-lg font-medium ${
                              trendAnalysis.totalChange < 0 ? 'text-green-600' : 
                              trendAnalysis.totalChange > 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {trendAnalysis.totalChange > 0 ? '+' : ''}{trendAnalysis.totalChange} Verstöße
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {urlHistory.length === 0 ? (
                    <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                      Kein Verlauf verfügbar
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {urlHistory.map((scan, index) => (
                        <div
                          key={scan.id || index}
                          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(scan.createdAt || scan.date).toLocaleString()}
                              </p>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-sm">
                                  <span className="text-gray-500">Verstöße:</span>{' '}
                                  <span className={scan.violationCount === 0 ? 'text-green-600' : 'text-red-600'}>
                                    {scan.violationCount}
                                  </span>
                                </span>
                                {scan.criticalCount !== undefined && (
                                  <span className="text-sm text-red-600">
                                    {scan.criticalCount} Kritisch
                                  </span>
                                )}
                              </div>
                            </div>
                            {index < urlHistory.length - 1 && (
                              <div className="flex items-center gap-1">
                                {scan.violationCount < urlHistory[index + 1].violationCount ? (
                                  <>
                                    <ArrowDownRight className="w-4 h-4 text-green-600" />
                                    <span className="text-sm text-green-600">
                                      -{urlHistory[index + 1].violationCount - scan.violationCount}
                                    </span>
                                  </>
                                ) : scan.violationCount > urlHistory[index + 1].violationCount ? (
                                  <>
                                    <ArrowUpRight className="w-4 h-4 text-red-600" />
                                    <span className="text-sm text-red-600">
                                      +{scan.violationCount - urlHistory[index + 1].violationCount}
                                    </span>
                                  </>
                                ) : (
                                  <Minus className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="p-6">
              {alerts.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Keine Alerts</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Du wirst benachrichtigt, wenn sich die Anzahl der Verstöße signifikant ändert.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 border rounded-lg ${
                        alert.type === 'improvement' 
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {alert.type === 'improvement' ? (
                              <TrendingDown className="w-4 h-4 text-green-600" />
                            ) : (
                              <TrendingUp className="w-4 h-4 text-red-600" />
                            )}
                            <span className={`font-medium ${
                              alert.type === 'improvement' ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'
                            }`}>
                              {alert.type === 'improvement' ? 'Verbesserung erkannt' : 'Regression erkannt'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{alert.url}</p>
                          <p className="text-sm mt-2">{alert.message}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {new Date(alert.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => markAlertAsRead(alert.id)}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Als gelesen markieren"
                        >
                          <CheckCircle className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Button component for the dashboard
interface RegressionButtonProps {
  onClick: () => void;
  className?: string;
}

export function RegressionButton({ onClick, className = '' }: RegressionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${className}`}
      title="Regression Tracking"
    >
      <Activity className="w-4 h-4" />
      <span className="text-sm hidden sm:inline">Regression</span>
    </button>
  );
}

// Feature Card for the dashboard
interface RegressionFeatureCardProps {
  onClick: () => void;
}

export function RegressionFeatureCard({ onClick }: RegressionFeatureCardProps) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-300 dark:hover:border-green-600 hover:shadow-md transition-all text-left w-full"
    >
      <Activity className="w-8 h-8 text-green-600 mb-3" />
      <h3 className="font-semibold text-gray-900 dark:text-white">Regression Tracking</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Verfolge Accessibility-Änderungen über Zeit
      </p>
    </button>
  );
}
