import { NextRequest, NextResponse } from 'next/server';
import { generateVisualOverlay, generateVisualOverlayForViewport } from '@/lib/visual-overlay';
import { A11yViolation } from '@/types';

/**
 * POST /api/visual-overlay
 * Generate visual overlay screenshot with highlighted violations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, violations, viewport } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL ist erforderlich' },
        { status: 400 }
      );
    }

    if (!violations || !Array.isArray(violations)) {
      return NextResponse.json(
        { error: 'Violations Array ist erforderlich' },
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

    let result;
    
    if (viewport) {
      // Generate overlay for specific viewport
      result = await generateVisualOverlayForViewport(
        validatedUrl,
        violations as A11yViolation[],
        viewport
      );
    } else {
      // Generate full page overlay
      result = await generateVisualOverlay(
        validatedUrl,
        violations as A11yViolation[]
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Visual Overlay API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Visual-Overlay-Generierung fehlgeschlagen' },
      { status: 500 }
    );
  }
}
