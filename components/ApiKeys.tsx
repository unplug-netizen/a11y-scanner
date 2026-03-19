'use client';

import { useState, useEffect } from 'react';
import { ApiKey, ApiKeyWithSecret } from '@/types';
import { useAuth } from './AuthProvider';
import { 
  Key, 
  Plus, 
  X, 
  Copy, 
  Trash2, 
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Loader2,
  Clock,
  BarChart3
} from 'lucide-react';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeysModal({ isOpen, onClose }: ApiKeysModalProps) {
  const { session } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKey, setNewKey] = useState<ApiKeyWithSecret | null>(null);

  const loadApiKeys = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/api-keys', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys || []);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadApiKeys();
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

  const deleteApiKey = async (id: string) => {
    if (!session?.access_token) return;
    if (!confirm('Möchtest du diesen API-Key wirklich löschen?')) return;

    try {
      const response = await fetch(`/api/api-keys?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter(k => k.id !== id));
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
  };

  const toggleActive = async (key: ApiKey) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/api-keys?id=${key.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ isActive: !key.isActive }),
      });

      if (response.ok) {
        const data = await response.json();
        setApiKeys(apiKeys.map(k => k.id === key.id ? data.apiKey : k));
      }
    } catch (error) {
      console.error('Error updating API key:', error);
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
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Developer API Keys</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Neuer Key
            </button>
            <button
              onClick={loadApiKeys}
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

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {showCreateForm ? (
            newKey ? (
              <NewKeyDisplay 
                apiKey={newKey} 
                onClose={() => {
                  setNewKey(null);
                  setShowCreateForm(false);
                  loadApiKeys();
                }}
              />
            ) : (
              <CreateApiKeyForm 
                onCancel={() => setShowCreateForm(false)}
                onSuccess={(key) => setNewKey(key)}
              />
            )
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine API Keys vorhanden</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Ersten Key erstellen
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div 
                  key={key.id} 
                  className={`p-4 border rounded-lg ${
                    key.isActive 
                      ? 'border-gray-200 dark:border-gray-700' 
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{key.name}</h3>
                        {!key.isActive && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                            Inaktiv
                          </span>
                        )}
                        {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
                            Abgelaufen
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                          {key.keyPrefix}••••••••
                        </code>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-4 h-4" />
                          {key.usageCount} Aufrufe
                        </span>
                        {key.lastUsedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Zuletzt: {new Date(key.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                        <span>Limit: {key.rateLimit}/h</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(key)}
                        className={`p-2 rounded-lg transition-colors ${
                          key.isActive 
                            ? 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600' 
                            : 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600'
                        }`}
                        title={key.isActive ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        {key.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteApiKey(key.id)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
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

function CreateApiKeyForm({ 
  onCancel, 
  onSuccess 
}: { 
  onCancel: () => void; 
  onSuccess: (key: ApiKeyWithSecret) => void;
}) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [rateLimit, setRateLimit] = useState(100);
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          rateLimit,
          expiresInDays: expiresInDays || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create API key');
      }

      onSuccess(data.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-medium text-gray-900 dark:text-white">Neuen API Key erstellen</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Produktion"
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Rate Limit (Aufrufe pro Stunde)
        </label>
        <select
          value={rateLimit}
          onChange={(e) => setRateLimit(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value={50}>50 / Stunde</option>
          <option value={100}>100 / Stunde</option>
          <option value={500}>500 / Stunde</option>
          <option value={1000}>1000 / Stunde</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Ablauf (optional)
        </label>
        <select
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Kein Ablauf</option>
          <option value={30}>30 Tage</option>
          <option value={90}>90 Tage</option>
          <option value={180}>180 Tage</option>
          <option value={365}>1 Jahr</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
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

function NewKeyDisplay({ 
  apiKey, 
  onClose 
}: { 
  apiKey: ApiKeyWithSecret; 
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-400">Wichtig!</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-500">
              Kopiere den API Key jetzt. Er wird nicht mehr angezeigt!
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dein API Key</label>
        <div className="flex gap-2">
          <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-mono text-sm text-gray-900 dark:text-gray-300 break-all">
            {apiKey.key}
          </code>
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Kopiert!' : 'Kopieren'}
          </button>
        </div>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">API Nutzung</h4>
        <pre className="text-sm text-gray-600 dark:text-gray-400 overflow-x-auto">
{`curl -X POST https://a11y-scanner-red.vercel.app/api/v1/scan \\
  -H "x-api-key: ${apiKey.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com", "mode": "quick"}'`}
        </pre>
      </div>

      <button
        onClick={onClose}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Ich habe den Key kopiert
      </button>
    </div>
  );
}
