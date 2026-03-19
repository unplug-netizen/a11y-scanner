import { NextRequest, NextResponse } from 'next/server';
import { generateFixSuggestion } from '@/lib/openai';
import { A11yViolation } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { violation, html } = body;

    if (!violation || !html) {
      return NextResponse.json(
        { error: 'Violation und HTML sind erforderlich' },
        { status: 400 }
      );
    }

    const suggestion = await generateFixSuggestion(violation as A11yViolation, html);
    
    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('Fix API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fix-Generierung fehlgeschlagen' },
      { status: 500 }
    );
  }
}
