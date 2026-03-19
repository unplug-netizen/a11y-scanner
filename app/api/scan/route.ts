import { NextRequest } from 'next/server';
import { scanWebsite } from '@/lib/scan-server';
import { 
  successResponse, 
  errorResponse, 
  validationErrorResponse,
  withApiHandler,
  ScanErrors 
} from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const POST = withApiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { url, mode = 'quick' } = body;

  // Validate URL presence
  if (!url || typeof url !== 'string') {
    return ScanErrors.URL_REQUIRED();
  }

  // Validate mode
  if (mode !== 'quick' && mode !== 'deep') {
    return ScanErrors.INVALID_MODE();
  }

  // Validate and normalize URL
  let validatedUrl: string;
  try {
    const urlObj = new URL(url);
    validatedUrl = urlObj.toString();
  } catch {
    // Try adding https://
    try {
      const urlObj = new URL(`https://${url}`);
      validatedUrl = urlObj.toString();
    } catch {
      return ScanErrors.INVALID_URL();
    }
  }

  logger.info('Starting scan', { url: validatedUrl, mode });
  
  const result = await scanWebsite(validatedUrl, mode);
  
  return successResponse(result);
}, { operation: 'POST /api/scan' });
