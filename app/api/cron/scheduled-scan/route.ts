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

// This endpoint is called by Vercel Cron
// Configure in vercel.json: "crons": [{ "path": "/api/cron/scheduled-scan", "schedule": "0 9 * * *" }]
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    // Find all scheduled scans that are due
    const { data: dueScans, error: fetchError } = await supabase
      .from('scheduled_scans')
      .select('*')
      .eq('is_active', true)
      .lte('next_scan_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching due scans:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled scans' },
        { status: 500 }
      );
    }

    if (!dueScans || dueScans.length === 0) {
      return NextResponse.json({ 
        message: 'No scheduled scans due',
        processed: 0 
      });
    }

    const results = [];

    // Process each due scan
    for (const scheduledScan of dueScans) {
      try {
        // Run the scan
        const scanResult = await scanWebsite(scheduledScan.url, 'quick');

        // Compare with previous result to find new/fixed violations
        const newViolations: any[] = [];
        const fixedViolations: any[] = [];

        if (scheduledScan.last_result?.violations) {
          const previousViolations = scheduledScan.last_result.violations;
          const currentIds = new Set(scanResult.violations.map((v: any) => v.id));
          const previousIds = new Set(previousViolations.map((v: any) => v.id));

          // Find new violations
          scanResult.violations.forEach((v: any) => {
            if (!previousIds.has(v.id)) {
              newViolations.push(v);
            }
          });

          // Find fixed violations
          previousViolations.forEach((v: any) => {
            if (!currentIds.has(v.id)) {
              fixedViolations.push(v);
            }
          });
        }

        // Save to history
        await supabase.from('scheduled_scan_history').insert({
          scheduled_scan_id: scheduledScan.id,
          user_id: scheduledScan.user_id,
          url: scheduledScan.url,
          result: scanResult,
          violation_count: scanResult.violations.length,
          new_violations: newViolations,
          fixed_violations: fixedViolations,
        });

        // Calculate next scan date
        const nextScanAt = calculateNextScanDate(scheduledScan.frequency);

        // Update scheduled scan
        await supabase
          .from('scheduled_scans')
          .update({
            last_scan_at: new Date().toISOString(),
            next_scan_at: nextScanAt.toISOString(),
            last_result: scanResult,
          })
          .eq('id', scheduledScan.id);

        // Send email notification if enabled and there are new issues
        if (scheduledScan.email_notifications && 
            (!scheduledScan.notify_on_new_issues_only || newViolations.length > 0)) {
          // Email sending would be implemented here
          // For now, we just log it
          console.log(`Would send email to user ${scheduledScan.user_id} about scan ${scheduledScan.id}`);
          console.log(`New violations: ${newViolations.length}, Fixed: ${fixedViolations.length}`);
        }

        results.push({
          id: scheduledScan.id,
          status: 'success',
          url: scheduledScan.url,
          violations: scanResult.violations.length,
          newViolations: newViolations.length,
          fixedViolations: fixedViolations.length,
        });

      } catch (error) {
        console.error(`Error processing scheduled scan ${scheduledScan.id}:`, error);
        results.push({
          id: scheduledScan.id,
          status: 'error',
          url: scheduledScan.url,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Scheduled scans processed',
      processed: dueScans.length,
      results,
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to calculate next scan date
function calculateNextScanDate(frequency: string): Date {
  const now = new Date();
  const next = new Date(now);

  switch (frequency) {
    case 'daily':
      next.setDate(now.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      break;
    case 'weekly':
      next.setDate(now.getDate() + 7);
      next.setHours(9, 0, 0, 0);
      break;
    case 'monthly':
      next.setMonth(now.getMonth() + 1);
      next.setHours(9, 0, 0, 0);
      break;
  }

  return next;
}
