import { NextRequest, NextResponse } from 'next/server';
import { simulateScreenReader } from '@/lib/screen-reader-simulation';

/**
 * POST /api/screen-reader
 * Simulate screen reader analysis on a webpage
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL ist erforderlich' },
        { status: 400 }
      );
    }

    // Validate URL
    let validatedUrl: string;
    try {
      const urlObj = new URL(url);
      validatedUrl = urlObj.toString();
    } catch {
      try {
        const urlObj = new URL(`https://${url}`);
        validatedUrl = urlObj.toString();
      } catch {
        return NextResponse.json(
          { error: 'Ungültige URL' },
          { status: 400 }
        );
      }
    }

    const result = await simulateScreenReader(validatedUrl);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Screen Reader API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Screen-Reader-Analyse fehlgeschlagen' },
      { status: 500 }
    );
  }
}
