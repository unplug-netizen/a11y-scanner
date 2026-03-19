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

export interface NotificationPayload {
  type: 'scan_complete' | 'new_issues' | 'scheduled_scan' | 'bulk_scan_complete';
  userId: string;
  workspaceId?: string;
  data: {
    url?: string;
    urls?: string[];
    violationCount?: number;
    newViolations?: number;
    fixedViolations?: number;
    scanId?: string;
    bulkScanId?: string;
    scheduledScanId?: string;
    scanName?: string;
    results?: any;
  };
}

// Queue a notification for processing
export async function queueNotification(payload: NotificationPayload): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) {
    console.error('Supabase not configured');
    return;
  }

  try {
    // Get user integrations
    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', payload.userId)
      .single();

    // Queue email notification
    if (integrations?.email_enabled) {
      await supabase.from('notification_queue').insert({
        user_id: payload.userId,
        workspace_id: payload.workspaceId,
        type: 'email',
        channel: payload.type,
        payload: payload.data,
        status: 'pending',
      });
    }

    // Queue Slack notification
    if (integrations?.slack_enabled && integrations?.slack_webhook_url) {
      await supabase.from('notification_queue').insert({
        user_id: payload.userId,
        workspace_id: payload.workspaceId,
        type: 'slack',
        channel: payload.type,
        payload: payload.data,
        status: 'pending',
      });
    }
  } catch (error) {
    console.error('Error queuing notification:', error);
  }
}

// Send Slack notification
export async function sendSlackNotification(
  webhookUrl: string,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    const message = buildSlackMessage(payload);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return false;
  }
}

// Build Slack message based on notification type
function buildSlackMessage(payload: NotificationPayload): any {
  const { type, data } = payload;

  switch (type) {
    case 'scan_complete':
      return {
        text: '🔍 A11y Scan Complete',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔍 Accessibility Scan Complete',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*URL:*\n${data.url}`,
              },
              {
                type: 'mrkdwn',
                text: `*Violations:*\n${data.violationCount || 0}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: data.violationCount === 0 
                ? '✅ No violations found! Great job!' 
                : `⚠️ Found ${data.violationCount} accessibility violations that need attention.`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Results',
                  emoji: true,
                },
                url: `https://a11y-scanner-red.vercel.app`,
                style: data.violationCount && data.violationCount > 0 ? 'danger' : 'primary',
              },
            ],
          },
        ],
      };

    case 'new_issues':
      return {
        text: '🚨 New Accessibility Issues Detected',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 New Issues Detected',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*URL:*\n${data.url}`,
              },
              {
                type: 'mrkdwn',
                text: `*New Issues:*\n${data.newViolations || 0}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `⚠️ ${data.newViolations} new accessibility violations were detected in the latest scan.`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Details',
                  emoji: true,
                },
                url: `https://a11y-scanner-red.vercel.app`,
                style: 'danger',
              },
            ],
          },
        ],
      };

    case 'scheduled_scan':
      return {
        text: '📅 Scheduled Scan Complete',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📅 Scheduled Scan Complete',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Name:*\n${data.scanName || 'Scheduled Scan'}`,
              },
              {
                type: 'mrkdwn',
                text: `*URL:*\n${data.url}`,
              },
            ],
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Violations:*\n${data.violationCount || 0}`,
              },
              {
                type: 'mrkdwn',
                text: `*New Issues:*\n${data.newViolations || 0}`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: data.fixedViolations && data.fixedViolations > 0 
                  ? `✅ ${data.fixedViolations} issues fixed since last scan`
                  : 'No issues fixed since last scan',
              },
            ],
          },
        ],
      };

    case 'bulk_scan_complete':
      return {
        text: '📊 Bulk Scan Complete',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📊 Bulk Scan Complete',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*URLs Scanned:*\n${data.urls?.length || 0}`,
              },
              {
                type: 'mrkdwn',
                text: `*Total Violations:*\n${data.violationCount || 0}`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Scan completed for ${data.urls?.length || 0} URLs.`,
              },
            ],
          },
        ],
      };

    default:
      return { text: 'A11y Scanner Notification' };
  }
}

// Send email notification using Resend
export async function sendEmailNotification(
  to: string,
  payload: NotificationPayload
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.error('Resend API key not configured');
    return false;
  }

  try {
    const { subject, html } = buildEmailContent(payload);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'A11y Scanner <notifications@a11y-scanner.app>',
        to,
        subject,
        html,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending email notification:', error);
    return false;
  }
}

// Build email content
function buildEmailContent(payload: NotificationPayload): { subject: string; html: string } {
  const { type, data } = payload;

  switch (type) {
    case 'scan_complete':
      return {
        subject: `A11y Scan Complete - ${data.violationCount === 0 ? '✅ No Issues' : `⚠️ ${data.violationCount} Violations`}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: ${data.violationCount === 0 ? '#16a34a' : '#dc2626'};">
              ${data.violationCount === 0 ? '✅ Scan Complete - No Issues!' : '⚠️ Scan Complete - Issues Found'}
            </h1>
            <p><strong>URL:</strong> ${data.url}</p>
            <p><strong>Violations:</strong> ${data.violationCount || 0}</p>
            <a href="https://a11y-scanner-red.vercel.app" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
              View Results
            </a>
          </div>
        `,
      };

    case 'new_issues':
      return {
        subject: `🚨 New Accessibility Issues - ${data.newViolations} found`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #dc2626;">🚨 New Issues Detected</h1>
            <p><strong>URL:</strong> ${data.url}</p>
            <p><strong>New Violations:</strong> ${data.newViolations || 0}</p>
            <a href="https://a11y-scanner-red.vercel.app" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
              View Details
            </a>
          </div>
        `,
      };

    case 'scheduled_scan':
      return {
        subject: `📅 Scheduled Scan: ${data.scanName || 'Scan Complete'}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>📅 Scheduled Scan Complete</h1>
            <p><strong>Name:</strong> ${data.scanName || 'Scheduled Scan'}</p>
            <p><strong>URL:</strong> ${data.url}</p>
            <p><strong>Violations:</strong> ${data.violationCount || 0}</p>
            <p><strong>New Issues:</strong> ${data.newViolations || 0}</p>
            ${data.fixedViolations ? `<p><strong>Fixed:</strong> ${data.fixedViolations}</p>` : ''}
          </div>
        `,
      };

    default:
      return {
        subject: 'A11y Scanner Notification',
        html: '<p>You have a new notification from A11y Scanner.</p>',
      };
  }
}
