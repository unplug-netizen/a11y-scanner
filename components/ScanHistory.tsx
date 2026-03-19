'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { ScanResult } from '@/types';
import { History, X, Loader2, ExternalLink, Trash2 } from 'lucide-react';

interface SavedScan {
  id: string;
  url: string;
  timestamp: string;
  violation_count: number;
  result: ScanResult;
}

interface ScanHistoryProps {
  onLoadScan: (scan: ScanResult) => void;
}

export function ScanHistory({ onLoadScan }: ScanHistoryProps) {
  const { isAuthenticated, user } = useAuth();
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadScans();
    }
  }, [isOpen, isAuthenticated]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
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
  }, [isOpen]);

  const loadScans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/scans');
      if (response.ok) {
        const data = await response.json();
        setScans(data.scans || []);
      } else {
        setError('Fehler beim Laden der Scan-History');
      }
    } catch (err) {
      setError('Fehler beim Laden der Scan-History');
    } finally {
      setLoading(false);
    }
  };

  const deleteScan = async (id: string) => {
    try {
      const response = await fetch(`/api/scans?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setScans(scans.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Error deleting scan:', err);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
      >
        <History className="w-4 h-4" />
        <span className="hidden sm:inline">History</span>
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5" />
                Scan-History
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="mt-4 text-gray-600">Lade Scans...</p>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              ) : scans.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Noch keine gespeicherten Scans</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Deine Scans werden automatisch gespeichert
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scans.map((scan) => (
                    <div
                      key={scan.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-900 truncate">
                              {scan.url}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span>{formatDate(scan.timestamp)}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              scan.violation_count > 0 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {scan.violation_count} Verstöße
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onLoadScan(scan.result);
                              setIsOpen(false);
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            Laden
                          </button>
                          <button
                            onClick={() => deleteScan(scan.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
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
      )}
    </>
  );
}
