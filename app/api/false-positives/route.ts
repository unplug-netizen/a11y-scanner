import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  createFalsePositiveRule, 
  filterFalsePositives,
  suggestFalsePositiveRules,
  validateFalsePositiveRule,
  FalsePositiveRule
} from '@/lib/false-positives';
import { A11yViolation } from '@/types';

// Create admin client for database operations
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// GET /api/false-positives - Get user's false positive rules
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
    const includeDefaults = searchParams.get('includeDefaults') === 'true';

    // Get user's custom rules
    const { data: customRules, error } = await supabase
      .from('false_positive_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rules' },
        { status: 500 }
      );
    }

    let rules: FalsePositiveRule[] = customRules?.map(r => ({
      id: r.id,
      violationId: r.violation_id,
      urlPattern: r.url_pattern,
      selectorPattern: r.selector_pattern,
      htmlPattern: r.html_pattern,
      reason: r.reason,
      createdAt: r.created_at,
      createdBy: r.created_by,
    })) || [];

    // Include default rules if requested
    if (includeDefaults) {
      const { getDefaultFalsePositiveRules } = await import('@/lib/false-positives');
      const defaultRules = getDefaultFalsePositiveRules(user.id);
      rules = [...defaultRules, ...rules];
    }

    return NextResponse.json({ rules });

  } catch (error) {
    console.error('GET /api/false-positives error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/false-positives - Create a new false positive rule
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
    const { violationId, urlPattern, selectorPattern, htmlPattern, reason } = body;

    // Validate rule
    const validation = validateFalsePositiveRule({
      violationId,
      urlPattern,
      selectorPattern,
      htmlPattern,
      reason,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Check rule limit (max 50 per user)
    const { count, error: countError } = await supabase
      .from('false_positive_rules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Count error:', countError);
    } else if (count && count >= 50) {
      return NextResponse.json(
        { error: 'Maximum 50 false positive rules allowed per user' },
        { status: 400 }
      );
    }

    // Create rule
    const rule = createFalsePositiveRule(
      violationId,
      { urlPattern, selectorPattern, htmlPattern, reason },
      user.id
    );

    // Save to database
    const { data: savedRule, error: insertError } = await supabase
      .from('false_positive_rules')
      .insert({
        id: rule.id,
        user_id: user.id,
        violation_id: rule.violationId,
        url_pattern: rule.urlPattern,
        selector_pattern: rule.selectorPattern,
        html_pattern: rule.htmlPattern,
        reason: rule.reason,
        created_by: rule.createdBy,
      })
      .select()
      .single();

    if (insertError || !savedRule) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rule: {
        id: savedRule.id,
        violationId: savedRule.violation_id,
        urlPattern: savedRule.url_pattern,
        selectorPattern: savedRule.selector_pattern,
        htmlPattern: savedRule.html_pattern,
        reason: savedRule.reason,
        createdAt: savedRule.created_at,
        createdBy: savedRule.created_by,
      },
      message: 'False positive rule created successfully',
    });

  } catch (error) {
    console.error('POST /api/false-positives error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/false-positives - Delete a false positive rule
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
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from('false_positive_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/false-positives error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/false-positives/test - Test filter against violations
export async function testFilter(request: NextRequest) {
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
    const { violations, url } = body;

    if (!violations || !Array.isArray(violations) || !url) {
      return NextResponse.json(
        { error: 'Violations array and URL are required' },
        { status: 400 }
      );
    }

    // Get user's rules
    const { data: customRules } = await supabase
      .from('false_positive_rules')
      .select('*')
      .eq('user_id', user.id);

    const rules: FalsePositiveRule[] = customRules?.map(r => ({
      id: r.id,
      violationId: r.violation_id,
      urlPattern: r.url_pattern,
      selectorPattern: r.selector_pattern,
      htmlPattern: r.html_pattern,
      reason: r.reason,
      createdAt: r.created_at,
      createdBy: r.created_by,
    })) || [];

    // Add default rules
    const { getDefaultFalsePositiveRules } = await import('@/lib/false-positives');
    const defaultRules = getDefaultFalsePositiveRules(user.id);
    const allRules = [...defaultRules, ...rules];

    // Test filter
    const result = filterFalsePositives(violations as A11yViolation[], url, allRules);

    // Get suggestions
    const suggestions = suggestFalsePositiveRules(violations as A11yViolation[], url);

    return NextResponse.json({
      filterResult: result,
      suggestions,
    });

  } catch (error) {
    console.error('POST /api/false-positives/test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
