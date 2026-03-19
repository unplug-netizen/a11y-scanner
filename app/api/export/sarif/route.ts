import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exportToSarifJson, exportBulkToSarifJson } from '@/lib/sarif-export';

// Create admin client for database operations
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// GET /api/export/sarif - Export scan results as SARIF
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
    const scanId = searchParams.get('scanId');
    const bulkScanId = searchParams.get('bulkScanId');
    const pretty = searchParams.get('pretty') === 'true';

    if (!scanId && !bulkScanId) {
      return NextResponse.json(
        { error: 'Either scanId or bulkScanId is required' },
        { status: 400 }
      );
    }

    // Export single scan
    if (scanId) {
      const { data: scan, error } = await supabase
        .from('scans')
        .select('*')
        .eq('id', scanId)
        .eq('user_id', user.id)
        .single();

      if (error || !scan) {
        return NextResponse.json(
          { error: 'Scan not found' },
          { status: 404 }
        );
      }

      const sarifJson = exportToSarifJson(scan.result, {
        runGuid: scan.id,
        automationId: `a11y-scan-${scan.id}`,
        automationDescription: `Accessibility scan of ${scan.url}`,
        pretty,
      });

      // Return as downloadable file
      return new NextResponse(sarifJson, {
        headers: {
          'Content-Type': 'application/sarif+json',
          'Content-Disposition': `attachment; filename="a11y-scan-${scanId}.sarif.json"`,
        },
      });
    }

    // Export bulk scan
    if (bulkScanId) {
      const { data: bulkScan, error } = await supabase
        .from('bulk_scans')
        .select('*')
        .eq('id', bulkScanId)
        .eq('user_id', user.id)
        .single();

      if (error || !bulkScan) {
        return NextResponse.json(
          { error: 'Bulk scan not found' },
          { status: 404 }
        );
      }

      // Extract successful scan results
      const successfulResults = bulkScan.results
        ?.filter((r: { status: string; result?: unknown }) => r.status === 'success' && r.result)
        .map((r: { result: unknown }) => r.result) || [];

      if (successfulResults.length === 0) {
        return NextResponse.json(
          { error: 'No successful scan results to export' },
          { status: 400 }
        );
      }

      const sarifJson = exportBulkToSarifJson(successfulResults, {
        runGuid: bulkScan.id,
        automationId: `a11y-bulk-scan-${bulkScan.id}`,
        automationDescription: bulkScan.name || 'Bulk accessibility scan',
        pretty,
      });

      return new NextResponse(sarifJson, {
        headers: {
          'Content-Type': 'application/sarif+json',
          'Content-Disposition': `attachment; filename="a11y-bulk-scan-${bulkScanId}.sarif.json"`,
        },
      });
    }

  } catch (error) {
    console.error('GET /api/export/sarif error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/export/sarif - Export scan results as SARIF (alternative method)
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
    const { scanId, bulkScanId, pretty = false } = body;

    if (!scanId && !bulkScanId) {
      return NextResponse.json(
        { error: 'Either scanId or bulkScanId is required' },
        { status: 400 }
      );
    }

    // Export single scan
    if (scanId) {
      const { data: scan, error } = await supabase
        .from('scans')
        .select('*')
        .eq('id', scanId)
        .eq('user_id', user.id)
        .single();

      if (error || !scan) {
        return NextResponse.json(
          { error: 'Scan not found' },
          { status: 404 }
        );
      }

      const sarifJson = exportToSarifJson(scan.result, {
        runGuid: scan.id,
        automationId: `a11y-scan-${scan.id}`,
        automationDescription: `Accessibility scan of ${scan.url}`,
        pretty,
      });

      return NextResponse.json({
        format: 'sarif',
        version: '2.1.0',
        content: sarifJson,
        filename: `a11y-scan-${scanId}.sarif.json`,
      });
    }

    // Export bulk scan
    if (bulkScanId) {
      const { data: bulkScan, error } = await supabase
        .from('bulk_scans')
        .select('*')
        .eq('id', bulkScanId)
        .eq('user_id', user.id)
        .single();

      if (error || !bulkScan) {
        return NextResponse.json(
          { error: 'Bulk scan not found' },
          { status: 404 }
        );
      }

      const successfulResults = bulkScan.results
        ?.filter((r: { status: string; result?: unknown }) => r.status === 'success' && r.result)
        .map((r: { result: unknown }) => r.result) || [];

      if (successfulResults.length === 0) {
        return NextResponse.json(
          { error: 'No successful scan results to export' },
          { status: 400 }
        );
      }

      const sarifJson = exportBulkToSarifJson(successfulResults, {
        runGuid: bulkScan.id,
        automationId: `a11y-bulk-scan-${bulkScan.id}`,
        automationDescription: bulkScan.name || 'Bulk accessibility scan',
        pretty,
      });

      return NextResponse.json({
        format: 'sarif',
        version: '2.1.0',
        content: sarifJson,
        filename: `a11y-bulk-scan-${bulkScanId}.sarif.json`,
      });
    }

  } catch (error) {
    console.error('POST /api/export/sarif error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
