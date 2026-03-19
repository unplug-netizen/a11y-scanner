import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { ScanResult, BulkScanResult, A11yViolation } from '@/types';

// Create admin client for database operations
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

// Webhook Event Types
export type WebhookEventType = 
  | 'scan.completed'
  | 'bulkscan.completed'
  | 'issue.detected';

// Webhook Payload Interfaces
export interface ScanCompletedPayload {
  event: 'scan.completed';
  timestamp: string;
  data: {
    scanId: string;
    url: string;
    mode: 'quick' | 'deep';
    violationCount: number;
    criticalCount: number;
    seriousCount: number;
    compliance: {
      wcag21AA: boolean;
      wcag22AA: boolean;
      section508: boolean;
    };
    scanDurationMs: number;
  };
}

export interface BulkScanCompletedPayload {
  event: 'bulkscan.completed';
  timestamp: string;
  data: {
    bulkScanId: string;
    name: string;
    totalUrls: number;
    completedUrls: number;
    failedUrls: number;
    totalViolations: number;
    criticalCount: number;
    seriousCount: number;
    urlsWithViolations: number;
    urlsClean: number;
    completedAt: string;
  };
}

export interface IssueDetectedPayload {
  event: 'issue.detected';
  timestamp: string;
  data: {
    scanId: string;
    url: string;
    issue: {
      id: string;
      impact: string;
      help: string;
      helpUrl: string;
      description: string;
      tags: string[];
      nodes: Array<{
        html: string;
        target: string[];
      }>;
    };
  };
}

export type WebhookPayload = 
  | ScanCompletedPayload 
  | BulkScanCompletedPayload 
  | IssueDetectedPayload;

// Webhook Configuration Interface
export interface WebhookConfig {
  id: string;
  userId: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  createdAt: string;
  lastDeliveredAt?: string;
  failureCount: number;
}

// Delivery Result Interface
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  responseTimeMs: number;
}

/**
 * Generate HMAC signature for webhook payload
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Get active webhooks for a user
 */
export async function getActiveWebhooks(userId: string): Promise<WebhookConfig[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !data) {
    console.error('Failed to fetch webhooks:', error);
    return [];
  }

  return data.map(w => ({
    id: w.id,
    userId: w.user_id,
    url: w.url,
    secret: w.secret,
    events: w.events,
    isActive: w.is_active,
    createdAt: w.created_at,
    lastDeliveredAt: w.last_delivered_at,
    failureCount: w.failure_count || 0,
  }));
}

/**
 * Send webhook payload to configured endpoint
 */
export async function sendWebhook(
  webhook: WebhookConfig,
  payload: WebhookPayload
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();
  const payloadString = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadString, webhook.secret);

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': crypto.randomUUID(),
        'User-Agent': 'A11yScanner/1.0',
      },
      body: payloadString,
      // 30 second timeout
      signal: AbortSignal.timeout(30000),
    });

    const responseTimeMs = Date.now() - startTime;

    // Update last delivered timestamp on success
    if (response.ok) {
      await updateWebhookDeliveryStatus(webhook.id, true);
    } else {
      await updateWebhookDeliveryStatus(webhook.id, false);
    }

    return {
      success: response.ok,
      statusCode: response.status,
      responseTimeMs,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    await updateWebhookDeliveryStatus(webhook.id, false);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTimeMs,
    };
  }
}

/**
 * Update webhook delivery status in database
 */
async function updateWebhookDeliveryStatus(
  webhookId: string,
  success: boolean
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  if (success) {
    await supabase
      .from('webhooks')
      .update({
        last_delivered_at: new Date().toISOString(),
        failure_count: 0,
      })
      .eq('id', webhookId);
  } else {
    // Increment failure count
    const { data } = await supabase
      .from('webhooks')
      .select('failure_count')
      .eq('id', webhookId)
      .single();

    const newFailureCount = (data?.failure_count || 0) + 1;
    
    // Disable webhook after 10 consecutive failures
    await supabase
      .from('webhooks')
      .update({
        failure_count: newFailureCount,
        is_active: newFailureCount < 10,
      })
      .eq('id', webhookId);
  }
}

