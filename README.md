# A11y Scanner - AI-Powered Accessibility Compliance Webapp

Ein MVP für automatisierte WCAG-Prüfung mit KI-generierten Fix-Vorschlägen.

## Features

- 🔍 URL-basierter Website-Scan mit axe-core
- 📊 Priorisierte Ergebnisse (Critical, Warning, Info)
- 🤖 KI-generierte Fix-Vorschläge via OpenAI
- 📄 PDF-Report Download
- 🔐 Supabase Auth (vorbereitet)

## Tech Stack

- Next.js 14+ mit App Router
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
# OpenAI
OPENAI_API_KEY=sk-...

# Supabase (optional für Auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Dev Server starten

```bash
npm run dev
```

App läuft unter: http://localhost:3000

## Nutzung

1. URL einer zu prüfenden Website eingeben
2. "Scan Starten" klicken
3. Ergebnisse mit Priorisierung anzeigen
4. KI-Fix-Vorschläge für jedes Problem lesen
5. PDF-Report herunterladen

## API Routes

- `POST /api/scan` - Führt axe-core Scan durch
- `POST /api/fix` - Generiert KI-Fix-Vorschläge

## Lizenz

MIT
