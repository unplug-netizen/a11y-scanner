import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBrowserPool } from '@/lib/browser-pool';
import { analyzeFocusOrder } from '@/lib/focus-order';

// Create admin client for database operations
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// POST /api/focus-order - Analyze focus order on a page
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
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

    // Run focus order analysis
    const pool = getBrowserPool();
    const page = await pool.acquirePage();

    try {
      await page.goto(validatedUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      const result = await analyzeFocusOrder(page);

      // Save result to database
      const { data: focusScan, error: insertError } = await supabase
        .from('focus_scans')
        .insert({
          user_id: user.id,
          url: validatedUrl,
          result,
          issue_count: result.issues.length,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Database error:', insertError);
      }

      return NextResponse.json({
        id: focusScan?.id,
        url: validatedUrl,
        status: 'completed',
        result: {
          issues: result.issues,
          focusableElements: result.focusableElements.slice(0, 50), // Limit for response size
          tabOrder: result.tabOrder.slice(0, 50),
          hasLogicalTabOrder: result.hasLogicalTabOrder,
          scanTimeMs: result.scanTimeMs,
        },
        createdAt: new Date().toISOString(),
      });

    } finally {
      pool.releasePage(page);
    }

  } catch (error) {
    console.error('POST /api/focus-order error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

// GET /api/focus-order - Get focus order scan history
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Get specific focus scan
      const { data: focusScan, error } = await supabase
        .from('focus_scans')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error || !focusScan) {
        return NextResponse.json(
          { error: 'Focus scan not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ focusScan });
    }

    // Get all focus scans for user
    const { data: focusScans, error } = await supabase
      .from('focus_scans')
      .select('id, url, issue_count, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch focus scans' },
        { status: 500 }
      );
    }

    return NextResponse.json({ focusScans: focusScans || [] });

  } catch (error) {
    console.error('GET /api/focus-order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/focus-order - Delete a focus scan
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Focus scan ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('focus_scans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete focus scan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/focus-order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
