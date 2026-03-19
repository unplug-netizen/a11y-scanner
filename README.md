# A11y Scanner - AI-Powered Accessibility Compliance Webapp

Ein MVP für automatisierte WCAG-Prüfung mit KI-generierten Fix-Vorschlägen.

🚀 **Live Demo:** https://a11y-scanner-red.vercel.app

## Features

### Core Features
- 🔍 URL-basierter Website-Scan mit axe-core
- 📊 Priorisierte Ergebnisse (Critical, Warning, Info)
- 🤖 KI-generierte Fix-Vorschläge via OpenAI
- 📄 PDF-Report Download
- 🔐 Supabase Auth mit Login/Signup
- 📜 Scan-History für eingeloggte User
- ⏱️ Rate Limiting (3 Scans/Tag ohne Auth)

### Phase 2 Features

#### 1. Bulk Scan 🚀
- **Mehrere URLs auf einmal scannen** (bis zu 50 URLs)
- **CSV/TXT Upload** oder Textarea mit URLs
- **Queue-System** mit max. 5 parallelen Scans
- **Aggregierter Report** mit:
  - Gesamtübersicht aller Verstöße
  - Häufigste Verstöße
  - Compliance-Statistik
  - CSV-Export

#### 2. Scheduled Scans 📅
- **Automatische Scans** täglich/wöchentlich/monatlich
- **Vercel Cron Jobs** (konfiguriert in vercel.json)
- **Email-Benachrichtigungen** bei neuen Issues
- **History mit Trend-Analyse**:
  - Verlauf der Verstöße über Zeit
  - Trend-Erkennung (verbessernd/verschlechternd/stabil)
  - Neue vs. behobene Verstöße

#### 3. Developer API 🔑
- **API-Key-basierter Zugriff**
- **Endpoints**:
  - `POST /api/v1/scan` - Scan starten
  - `GET /api/v1/results/:id` - Ergebnisse abrufen
- **Rate Limiting** pro Key (konfigurierbar: 50-1000/h)
- **JSON-Responses**

## Tech Stack

- Next.js 16+ mit App Router
- TypeScript
- Tailwind CSS
- Supabase (Auth + Database)
- axe-core (Accessibility Scanning)
- OpenAI API
- Puppeteer + @sparticuz/chromium (Serverless)

## Setup

### 1. Dependencies installieren

```bash
npm install
```

### 2. Umgebungsvariablen konfigurieren

`.env.local` erstellen:

```bash
cp .env.example .env.local
```

Folgende Werte eintragen:

```env
# OpenAI (erforderlich für KI-Fixes)
OPENAI_API_KEY=sk-...

# Supabase (erforderlich für Auth & History)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Cron Secret für Scheduled Scans
CRON_SECRET=your-random-secret
```

### 3. Supabase einrichten

1. Erstelle ein Projekt auf [supabase.com](https://supabase.com)
2. Führe das Schema aus `supabase/schema.sql` im SQL Editor aus
3. Kopiere die API Keys in `.env.local`

### 4. Dev Server starten

```bash
npm run dev
```

App läuft unter: http://localhost:3000

## Nutzung

### Ohne Account
- Bis zu 3 Scans pro Tag
- Alle Scan-Features verfügbar
- Keine Speicherung der Ergebnisse

### Mit Account
- Unbegrenzte Scans
- Scan-History wird gespeichert
- **Bulk Scans** (bis zu 50 URLs)
- **Geplante Scans** mit Email-Benachrichtigungen
- **Developer API** mit API Keys

## API Routes

### Core Routes
- `POST /api/scan` - Führt axe-core Scan durch
- `POST /api/fix` - Generiert KI-Fix-Vorschläge
- `GET /api/scans` - Lädt Scan-History (auth required)
- `POST /api/scans` - Speichert einen Scan (auth required)
- `DELETE /api/scans` - Löscht einen Scan (auth required)

### Phase 2 Routes

#### Bulk Scan
- `POST /api/bulk-scan` - Startet Bulk Scan (auth required)
- `GET /api/bulk-scan` - Listet Bulk Scans (auth required)
- `GET /api/bulk-scan?id=:id` - Einzelnen Bulk Scan abrufen
- `DELETE /api/bulk-scan?id=:id` - Bulk Scan löschen

#### Scheduled Scans
- `POST /api/scheduled-scan` - Erstellt geplanten Scan
- `GET /api/scheduled-scan` - Listet geplante Scans
- `GET /api/scheduled-scan?id=:id&trend=true` - Trend-Analyse
- `GET /api/scheduled-scan?id=:id&history=true` - Scan-History
- `PATCH /api/scheduled-scan?id=:id` - Aktualisiert Scan
- `DELETE /api/scheduled-scan?id=:id` - Löscht Scan

#### Cron Job
- `GET /api/cron/scheduled-scan` - Führt fällige Scans aus (Vercel Cron)

#### Developer API
- `POST /api/v1/scan` - Scan starten (API Key required)
- `GET /api/v1/results/:id` - Scan-Ergebnisse abrufen

#### API Key Management
- `GET /api/api-keys` - Listet API Keys
- `POST /api/api-keys` - Erstellt neuen API Key
- `PATCH /api/api-keys?id=:id` - Aktualisiert API Key
- `DELETE /api/api-keys?id=:id` - Löscht API Key

## API Nutzung

### Authentication

Alle API Requests benötigen einen API Key im Header:

```bash
curl -X POST https://a11y-scanner-red.vercel.app/api/v1/scan \
  -H "x-api-key: a11y_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "mode": "quick"}'
```

### Rate Limiting

Standard-Limit: 100 Requests/Stunde pro API Key

### Response Format

```json
{
  "id": "uuid",
  "url": "https://example.com",
  "status": "completed",
  "result": {
    "timestamp": "2024-01-15T10:30:00Z",
    "violations": [...],
    "passes": 45,
    "incomplete": 2,
    "inapplicable": 12,
    "compliance": {
      "wcag21": { "A": true, "AA": false, "AAA": false },
      "wcag22": { "A": true, "AA": false, "AAA": false },
      "section508": true
    }
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Deployment

### Vercel

```bash
npm i -g vercel
vercel
```

Umgebungsvariablen im Vercel Dashboard setzen:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `CRON_SECRET` (optional, für Scheduled Scans)

### Vercel Cron Jobs konfigurieren

1. Gehe zu deinem Projekt im Vercel Dashboard
2. Öffne "Settings" → "Cron Jobs"
3. Füge hinzu: `0 9 * * *` → `/api/cron/scheduled-scan`

Oder nutze die `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/scheduled-scan",
      "schedule": "0 9 * * *"
    }
  ]
}
```

## Datenbank Schema

Das Schema in `supabase/schema.sql` enthält:

- `scans` - Einzelne Scans
- `bulk_scans` - Bulk Scan Jobs
- `scheduled_scans` - Geplante Scans
- `scheduled_scan_history` - Historie geplanter Scans
- `api_keys` - API Keys für Developer API
- `api_usage_logs` - API Nutzungs-Logs

## Lizenz

MIT
