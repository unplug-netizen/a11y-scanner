import { NextRequest, NextResponse } from 'next/server';
import { generateEnhancedFixSuggestion, generateBatchFixSuggestions } from '@/lib/openai-enhanced';
import { A11yViolation } from '@/types';

/**
 * POST /api/fix-enhanced
 * Generate enhanced AI fix suggestions with code examples
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { violation, html, pageContext, batch } = body;

    // Batch processing
    if (batch && Array.isArray(batch)) {
      const suggestions = await generateBatchFixSuggestions(
        batch.map((item: { violation: A11yViolation; html: string }) => ({
          violation: item.violation,
          html: item.html
        }))
      );
      
      return NextResponse.json({ suggestions });
    }

    // Single violation processing
    if (!violation || !html) {
      return NextResponse.json(
        { error: 'Violation und HTML sind erforderlich' },
        { status: 400 }
      );
    }

    const suggestion = await generateEnhancedFixSuggestion(
      violation as A11yViolation,
      html,
      pageContext
    );
    
    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('Enhanced Fix API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fix-Generierung fehlgeschlagen' },
      { status: 500 }
    );
  }
}
