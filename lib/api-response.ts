import { NextResponse } from 'next/server';
import { logger, handleApiError } from '@/lib/logger';

/**
 * Standardisierte API Response Wrapper
 */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}

export function errorResponse(message: string, status = 500, details?: unknown) {
  logger.error('API Error Response', new Error(message), { status, details });
  
  const response: { success: boolean; error: string; details?: unknown } = {
    success: false,
    error: message,
  };
  
  if (details) {
    response.details = details;
  }
  
  return NextResponse.json(response, { status });
}

export function validationErrorResponse(field: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation Error',
      field,
      message,
    },
    { status: 400 }
  );
}

/**
 * Async Handler für API Routes mit automatischem Error Handling
 */
export function withApiHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options: { operation: string }
): T {
  return (async (...args: any[]) => {
    try {
      logger.debug(`${options.operation} started`);
      const result = await handler(...args);
      logger.debug(`${options.operation} completed`);
      return result;
    } catch (error) {
      const { message, status } = handleApiError(error);
      logger.error(`${options.operation} failed`, error as Error);
      return errorResponse(message, status);
    }
  }) as T;
}

/**
 * Rate Limiting Response
 */
export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limit exceeded',
      retryAfter,
    },
    { 
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
      },
    }
  );
}

/**
 * Scan-spezifische Error Responses
 */
export const ScanErrors = {
  INVALID_URL: () => errorResponse('Ungültige URL', 400),
  URL_REQUIRED: () => errorResponse('URL ist erforderlich', 400),
  INVALID_MODE: () => errorResponse('Ungültiger Scan-Modus. Verwende "quick" oder "deep"', 400),
  SCAN_FAILED: (details?: string) => errorResponse('Scan fehlgeschlagen', 500, details),
  TIMEOUT: () => errorResponse('Scan-Timeout überschritten', 504),
  BROWSER_ERROR: () => errorResponse('Browser konnte nicht initialisiert werden', 503),
};
