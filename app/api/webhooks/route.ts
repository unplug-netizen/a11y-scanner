import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateWebhookSecret, WebhookEventType } from '@/lib/webhooks';

// Create admin client for database operations
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

const VALID_EVENTS: string[] = [
  'scan.completed',
  'bulkscan.completed',
  'issue.detected',
];

// GET /api/webhooks - List user's webhooks
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

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('id, url, events, is_active, created_at, last_delivered_at, failure_count')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch webhooks' },
        { status: 500 }
      );
    }

    return NextResponse.json({ webhooks: webhooks || [] });

  } catch (error) {
    console.error('GET /api/webhooks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/webhooks - Create a new webhook
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
    const { url, events } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Webhook URL is required' },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Validate events
    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'At least one event is required' },
        { status: 400 }
      );
    }

    const invalidEvents = events.filter(e => !VALID_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(', ')}` },
        { status: 400 }
      );
    }

    // Check webhook limit (max 10 per user)
    const { count, error: countError } = await supabase
      .from('webhooks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Count error:', countError);
    } else if (count && count >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 webhooks allowed per user' },
        { status: 400 }
      );
    }

    // Generate secret
    const secret = generateWebhookSecret();

    // Create webhook
    const { data: webhook, error: insertError } = await supabase
      .from('webhooks')
      .insert({
        user_id: user.id,
        url,
        events,
        secret,
        is_active: true,
        failure_count: 0,
      })
      .select('id, url, events, is_active, created_at')
      .single();

    if (insertError || !webhook) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create webhook' },
        { status: 500 }
      );
    }

    // Return webhook with secret (only shown once)
    return NextResponse.json({
      webhook: {
        ...webhook,
        secret,
      },
      message: 'Webhook created successfully. Save the secret - it will not be shown again.',
    });

  } catch (error) {
    console.error('POST /api/webhooks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/webhooks - Update a webhook
export async function PATCH(request: NextRequest) {
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
        { error: 'Webhook ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Validate and prepare updates
    if (body.url !== undefined) {
      try {
        new URL(body.url);
        updates.url = body.url;
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    if (body.events !== undefined) {
      if (!Array.isArray(body.events) || body.events.length === 0) {
        return NextResponse.json(
          { error: 'At least one event is required' },
          { status: 400 }
        );
      }

      const invalidEvents = body.events.filter((e: string) => !VALID_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { error: `Invalid events: ${invalidEvents.join(', ')}` },
          { status: 400 }
        );
      }
      updates.events = body.events;
    }

    if (body.is_active !== undefined) {
      updates.is_active = body.is_active;
      if (body.is_active) {
        updates.failure_count = 0; // Reset failure count when reactivating
      }
    }

    // Update webhook
    const { data: webhook, error: updateError } = await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, url, events, is_active, created_at, last_delivered_at, failure_count')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update webhook' },
        { status: 500 }
      );
    }

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ webhook });

  } catch (error) {
    console.error('PATCH /api/webhooks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/webhooks - Delete a webhook
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
        { error: 'Webhook ID is required' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete webhook' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/webhooks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/webhooks/regenerate - Regenerate webhook secret
export async function regenerateSecret(request: NextRequest) {
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
        { error: 'Webhook ID is required' },
        { status: 400 }
      );
    }

    const newSecret = generateWebhookSecret();

    const { data: webhook, error: updateError } = await supabase
      .from('webhooks')
      .update({ secret: newSecret })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, url, events, is_active, created_at')
      .single();

    if (updateError || !webhook) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to regenerate secret' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      webhook: {
        ...webhook,
        secret: newSecret,
      },
      message: 'Secret regenerated successfully. Save the new secret - it will not be shown again.',
    });

  } catch (error) {
    console.error('POST /api/webhooks/regenerate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
