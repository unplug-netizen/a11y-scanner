import { NextRequest, NextResponse } from 'next/server';
import { scanWebsite } from '@/lib/scan-server';
import { simulateScreenReader } from '@/lib/screen-reader-simulation';
import { analyzeMobileAccessibility } from '@/lib/mobile-accessibility';
import { generateVisualOverlay } from '@/lib/visual-overlay';
import { generateBatchFixSuggestions } from '@/lib/openai-enhanced';
import { CompleteScanResult, A11yViolation } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      url, 
      mode = 'quick',
      options = {}
    } = body;
    
    const {
      includeScreenReader = true,
      includeMobile = true,
      includeVisualOverlay = true,
      includeEnhancedFixes = true,
      maxFixes = 10
    } = options;

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

    // Run base scan
    console.log(`Starting ${mode} scan for ${validatedUrl}...`);
    const baseResult = await scanWebsite(validatedUrl, mode);
    
    const completeResult: CompleteScanResult = {
      ...baseResult
    };

    // Run additional analyses in parallel
    const analysisPromises: Promise<void>[] = [];

    // Screen Reader Simulation
    if (includeScreenReader) {
      analysisPromises.push(
        simulateScreenReader(validatedUrl)
          .then(result => {
            completeResult.screenReaderResult = result;
            console.log('Screen reader analysis completed');
          })
          .catch(err => {
            console.error('Screen reader analysis failed:', err);
          })
      );
    }

    // Mobile Accessibility
    if (includeMobile) {
      analysisPromises.push(
        analyzeMobileAccessibility(validatedUrl)
          .then(result => {
            completeResult.mobileResult = result;
            console.log('Mobile analysis completed');
          })
          .catch(err => {
            console.error('Mobile analysis failed:', err);
          })
      );
    }

    // Visual Overlay
    if (includeVisualOverlay && baseResult.violations.length > 0) {
      analysisPromises.push(
        generateVisualOverlay(validatedUrl, baseResult.violations)
          .then(result => {
            completeResult.visualOverlay = result;
            console.log('Visual overlay generated');
          })
          .catch(err => {
            console.error('Visual overlay generation failed:', err);
          })
      );
    }

    // Enhanced AI Fixes
    if (includeEnhancedFixes && baseResult.violations.length > 0) {
      analysisPromises.push(
        generateEnhancedFixes(baseResult.violations, maxFixes)
          .then(fixes => {
            completeResult.enhancedFixes = fixes;
            console.log('Enhanced fixes generated');
          })
          .catch(err => {
            console.error('Enhanced fixes generation failed:', err);
          })
      );
    }

    // Wait for all analyses to complete
    await Promise.allSettled(analysisPromises);

    console.log('Scan completed with all optional analyses');
    
    return NextResponse.json(completeResult);
  } catch (error) {
    console.error('Scan API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scan fehlgeschlagen' },
      { status: 500 }
    );
  }
}

/**
 * Generate enhanced fixes for violations
 */
async function generateEnhancedFixes(
  violations: A11yViolation[],
  maxFixes: number
): Promise<any[]> {
  // Prioritize violations by impact
  const prioritized = [...violations].sort((a, b) => {
    const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    return impactOrder[a.impact || 'moderate'] - impactOrder[b.impact || 'moderate'];
  });

  // Take top violations
  const topViolations = prioritized.slice(0, maxFixes);

  // Generate fixes
  const fixPromises = topViolations.map(violation => {
    const html = violation.nodes[0]?.html || '<div>Element not found</div>';
    return generateBatchFixSuggestions([{ violation, html }])
      .then(fixes => fixes[0])
      .catch(() => null);
  });

  const fixes = await Promise.all(fixPromises);
  return fixes.filter(f => f !== null);
}
