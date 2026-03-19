import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TrendAnalysis, TrendDataPoint } from '@/types';

// Create admin client for database operations
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// GET /api/scheduled-scan - Get user's scheduled scans
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    // Get user from auth header
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const history = searchParams.get('history');
    const trend = searchParams.get('trend');

    if (trend && id) {
      // Get trend analysis for a scheduled scan
      return getTrendAnalysis(supabase, id, user.id);
    }

    if (history && id) {
      // Get history for a specific scheduled scan
      const { data: scanHistory, error } = await supabase
        .from('scheduled_scan_history')
        .select('*')
        .eq('scheduled_scan_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Database error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch scan history' },
          { status: 500 }
        );
      }

      return NextResponse.json({ history: scanHistory || [] });
    }

    if (id) {
      // Get specific scheduled scan
      const { data: scheduledScan, error } = await supabase
        .from('scheduled_scans')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error || !scheduledScan) {
        return NextResponse.json(
          { error: 'Scheduled scan not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ scheduledScan });
    }

    // Get all scheduled scans for user
    const { data: scheduledScans, error } = await supabase
      .from('scheduled_scans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled scans' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scheduledScans: scheduledScans || [] });

  } catch (error) {
    console.error('GET /api/scheduled-scan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/scheduled-scan - Create a scheduled scan
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    // Get user from auth header
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

    const body = await request.json();
    const { 
      name, 
      url, 
      frequency, 
      emailNotifications = true, 
      notifyOnNewIssuesOnly = true 
    } = body;

    if (!name || !url || !frequency) {
      return NextResponse.json(
        { error: 'Name, URL, and frequency are required' },
        { status: 400 }
      );
    }

    // Validate URL
    let validatedUrl: string;
    try {
      try {
        const urlObj = new URL(url);
        validatedUrl = urlObj.toString();
      } catch {
        const urlObj = new URL(`https://${url}`);
        validatedUrl = urlObj.toString();
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // Validate frequency
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Frequency must be daily, weekly, or monthly' },
        { status: 400 }
      );
    }

    // Calculate next scan date
    const nextScanAt = calculateNextScanDate(frequency);

    // Create scheduled scan
    const { data: scheduledScan, error: insertError } = await supabase
      .from('scheduled_scans')
      .insert({
        user_id: user.id,
        name,
        url: validatedUrl,
        frequency,
        email_notifications: emailNotifications,
        notify_on_new_issues_only: notifyOnNewIssuesOnly,
        next_scan_at: nextScanAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (insertError || !scheduledScan) {
      console.error('Database error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create scheduled scan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scheduledScan });

  } catch (error) {
    console.error('POST /api/scheduled-scan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/scheduled-scan - Update a scheduled scan
export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    // Get user from auth header
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Scheduled scan ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.frequency !== undefined) {
      if (!['daily', 'weekly', 'monthly'].includes(body.frequency)) {
        return NextResponse.json(
          { error: 'Frequency must be daily, weekly, or monthly' },
          { status: 400 }
        );
      }
      updates.frequency = body.frequency;
      updates.next_scan_at = calculateNextScanDate(body.frequency).toISOString();
    }
    if (body.emailNotifications !== undefined) updates.email_notifications = body.emailNotifications;
    if (body.notifyOnNewIssuesOnly !== undefined) updates.notify_on_new_issues_only = body.notifyOnNewIssuesOnly;
    if (body.isActive !== undefined) updates.is_active = body.isActive;

    const { data: scheduledScan, error } = await supabase
      .from('scheduled_scans')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !scheduledScan) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update scheduled scan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scheduledScan });

  } catch (error) {
    console.error('PATCH /api/scheduled-scan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/scheduled-scan - Delete a scheduled scan
export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    // Get user from auth header
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Scheduled scan ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('scheduled_scans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete scheduled scan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/scheduled-scan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to calculate next scan date
function calculateNextScanDate(frequency: string): Date {
  const now = new Date();
  const next = new Date(now);

  switch (frequency) {
    case 'daily':
      next.setDate(now.getDate() + 1);
      next.setHours(9, 0, 0, 0); // 9 AM
      break;
    case 'weekly':
      next.setDate(now.getDate() + 7);
      next.setHours(9, 0, 0, 0);
      break;
    case 'monthly':
      next.setMonth(now.getMonth() + 1);
      next.setHours(9, 0, 0, 0);
      break;
  }

  return next;
}

// Get trend analysis for a scheduled scan
async function getTrendAnalysis(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  scanId: string,
  userId: string
): Promise<NextResponse> {
  // Get scheduled scan info
  const { data: scheduledScan, error: scanError } = await supabase
    .from('scheduled_scans')
    .select('url')
    .eq('id', scanId)
    .eq('user_id', userId)
    .single();

  if (scanError || !scheduledScan) {
    return NextResponse.json(
      { error: 'Scheduled scan not found' },
      { status: 404 }
    );
  }

  // Get history
  const { data: history, error } = await supabase
    .from('scheduled_scan_history')
    .select('*')
    .eq('scheduled_scan_id', scanId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(30);

  if (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trend data' },
      { status: 500 }
    );
  }

  if (!history || history.length < 2) {
    return NextResponse.json(
      { error: 'Not enough data for trend analysis' },
      { status: 400 }
    );
  }

  // Build trend data points
  const trendData: TrendDataPoint[] = history.map(h => {
    const criticalCount = h.result?.violations?.filter(
      (v: any) => v.impact === 'critical'
    ).length || 0;

    return {
      date: h.created_at,
      violationCount: h.violation_count,
      criticalCount,
    };
  });

  // Calculate trend
  const first = trendData[0];
  const last = trendData[trendData.length - 1];
  const totalChange = last.violationCount - first.violationCount;
  
  let trend: 'improving' | 'worsening' | 'stable';
  if (totalChange < -5) {
    trend = 'improving';
  } else if (totalChange > 5) {
    trend = 'worsening';
  } else {
    trend = 'stable';
  }

  const analysis: TrendAnalysis = {
    scanId,
    url: scheduledScan.url,
    history: trendData,
    trend,
    totalChange,
  };

  return NextResponse.json({ analysis });
}
