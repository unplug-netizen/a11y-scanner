# A11y Scanner - AI-Powered Accessibility Compliance Webapp

Ein MVP für automatisierte WCAG-Prüfung mit KI-generierten Fix-Vorschlägen.

🚀 **Live Demo:** https://a11y-scanner-red.vercel.app

## Features

- 🔍 URL-basierter Website-Scan mit axe-core
- 📊 Priorisierte Ergebnisse (Critical, Warning, Info)
- 🤖 KI-generierte Fix-Vorschläge via OpenAI
- 📄 PDF-Report Download
- 🔐 Supabase Auth mit Login/Signup
- 📜 Scan-History für eingeloggte User
- ⏱️ Rate Limiting (3 Scans/Tag ohne Auth)

## Tech Stack

- Next.js 16+ mit App Router
- TypeScript
- Tailwind CSS
- Supabase (Auth + Database)
- axe-core (Accessibility Scanning)
- OpenAI API

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
- Frühere Scans können neu geladen werden

## API Routes

- `POST /api/scan` - Führt axe-core Scan durch
- `POST /api/fix` - Generiert KI-Fix-Vorschläge
- `GET /api/scans` - Lädt Scan-History (auth required)
- `POST /api/scans` - Speichert einen Scan (auth required)
- `DELETE /api/scans` - Löscht einen Scan (auth required)

## Deployment

### Vercel

```bash
npm i -g vercel
vercel
```

Umgebungsvariablen in Vercel Dashboard setzen.

## Lizenz

MIT
