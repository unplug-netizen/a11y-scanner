# A11y Scanner - Technische Verbesserungen (Phase 4)

**Analyst:** Coder Agent  
**Datum:** 2026-03-19  
**Status:** Bereit für Review

---

## Zusammenfassung

Basierend auf der Analyse des aktuellen Codes (Next.js 16, TypeScript, Tailwind, Puppeteer, axe-core) und den Research-Ergebnissen aus `shared_memory.md` habe ich technische Verbesserungen in 4 Kategorien identifiziert:

| Kategorie | Priorität | Aufwand | Impact |
|-----------|-----------|---------|--------|
| Performance-Optimierungen | P1 | M | Hoch |
| Neue Scan-Features | P1 | L | Sehr Hoch |
| API-Erweiterungen | P2 | M | Mittel |
| Code-Qualität | P2 | M | Hoch |

---

## 1. Performance-Optimierungen

### 1.1 Browser-Pool statt Einzel-Instanzen

**Problem:** Aktuell wird pro Scan eine neue Browser-Instanz gestartet (`puppeteer.launch()`). Das ist langsamer und ressourcenintensiver.

**Lösung:** Browser-Pool mit `puppeteer-cluster` oder eigenem Pool:

```typescript
// lib/browser-pool.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

interface BrowserPool {
  acquire(): Promise<puppeteer.Browser>;
  release(browser: puppeteer.Browser): void;
}

// Vorteile:
// - Wiederverwendung von Browser-Instanzen
// - Schnellere Scans (-30-50% Zeit)
// - Weniger Memory-Overhead
```

**Impact:** 30-50% schnellere Scans, besonders bei Bulk-Operations

### 1.2 Parallelisierung optimieren

**Aktuell:** `MAX_CONCURRENT = 5` im Bulk-Scan

**Verbesserung:** Dynamische Concurrency basierend auf:
- Vercel Function Memory (512MB/1GB/3GB)
- Timeout-Risiko (300s Limit)
- URL-Komplexität

```typescript
// Dynamische Concurrency
function getOptimalConcurrency(urlCount: number, mode: 'quick' | 'deep'): number {
  const memory = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '1024';
  const memoryMB = parseInt(memory);
  
  // Deep Scans brauchen mehr Memory pro Tab
  const baseConcurrency = mode === 'deep' ? 2 : 5;
  const memoryMultiplier = Math.floor(memoryMB / 512);
  
  return Math.min(urlCount, baseConcurrency * memoryMultiplier, 10);
}
```

### 1.3 Caching-Strategie

**Problem:** Gleiche URLs werden wiederholt gescannt

**Lösung:** Redis-basiertes Caching für Scan-Ergebnisse:

```typescript
// lib/cache.ts
interface CacheConfig {
  ttl: number;        // Cache-Dauer
  key: string;        // URL + Scan-Mode Hash
  invalidateOn: string[]; // Events die Cache invalidieren
}

// TTL-Vorschläge:
// - Quick Scan: 1 Stunde
// - Deep Scan: 4 Stunden
// - Bulk Scan Items: 30 Minuten
```

**Vorteile:**
- Reduziert API-Kosten
- Schnellere Wiederholungsscan
- Bessere UX bei Dashboard-Reloads

### 1.4 Streaming-Response für große Scans

**Problem:** Deep Scans mit 15+ Seiten können >10MB JSON erzeugen

**Lösung:** Streaming oder Chunked-Response:

```typescript
// app/api/scan/stream/route.ts
export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      // Sende Progress-Updates während des Scans
      for (const page of pages) {
        const result = await scanPage(page);
        controller.enqueue(JSON.stringify({
          type: 'page_complete',
          page: result.url,
          progress: ++completed / total
        }));
      }
      controller.close();
    }
  });
  
  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

---

## 2. Neue Scan-Features

### 2.1 Kontrast-Check (WCAG 1.4.3, 1.4.6)

**Warum:** axe-core erkennt Kontrast-Probleme, aber nicht alle Edge-Cases

**Implementierung:**

```typescript
// lib/contrast-checker.ts
interface ContrastResult {
  element: string;
  foreground: string;
  background: string;
  ratio: number;
  requiredRatio: number;
  wcagLevel: 'AA' | 'AAA';
  passed: boolean;
}

