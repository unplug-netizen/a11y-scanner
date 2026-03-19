import OpenAI from 'openai';
import { A11yViolation, FixSuggestion, EnhancedFixSuggestion, CodeExample, Resource } from '@/types';

// WCAG criterion mapping for common violations
const WCAG_MAPPING: Record<string, { criterion: string; level: string; url: string }> = {
  'aria-allowed-attr': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'aria-hidden-body': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'aria-required-attr': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'aria-required-children': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'aria-required-parent': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'aria-roles': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'aria-valid-attr-value': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'aria-valid-attr': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'button-name': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'color-contrast': { criterion: '1.4.3 Contrast (Minimum)', level: 'AA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html' },
  'color-contrast-enhanced': { criterion: '1.4.6 Contrast (Enhanced)', level: 'AAA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html' },
  'definition-list': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'dlitem': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'document-title': { criterion: '2.4.2 Page Titled', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/page-titled.html' },
  'duplicate-id': { criterion: '4.1.1 Parsing', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/parsing.html' },
  'empty-heading': { criterion: '2.4.6 Headings and Labels', level: 'AA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html' },
  'form-field-multiple-labels': { criterion: '3.3.2 Labels or Instructions', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html' },
  'frame-tested': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'frame-title': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'heading-order': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'html-has-lang': { criterion: '3.1.1 Language of Page', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html' },
  'html-lang-valid': { criterion: '3.1.1 Language of Page', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html' },
  'html-xml-lang-match': { criterion: '3.1.1 Language of Page', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html' },
  'image-alt': { criterion: '1.1.1 Non-text Content', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html' },
  'input-button-name': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'input-image-alt': { criterion: '1.1.1 Non-text Content', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html' },
  'label': { criterion: '3.3.2 Labels or Instructions', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html' },
  'label-title-only': { criterion: '3.3.2 Labels or Instructions', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html' },
  'landmark-banner-is-top-level': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'landmark-complementary-is-top-level': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'landmark-contentinfo-is-top-level': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'landmark-main-is-top-level': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'landmark-no-duplicate-banner': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'landmark-no-duplicate-contentinfo': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'landmark-one-main': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'landmark-unique': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'link-in-text-block': { criterion: '1.4.1 Use of Color', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html' },
  'link-name': { criterion: '2.4.4 Link Purpose (In Context)', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html' },
  'list': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'listitem': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'marquee': { criterion: '2.2.2 Pause, Stop, Hide', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html' },
  'meta-refresh': { criterion: '2.2.1 Timing Adjustable', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/timing-adjustable.html' },
  'meta-viewport': { criterion: '1.4.4 Resize Text', level: 'AA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html' },
  'meta-viewport-large': { criterion: '1.4.4 Resize Text', level: 'AA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html' },
  'object-alt': { criterion: '1.1.1 Non-text Content', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html' },
  'p-as-heading': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'page-has-heading-one': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'presentation-role-conflict': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'region': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'role-img-alt': { criterion: '1.1.1 Non-text Content', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html' },
  'scope-attr-valid': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'scrollable-region-focusable': { criterion: '2.1.1 Keyboard', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html' },
  'select-name': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'server-side-image-map': { criterion: '2.1.1 Keyboard', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html' },
  'skip-link': { criterion: '2.4.1 Bypass Blocks', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html' },
  'svg-img-alt': { criterion: '1.1.1 Non-text Content', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html' },
  'tabindex': { criterion: '2.4.3 Focus Order', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html' },
  'table-duplicate-name': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'table-fake-caption': { criterion: '1.3.1 Info and Relationships', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html' },
  'target-size': { criterion: '2.5.5 Target Size (Enhanced)', level: 'AAA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/target-size-enhanced.html' },
  'td-has-header': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'td-headers-attr': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'th-has-data-cells': { criterion: '4.1.2 Name, Role, Value', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html' },
  'valid-lang': { criterion: '3.1.2 Language of Parts', level: 'AA', url: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-parts.html' },
  'video-caption': { criterion: '1.2.2 Captions (Prerecorded)', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/captions-prerecorded.html' },
  'video-description': { criterion: '1.2.3 Audio Description or Media Alternative', level: 'A', url: 'https://www.w3.org/WAI/WCAG21/Understanding/audio-description-or-media-alternative-prerecorded.html' },
};

// Get WCAG info for a violation
function getWCAGInfo(violationId: string): { criterion: string; level: string; url: string } {
  return WCAG_MAPPING[violationId] || {
    criterion: 'Allgemeine WCAG-Richtlinie',
    level: 'A',
    url: 'https://www.w3.org/WAI/WCAG21/Understanding/'
  };
}

// Get complexity based on violation type
function getComplexity(violationId: string): 'simple' | 'moderate' | 'complex' {
  const simple = ['image-alt', 'html-has-lang', 'document-title', 'meta-viewport', 'label'];
  const complex = ['color-contrast', 'aria-roles', 'aria-required-children', 'aria-required-parent', 'table-fake-caption'];
  
  if (simple.includes(violationId)) return 'simple';
  if (complex.includes(violationId)) return 'complex';
  return 'moderate';
}

// Get estimated time based on complexity
function getEstimatedTime(complexity: string): string {
  switch (complexity) {
    case 'simple': return '5-10 Minuten';
    case 'moderate': return '15-30 Minuten';
    case 'complex': return '1-2 Stunden';
    default: return '30 Minuten';
  }
}

// Generate resources based on violation type
function generateResources(violationId: string): Resource[] {
  const wcagInfo = getWCAGInfo(violationId);
  const resources: Resource[] = [
    { title: 'WCAG 2.1 Understanding', url: wcagInfo.url, type: 'wcag' }
  ];

  // Add MDN resources for specific violations
  if (violationId.includes('aria')) {
    resources.push(
      { title: 'ARIA - MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA', type: 'mdn' },
      { title: 'ARIA Authoring Practices', url: 'https://www.w3.org/WAI/ARIA/apg/', type: 'article' }
    );
  }
  
  if (violationId.includes('image') || violationId === 'image-alt') {
    resources.push(
      { title: 'Alt-Text Decision Tree', url: 'https://www.w3.org/WAI/tutorials/images/decision-tree/', type: 'article' },
      { title: 'img element - MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img', type: 'mdn' }
    );
  }

  if (violationId.includes('label') || violationId.includes('form')) {
    resources.push(
      { title: 'Labeling Controls - MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/forms/Basic_form_hints', type: 'mdn' },
      { title: 'Form Labels - WebAIM', url: 'https://webaim.org/articles/forms/labels', type: 'article' }
    );
  }

  if (violationId.includes('color') || violationId.includes('contrast')) {
    resources.push(
      { title: 'Contrast Checker', url: 'https://webaim.org/resources/contrastchecker/', type: 'tool' },
      { title: 'Color Contrast - MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_WCAG/Perceivable/Color_contrast', type: 'mdn' }
    );
  }

  if (violationId.includes('heading')) {
    resources.push(
      { title: 'Headings - WebAIM', url: 'https://webaim.org/techniques/semanticstructure/#headings', type: 'article' }
    );
  }

  return resources;
}

export async function generateEnhancedFixSuggestion(
  violation: A11yViolation,
  html: string,
  pageContext?: string
): Promise<EnhancedFixSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  const wcagInfo = getWCAGInfo(violation.id);
  const complexity = getComplexity(violation.id);
  const estimatedTime = getEstimatedTime(complexity);
  const resources = generateResources(violation.id);

  if (!apiKey) {
    return generateFallbackSuggestion(violation, html, wcagInfo, complexity, estimatedTime, resources);
  }

  const openai = new OpenAI({ apiKey });

  const prompt = `Du bist ein Senior Accessibility-Experte mit 10+ Jahren Erfahrung. Analysiere folgenden WCAG-Verstoß und generiere einen umfassenden Fix mit Code-Beispielen.

**Verstoß:** ${violation.description}
**Hilfe:** ${violation.help}
**WCAG Kriterium:** ${wcagInfo.criterion} (Level ${wcagInfo.level})
**Tags:** ${violation.tags.join(', ')}
**Impact:** ${violation.impact}

**HTML-Code mit Problem:**
\`\`\`html
${html}
\`\`\`

${pageContext ? `**Seiten-Kontext:** ${pageContext}` : ''}

**Anforderungen an die Antwort:**

1. **fixedCode**: Der korrigierte HTML-Code (nur das fixierte Element)
2. **explanation**: Kurze Erklärung (1-2 Sätze) was das Problem ist
3. **explanationDetailed**: Detaillierte Erklärung mit:
   - Warum dies ein Problem ist
   - Welche Benutzer betroffen sind (Screen-Reader, Tastatur, etc.)
   - Bezug zum WCAG Kriterium
4. **codeExamples**: Array mit zusätzlichen Code-Beispielen für verschiedene Frameworks:
   - HTML (reines HTML)
   - React (JSX Komponente)
   - Vue (Vue Template)
   - CSS (falls relevant)
5. **confidenceScore**: Zahl 70-95 (wie sicher ist der Fix)

Gib die Antwort als JSON zurück:
{
  "fixedCode": "string",
  "explanation": "string",
  "explanationDetailed": "string",
  "codeExamples": [
    { "title": "HTML", "code": "string", "language": "html" },
    { "title": "React", "code": "string", "language": "react" },
    { "title": "Vue", "code": "string", "language": "vue" }
  ],
  "confidenceScore": 85
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Experte für Web Accessibility (WCAG 2.1/2.2). Du gibst präzise, technische Antworten mit praktischen Code-Beispielen im JSON-Format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Keine Antwort von OpenAI');
    }

    const result = JSON.parse(content);

    return {
      violationId: violation.id,
      violationType: violation.id,
      impact: violation.impact || 'moderate',
      originalCode: html,
      originalHtml: html,
      fixedCode: result.fixedCode || html,
      explanation: result.explanation || violation.help,
      explanationDetailed: result.explanationDetailed || result.explanation || violation.help,
      codeExamples: result.codeExamples || generateDefaultCodeExamples(violation, html),
      wcagCriterion: wcagInfo.criterion,
      wcagLevel: wcagInfo.level,
      wcagUrl: wcagInfo.url,
      resources,
      confidenceScore: result.confidenceScore || 80,
      complexity,
      estimatedTime,
    };
  } catch (error) {
    console.error('OpenAI Error:', error);
    return generateFallbackSuggestion(violation, html, wcagInfo, complexity, estimatedTime, resources);
  }
}

// Generate default code examples based on violation type
function generateDefaultCodeExamples(violation: A11yViolation, html: string): CodeExample[] {
  const examples: CodeExample[] = [];

  // HTML example (always include)
  examples.push({
    title: 'HTML',
    code: html,
    language: 'html'
  });

  // React example
  if (violation.id === 'image-alt') {
    examples.push(
      {
        title: 'React',
        code: `// ❌ Vorher
<img src="photo.jpg" />

// ✅ Nachher
<img src="photo.jpg" alt="Beschreibung des Bildes" />`,
        language: 'react'
      },
      {
        title: 'Vue',
        code: `<!-- ❌ Vorher -->
<img src="photo.jpg" />

<!-- ✅ Nachher -->
<img src="photo.jpg" alt="Beschreibung des Bildes" />`,
        language: 'vue'
      }
    );
  } else if (violation.id === 'label') {
    examples.push(
      {
        title: 'React',
        code: `// ❌ Vorher
<input type="email" placeholder="E-Mail" />

// ✅ Nachher - Option 1: Label mit htmlFor
<label htmlFor="email">E-Mail-Adresse</label>
<input type="email" id="email" />

// ✅ Nachher - Option 2: Aria-Label
<input type="email" aria-label="E-Mail-Adresse" />`,
        language: 'react'
      },
      {
        title: 'Vue',
        code: `<!-- ❌ Vorher -->
<input type="email" placeholder="E-Mail" />

<!-- ✅ Nachher -->
<label for="email">E-Mail-Adresse</label>
<input type="email" id="email" />`,
        language: 'vue'
      }
    );
  } else if (violation.id === 'button-name') {
    examples.push(
      {
        title: 'React',
        code: `// ❌ Vorher
<button><Icon name="search" /></button>

// ✅ Nachher
<button aria-label="Suchen"><Icon name="search" /></button>
// oder
<button><Icon name="search" /> Suchen</button>`,
        language: 'react'
      }
    );
  }

  return examples;
}

// Generate fallback suggestion when OpenAI is unavailable
function generateFallbackSuggestion(
  violation: A11yViolation,
  html: string,
  wcagInfo: { criterion: string; level: string; url: string },
  complexity: 'simple' | 'moderate' | 'complex',
  estimatedTime: string,
  resources: Resource[]
): EnhancedFixSuggestion {
  const fallbackMessages: Record<string, { explanation: string; detailed: string; fix: string }> = {
    'image-alt': {
      explanation: 'Bilder benötigen einen alternativen Text für Screen-Reader-Benutzer.',
      detailed: 'Blinde und sehbehinderte Nutzer können Bilder nicht sehen. Ein alt-Text beschreibt den Inhalt und die Funktion des Bildes. Dies ist essentiell für WCAG 1.1.1 Non-text Content (Level A).',
      fix: html.replace(/<img([^>]*)>/, '<img$1 alt="Beschreibung des Bildes">')
    },
    'label': {
      explanation: 'Formularfelder benötigen ein zugeordnetes Label.',
      detailed: 'Screen-Reader-Benutzer können Formularfelder ohne Label nicht identifizieren. Ein Label kann mit dem for-Attribut oder als Wrapper um das Input-Element verwendet werden. Betrifft WCAG 3.3.2 Labels or Instructions (Level A).',
      fix: `<label>\n  Label-Text\n  ${html.trim()}\n</label>`
    },
    'button-name': {
      explanation: 'Buttons benötigen einen zugänglichen Namen.',
      detailed: 'Buttons müssen für Screen-Reader-Benutzer identifizierbar sein. Dies kann durch Text-Inhalt, aria-label oder aria-labelledby erreicht werden. Betrifft WCAG 4.1.2 Name, Role, Value (Level A).',
      fix: html.replace(/<button/, '<button aria-label="Button-Aktion"')
    },
    'color-contrast': {
      explanation: 'Der Farbkontrast zwischen Text und Hintergrund ist unzureichend.',
      detailed: 'Menschen mit Sehbehinderungen oder Farbblindheit benötigen ausreichenden Kontrast, um Text lesen zu können. Der Mindestkontrast für normalen Text beträgt 4.5:1 (WCAG AA). Verwenden Sie einen Contrast Checker, um passende Farben zu finden.',
      fix: '/* Erhöhen Sie den Kontrast in Ihrem CSS */\n.element {\n  color: #000000; /* oder eine dunklere Farbe */\n  background-color: #ffffff; /* oder eine hellere Farbe */\n}'
    },
    'heading-order': {
      explanation: 'Überschriften sollten in hierarchischer Reihenfolge verwendet werden.',
      detailed: 'Screen-Reader-Benutzer nutzen Überschriften zur Navigation. Eine korrekte Hierarchie (h1 → h2 → h3) ist essentiell für die Orientierung. Vermeiden Sie das Überspringen von Ebenen. Betrifft WCAG 1.3.1 Info and Relationships (Level A).',
      fix: html.replace(/h[3-6]/, 'h2') // Simplified fallback
    },
    'link-name': {
      explanation: 'Links benötigen einen zugänglichen Namen, der den Zweck beschreibt.',
      detailed: 'Screen-Reader-Benutzer hören Links außerhalb des Kontexts. Vermeiden Sie generische Texte wie "Hier klicken" oder "Mehr". Beschreiben Sie stattdessen das Ziel des Links. Betrifft WCAG 2.4.4 Link Purpose (Level A).',
      fix: html.replace(/>([^<]*)</, '>Beschreibender Link-Text<')
    },
    'aria-roles': {
      explanation: 'ARIA-Rollen müssen gültig sein und korrekt verwendet werden.',
      detailed: 'Ungültige oder falsch verwendete ARIA-Rollen können Screen-Reader verwirren. Verwenden Sie nur standardisierte ARIA-Rollen und stellen Sie sicher, dass sie mit den erforderlichen Attributen kombiniert werden.',
      fix: html // No simple fallback fix available
    },
  };

  const fallback = fallbackMessages[violation.id] || {
    explanation: violation.help,
    detailed: `${violation.help} Dieser Verstoß betrifft ${wcagInfo.criterion} (Level ${wcagInfo.level}).`,
    fix: html
  };

  return {
    violationId: violation.id,
    violationType: violation.id,
    impact: violation.impact || 'moderate',
    originalCode: html,
    originalHtml: html,
    fixedCode: fallback.fix,
    explanation: fallback.explanation,
    explanationDetailed: fallback.detailed,
    codeExamples: generateDefaultCodeExamples(violation, html),
    wcagCriterion: wcagInfo.criterion,
    wcagLevel: wcagInfo.level,
    wcagUrl: wcagInfo.url,
    resources,
    confidenceScore: 70,
    complexity,
    estimatedTime,
  };
}

// Legacy function for backward compatibility
export async function generateFixSuggestion(
  violation: A11yViolation,
  html: string
): Promise<FixSuggestion> {
  const enhanced = await generateEnhancedFixSuggestion(violation, html);
  
  return {
    violationId: enhanced.violationId,
    originalCode: enhanced.originalCode,
    fixedCode: enhanced.fixedCode,
    explanation: enhanced.explanation,
  };
}

// Batch generate fix suggestions for multiple violations
export async function generateBatchFixSuggestions(
  violations: Array<{ violation: A11yViolation; html: string }>
): Promise<EnhancedFixSuggestion[]> {
  const suggestions: EnhancedFixSuggestion[] = [];
  
  // Process in batches to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < violations.length; i += batchSize) {
    const batch = violations.slice(i, i + batchSize);
    const batchPromises = batch.map(({ violation, html }) => 
      generateEnhancedFixSuggestion(violation, html)
    );
    
    const batchResults = await Promise.all(batchPromises);
    suggestions.push(...batchResults);
    
    // Small delay between batches
    if (i + batchSize < violations.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return suggestions;
}
