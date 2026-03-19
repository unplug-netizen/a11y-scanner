# A11y Scanner - Entwicklungs-Update

## Zusammenfassung

Ich habe die A11y Scanner Webapp um folgende Features erweitert:

### ✅ Phase 1 (Bestehend)
- Supabase Auth mit Login/Signup
- Scan-History für User
- Rate Limiting / Freemium-Logik
- UI-Polish und Tests

### ✅ Phase 2 - Neue Features

#### 1. Bulk Scan 🚀
- **Mehrere URLs auf einmal scannen** (bis zu 50 URLs)
- **CSV/TXT Upload** oder Textarea mit URLs
- **Queue-System** mit max. 5 parallelen Scans
- **Aggregierter Report** mit:
  - Gesamtübersicht aller Verstöße
  - Häufigste Verstöße
  - Compliance-Statistik
  - CSV-Export
- **UI-Komponenten**: `BulkScanModal`, `BulkScanHistory`

#### 2. Scheduled Scans 📅
- **Automatische Scans** täglich/wöchentlich/monatlich
- **Vercel Cron Jobs** (konfiguriert in vercel.json)
- **Email-Benachrichtigungen** bei neuen Issues
- **History mit Trend-Analyse**:
  - Verlauf der Verstöße über Zeit
  - Trend-Erkennung (verbessernd/verschlechternd/stabil)
  - Neue vs. behobene Verstöße
- **UI-Komponenten**: `ScheduledScanModal`

#### 3. Developer API 🔑
- **API-Key-basierter Zugriff**
- **Endpoints**:
  - `POST /api/v1/scan` - Scan starten
  - `GET /api/v1/results/:id` - Ergebnisse abrufen
- **Rate Limiting** pro Key (konfigurierbar: 50-1000/h)
- **JSON-Responses**
- **UI-Komponenten**: `ApiKeysModal`

## API Endpoints

### Core Routes
- `POST /api/scan` - Einzelnen Scan durchführen
- `POST /api/fix` - KI-Fix generieren
- `GET/POST/DELETE /api/scans` - Scan-History

### Phase 2 Routes

#### Bulk Scan
- `POST /api/bulk-scan` - Bulk Scan starten
- `GET /api/bulk-scan` - Bulk Scans listen
- `GET /api/bulk-scan?id=:id` - Einzelnen Bulk Scan abrufen
- `DELETE /api/bulk-scan?id=:id` - Bulk Scan löschen

#### Scheduled Scans
- `POST /api/scheduled-scan` - Geplanten Scan erstellen
- `GET /api/scheduled-scan` - Geplante Scans listen
- `GET /api/scheduled-scan?id=:id&trend=true` - Trend-Analyse
- `GET /api/scheduled-scan?id=:id&history=true` - History
- `PATCH /api/scheduled-scan?id=:id` - Scan aktualisieren
- `DELETE /api/scheduled-scan?id=:id` - Scan löschen

#### Cron Job
- `GET /api/cron/scheduled-scan` - Fällige Scans ausführen

#### Developer API
- `POST /api/v1/scan` - Scan starten (API Key)
- `GET /api/v1/results/:id` - Ergebnisse abrufen

#### API Key Management
- `GET /api/api-keys` - API Keys listen
- `POST /api/api-keys` - API Key erstellen
- `PATCH /api/api-keys?id=:id` - API Key aktualisieren
- `DELETE /api/api-keys?id=:id` - API Key löschen

## Datenbank Schema

Aktualisiert in `supabase/schema.sql`:

- `scans` - Einzelne Scans
- `bulk_scans` - Bulk Scan Jobs mit Status und Ergebnissen
- `scheduled_scans` - Geplante Scans mit Frequenz und Notifications
- `scheduled_scan_history` - Historie geplanter Scans
- `api_keys` - API Keys mit Rate Limiting
- `api_usage_logs` - API Nutzungs-Logs

## Deployment

### Vercel

```bash
vercel --prod
```

Live URL: https://a11y-scanner-red.vercel.app

### Umgebungsvariablen

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
CRON_SECRET= (optional, für Scheduled Scans)
```

### Vercel Cron Jobs

Im Vercel Dashboard unter Settings → Cron Jobs:
- `0 9 * * *` → `/api/cron/scheduled-scan`

Oder in `vercel.json`:
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

## Dateien geändert/erstellt

### Neue API Routes
- `app/api/bulk-scan/route.ts`
- `app/api/scheduled-scan/route.ts`
- `app/api/cron/scheduled-scan/route.ts`
- `app/api/api-keys/route.ts`
- `app/api/v1/scan/route.ts`
- `app/api/v1/results/[id]/route.ts`

### Neue Komponenten
- `components/BulkScan.tsx`
- `components/ScheduledScan.tsx`
- `components/ApiKeys.tsx`

### Neue Libraries
- `lib/api-auth.ts` - API Key Validierung und Rate Limiting

### Geänderte Dateien
- `app/page.tsx` - Neue Features integriert
- `types/index.ts` - Neue Typen für Phase 2
- `supabase/schema.sql` - Neue Tabellen
- `vercel.json` - Cron Jobs hinzugefügt
- `README.md` - Dokumentation aktualisiert

## Nächste Schritte

1. **Supabase Schema aktualisieren** - Neue Tabellen erstellen
2. **Vercel Cron Jobs aktivieren** - Im Dashboard konfigurieren
3. **Email-Service** - Für Scheduled Scan Notifications
4. **Tests** - Neue Features testen
5. **Dokumentation** - API Dokumentation erweitern
