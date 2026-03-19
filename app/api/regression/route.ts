import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  trackScan, 
  getScanHistory, 
  getTrendAnalysis, 
  getTrackedURLs,
  getUnreadAlerts,
  markAlertAsRead,
  startTrackingURL,
  stopTrackingURL
} from '@/lib/regression-tracking';

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/regression
 * Get regression data, history, or tracked URLs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const url = searchParams.get('url');
    const days = parseInt(searchParams.get('days') || '30');
    
    // Get user from auth header or session
    const authHeader = request.headers.get('authorization');
    const supabase = getSupabaseClient();
    
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    
    // For demo/development, allow requests without auth
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentifizierung erforderlich' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'history':
        if (!url) {
          return NextResponse.json(
            { error: 'URL ist erforderlich' },
            { status: 400 }
          );
        }
        const history = await getScanHistory(userId, url, days);
        return NextResponse.json({ history });
        
      case 'trend':
        if (!url) {
          return NextResponse.json(
            { error: 'URL ist erforderlich' },
            { status: 400 }
          );
        }
        const trend = await getTrendAnalysis(userId, url, days);
        return NextResponse.json(trend);
        
      case 'tracked-urls':
        const trackedUrls = await getTrackedURLs(userId);
        return NextResponse.json({ trackedUrls });
        
      case 'alerts':
        const alerts = await getUnreadAlerts(userId);
        return NextResponse.json({ alerts });
        
      default:
        return NextResponse.json(
          { error: 'Ungültige Aktion. Verwenden Sie: history, trend, tracked-urls, alerts' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Regression API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Regression-Abfrage fehlgeschlagen' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/regression
 * Track a scan or start/stop URL tracking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, scanId, url, scanResult, options } = body;
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    const supabase = getSupabaseClient();
    
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentifizierung erforderlich' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'track':
        if (!scanId || !url || !scanResult) {
          return NextResponse.json(
            { error: 'scanId, url und scanResult sind erforderlich' },
            { status: 400 }
          );
        }
        const analysis = await trackScan(userId, scanId, url, scanResult);
        return NextResponse.json(analysis);
        
      case 'start-tracking':
        if (!url) {
          return NextResponse.json(
            { error: 'URL ist erforderlich' },
            { status: 400 }
          );
        }
        await startTrackingURL(userId, url, options);
        return NextResponse.json({ success: true, message: 'URL wird jetzt überwacht' });
        
      case 'stop-tracking':
        if (!url) {
          return NextResponse.json(
            { error: 'URL ist erforderlich' },
            { status: 400 }
          );
        }
        await stopTrackingURL(userId, url);
        return NextResponse.json({ success: true, message: 'URL-Überwachung gestoppt' });
        
      default:
        return NextResponse.json(
          { error: 'Ungültige Aktion. Verwenden Sie: track, start-tracking, stop-tracking' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Regression API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Regression-Tracking fehlgeschlagen' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/regression
 * Mark alerts as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId } = body;
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    const supabase = getSupabaseClient();
    
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentifizierung erforderlich' },
        { status: 401 }
      );
    }

    if (!alertId) {
      return NextResponse.json(
        { error: 'alertId ist erforderlich' },
        { status: 400 }
      );
    }

    await markAlertAsRead(userId, alertId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Regression API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Aktualisierung fehlgeschlagen' },
      { status: 500 }
    );
  }
}
