import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// GET /api/dashboard - Get dashboard statistics
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get time range from query params
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get scans in time range
    const { data: scans, error: scansError } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (scansError) {
      console.error('Database error:', scansError);
      return NextResponse.json(
        { error: 'Failed to fetch scans' },
        { status: 500 }
      );
    }

    // Calculate statistics
    const totalScans = scans?.length || 0;
    let totalViolations = 0;
    let criticalIssues = 0;
    let seriousIssues = 0;
    let compliantScans = 0;

    scans?.forEach(scan => {
      const violations = scan.result?.violations || [];
      const violationCount = violations.length;
      
      totalViolations += violationCount;
      
      if (violationCount === 0) {
        compliantScans++;
      }

      violations.forEach((v: any) => {
        if (v.impact === 'critical') criticalIssues++;
        if (v.impact === 'serious') seriousIssues++;
      });
    });

    const averageViolationsPerScan = totalScans > 0 ? totalViolations / totalScans : 0;
    const complianceRate = totalScans > 0 ? Math.round((compliantScans / totalScans) * 100) : 0;

    // Calculate trend (compare first half with second half of period)
    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    let trendPercentage = 0;

    if (scans && scans.length >= 4) {
      const midPoint = Math.floor(scans.length / 2);
      const firstHalf = scans.slice(0, midPoint);
      const secondHalf = scans.slice(midPoint);

      const firstHalfAvg = firstHalf.reduce((sum, s) => sum + (s.result?.violations?.length || 0), 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, s) => sum + (s.result?.violations?.length || 0), 0) / secondHalf.length;

      if (firstHalfAvg > 0) {
        const change = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        trendPercentage = Math.abs(Math.round(change));
        
        if (change < -10) {
          trend = 'improving';
        } else if (change > 10) {
          trend = 'worsening';
        } else {
          trend = 'stable';
        }
      }
    }

    // Get recent scans (last 10)
    const recentScans = scans?.slice(0, 10).map(scan => ({
      id: scan.id,
      url: scan.url,
      violationCount: scan.violation_count || 0,
      createdAt: scan.created_at,
      scanMode: scan.result?.scanMode || 'quick',
    })) || [];

    const stats = {
      totalScans,
      totalViolations,
      averageViolationsPerScan,
      criticalIssues,
      seriousIssues,
      complianceRate,
      recentScans,
      trend,
      trendPercentage,
    };

    return NextResponse.json({ stats });

  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
