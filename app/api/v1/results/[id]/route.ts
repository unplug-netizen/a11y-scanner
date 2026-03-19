import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, logApiUsage } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// GET /api/v1/results/:id - Get scan results by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;
  
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status || 401 }
    );
  }

  const context = authResult.context!;
  const supabase = createAdminClient();

  if (!supabase) {
    const responseTime = Date.now() - startTime;
    await logApiUsage(context, request, 500, responseTime);
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    if (!id) {
      const responseTime = Date.now() - startTime;
      await logApiUsage(context, request, 400, responseTime);
      return NextResponse.json(
        { error: 'Scan ID is required' },
        { status: 400 }
      );
    }

    // Fetch scan from database
    const { data: scan, error } = await supabase
      .from('scans')
      .select('*')
      .eq('id', id)
      .eq('user_id', context.userId)
      .single();

    if (error || !scan) {
      const responseTime = Date.now() - startTime;
      await logApiUsage(context, request, 404, responseTime);
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }

    const responseTime = Date.now() - startTime;
    await logApiUsage(context, request, 200, responseTime);

    return NextResponse.json({
      id: scan.id,
      url: scan.url,
      status: 'completed',
      result: scan.result,
      violationCount: scan.violation_count,
      createdAt: scan.created_at,
    });

  } catch (error) {
    console.error('API v1 results error:', error);
    const responseTime = Date.now() - startTime;
    await logApiUsage(context, request, 500, responseTime);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
