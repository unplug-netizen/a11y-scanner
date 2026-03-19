import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scanWebsite } from '@/lib/scan-server';

// Create admin client
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

/**
 * GitHub Actions API Endpoint
 * 
 * POST /api/ci/github
 * 
 * Headers:
 * - Authorization: Bearer <api-key>
 * 
 * Body:
 * {
 *   url: string,
 *   failOn?: 'critical' | 'serious' | 'moderate' | 'minor',
 *   metadata?: {
 *     repo: string,
 *     pr: number,
 *     commit: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    // Get API key from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.split(' ')[1];

    // Validate API key
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, user_id, rate_limit, is_active')
      .eq('key_hash', await hashKey(apiKey))
      .single();

    if (keyError || !keyData || !keyData.is_active) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check rate limit
    const { data: usageData } = await supabase.rpc('get_api_usage_last_hour', {
      p_api_key_id: keyData.id,
    });

    if (usageData && usageData >= keyData.rate_limit) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { url, failOn = 'serious', metadata } = body;

    if (!url) {
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

    // Log API usage
    const startTime = Date.now();

    // Run scan
    const scanResult = await scanWebsite(validatedUrl, 'quick');

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Log usage
    await supabase.from('api_usage_logs').insert({
      api_key_id: keyData.id,
      user_id: keyData.user_id,
      endpoint: '/api/ci/github',
      method: 'POST',
      status_code: 200,
      response_time_ms: responseTime,
    });

    // Update key usage
    await supabase
      .from('api_keys')
      .update({
        usage_count: supabase.rpc('increment', { x: 1 }),
        last_used_at: new Date().toISOString(),
      })
      .eq('id', keyData.id);

    // Count violations by impact
    const violationsByImpact = {
      critical: scanResult.violations.filter(v => v.impact === 'critical').length,
      serious: scanResult.violations.filter(v => v.impact === 'serious').length,
      moderate: scanResult.violations.filter(v => v.impact === 'moderate').length,
      minor: scanResult.violations.filter(v => v.impact === 'minor').length,
    };

    // Determine if check should fail
    const impactLevels = ['critical', 'serious', 'moderate', 'minor'];
    const failLevelIndex = impactLevels.indexOf(failOn);
    let shouldFail = false;

    for (let i = 0; i <= failLevelIndex; i++) {
      if (violationsByImpact[impactLevels[i] as keyof typeof violationsByImpact] > 0) {
        shouldFail = true;
        break;
      }
    }

    // Build GitHub Actions compatible response
    const response = {
      success: !shouldFail,
      url: validatedUrl,
      summary: {
        totalViolations: scanResult.violations.length,
        critical: violationsByImpact.critical,
        serious: violationsByImpact.serious,
        moderate: violationsByImpact.moderate,
        minor: violationsByImpact.minor,
        passes: scanResult.passes,
      },
      violations: scanResult.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.length,
      })),
      compliance: scanResult.compliance,
      reportUrl: `https://a11y-scanner-red.vercel.app`,
      metadata: {
        scanTime: new Date().toISOString(),
        ...metadata,
      },
    };

    return NextResponse.json(response, {
      status: shouldFail ? 400 : 200,
    });

  } catch (error) {
    console.error('CI GitHub API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Hash API key for lookup
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/ci/github - Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'A11y Scanner CI',
    version: '1.0.0',
  });
}
