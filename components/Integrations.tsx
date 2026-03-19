'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { 
  Bell, 
  Slack, 
  Mail, 
  Save, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Send,
  X
} from 'lucide-react';

interface Integrations {
  slack_webhook_url?: string;
  slack_channel?: string;
  slack_enabled?: boolean;
  email_enabled?: boolean;
  email_address?: string;
  notify_on_scan_complete?: boolean;
  notify_on_new_issues?: boolean;
  notify_on_scheduled_scan?: boolean;
}

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IntegrationsModal({ isOpen, onClose }: IntegrationsModalProps) {
  const { session } = useAuth();
  const [integrations, setIntegrations] = useState<Integrations>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && session?.access_token) {
      loadIntegrations();
    }
  }, [isOpen, session]);

  const loadIntegrations = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/integrations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIntegrations(data.integrations || {});
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveIntegrations = async () => {
    if (!session?.access_token) return;
    
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          slackWebhookUrl: integrations.slack_webhook_url,
          slackChannel: integrations.slack_channel,
          slackEnabled: integrations.slack_enabled,
          emailEnabled: integrations.email_enabled,
          emailAddress: integrations.email_address,
          notifyOnScanComplete: integrations.notify_on_scan_complete,
          notifyOnNewIssues: integrations.notify_on_new_issues,
          notifyOnScheduledScan: integrations.notify_on_scheduled_scan,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setIntegrations(data.integrations);
        setMessage({ type: 'success', text: 'Integrationen gespeichert!' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Fehler beim Speichern' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Netzwerkfehler' });
    } finally {
      setSaving(false);
    }
  };

  const testSlack = async () => {
    if (!session?.access_token || !integrations.slack_webhook_url) return;
    
    setTestingSlack(true);
    setMessage(null);

    try {
      const response = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: 'slack',
          webhookUrl: integrations.slack_webhook_url,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Slack-Testnachricht gesendet!' });
      } else {
        setMessage({ type: 'error', text: 'Slack-Test fehlgeschlagen' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Netzwerkfehler' });
    } finally {
      setTestingSlack(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Integrationen</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Slack Integration */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Slack className="w-5 h-5 text-purple-600" />
                  <h3 className="font-medium text-gray-900">Slack</h3>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Slack-Benachrichtigungen aktivieren</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={integrations.slack_enabled || false}
                        onChange={(e) => setIntegrations({ ...integrations, slack_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {integrations.slack_enabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Webhook URL
                        </label>
                        <input
                          type="url"
                          value={integrations.slack_webhook_url || ''}
                          onChange={(e) => setIntegrations({ ...integrations, slack_webhook_url: e.target.value })}
                          placeholder="https://hooks.slack.com/services/..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Erstelle einen Webhook in deinen Slack App-Einstellungen
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kanal (optional)
                        </label>
                        <input
                          type="text"
                          value={integrations.slack_channel || ''}
                          onChange={(e) => setIntegrations({ ...integrations, slack_channel: e.target.value })}
                          placeholder="#accessibility"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <button
                        onClick={testSlack}
                        disabled={testingSlack || !integrations.slack_webhook_url}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                      >
                        {testingSlack ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Testnachricht senden
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Email Integration */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h3 className="font-medium text-gray-900">E-Mail</h3>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">E-Mail-Benachrichtigungen aktivieren</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={integrations.email_enabled || false}
                        onChange={(e) => setIntegrations({ ...integrations, email_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {integrations.email_enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        E-Mail-Adresse
                      </label>
                      <input
                        type="email"
                        value={integrations.email_address || ''}
                        onChange={(e) => setIntegrations({ ...integrations, email_address: e.target.value })}
                        placeholder="deine@email.de"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Benachrichtigungs-Einstellungen</h3>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={integrations.notify_on_scan_complete !== false}
                      onChange={(e) => setIntegrations({ ...integrations, notify_on_scan_complete: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Bei Scan-Abschluss benachrichtigen</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={integrations.notify_on_new_issues !== false}
                      onChange={(e) => setIntegrations({ ...integrations, notify_on_new_issues: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Bei neuen Issues benachrichtigen</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={integrations.notify_on_scheduled_scan !== false}
                      onChange={(e) => setIntegrations({ ...integrations, notify_on_scheduled_scan: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Bei geplanten Scans benachrichtigen</span>
                  </label>
                </div>
              </div>

              {/* Message */}
              {message && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${
                  message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  {message.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={saveIntegrations}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
