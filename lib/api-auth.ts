import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Create admin client
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
};

export interface ApiAuthContext {
  userId: string;
  apiKeyId: string;
  rateLimit: number;
}

export async function validateApiKey(request: NextRequest): Promise<{ 
  success: boolean; 
  context?: ApiAuthContext; 
  error?: string; 
  status?: number 
}> {
  const supabase = createAdminClient();
  if (!supabase) {
    return { success: false, error: 'Server configuration error', status: 500 };
  }

  // Get API key from header
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return { success: false, error: 'API key required', status: 401 };
  }

  // Validate API key format
  if (!apiKey.startsWith('a11y_')) {
    return { success: false, error: 'Invalid API key format', status: 401 };
  }

  // Hash the API key
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // Look up the API key
  const { data: apiKeyRecord, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !apiKeyRecord) {
    return { success: false, error: 'Invalid API key', status: 401 };
  }

  // Check if expired
  if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
    return { success: false, error: 'API key expired', status: 401 };
  }

  // Check rate limit
  const { data: usageCount, error: usageError } = await supabase.rpc(
    'get_api_usage_last_hour',
    { p_api_key_id: apiKeyRecord.id }
  );

  if (usageError) {
    console.error('Rate limit check error:', usageError);
    return { success: false, error: 'Rate limit check failed', status: 500 };
  }

  if (usageCount >= apiKeyRecord.rate_limit) {
    return { 
      success: false, 
      error: `Rate limit exceeded. Limit: ${apiKeyRecord.rate_limit} requests/hour`, 
      status: 429 
    };
  }

  // Update usage stats
  await supabase
    .from('api_keys')
    .update({
      usage_count: apiKeyRecord.usage_count + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', apiKeyRecord.id);

  return {
    success: true,
    context: {
      userId: apiKeyRecord.user_id,
      apiKeyId: apiKeyRecord.id,
      rateLimit: apiKeyRecord.rate_limit,
    },
  };
}

export async function logApiUsage(
  context: ApiAuthContext,
  request: NextRequest,
  statusCode: number,
  responseTimeMs: number
) {
  const supabase = createAdminClient();
  if (!supabase) return;

  await supabase.from('api_usage_logs').insert({
    api_key_id: context.apiKeyId,
    user_id: context.userId,
    endpoint: request.nextUrl.pathname,
    method: request.method,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
  });
}
