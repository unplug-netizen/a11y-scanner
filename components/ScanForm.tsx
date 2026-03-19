'use client';

import { useState } from 'react';
import { Search, Loader2, Lock, Zap, Layers } from 'lucide-react';

interface ScanFormProps {
  onScan: (url: string, mode: 'quick' | 'deep') => void;
  loading: boolean;
  disabled?: boolean;
}

export function ScanForm({ onScan, loading, disabled }: ScanFormProps) {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'quick' | 'deep'>('quick');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !loading && !disabled) {
      onScan(url.trim(), mode);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      {/* Scan Mode Toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('quick')}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'quick'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            } disabled:opacity-50`}
          >
            <Zap className="w-4 h-4" />
            Quick Scan
          </button>
          <button
            type="button"
            onClick={() => setMode('deep')}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'deep'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            } disabled:opacity-50`}
          >
            <Layers className="w-4 h-4" />
            Deep Scan
          </button>
        </div>
      </div>

      {/* Mode Description */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
        {mode === 'quick' 
          ? "Nur die Start-URL wird geprüft (~10 Sekunden)"
          : "Crawlt bis zu 15 interne Seiten (~60-120 Sekunden)"
        }
      </p>

      <div className="relative flex items-center">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={disabled ? "Tageslimit erreicht - bitte anmelden" : "https://example.com"}
          className="w-full px-6 py-4 pr-36 text-lg border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 rounded-xl focus:border-blue-500 focus:outline-none transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-400"
          disabled={loading || disabled}
        />
        <button
          type="submit"
          disabled={loading || !url.trim() || disabled}
          className="absolute right-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning...
            </>
          ) : disabled ? (
            <>
              <Lock className="w-4 h-4" />
              Limit
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Scannen
            </>
          )}
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
        {disabled 
          ? "Du hast dein tägliches Scan-Limit erreicht. Melde dich an für unbegrenzte Scans."
          : "Gib eine URL ein, um die Website auf Barrierefreiheit zu prüfen"
        }
      </p>
    </form>
  );
}