async function checkContrast(page: Page): Promise<ContrastResult[]> {
  return page.evaluate(() => {
    const results: ContrastResult[] = [];
    const elements = document.querySelectorAll('p, span, a, button, h1, h2, h3, h4, h5, h6');
    
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      const fg = style.color;
      const bg = style.backgroundColor;
      const ratio = calculateContrastRatio(fg, bg);
      
      // AA: 4.5:1 normal, 3:1 large text
      // AAA: 7:1 normal, 4.5:1 large text
      const fontSize = parseFloat(style.fontSize);
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && style.fontWeight === 'bold');
      const requiredAA = isLargeText ? 3 : 4.5;
      
      if (ratio < requiredAA) {
        results.push({
          element: el.outerHTML.slice(0, 100),
          foreground: fg,
          background: bg,
          ratio: Math.round(ratio * 100) / 100,
          requiredRatio: requiredAA,
          wcagLevel: 'AA',
          passed: false
        });
      }
    });
    
    return results;
  });
}
```

**UI-Integration:** Neuer Tab in ViolationCard für "Visuelle Probleme"

### 2.2 Focus-Order Analyse

**Warum:** Tastatur-Navigation ist kritisch für Accessibility

**Implementierung:**

```typescript
// lib/focus-order-checker.ts
interface FocusOrderIssue {
  type: 'missing-focus' | 'illogical-order' | 'focus-trap' | 'hidden-focusable';
  element: string;
  currentIndex?: number;
  expectedIndex?: number;
  description: string;
}

async function analyzeFocusOrder(page: Page): Promise<FocusOrderIssue[]> {
  return page.evaluate(() => {
    const issues: FocusOrderIssue[] = [];
    
    // Alle fokussierbaren Elemente
    const focusable = Array.from(document.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ));
    
    // Prüfe auf fehlende :focus Styles
    focusable.forEach(el => {
      const style = window.getComputedStyle(el);
      const hasOutline = style.outline !== 'none' || style.boxShadow !== 'none';
      
      if (!hasOutline) {
        issues.push({
          type: 'missing-focus',
          element: el.tagName,
          description: `Element ${el.tagName} hat keinen sichtbaren Focus-Indikator`
        });
      }
    });
    
    // Prüfe tabindex > 0 (Anti-Pattern)
    document.querySelectorAll('[tabindex]').forEach(el => {
      const tabIndex = parseInt(el.getAttribute('tabindex') || '0');
      if (tabIndex > 0) {
        issues.push({
          type: 'illogical-order',
          element: el.outerHTML.slice(0, 100),
          description: 'Positiver tabindex verändert natürliche Tab-Reihenfolge'
        });
      }
    });
    
    return issues;
  });
}
```

### 2.3 Screen-Reader Simulation

**Warum:** Automatisierte Prüfung von ARIA-Implementierungen

**Implementierung:**

```typescript
// lib/screen-reader-checker.ts
interface ScreenReaderIssue {
  type: 'missing-label' | 'invalid-aria' | 'redundant-aria' | 'empty-heading';
  element: string;
  ariaRole?: string;
  accessibleName?: string;
  description: string;
}

