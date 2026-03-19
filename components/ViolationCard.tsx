'use client';

import { useState } from 'react';
import { A11yViolation, FixSuggestion } from '@/types';
import { getImpactColor, getImpactLabel } from '@/lib/helpers';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Wrench, 
  ExternalLink,
  Code,
  Loader2
} from 'lucide-react';

interface ViolationCardProps {
  violation: A11yViolation;
}

export function ViolationCard({ violation }: ViolationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [fixSuggestion, setFixSuggestion] = useState<FixSuggestion | null>(null);
  const [loadingFix, setLoadingFix] = useState(false);
  const [showFix, setShowFix] = useState(false);

  const handleGenerateFix = async (html: string) => {
    if (fixSuggestion) {
      setShowFix(!showFix);
      return;
    }

    setLoadingFix(true);
    try {
      const response = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violation, html }),
      });

      const data = await response.json();
      if (response.ok) {
        setFixSuggestion(data);
        setShowFix(true);
      }
    } catch (error) {
      console.error('Fix generation error:', error);
    } finally {
      setLoadingFix(false);
    }
  };

  const impactClass = getImpactColor(violation.impact);
  const impactLabel = getImpactLabel(violation.impact);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className={`p-4 cursor-pointer transition-colors hover:bg-gray-50`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className={`w-5 h-5 mt-0.5 ${violation.impact === 'critical' ? 'text-red-500' : violation.impact === 'serious' ? 'text-orange-500' : 'text-yellow-500'}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-gray-900">{violation.help}</h4>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${impactClass}`}>
                  {impactLabel}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{violation.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">
                  {violation.nodes.length} betroffene Elemente
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-gray-500">
                  {violation.tags.join(', ')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={violation.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="WCAG Dokumentation"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {violation.nodes.map((node, index) => (
            <div key={index} className="p-4 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center gap-2 mb-2">
                <Code className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Betroffenes Element {index + 1}
                </span>
              </div>
              
              {/* HTML Preview */}
              <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
                <code className="text-sm text-green-400 font-mono">
                  {node.html.length > 200 ? node.html.substring(0, 200) + '...' : node.html}
                </code>
              </div>

              {/* Failure Summary */}
              {node.failureSummary && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <span className="font-medium">Problem: </span>
                    {node.failureSummary}
                  </p>
                </div>
              )}

              {/* Target Selector */}
              <div className="mt-2 text-xs text-gray-500">
                Selector: <code className="bg-gray-100 px-1 py-0.5 rounded">{node.target.join(' > ')}</code>
              </div>

              {/* AI Fix Button */}
              <button
                onClick={() => handleGenerateFix(node.html)}
                disabled={loadingFix}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loadingFix ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generiere Fix...
                  </>
                ) : showFix && fixSuggestion ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Fix ausblenden
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4" />
                    KI-Fix vorschlagen
                  </>
                )}
              </button>

              {/* Fix Suggestion */}
              {showFix && fixSuggestion && (
                <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h5 className="font-medium text-purple-900 mb-2">KI-Generierter Fix:</h5>
                  <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto mb-3">
                    <code className="text-sm text-green-400 font-mono">
                      {fixSuggestion.fixedCode}
                    </code>
                  </div>
                  <div className="text-sm text-purple-800">
                    <span className="font-medium">Erklärung: </span>
                    {fixSuggestion.explanation}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
