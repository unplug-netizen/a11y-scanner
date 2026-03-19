import { NextRequest, NextResponse } from 'next/server';
import { scanWebsite } from '@/lib/scan-server';
import { validateApiKey, logApiUsage, ApiAuthContext } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';
import { triggerScanCompleted, triggerIssueDetected } from '@/lib/webhooks';

const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// POST /api/v1/scan - Start a scan via API
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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

  try {
    const body = await request.json();
    const { url, mode = 'quick' } = body;

    if (!url || typeof url !== 'string') {
      const responseTime = Date.now() - startTime;
      await logApiUsage(context, request, 400, responseTime);
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate mode
    if (mode !== 'quick' && mode !== 'deep') {
      const responseTime = Date.now() - startTime;
      await logApiUsage(context, request, 400, responseTime);
      return NextResponse.json(
        { error: 'Mode must be "quick" or "deep"' },
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
      const responseTime = Date.now() - startTime;
      await logApiUsage(context, request, 400, responseTime);
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // For quick scans, run immediately
    // For deep scans, queue and return job ID (simplified: just run it)
    const scanStartTime = Date.now();
    const result = await scanWebsite(validatedUrl, mode);
    const scanDurationMs = Date.now() - scanStartTime;

    // Save scan result
    let scanId: string | undefined;
    if (supabase) {
      const { data: scanRecord } = await supabase
        .from('scans')
        .insert({
          user_id: context.userId,
          url: validatedUrl,
          result: result,
          violation_count: result.violations.length,
        })
        .select('id')
        .single();

      scanId = scanRecord?.id;

      // Trigger webhooks asynchronously (don't await)
      if (scanId) {
        triggerScanCompleted(context.userId, scanId, result, scanDurationMs).catch(console.error);
        
        // Trigger issue.detected for critical/serious violations
        result.violations.forEach(violation => {
          triggerIssueDetected(context.userId, scanId!, validatedUrl, violation).catch(console.error);
        });
      }

      const responseTime = Date.now() - startTime;
      await logApiUsage(context, request, 200, responseTime);

      return NextResponse.json({
        id: scanId,
        url: validatedUrl,
        status: 'completed',
        result: {
          timestamp: result.timestamp,
          violations: result.violations,
          passes: result.passes,
          incomplete: result.incomplete,
          inapplicable: result.inapplicable,
          compliance: result.compliance,
          scanMode: result.scanMode,
          pagesScanned: result.pagesScanned,
        },
        createdAt: new Date().toISOString(),
      });
    }

    const responseTime = Date.now() - startTime;
    await logApiUsage(context, request, 200, responseTime);

    return NextResponse.json({
      url: validatedUrl,
      status: 'completed',
      result: {
        timestamp: result.timestamp,
        violations: result.violations,
        passes: result.passes,
        incomplete: result.incomplete,
        inapplicable: result.inapplicable,
        compliance: result.compliance,
        scanMode: result.scanMode,
        pagesScanned: result.pagesScanned,
      },
      createdAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('API v1 scan error:', error);
    const responseTime = Date.now() - startTime;
    await logApiUsage(context, request, 500, responseTime);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan failed' },
      { status: 500 }
    );
  }
}

// GET /api/v1/scan - API info
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  const authResult = await validateApiKey(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status || 401 }
    );
  }

  const context = authResult.context!;
  const responseTime = Date.now() - startTime;
  await logApiUsage(context, request, 200, responseTime);

  return NextResponse.json({
    version: '1.0',
    endpoints: {
      'POST /api/v1/scan': 'Start a new scan',
      'GET /api/v1/results/:id': 'Get scan results by ID',
    },
    rateLimit: {
      limit: context.rateLimit,
      window: '1 hour',
    },
  });
}