async function simulateScreenReader(page: Page): Promise<ScreenReaderIssue[]> {
  return page.evaluate(() => {
    const issues: ScreenReaderIssue[] = [];
    
    // Prüfe Bilder ohne Alt-Text
    document.querySelectorAll('img:not([alt])').forEach(img => {
      if (!img.hasAttribute('aria-label') && !img.hasAttribute('aria-labelledby')) {
        issues.push({
          type: 'missing-label',
          element: '<img>',
          description: 'Bild ohne Alt-Text oder ARIA-Label'
        });
      }
    });
    
    // Prüfe Buttons ohne accessible name
    document.querySelectorAll('button').forEach(btn => {
      const name = btn.textContent?.trim() || 
                   btn.getAttribute('aria-label') ||
                   document.getElementById(btn.getAttribute('aria-labelledby') || '')?.textContent;
      
      if (!name) {
        issues.push({
          type: 'missing-label',
          element: '<button>',
          description: 'Button ohne zugänglichen Namen'
        });
      }
    });
    
    // Prüfe leere Überschriften
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
      if (!heading.textContent?.trim()) {
        issues.push({
          type: 'empty-heading',
          element: `<${heading.tagName}>`,
          description: 'Leere Überschrift'
        });
      }
    });
    
    // Prüfe ARIA-Validität
    document.querySelectorAll('[role]').forEach(el => {
      const role = el.getAttribute('role');
      const validRoles = ['button', 'link', 'heading', 'img', 'navigation', 'main', 'search'];
      
      if (!validRoles.includes(role || '')) {
        issues.push({
          type: 'invalid-aria',
          element: el.outerHTML.slice(0, 100),
          ariaRole: role || undefined,
          description: `Ungültige ARIA-Rolle: ${role}`
        });
      }
    });
    
    return issues;
  });
}
```

### 2.4 Mobile Accessibility Check

**Warum:** Touch-Targets, Viewport-Scaling, etc.

```typescript
// lib/mobile-checker.ts
interface MobileIssue {
  type: 'small-touch-target' | 'viewport-scale-disabled' | 'orientation-locked';
  element?: string;
  size?: { width: number; height: number };
  description: string;
}

async function checkMobileAccessibility(page: Page): Promise<MobileIssue[]> {
  // Emuliere Mobile Viewport
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
  
  return page.evaluate(() => {
    const issues: MobileIssue[] = [];
    
    // Prüfe Touch-Target-Größe (min 44x44pt)
    document.querySelectorAll('button, a, input, [role="button"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        issues.push({
          type: 'small-touch-target',
          element: el.tagName,
          size: { width: rect.width, height: rect.height },
          description: `Touch-Target zu klein (${Math.round(rect.width)}x${Math.round(rect.height)}px)`
        });
      }
    });
    
    // Prüfe Viewport Meta-Tag
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const content = viewport.getAttribute('content') || '';
      if (content.includes('user-scalable=no')) {
        issues.push({
          type: 'viewport-scale-disabled',
          description: 'User-Scaling ist deaktiviert'
        });
      }
    }
    
    return issues;
  });
}
```

---

## 3. API-Erweiterungen

### 3.1 Webhook-Events

**Warum:** Echtzeit-Benachrichtigungen für CI/CD und externe Systeme

**Implementierung:**

```typescript
// types/webhooks.ts
interface WebhookEvent {
  id: string;
  type: 'scan.completed' | 'scan.failed' | 'bulkscan.completed' | 'scheduledscan.completed' | 'issue.detected';
  timestamp: string;
  data: ScanCompletedData | IssueDetectedData;
}

interface WebhookConfig {
  id: string;
  userId: string;
  url: string;
  secret: string; // Für HMAC-Signature
  events: string[];
  isActive: boolean;
  createdAt: string;
}

// lib/webhooks.ts
async function triggerWebhook(event: WebhookEvent, config: WebhookConfig) {
  const payload = JSON.stringify(event);
  const signature = createHmac('sha256', config.secret).update(payload).digest('hex');
  
  await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-A11y-Scanner-Signature': `sha256=${signature}`,
      'X-A11y-Scanner-Event': event.type,
    },
    body: payload,
  });
}
```

**Events:**
| Event | Trigger | Payload |
|-------|---------|---------|
| `scan.completed` | Einzelscan fertig | ScanResult + URL |
| `scan.failed` | Scan fehlgeschlagen | Error + URL |
| `bulkscan.completed` | Bulk-Scan fertig | AggregateReport |
| `scheduledscan.completed` | Cron-Scan fertig | ScanResult + Trend |
| `issue.detected` | Neue kritische Issues | Violation[] + URL |

### 3.2 Export-Formate

**Aktuell:** PDF (pdfmake)

**Neu:**

```typescript
// app/api/export/route.ts
interface ExportRequest {
  scanId: string;
  format: 'pdf' | 'csv' | 'json' | 'sarif' | 'html';
  options?: {
    includeFixed?: boolean;
    template?: 'detailed' | 'summary' | 'executive';
  };
}

