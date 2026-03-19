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

// GET /api/integrations - Get user's integrations
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

    const { data: integrations, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      integrations: integrations || {
        slack_enabled: false,
        email_enabled: false,
        notify_on_scan_complete: true,
        notify_on_new_issues: true,
        notify_on_scheduled_scan: true,
      }
    });

  } catch (error) {
    console.error('GET /api/integrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/integrations - Create or update integrations
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
    const {
      slackWebhookUrl,
      slackChannel,
      slackEnabled,
      emailEnabled,
      emailAddress,
      notifyOnScanComplete,
      notifyOnNewIssues,
      notifyOnScheduledScan,
    } = body;

    // Validate Slack webhook URL if provided
    if (slackWebhookUrl && !slackWebhookUrl.match(/^https:\/\/hooks\.slack\.com\/services\//)) {
      return NextResponse.json(
        { error: 'Invalid Slack webhook URL' },
        { status: 400 }
      );
    }

    // Check if integration record exists
    const { data: existing } = await supabase
      .from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const integrationData = {
      user_id: user.id,
      slack_webhook_url: slackWebhookUrl || null,
      slack_channel: slackChannel || null,
      slack_enabled: slackEnabled || false,
      email_enabled: emailEnabled || false,
      email_address: emailAddress || user.email,
      notify_on_scan_complete: notifyOnScanComplete !== false,
      notify_on_new_issues: notifyOnNewIssues !== false,
      notify_on_scheduled_scan: notifyOnScheduledScan !== false,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('user_integrations')
        .update(integrationData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        return NextResponse.json(
          { error: 'Failed to update integrations' },
          { status: 500 }
        );
      }
      result = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('user_integrations')
        .insert(integrationData)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        return NextResponse.json(
          { error: 'Failed to create integrations' },
          { status: 500 }
        );
      }
      result = data;
    }

    return NextResponse.json({ integrations: result });

  } catch (error) {
    console.error('POST /api/integrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations - Delete integrations
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

    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete integrations' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/integrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
