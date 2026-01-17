/**
 * =====================================================
 *  ZENTRALE KONFIGURATIONSDATEI FÜR SELF-HOSTING
 * =====================================================
 * 
 * Diese Datei enthält ALLE Konfigurationswerte, die du
 * für Self-Hosting anpassen musst. Ändere nur diese Datei!
 * 
 * ANLEITUNG FÜR SELF-HOSTING:
 * 1. Kopiere diese Datei und passe die Werte an
 * 2. Stelle sicher, dass deine Supabase-Instanz läuft
 * 3. Erstelle die .env Datei mit deinen Werten (siehe unten)
 * 
 * BENÖTIGTE UMGEBUNGSVARIABLEN (.env):
 * =====================================
 * VITE_SUPABASE_URL=https://deine-supabase-url.supabase.co
 * VITE_SUPABASE_PUBLISHABLE_KEY=dein-anon-key
 * VITE_SUPABASE_PROJECT_ID=dein-projekt-id
 * 
 * Für Edge Functions (.env auf dem Server):
 * SUPABASE_URL=https://deine-supabase-url.supabase.co
 * SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key
 */

// =====================================================
//  SUPABASE / DATENBANK KONFIGURATION
// =====================================================

/**
 * Supabase URL - Die URL deiner Supabase-Instanz
 * Für Self-Hosting: http://localhost:54321 oder deine eigene Domain
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

/**
 * Supabase Anon/Publishable Key - Der öffentliche API-Schlüssel
 * Für Self-Hosting: Den anon key aus deiner Supabase-Instanz
 */
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

/**
 * Supabase Projekt-ID - Für Storage-Uploads
 * Für Self-Hosting: Die Projekt-ID aus deiner Supabase-Instanz
 */
export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || '';

// =====================================================
//  STORAGE KONFIGURATION
// =====================================================

/**
 * TUS Endpoint für resumierbare Uploads (große Dateien)
 * Für Self-Hosting: Anpassen auf deine Supabase Storage URL
 */
export const getStorageEndpoint = () => {
  if (!SUPABASE_PROJECT_ID) return '';
  return `https://${SUPABASE_PROJECT_ID}.storage.supabase.co/storage/v1/upload/resumable`;
};

/**
 * Storage Buckets - Die Namen der Speicher-Buckets
 * Diese müssen in deiner Supabase-Instanz erstellt werden
 */
export const STORAGE_BUCKETS = {
  PHOTOS: 'photos',
  FILES: 'files',
  NOTE_ATTACHMENTS: 'note-attachments',
  TIKTOK_THUMBNAILS: 'tiktok-thumbnails',
  BACKUPS: 'backups',
} as const;

// =====================================================
//  EDGE FUNCTIONS KONFIGURATION
// =====================================================

/**
 * Edge Function Namen
 * Bei Self-Hosting müssen diese auf deinem Server deployed werden
 */
export const EDGE_FUNCTIONS = {
  VERIFY_PIN: 'verify-pin',
  VAULT_DATA: 'vault-data',
  CLEANUP_TRASH: 'cleanup-trash',
  FETCH_LINK_METADATA: 'fetch-link-metadata',
  FETCH_TIKTOK_METADATA: 'fetch-tiktok-metadata',
  VERIFY_SHARED_ALBUM: 'verify-shared-album',
} as const;

// =====================================================
//  APP KONFIGURATION
// =====================================================

/** App Name */
export const APP_NAME = 'PhantomLock Vault';

/** App Version */
export const APP_VERSION = '1.0.0';

/** Standard-Sprache */
export const DEFAULT_LOCALE = 'de-DE';

// =====================================================
//  SICHERHEITS-KONFIGURATION
// =====================================================

/** Session-Gültigkeit in Stunden */
export const SESSION_VALIDITY_HOURS = 24;

/** Auto-Lock Timeout in Minuten */
export const AUTO_LOCK_TIMEOUT_MINUTES = 5;

/** Maximale Login-Versuche bevor Sperre */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Sperrzeit nach zu vielen Versuchen (Minuten) */
export const LOCKOUT_DURATION_MINUTES = 15;

// =====================================================
//  UPLOAD LIMITS
// =====================================================

/** Maximale Dateigröße in MB */
export const MAX_FILE_SIZE_MB = 50;

/** Maximale Dateigröße in Bytes */
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Chunk-Größe für resumierbare Uploads (MB) */
export const UPLOAD_CHUNK_SIZE_MB = 6;

// =====================================================
//  PAPIERKORB KONFIGURATION
// =====================================================

/** Tage bis zur endgültigen Löschung */
export const TRASH_RETENTION_DAYS = 30;

// =====================================================
//  API TIMEOUTS
// =====================================================

/** Standard API Timeout in Millisekunden */
export const API_TIMEOUT_MS = 30000;

/** Upload Timeout in Millisekunden */
export const UPLOAD_TIMEOUT_MS = 120000;

// =====================================================
//  ENTWICKLER-MODUS
// =====================================================

/** Ist die App im Entwicklungsmodus? */
export const IS_DEVELOPMENT = import.meta.env.DEV;

/** Debug-Logging aktiviert? */
export const DEBUG_LOGGING = import.meta.env.DEV;

// =====================================================
//  VALIDIERUNG
// =====================================================

/**
 * Überprüft ob alle notwendigen Konfigurationswerte gesetzt sind
 * Rufe diese Funktion beim App-Start auf
 */
export const validateConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!SUPABASE_URL) {
    errors.push('VITE_SUPABASE_URL ist nicht gesetzt');
  }
  
  if (!SUPABASE_ANON_KEY) {
    errors.push('VITE_SUPABASE_PUBLISHABLE_KEY ist nicht gesetzt');
  }
  
  if (!SUPABASE_PROJECT_ID) {
    errors.push('VITE_SUPABASE_PROJECT_ID ist nicht gesetzt');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Gibt eine lesbare Zusammenfassung der Konfiguration aus
 * Nützlich für Debugging
 */
export const getConfigSummary = (): string => {
  const maskedKey = SUPABASE_ANON_KEY 
    ? `${SUPABASE_ANON_KEY.substring(0, 20)}...` 
    : 'NICHT GESETZT';
  
  return `
╔══════════════════════════════════════════════════════════════╗
║  ${APP_NAME} - Konfiguration v${APP_VERSION}
╠══════════════════════════════════════════════════════════════╣
║  Supabase URL:      ${SUPABASE_URL || 'NICHT GESETZT'}
║  Projekt ID:        ${SUPABASE_PROJECT_ID || 'NICHT GESETZT'}
║  Anon Key:          ${maskedKey}
║  Entwicklungsmodus: ${IS_DEVELOPMENT ? 'JA' : 'NEIN'}
╚══════════════════════════════════════════════════════════════╝
  `.trim();
};
