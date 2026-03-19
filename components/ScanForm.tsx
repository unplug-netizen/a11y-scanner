'use client';

import { useState } from 'react';
import { Search, Loader2, Lock } from 'lucide-react';

interface ScanFormProps {
  onScan: (url: string) => void;
  loading: boolean;
  disabled?: boolean;
}

export function ScanForm({ onScan, loading, disabled }: ScanFormProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !loading && !disabled) {
      onScan(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={disabled ? "Tageslimit erreicht - bitte anmelden" : "https://example.com"}
          className="w-full px-6 py-4 pr-36 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors disabled:bg-gray-100 disabled:text-gray-400"
          disabled={loading || disabled}
        />
        <button
          type="submit"
          disabled={loading || !url.trim() || disabled}
          className="absolute right-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
      <p className="mt-2 text-sm text-gray-500 text-center">
        {disabled 
          ? "Du hast dein tägliches Scan-Limit erreicht. Melde dich an für unbegrenzte Scans."
          : "Gib eine URL ein, um die Website auf Barrierefreiheit zu prüfen"
        }
      </p>
    </form>
  );
}
