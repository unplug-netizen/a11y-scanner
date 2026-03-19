'use client';

import { ComplianceStatus } from '@/types';
import { CheckCircle, XCircle, Shield } from 'lucide-react';

interface ComplianceBadgeProps {
  compliance: ComplianceStatus;
}

export function ComplianceBadge({ compliance }: ComplianceBadgeProps) {
  const getStatusColor = (passed: boolean) => 
    passed ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
  
  const getIcon = (passed: boolean) => 
    passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Compliance Status</h3>
      </div>
      
      <div className="space-y-4">
        {/* WCAG 2.1 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">WCAG 2.1</h4>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(compliance.wcag21.A)}`}>
              {getIcon(compliance.wcag21.A)}
              Level A
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(compliance.wcag21.AA)}`}>
              {getIcon(compliance.wcag21.AA)}
              Level AA
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(compliance.wcag21.AAA)}`}>
              {getIcon(compliance.wcag21.AAA)}
              Level AAA
            </span>
          </div>
        </div>

        {/* WCAG 2.2 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">WCAG 2.2</h4>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(compliance.wcag22.A)}`}>
              {getIcon(compliance.wcag22.A)}
              Level A
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(compliance.wcag22.AA)}`}>
              {getIcon(compliance.wcag22.AA)}
              Level AA
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(compliance.wcag22.AAA)}`}>
              {getIcon(compliance.wcag22.AAA)}
              Level AAA
            </span>
          </div>
        </div>

        {/* Section 508 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Section 508</h4>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(compliance.section508)}`}>
            {getIcon(compliance.section508)}
            {compliance.section508 ? 'Compliant' : 'Non-Compliant'}
          </span>
        </div>
      </div>
    </div>
  );
}
