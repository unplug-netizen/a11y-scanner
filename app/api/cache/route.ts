import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getCacheStats, 
  clearScanCache, 
  invalidateScanCache,
  isCacheAvailable 
} from '@/lib/cache';

// Create admin client for database operations
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// GET /api/cache - Get cache status and statistics
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

    const stats = await getCacheStats();

    return NextResponse.json({
      available: isCacheAvailable(),
      stats: stats || null,
      ttl: {
        quick: '1 hour',
        deep: '4 hours',
      },
    });

  } catch (error) {
    console.error('GET /api/cache error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/cache - Clear cache (admin only or own cache)
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
    const url = searchParams.get('url');
    const mode = searchParams.get('mode') as 'quick' | 'deep' | null;
    const all = searchParams.get('all') === 'true';

    if (all) {
      // Clear all cache (admin only - check if user has admin role)
      const { data: userData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!userData) {
        return NextResponse.json(
          { error: 'Admin access required to clear all cache' },
          { status: 403 }
        );
      }

      await clearScanCache();
      return NextResponse.json({ 
        success: true, 
        message: 'All cache cleared' 
      });
    }

    if (url) {
      // Invalidate specific URL cache
      await invalidateScanCache(url, mode || undefined);
      return NextResponse.json({ 
        success: true, 
        message: `Cache invalidated for ${url}` 
      });
    }

    return NextResponse.json(
      { error: 'Provide ?url=... or ?all=true' },
      { status: 400 }
    );

  } catch (error) {
    console.error('DELETE /api/cache error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