/**
 * Trigger webhooks for scan.completed event
 */
export async function triggerScanCompleted(
  userId: string,
  scanId: string,
  result: ScanResult,
  scanDurationMs: number
): Promise<void> {
  const webhooks = await getActiveWebhooks(userId);
  
  const payload: ScanCompletedPayload = {
    event: 'scan.completed',
    timestamp: new Date().toISOString(),
    data: {
      scanId,
      url: result.url,
      mode: result.scanMode || 'quick',
      violationCount: result.violations.length,
      criticalCount: result.violations.filter(v => v.impact === 'critical').length,
      seriousCount: result.violations.filter(v => v.impact === 'serious').length,
      compliance: {
        wcag21AA: result.compliance?.wcag21.AA ?? false,
        wcag22AA: result.compliance?.wcag22.AA ?? false,
        section508: result.compliance?.section508 ?? false,
      },
      scanDurationMs,
    },
  };

  // Send to all webhooks subscribed to this event
  const relevantWebhooks = webhooks.filter(w => 
    w.events.includes('scan.completed')
  );

  await Promise.allSettled(
    relevantWebhooks.map(webhook => sendWebhook(webhook, payload))
  );
}

/**
 * Trigger webhooks for bulkscan.completed event
 */
export async function triggerBulkScanCompleted(
  userId: string,
  bulkScan: BulkScanResult
): Promise<void> {
  const webhooks = await getActiveWebhooks(userId);
  
  const payload: BulkScanCompletedPayload = {
    event: 'bulkscan.completed',
    timestamp: new Date().toISOString(),
    data: {
      bulkScanId: bulkScan.id,
      name: bulkScan.name || 'Untitled Bulk Scan',
      totalUrls: bulkScan.totalUrls,
      completedUrls: bulkScan.completedUrls,
      failedUrls: bulkScan.failedUrls,
      totalViolations: bulkScan.aggregateReport?.totalViolations || 0,
      criticalCount: bulkScan.aggregateReport?.criticalCount || 0,
      seriousCount: bulkScan.aggregateReport?.seriousCount || 0,
      urlsWithViolations: bulkScan.aggregateReport?.urlsWithViolations || 0,
      urlsClean: bulkScan.aggregateReport?.urlsClean || 0,
      completedAt: bulkScan.completedAt || new Date().toISOString(),
    },
  };

  // Send to all webhooks subscribed to this event
  const relevantWebhooks = webhooks.filter(w => 
    w.events.includes('bulkscan.completed')
  );

  await Promise.allSettled(
    relevantWebhooks.map(webhook => sendWebhook(webhook, payload))
  );
}

/**
 * Trigger webhooks for issue.detected event
 * Called for each critical or serious violation
 */
export async function triggerIssueDetected(
  userId: string,
  scanId: string,
  url: string,
  violation: A11yViolation
): Promise<void> {
  // Only trigger for critical and serious issues
  if (violation.impact !== 'critical' && violation.impact !== 'serious') {
    return;
  }

  const webhooks = await getActiveWebhooks(userId);
  
  const payload: IssueDetectedPayload = {
    event: 'issue.detected',
    timestamp: new Date().toISOString(),
    data: {
      scanId,
      url,
      issue: {
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        helpUrl: violation.helpUrl,
        description: violation.description,
        tags: violation.tags,
        nodes: violation.nodes.map(n => ({
          html: n.html,
          target: n.target,
        })),
      },
    },
  };

  // Send to all webhooks subscribed to this event
  const relevantWebhooks = webhooks.filter(w => 
    w.events.includes('issue.detected')
  );

  await Promise.allSettled(
    relevantWebhooks.map(webhook => sendWebhook(webhook, payload))
  );
}

/**
 * Generate a secure webhook secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
