# PhantomLock Vault - Konfiguration

Diese Dateien enthält alles, was du für Self-Hosting brauchst.

## Dateien in diesem Ordner

| Datei | Beschreibung |
|-------|-------------|
| `index.ts` | **Hauptkonfiguration** - Alle App-Einstellungen an einem Ort |
| `env.template` | Vorlage für deine `.env` Datei |
| `self-hosting.md` | Komplette Self-Hosting Anleitung |

## Schnellstart

1. **Kopiere die .env Vorlage:**
   ```bash
   cp src/config/env.template .env
   ```

2. **Trage deine Supabase-Daten ein:**
   - `VITE_SUPABASE_URL` - Die URL deiner Supabase-Instanz
   - `VITE_SUPABASE_PUBLISHABLE_KEY` - Der Anon/Public Key
   - `VITE_SUPABASE_PROJECT_ID` - Die Projekt-ID

3. **App starten:**
   ```bash
   npm run dev
   ```

## Was musst du wo ändern?

### Frontend (Diese Datei: `src/config/index.ts`)
- App-Name und Version
- Session-Gültigkeit
- Auto-Lock Timeout
- Upload-Limits
- Papierkorb-Einstellungen

### Umgebungsvariablen (`.env`)
- Supabase URLs und Keys
- Projekt-ID

### Edge Functions (`supabase/functions/`)
Server-seitige Variablen (werden automatisch von Supabase bereitgestellt):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Konfigurationswerte

| Einstellung | Standard | Datei |
|------------|----------|-------|
| Session-Gültigkeit | 24 Stunden | `index.ts` |
| Auto-Lock Timeout | 5 Minuten | `index.ts` |
| Max. Dateigröße | 50 MB | `index.ts` |
| Papierkorb-Aufbewahrung | 30 Tage | `index.ts` |
| Max. Login-Versuche | 5 | `index.ts` |

## Fragen?

Lies die ausführliche Anleitung in `self-hosting.md`.
