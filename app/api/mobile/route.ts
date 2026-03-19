import { NextRequest, NextResponse } from 'next/server';
import { analyzeMobileAccessibility } from '@/lib/mobile-accessibility';

/**
 * POST /api/mobile
 * Analyze mobile accessibility of a webpage
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

    const result = await analyzeMobileAccessibility(validatedUrl);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Mobile Accessibility API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mobile-Accessibility-Analyse fehlgeschlagen' },
      { status: 500 }
    );
  }
}
