# Self-Hosting Anleitung für PhantomLock Vault

## Übersicht

Diese Anleitung erklärt, wie du PhantomLock Vault auf deinem eigenen Server hosten kannst.

---

## 1. Voraussetzungen

### Server-Anforderungen
- **Linux Server** (Ubuntu 22.04+ empfohlen)
- **Docker & Docker Compose** (für Supabase)
- **Node.js 18+** oder **Bun** (für das Frontend)
- **Mindestens 4GB RAM** (8GB empfohlen)
- **20GB+ Speicherplatz**

### Software
- PostgreSQL 15+ (wird von Supabase bereitgestellt)
- Deno Runtime (für Edge Functions)

---

## 2. Supabase Self-Hosting

### Option A: Docker Compose (Empfohlen)

```bash
# Klone das Supabase Repository
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Kopiere die Beispiel-Umgebungsvariablen
cp .env.example .env

# Bearbeite die .env Datei und setze:
# - POSTGRES_PASSWORD
# - JWT_SECRET (generiere mit: openssl rand -base64 32)
# - ANON_KEY (generiere mit Supabase JWT Tool)
# - SERVICE_ROLE_KEY

# Starte Supabase
docker compose up -d
```

### Wichtige URLs nach dem Start
- **Supabase Studio**: http://localhost:54323
- **API**: http://localhost:54321
- **PostgreSQL**: localhost:54322

---

## 3. Datenbank einrichten

### Migrationen ausführen

Alle SQL-Dateien aus `supabase/migrations/` müssen in der richtigen Reihenfolge ausgeführt werden:

```bash
# Verbinde dich mit PostgreSQL
psql -h localhost -p 54322 -U postgres -d postgres

# Führe jede Migration aus
\i supabase/migrations/YYYYMMDD_migration_name.sql
```

### Storage Buckets erstellen

```sql
-- Im Supabase Studio oder via SQL
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('photos', 'photos', false),
  ('files', 'files', false),
  ('note-attachments', 'note-attachments', false),
  ('tiktok-thumbnails', 'tiktok-thumbnails', false),
  ('backups', 'backups', false);
```

---

## 4. Edge Functions deployen

### Deno installieren

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### Functions deployen (mit Supabase CLI)

```bash
# Supabase CLI installieren
npm install -g supabase

# Login (nur bei Supabase Cloud)
# Für Self-Hosting: Konfiguriere die lokale Instanz
supabase init

# Functions deployen
supabase functions deploy verify-pin
supabase functions deploy vault-data
supabase functions deploy cleanup-trash
supabase functions deploy fetch-link-metadata
supabase functions deploy fetch-tiktok-metadata
supabase functions deploy verify-shared-album
```

### Alternative: Manuelles Deployment

Wenn du die Functions ohne Supabase CLI deployen möchtest, kannst du einen eigenen Deno-Server aufsetzen:

```typescript
// server.ts
import { serve } from "https://deno.land/std/http/server.ts";

// Importiere deine Functions
import { handler as verifyPin } from "./supabase/functions/verify-pin/index.ts";
import { handler as vaultData } from "./supabase/functions/vault-data/index.ts";
// ... weitere Functions

serve((req) => {
  const url = new URL(req.url);
  
  switch(url.pathname) {
    case "/functions/v1/verify-pin":
      return verifyPin(req);
    case "/functions/v1/vault-data":
      return vaultData(req);
    // ... weitere Routes
    default:
      return new Response("Not Found", { status: 404 });
  }
}, { port: 54321 });
```

---

## 5. Frontend konfigurieren

### Umgebungsvariablen setzen

Erstelle eine `.env` Datei im Projekt-Root:

```env
# Supabase Konfiguration
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=dein-anon-key-hier
VITE_SUPABASE_PROJECT_ID=local

# Optional: Für Produktion
# VITE_SUPABASE_URL=https://deine-domain.de
```

### Frontend bauen

```bash
# Dependencies installieren
npm install
# oder
bun install

# Entwicklungsserver starten
npm run dev

# Für Produktion bauen
npm run build
```

### Mit Nginx deployen

```nginx
server {
    listen 80;
    server_name deine-domain.de;

    location / {
        root /var/www/phantomlock/dist;
        try_files $uri $uri/ /index.html;
    }

    location /rest/v1/ {
        proxy_pass http://localhost:54321;
        proxy_set_header Host $host;
    }

    location /functions/v1/ {
        proxy_pass http://localhost:54321;
        proxy_set_header Host $host;
    }
}
```

---

## 6. Konfigurationsdatei

Die zentrale Konfiguration befindet sich in:

```
src/config/index.ts
```

Hier kannst du folgende Werte anpassen:
- App-Name und Version
- Session-Timeouts
- Upload-Limits
- Papierkorb-Aufbewahrungszeit
- Storage Bucket Namen

---

## 7. Sicherheitshinweise

### HTTPS einrichten

Für Produktion **MUSS** HTTPS verwendet werden:

```bash
# Mit Certbot (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.de
```

### Firewall konfigurieren

```bash
# UFW Beispiel
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 54321/tcp  # Supabase API nur intern
sudo ufw deny 54322/tcp  # PostgreSQL nur intern
```

### Backup-Strategie

```bash
# PostgreSQL Backup
pg_dump -h localhost -p 54322 -U postgres -d postgres > backup.sql

# Storage Backup
cp -r /var/lib/supabase/storage /backup/storage
```

---

## 8. Fehlerbehebung

### Verbindungsprobleme

```bash
# Prüfe ob Supabase läuft
docker compose ps

# Logs anzeigen
docker compose logs -f supabase-db
docker compose logs -f supabase-kong
```

### CORS Fehler

Stelle sicher, dass in der Supabase-Konfiguration deine Domain erlaubt ist:

```yaml
# docker/.env
ADDITIONAL_REDIRECT_URLS=https://deine-domain.de
```

---

## 9. Support

Bei Fragen oder Problemen:
1. Überprüfe die Supabase Self-Hosting Dokumentation
2. Stelle sicher, dass alle Migrationen ausgeführt wurden
3. Prüfe die Browser-Konsole auf Fehler
