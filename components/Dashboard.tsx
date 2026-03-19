'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Globe,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Loader2,
  Calendar,
  Zap,
  Shield
} from 'lucide-react';

interface DashboardStats {
  totalScans: number;
  totalViolations: number;
  averageViolationsPerScan: number;
  criticalIssues: number;
  seriousIssues: number;
  complianceRate: number;
  recentScans: RecentScan[];
  trend: 'improving' | 'worsening' | 'stable';
  trendPercentage: number;
}

interface RecentScan {
  id: string;
  url: string;
  violationCount: number;
  createdAt: string;
  scanMode: string;
}

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DashboardModal({ isOpen, onClose }: DashboardModalProps) {
  const { session } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (isOpen && session?.access_token) {
      loadStats();
    }
  }, [isOpen, session, timeRange]);

  const loadStats = async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = () => {
    if (!stats) return null;
    switch (stats.trend) {
      case 'improving':
        return <TrendingDown className="w-5 h-5 text-green-500" />;
      case 'worsening':
        return <TrendingUp className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTrendColor = () => {
    if (!stats) return 'text-gray-500';
    switch (stats.trend) {
      case 'improving':
        return 'text-green-600';
      case 'worsening':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendText = () => {
    if (!stats) return 'Stabil';
    switch (stats.trend) {
      case 'improving':
        return `${stats.trendPercentage}% weniger Issues`;
      case 'worsening':
        return `${stats.trendPercentage}% mehr Issues`;
      default:
        return 'Stabil';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${
                    timeRange === range
                      ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {range === '7d' ? '7 Tage' : range === '30d' ? '30 Tage' : '90 Tage'}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={<Globe className="w-5 h-5 text-blue-600" />}
                  label="Gesamt-Scans"
                  value={stats.totalScans}
                />
                <StatCard
                  icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
                  label="Verstöße"
                  value={stats.totalViolations}
                  subtext={`Ø ${stats.averageViolationsPerScan.toFixed(1)} pro Scan`}
                />
                <StatCard
                  icon={<Shield className="w-5 h-5 text-green-600" />}
                  label="Compliance"
                  value={`${stats.complianceRate}%`}
                />
                <StatCard
                  icon={getTrendIcon()}
                  label="Trend"
                  value={getTrendText()}
                  valueClassName={getTrendColor()}
                />
              </div>

              {/* Issues Breakdown */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Verstöße nach Schweregrad</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <IssueBadge
                    label="Kritisch"
                    count={stats.criticalIssues}
                    color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  />
                  <IssueBadge
                    label="Ernst"
                    count={stats.seriousIssues}
                    color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  />
                  <IssueBadge
                    label="Mittel"
                    count={stats.totalViolations - stats.criticalIssues - stats.seriousIssues}
                    color="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  />
                  <IssueBadge
                    label="Gering"
                    count={0}
                    color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  />
                </div>
              </div>

              {/* Recent Scans */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Letzte Scans</h3>
                {stats.recentScans.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recentScans.map((scan) => (
                      <div
                        key={scan.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {scan.scanMode === 'deep' ? (
                            <Zap className="w-5 h-5 text-purple-600" />
                          ) : (
                            <Activity className="w-5 h-5 text-blue-600" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-[300px]">
                              {scan.url}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(scan.createdAt).toLocaleString('de-DE')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {scan.violationCount === 0 ? (
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                              <CheckCircle className="w-4 h-4" />
                              OK
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {scan.violationCount}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    Noch keine Scans vorhanden
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Keine Daten verfügbar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  subtext,
  valueClassName = 'text-gray-900 dark:text-white'
}: { 
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${valueClassName}`}>{value}</div>
      {subtext && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtext}</div>
      )}
    </div>
  );
}

function IssueBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${color}`}>
      <span className="font-medium">{label}</span>
      <span className="text-lg font-bold">{count}</span>
    </div>
  );
}
