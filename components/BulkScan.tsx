'use client';

import { useState, useCallback } from 'react';
import { BulkScanResult, AggregateReport } from '@/types';
import { useAuth } from './AuthProvider';
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  BarChart3,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface BulkScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete?: (result: BulkScanResult) => void;
}

export function BulkScanModal({ isOpen, onClose, onScanComplete }: BulkScanModalProps) {
  const { session } = useAuth();
  const [urls, setUrls] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'quick' | 'deep'>('quick');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkScanResult | null>(null);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const lines = e.target.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    setUrls(lines);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
      const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      setUrls(lines);
    };
    reader.readAsText(file);
  }, []);

  const handleSubmit = async () => {
    if (urls.length === 0) {
      setError('Bitte gib mindestens eine URL ein');
      return;
    }

    if (urls.length > 50) {
      setError('Maximal 50 URLs erlaubt');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/bulk-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          urls,
          name: name || `Bulk Scan ${new Date().toLocaleString()}`,
          mode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Bulk scan failed');
      }

      // Poll for results
      pollForResults(data.id);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    }
  };

  const pollForResults = async (id: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/bulk-scan?id=${id}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error);
        }

        if (data.bulkScan.status === 'completed') {
          setResult(data.bulkScan);
          setLoading(false);
          onScanComplete?.(data.bulkScan);
          return;
        } else if (data.bulkScan.status === 'failed') {
          setError('Bulk scan failed');
          setLoading(false);
          return;
        }

        // Continue polling
        setTimeout(poll, 2000);
      } catch (err) {
        setError('Fehler beim Abrufen der Ergebnisse');
        setLoading(false);
      }
    };

    poll();
  };

  const downloadCSV = () => {
    if (!result) return;

    const rows = [
      ['URL', 'Status', 'Violations', 'Critical', 'Serious', 'Moderate', 'Minor'],
      ...result.results.map(r => [
        r.url,
        r.status,
        r.result?.violations.length || 0,
        r.result?.violations.filter(v => v.impact === 'critical').length || 0,
        r.result?.violations.filter(v => v.impact === 'serious').length || 0,
        r.result?.violations.filter(v => v.impact === 'moderate').length || 0,
        r.result?.violations.filter(v => v.impact === 'minor').length || 0,
      ]),
    ];

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-scan-${result.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Bulk Scan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!result ? (
            <>
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scan-Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Wochen-Check"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scan-Modus
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setMode('quick')}
                    className={`flex-1 px-4 py-3 border rounded-lg text-left transition-colors ${
                      mode === 'quick'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">Quick Scan</div>
                    <div className="text-sm text-gray-500">Nur Startseite (~30s)</div>
                  </button>
                  <button
                    onClick={() => setMode('deep')}
                    className={`flex-1 px-4 py-3 border rounded-lg text-left transition-colors ${
                      mode === 'deep'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">Deep Scan</div>
                    <div className="text-sm text-gray-500">Bis zu 15 Seiten (~2min)</div>
                  </button>
                </div>
              </div>

              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URLs (eine pro Zeile, max. 50)
                </label>
                <textarea
                  value={inputText}
                  onChange={handleTextareaChange}
                  placeholder="https://example.com&#10;https://example.com/about&#10;..."
                  className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <div className="mt-2 text-sm text-gray-500">
                  {urls.length} URLs eingegeben
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Oder CSV/TXT Datei hochladen
                </label>
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">Datei auswählen...</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-700">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || urls.length === 0}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Scan wird gestartet...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-5 h-5" />
                    Bulk Scan starten
                  </>
                )}
              </button>
            </>
          ) : (
            <BulkScanResults 
              result={result} 
              onDownload={downloadCSV}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BulkScanResults({ 
  result, 
  onDownload, 
  onClose 
}: { 
  result: BulkScanResult; 
  onDownload: () => void;
  onClose: () => void;
}) {
  const report = result.aggregateReport;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">Bulk Scan abgeschlossen!</h3>
        <p className="text-gray-500">
          {result.completedUrls} von {result.totalUrls} URLs erfolgreich gescannt
        </p>
      </div>

      {report && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{report.criticalCount}</div>
            <div className="text-sm text-red-700">Kritisch</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{report.seriousCount}</div>
            <div className="text-sm text-orange-700">Ernst</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{report.moderateCount}</div>
            <div className="text-sm text-yellow-700">Mittel</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{report.minorCount}</div>
            <div className="text-sm text-blue-700">Gering</div>
          </div>
        </div>
      )}

      {report?.commonViolations && report.commonViolations.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Häufigste Verstöße</h4>
          <div className="space-y-2">
            {report.commonViolations.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{v.help}</p>
                  <p className="text-xs text-gray-500">{v.affectedUrls.length} URLs betroffen</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  v.impact === 'critical' ? 'bg-red-100 text-red-700' :
                  v.impact === 'serious' ? 'bg-orange-100 text-orange-700' :
                  v.impact === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {v.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onDownload}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          CSV herunterladen
        </button>
        <button
          onClick={onClose}
          className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}

// Bulk Scan History Component
export function BulkScanHistory() {
  const { session, isAuthenticated } = useAuth();
  const [scans, setScans] = useState<BulkScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadScans = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/bulk-scan', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setScans(data.bulkScans || []);
      }
    } catch (error) {
      console.error('Error loading bulk scans:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteScan = async (id: string) => {
    if (!session?.access_token) return;
    if (!confirm('Möchtest du diesen Bulk Scan wirklich löschen?')) return;

    try {
      const response = await fetch(`/api/bulk-scan?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setScans(scans.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Error deleting bulk scan:', error);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        onClick={() => {
          setShowModal(true);
          loadScans();
        }}
        className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <BarChart3 className="w-4 h-4" />
        <span className="hidden sm:inline">Bulk Scans</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Bulk Scan Verlauf</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadScans}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Aktualisieren"
                >
                  <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {scans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Noch keine Bulk Scans vorhanden</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scans.map((scan) => (
                    <div key={scan.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{scan.name}</h3>
                          <p className="text-sm text-gray-500">
                            {scan.totalUrls} URLs • {new Date(scan.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            scan.status === 'completed' ? 'bg-green-100 text-green-700' :
                            scan.status === 'running' ? 'bg-blue-100 text-blue-700' :
                            scan.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {scan.status === 'completed' ? 'Abgeschlossen' :
                             scan.status === 'running' ? 'Läuft...' :
                             scan.status === 'failed' ? 'Fehler' :
                             'Wartend'}
                          </span>
                          <button
                            onClick={() => deleteScan(scan.id)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>

                      {scan.aggregateReport && (
                        <div className="mt-3 flex items-center gap-4 text-sm">
                          <span className="text-red-600">
                            {scan.aggregateReport.criticalCount} Kritisch
                          </span>
                          <span className="text-orange-600">
                            {scan.aggregateReport.seriousCount} Ernst
                          </span>
                          <span className="text-gray-500">
                            {scan.aggregateReport.urlsClean}/{scan.totalUrls} sauber
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
