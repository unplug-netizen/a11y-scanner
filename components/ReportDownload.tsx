'use client';

import { ScanResult } from '@/types';
import { Download } from 'lucide-react';
import { useState } from 'react';

interface ReportDownloadProps {
  result: ScanResult;
}

export function ReportDownload({ result }: ReportDownloadProps) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
      (pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfFonts as any).vfs;

      const criticalCount = result.violations.filter(v => v.impact === 'critical').length;
      const seriousCount = result.violations.filter(v => v.impact === 'serious').length;
      const moderateCount = result.violations.filter(v => v.impact === 'moderate').length;
      const minorCount = result.violations.filter(v => v.impact === 'minor').length;

      const docDefinition: any = {
        content: [
          { text: 'A11y Scanner Report', style: 'header' },
          { text: `URL: ${result.url}`, style: 'subheader' },
          { text: `Scan Datum: ${new Date(result.timestamp).toLocaleString('de-DE')}`, style: 'date' },
          { text: '', margin: [0, 10] },
          { text: 'Zusammenfassung', style: 'sectionHeader' },
          {
            columns: [
              { text: `Kritisch: ${criticalCount}`, style: 'critical' },
              { text: `Ernst: ${seriousCount}`, style: 'serious' },
              { text: `Mittel: ${moderateCount}`, style: 'moderate' },
              { text: `Gering: ${minorCount}`, style: 'minor' },
            ]
          },
          { text: '', margin: [0, 20] },
        ],
        styles: {
          header: {
            fontSize: 24,
            bold: true,
            color: '#2563eb',
            margin: [0, 0, 0, 10]
          },
          subheader: {
            fontSize: 12,
            color: '#666666'
          },
          date: {
            fontSize: 12,
            color: '#666666',
            margin: [0, 0, 0, 20]
          },
          sectionHeader: {
            fontSize: 16,
            bold: true,
            margin: [0, 0, 0, 10]
          },
          critical: { color: '#dc2626', bold: true },
          serious: { color: '#ea580c', bold: true },
          moderate: { color: '#ca8a04', bold: true },
          minor: { color: '#2563eb', bold: true },
          violationHeader: {
            fontSize: 12,
            bold: true,
            margin: [0, 10, 0, 5]
          },
          violationDesc: {
            fontSize: 10,
            color: '#444444',
            margin: [0, 0, 0, 5]
          },
          tags: {
            fontSize: 9,
            color: '#666666',
            italics: true
          }
        },
        footer: (currentPage: number, pageCount: number) => ({
          text: `Generiert mit A11y Scanner • Seite ${currentPage} von ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          color: '#999999',
          margin: [0, 20]
        })
      };

      if (result.violations.length > 0) {
        docDefinition.content.push({ text: 'Gefundene Verstöße', style: 'sectionHeader' });
        
        result.violations.forEach((violation) => {
          const impactColors: Record<string, string> = {
            critical: '#dc2626',
            serious: '#ea580c',
            moderate: '#ca8a04',
            minor: '#2563eb'
          };
          
          docDefinition.content.push({
            text: `[${(violation.impact || 'unknown').toUpperCase()}] ${violation.help}`,
            style: 'violationHeader',
            color: impactColors[violation.impact || ''] || '#666666'
          });
          
          docDefinition.content.push({
            text: violation.description,
            style: 'violationDesc'
          });
          
          docDefinition.content.push({
            text: `Tags: ${violation.tags.join(', ')}`,
            style: 'tags'
          });
          
          docDefinition.content.push({
            text: `Dokumentation: ${violation.helpUrl}`,
            style: 'tags',
            color: '#2563eb'
          });
          
          docDefinition.content.push({ text: '', margin: [0, 5] });
        });
      } else {
        docDefinition.content.push({
          text: 'Keine Verstöße gefunden!',
          style: { color: '#22c55e', bold: true, fontSize: 14 }
        });
      }

      pdfMake.createPdf(docDefinition).download(`a11y-report-${new Date().toISOString().split('T')[0]}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={generating}
      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
    >
      <Download className="w-4 h-4" />
      {generating ? 'Generiere...' : 'PDF Report'}
    </button>
  );
}