// SARIF (Static Analysis Results Interchange Format)
// Standard für Security/Accessibility Tools, wird von GitHub unterstützt
function exportToSarif(result: ScanResult) {
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'A11y Scanner',
          version: '1.0.0',
          rules: result.violations.map(v => ({
            id: v.id,
            name: v.help,
            shortDescription: { text: v.description },
            helpUri: v.helpUrl,
          }))
        }
      },
      results: result.violations.map(v => ({
        ruleId: v.id,
        level: v.impact === 'critical' ? 'error' : 'warning',
        message: { text: v.help },
        locations: v.nodes.map(n => ({
          physicalLocation: {
            artifactLocation: { uri: result.url },
            region: { snippet: { text: n.html } }
          }
        }))
      }))
    }]
  };
}

// CSV für Excel-Import
function exportToCsv(result: ScanResult): string {
  const headers = ['ID', 'Impact', 'Description', 'Help URL', 'Element', 'Tags'];
  const rows = result.violations.flatMap(v => 
    v.nodes.map(n => [
      v.id,
      v.impact,
      `"${v.description.replace(/"/g, '""')}"`,
      v.helpUrl,
      `"${n.html.replace(/"/g, '""').slice(0, 200)}"`,
      v.tags.join(', ')
    ].join(','))
  );
  return [headers.join(','), ...rows].join('\n');
}

// HTML Report (selbstständige Datei)
function exportToHtml(result: ScanResult): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>A11y Report - ${result.url}</title>
  <style>${getReportStyles()}</style>
</head>
<body>
  <h1>Accessibility Report</h1>
  <p>URL: ${result.url}</p>
  <p>Date: ${result.timestamp}</p>
  <div class="compliance-badges">
    ${renderComplianceBadges(result.compliance)}
  </div>
  <h2>Violations (${result.violations.length})</h2>
  ${result.violations.map(v => renderViolation(v)).join('')}
</body>
</html>`;
}
```

### 3.3 GraphQL API (Optional)

**Warum:** Flexible Datenabfragen für komplexe Dashboards

```typescript
// app/api/graphql/route.ts
const typeDefs = gql`
  type Scan {
    id: ID!
    url: String!
    timestamp: String!
    violations: [Violation!]!
    compliance: ComplianceStatus!
    pages: [PageResult!]
  }

  type Violation {
    id: ID!
    impact: Impact!
    description: String!
    help: String!
    helpUrl: String!
    nodes: [Node!]!
  }

  type Query {
    scan(id: ID!): Scan
    scans(
      userId: ID!
      limit: Int = 10
      offset: Int = 0
      filter: ScanFilter
    ): ScanConnection
    trends(userId: ID!, url: String, days: Int = 30): TrendData
  }

  input ScanFilter {
    urlContains: String
    hasViolations: Boolean
    dateFrom: String
    dateTo: String
  }
`;
```

---

## 4. Code-Qualität

### 4.1 Test-Abdeckung erweitern

**Aktueller Stand:** Nur Basis-Tests in `__tests__/`

**Ziel:** >80% Coverage

```typescript
// __tests__/scan-server.test.ts
import { scanWebsite, calculateCompliance } from '@/lib/scan-server';

// Integration Tests mit Mock-Browser
jest.mock('puppeteer-core');

describe('scanWebsite', () => {
  it('should handle timeouts gracefully', async () => {
    // Teste Timeout-Handling
  });

  it('should aggregate violations across pages', async () => {
    // Teste Deduplizierung
  });

  it('should calculate compliance correctly', () => {
    const violations = [
      { tags: ['wcag21aa'] },
      { tags: ['wcag2a'] },
    ];
    const compliance = calculateCompliance(violations as any);
    expect(compliance.wcag21.AA).toBe(false);
    expect(compliance.wcag21.A).toBe(false);
  });
});

// __tests__/contrast-checker.test.ts
describe('Contrast Checker', () => {
  it('should detect insufficient contrast', async () => {
    // Teste Kontrast-Berechnung
  });

  it('should handle transparent backgrounds', async () => {
    // Edge Case: rgba(0,0,0,0)
  });
});

// E2E Tests mit Playwright
describe('E2E: Full Scan Flow', () => {
  it('should complete a full scan end-to-end', async () => {
    // Teste kompletten Flow: URL eingeben → Scan starten → Ergebnisse anzeigen
  });
});
```

