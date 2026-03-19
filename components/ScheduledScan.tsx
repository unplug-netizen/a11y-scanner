'use client';

import { useState, useEffect } from 'react';
import { ScheduledScan, TrendAnalysis } from '@/types';
import { useAuth } from './AuthProvider';
import { 
  Calendar, 
  Clock, 
  X, 
  Plus, 
  Trash2, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Mail,
  Bell,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface ScheduledScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduledScanModal({ isOpen, onClose }: ScheduledScanModalProps) {
  const { session } = useAuth();
  const [scans, setScans] = useState<ScheduledScan[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedScan, setSelectedScan] = useState<ScheduledScan | null>(null);

  const loadScans = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/scheduled-scan', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setScans(data.scheduledScans || []);
      }
    } catch (error) {
      console.error('Error loading scheduled scans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadScans();
    }
  }, [isOpen]);

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

  const deleteScan = async (id: string) => {
    if (!session?.access_token) return;
    if (!confirm('Möchtest du diesen geplanten Scan wirklich löschen?')) return;

    try {
      const response = await fetch(`/api/scheduled-scan?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setScans(scans.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Error deleting scheduled scan:', error);
    }
  };

  const toggleActive = async (scan: ScheduledScan) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/scheduled-scan?id=${scan.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ isActive: !scan.isActive }),
      });

      if (response.ok) {
        const data = await response.json();
        setScans(scans.map(s => s.id === scan.id ? data.scheduledScan : s));
      }
    } catch (error) {
      console.error('Error updating scheduled scan:', error);
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Geplante Scans</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neu
            </button>
            <button
              onClick={loadScans}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {showCreateForm ? (
            <CreateScheduledScanForm 
              onCancel={() => setShowCreateForm(false)}
              onSuccess={() => {
                setShowCreateForm(false);
                loadScans();
              }}
            />
          ) : selectedScan ? (
            <ScheduledScanDetail 
              scan={selectedScan}
              onBack={() => setSelectedScan(null)}
            />
          ) : scans.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine geplanten Scans</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Ersten Scan planen
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {scans.map((scan) => (
                <div 
                  key={scan.id} 
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    scan.isActive ? 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:bg-gray-700' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 opacity-75'
                  }`}
                  onClick={() => setSelectedScan(scan)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{scan.name}</h3>
                        {!scan.isActive && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            Pausiert
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{scan.url}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {scan.frequency === 'daily' ? 'Täglich' :
                           scan.frequency === 'weekly' ? 'Wöchentlich' :
                           'Monatlich'}
                        </span>
                        {scan.nextScanAt && (
                          <span>Nächster: {new Date(scan.nextScanAt).toLocaleDateString()}</span>
                        )}
                        {scan.emailNotifications && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            Email
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive(scan);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          scan.isActive 
                            ? 'hover:bg-yellow-100 text-yellow-600' 
                            : 'hover:bg-green-100 text-green-600'
                        }`}
                        title={scan.isActive ? 'Pausieren' : 'Aktivieren'}
                      >
                        {scan.isActive ? <Bell className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteScan(scan.id);
                        }}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Löschen"
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
      </div>
    </div>
  );
}

function CreateScheduledScanForm({ 
  onCancel, 
  onSuccess 
}: { 
  onCancel: () => void; 
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [notifyOnNewIssuesOnly, setNotifyOnNewIssuesOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scheduled-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          url,
          frequency,
          emailNotifications,
          notifyOnNewIssuesOnly,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create scheduled scan');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-medium text-gray-900">Neuen geplanten Scan erstellen</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Homepage Check"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Häufigkeit</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="daily">Täglich</option>
          <option value="weekly">Wöchentlich</option>
          <option value="monthly">Monatlich</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Email-Benachrichtigungen</span>
        </label>

        {emailNotifications && (
          <label className="flex items-center gap-2 ml-6">
            <input
              type="checkbox"
              checked={notifyOnNewIssuesOnly}
              onChange={(e) => setNotifyOnNewIssuesOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Nur bei neuen Issues benachrichtigen</span>
          </label>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Wird erstellt...
            </>
          ) : (
            'Erstellen'
          )}
        </button>
      </div>
    </form>
  );
}

function ScheduledScanDetail({ 
  scan, 
  onBack 
}: { 
  scan: ScheduledScan; 
  onBack: () => void;
}) {
  const { session } = useAuth();
  const [trend, setTrend] = useState<TrendAnalysis | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDetailData();
  }, [scan.id]);

  const loadDetailData = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    try {
      // Load trend
      const trendResponse = await fetch(`/api/scheduled-scan?id=${scan.id}&trend=true`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (trendResponse.ok) {
        const trendData = await trendResponse.json();
        setTrend(trendData.analysis);
      }

      // Load history
      const historyResponse = await fetch(`/api/scheduled-scan?id=${scan.id}&history=true`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setHistory(historyData.history || []);
      }
    } catch (error) {
      console.error('Error loading detail data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-blue-600 hover:text-blue-700 font-medium"
      >
        ← Zurück zur Übersicht
      </button>

      <div>
        <h3 className="text-lg font-semibold text-gray-900">{scan.name}</h3>
        <p className="text-gray-500">{scan.url}</p>
      </div>

      {trend && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Trend-Analyse
          </h4>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              trend.trend === 'improving' ? 'bg-green-100 text-green-700' :
              trend.trend === 'worsening' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {trend.trend === 'improving' ? <TrendingUp className="w-5 h-5" /> :
               trend.trend === 'worsening' ? <TrendingDown className="w-5 h-5" /> :
               <Minus className="w-5 h-5" />}
              <span className="font-medium">
                {trend.trend === 'improving' ? 'Verbessernd' :
                 trend.trend === 'worsening' ? 'Verschlechternd' :
                 'Stabil'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Veränderung: {trend.totalChange > 0 ? '+' : ''}{trend.totalChange} Verstöße
            </div>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-medium text-gray-900 mb-3">Scan-Verlauf</h4>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-500">Noch keine Scans durchgeführt</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(h.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {h.violation_count} Verstöße
                    {h.new_violations?.length > 0 && (
                      <span className="text-red-600 ml-2">
                        (+{h.new_violations.length} neu)
                      </span>
                    )}
                    {h.fixed_violations?.length > 0 && (
                      <span className="text-green-600 ml-2">
                        ({h.fixed_violations.length} behoben)
                      </span>
                    )}
                  </p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
