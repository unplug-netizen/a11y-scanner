import OpenAI from 'openai';
import { A11yViolation, FixSuggestion } from '@/types';

export async function generateFixSuggestion(
  violation: A11yViolation,
  html: string
): Promise<FixSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      violationId: violation.id,
      originalCode: html,
      fixedCode: 'OpenAI API Key nicht konfiguriert',
      explanation: 'Bitte setze die OPENAI_API_KEY Umgebungsvariable, um KI-Fix-Vorschläge zu erhalten.',
    };
  }

  const openai = new OpenAI({ apiKey });

  const prompt = `Du bist ein Accessibility-Experte. Analysiere folgenden WCAG-Verstoß und generiere einen konkreten Fix.

Verstoß: ${violation.description}
Hilfe: ${violation.help}
Tags: ${violation.tags.join(', ')}
Impact: ${violation.impact}

HTML-Code mit Problem:
\`\`\`html
${html}
\`\`\`

Gib eine JSON-Antwort zurück:
{
  "fixedCode": "Der korrigierte HTML-Code",
  "explanation": "Erklärung der Änderungen"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Experte für Web Accessibility (WCAG 2.1). Du gibst präzise, technische Antworten im JSON-Format.',
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
      originalCode: html,
      fixedCode: result.fixedCode || 'Kein Fix verfügbar',
      explanation: result.explanation || 'Keine Erklärung verfügbar',
    };
  } catch (error) {
    console.error('OpenAI Error:', error);
    return {
      violationId: violation.id,
      originalCode: html,
      fixedCode: 'Fehler bei der Generierung',
      explanation: 'Der KI-Service ist momentan nicht verfügbar.',
    };
  }
}
