# Supabase Migration - Schnellanleitung

## Schritt 1: Supabase Dashboard öffnen
1. Gehe zu https://supabase.com/dashboard
2. Wähle dein Projekt aus
3. Klicke auf "SQL Editor" im linken Menü

## Schritt 2: Neue Query erstellen
1. Klicke auf "New query"
2. Kopiere den Inhalt aus `supabase/migrations/20250319_phase42_complete_migration.sql`

## Schritt 3: Migration ausführen
1. Füge den SQL-Code ein
2. Klicke auf "Run"
3. Prüfe, ob keine Fehler auftreten

## Schritt 4: Tabellen verifizieren
Führe diese Query aus, um zu prüfen, ob alle Tabellen erstellt wurden:

```sql
SELECT table_name 
FROM information.tables 
WHERE table_schema = 'public' 
AND table_name IN ('webhooks', 'focus_scans', 'false_positive_rules');
```

Erwartetes Ergebnis: 3 Zeilen

## Schritt 5: Deploy
Nach erfolgreicher Migration:
```bash
vercel --prod
```

## Troubleshooting

### Fehler: "relation already exists"
Die Tabellen existieren bereits. Kein Problem - die Migration verwendet `IF NOT EXISTS`.

### Fehler: "permission denied"
Stelle sicher, dass du als Projekt-Owner eingeloggt bist.

### Fehler: "foreign key constraint"
Die `auth.users` Tabelle muss existieren (wird von Supabase Auth automatisch erstellt).
