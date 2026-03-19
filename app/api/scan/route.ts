import { NextRequest, NextResponse } from 'next/server';
import { scanWebsite } from '@/lib/scan-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, mode = 'quick' } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL ist erforderlich' },
        { status: 400 }
      );
    }

    // Validate mode
    if (mode !== 'quick' && mode !== 'deep') {
      return NextResponse.json(
        { error: 'Ungültiger Scan-Modus. Verwende "quick" oder "deep"' },
        { status: 400 }
      );
    }

    // Validate URL
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
        return NextResponse.json(
          { error: 'Ungültige URL' },
          { status: 400 }
        );
      }
    }

    const result = await scanWebsite(validatedUrl, mode);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Scan API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan fehlgeschlagen' },
      { status: 500 }
    );
  }
}
