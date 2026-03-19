import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scanWebsite } from '@/lib/scan-server';
import { BulkScanItemResult, AggregateReport, CommonViolation, BulkScanResult } from '@/types';
import { triggerBulkScanCompleted } from '@/lib/webhooks';

// Create admin client for database operations
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// Maximum concurrent scans
const MAX_CONCURRENT = 5;

// POST /api/bulk-scan - Start a bulk scan
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
    const { urls, name, mode = 'quick' } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required' },
        { status: 400 }
      );
    }

    if (urls.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 URLs allowed per bulk scan' },
        { status: 400 }
      );
    }

    // Validate and normalize URLs
    const normalizedUrls: string[] = [];
    for (const url of urls) {
      try {
        let validatedUrl: string;
        try {
          const urlObj = new URL(url);
          validatedUrl = urlObj.toString();
        } catch {
          const urlObj = new URL(`https://${url}`);
          validatedUrl = urlObj.toString();
        }
        normalizedUrls.push(validatedUrl);
      } catch {
        return NextResponse.json(
          { error: `Invalid URL: ${url}` },
          { status: 400 }
        );
      }
    }

    // Create bulk scan record
    const { data: bulkScan, error: insertError } = await supabase
      .from('bulk_scans')
      .insert({
        user_id: user.id,
        name: name || `Bulk Scan ${new Date().toLocaleString()}`,
        urls: normalizedUrls,
        status: 'running',
        total_urls: normalizedUrls.length,
        results: [],
        completed_urls: 0,
        failed_urls: 0,
      })
      .select()
      .single();

    if (insertError || !bulkScan) {
      console.error('Database error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create bulk scan' },
        { status: 500 }
      );
    }

    // Start scanning in background (don't await)
    processBulkScan(supabase, bulkScan.id, normalizedUrls, mode);

    return NextResponse.json({ 
      id: bulkScan.id,
      status: 'running',
      totalUrls: normalizedUrls.length,
      message: 'Bulk scan started'
    });

  } catch (error) {
    console.error('POST /api/bulk-scan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/bulk-scan - Get user's bulk scans
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

    if (id) {
      // Get specific bulk scan
      const { data: bulkScan, error } = await supabase
        .from('bulk_scans')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error || !bulkScan) {
        return NextResponse.json(
          { error: 'Bulk scan not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ bulkScan });
    }

    // Get all bulk scans for user
    const { data: bulkScans, error } = await supabase
      .from('bulk_scans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bulk scans' },
        { status: 500 }
      );
    }

    return NextResponse.json({ bulkScans: bulkScans || [] });

  } catch (error) {
    console.error('GET /api/bulk-scan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/bulk-scan - Delete a bulk scan
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
        { error: 'Bulk scan ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('bulk_scans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete bulk scan' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/bulk-scan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Process bulk scan with concurrency control
async function processBulkScan(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  bulkScanId: string,
  urls: string[],
  mode: 'quick' | 'deep'
) {
  const results: BulkScanItemResult[] = [];
  let completed = 0;
  let failed = 0;

  // Process URLs in batches
  for (let i = 0; i < urls.length; i += MAX_CONCURRENT) {
    const batch = urls.slice(i, i + MAX_CONCURRENT);
    
    const batchPromises = batch.map(async (url) => {
      try {
        const result = await scanWebsite(url, mode);
        completed++;
        return {
          url,
          status: 'success' as const,
          result,
          scannedAt: new Date().toISOString(),
        };
      } catch (error) {
        failed++;
        return {
          url,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Scan failed',
          scannedAt: new Date().toISOString(),
        };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        failed++;
        results.push({
          url: 'unknown',
          status: 'error',
          error: 'Unexpected error',
          scannedAt: new Date().toISOString(),
        });
      }
    });

    // Update progress
    await supabase
      .from('bulk_scans')
      .update({
        results,
        completed_urls: completed,
        failed_urls: failed,
      })
      .eq('id', bulkScanId);
  }

  // Generate aggregate report
  const aggregateReport = generateAggregateReport(results);

  // Mark as completed
  await supabase
    .from('bulk_scans')
    .update({
      status: 'completed',
      results,
      completed_urls: completed,
      failed_urls: failed,
      aggregate_report: aggregateReport,
      completed_at: new Date().toISOString(),
    })
    .eq('id', bulkScanId);

  // Get user_id for webhook trigger
  const { data: bulkScanData } = await supabase
    .from('bulk_scans')
    .select('user_id')
    .eq('id', bulkScanId)
    .single();

  if (bulkScanData?.user_id) {
    // Fetch complete bulk scan for webhook
    const { data: completeBulkScan } = await supabase
      .from('bulk_scans')
      .select('*')
      .eq('id', bulkScanId)
      .single();

    if (completeBulkScan) {
      const bulkScanResult: BulkScanResult = {
        id: completeBulkScan.id,
        userId: completeBulkScan.user_id,
        name: completeBulkScan.name,
        urls: completeBulkScan.urls,
        status: completeBulkScan.status,
        results: completeBulkScan.results,
        totalUrls: completeBulkScan.total_urls,
        completedUrls: completeBulkScan.completed_urls,
        failedUrls: completeBulkScan.failed_urls,
        aggregateReport: completeBulkScan.aggregate_report,
        createdAt: completeBulkScan.created_at,
        completedAt: completeBulkScan.completed_at,
      };

      // Trigger webhook asynchronously
      triggerBulkScanCompleted(bulkScanData.user_id, bulkScanResult).catch(console.error);
    }
  }
}

function generateAggregateReport(results: BulkScanItemResult[]): AggregateReport {
  const successfulResults = results.filter(r => r.status === 'success' && r.result);
  
  let totalViolations = 0;
  let criticalCount = 0;
  let seriousCount = 0;
  let moderateCount = 0;
  let minorCount = 0;
  
  const violationMap = new Map<string, CommonViolation>();

  successfulResults.forEach(({ result, url }) => {
    if (!result) return;
    
    totalViolations += result.violations.length;
    
    result.violations.forEach(v => {
      switch (v.impact) {
        case 'critical': criticalCount++; break;
        case 'serious': seriousCount++; break;
        case 'moderate': moderateCount++; break;
        case 'minor': minorCount++; break;
      }

      // Track common violations
      if (!violationMap.has(v.id)) {
        violationMap.set(v.id, {
          id: v.id,
          help: v.help,
          impact: v.impact || 'unknown',
          count: 0,
          affectedUrls: [],
        });
      }
      
      const commonViolation = violationMap.get(v.id)!;
      commonViolation.count++;
      if (!commonViolation.affectedUrls.includes(url)) {
        commonViolation.affectedUrls.push(url);
      }
    });
  });

  // Sort by count and take top 10
  const commonViolations = Array.from(violationMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const urlsWithViolations = successfulResults.filter(r => 
    r.result && r.result.violations.length > 0
  ).length;

  // Calculate compliance summary
  let wcag21AA = 0;
  let wcag22AA = 0;
  let section508 = 0;

  successfulResults.forEach(({ result }) => {
    if (result?.compliance) {
      if (result.compliance.wcag21.AA) wcag21AA++;
      if (result.compliance.wcag22.AA) wcag22AA++;
      if (result.compliance.section508) section508++;
    }
  });

  const totalSuccessful = successfulResults.length;

  return {
    totalViolations,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    urlsWithViolations,
    urlsClean: totalSuccessful - urlsWithViolations,
    commonViolations,
    complianceSummary: {
      wcag21AA: totalSuccessful > 0 ? Math.round((wcag21AA / totalSuccessful) * 100) : 0,
      wcag22AA: totalSuccessful > 0 ? Math.round((wcag22AA / totalSuccessful) * 100) : 0,
      section508: totalSuccessful > 0 ? Math.round((section508 / totalSuccessful) * 100) : 0,
    },
  };
}