### 4.2 Error Handling & Monitoring

**Aktuell:** Basic try/catch mit console.error

**Verbesserung:** Strukturiertes Error-Handling + Sentry

```typescript
// lib/errors.ts
export class ScanError extends Error {
  constructor(
    message: string,
    public code: 'TIMEOUT' | 'BROWSER_CRASH' | 'INVALID_URL' | 'NETWORK_ERROR',
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

// lib/monitoring.ts
import * as Sentry from '@sentry/nextjs';

export function initMonitoring() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.httpIntegration(),
    ],
  });
}

export function captureScanError(error: ScanError, scanId: string) {
  Sentry.captureException(error, {
    tags: { scanId, errorCode: error.code },
    extra: error.context,
  });
}

// Verwendung in scan-server.ts
try {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
} catch (error) {
  if (error instanceof puppeteer.errors.TimeoutError) {
    throw new ScanError(
      `Timeout loading ${url}`,
      'TIMEOUT',
      { url, timeout: 30000 }
    );
  }
  throw error;
}
```

### 4.3 Rate Limiting & Abuse Prevention

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 Requests/Minute
  analytics: true,
});

// Middleware für API-Routes
export async function rateLimitMiddleware(
  request: NextRequest,
  identifier: string
) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        }
      }
    );
  }
}
```

### 4.4 Type Safety verbessern

**Aktuell:** Einige `any` Types in scan-server.ts

**Verbesserung:** Striktere Typen

```typescript
// types/puppeteer.ts
import { Page, Browser } from 'puppeteer-core';

export interface ScanPage extends Page {
  // Erweiterte Typen für unsere Use-Cases
}

// lib/scan-server.ts - Striktere Typisierung
async function scanSinglePage(
  browser: Browser,
  url: string,
  axeCoreSource: string
): Promise<PageResult> {
  const page = await browser.newPage();
  // ...
}

// Zod für Runtime-Validierung
import { z } from 'zod';

const ScanRequestSchema = z.object({
  url: z.string().url(),
  mode: z.enum(['quick', 'deep']).default('quick'),
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;
```

---

## Priorisierung & Roadmap

### Phase 4.1 (Sofort - P1)
1. **Browser-Pool** → 30-50% Performance-Improvement
2. **Kontrast-Check** → Hoher User-Value
3. **Error Handling + Sentry** → Stabilität
4. **Test-Abdeckung** → Vertrauen in Deployments

### Phase 4.2 (Nächster Sprint - P2)
1. **Focus-Order Analyse**
2. **Webhook-Events**
3. **SARIF Export** (für GitHub Integration)
4. **Caching-Strategie**

### Phase 4.3 (Später - P3)
1. **Screen-Reader Simulation**
2. **Mobile Accessibility Check**
3. **GraphQL API**
4. **CSV/HTML Export**

---

## Geschätzter Aufwand

| Phase | Features | Geschätzte Zeit |
|-------|----------|-----------------|
| 4.1 | Browser-Pool, Kontrast, Error Handling, Tests | 3-4 Tage |
| 4.2 | Focus-Order, Webhooks, SARIF, Caching | 2-3 Tage |
| 4.3 | Screen-Reader, Mobile, GraphQL, Export | 3-4 Tage |
| **Gesamt** | | **8-11 Tage** |

---

## Technische Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Puppeteer-Pool auf Vercel instabil | Mittel | Hoch | Fallback zu aktuellem Verhalten |
| Memory-Limit bei Deep Scans | Hoch | Mittel | Streaming + Pagination |
| axe-core Updates brechen Tests | Niedrig | Mittel | Pinned Version + Regression Tests |

---

**Empfehlung:** Mit Phase 4.1 starten - die Performance-Verbesserungen und bessere Fehlerbehandlung haben sofortigen Impact auf User Experience und System-Stabilität.
