
# Implementation Plan: Erweiterte Funktionen

## Übersicht

Dieser Plan implementiert 8 neue Hauptfunktionen für den Private Vault, die die Benutzererfahrung und Sicherheit erheblich verbessern werden.

---

## 1. Offline-Mode (Erweitert)

### Aktueller Stand
- IndexedDB (Dexie.js) ist bereits in `src/lib/db.ts` konfiguriert
- PWA mit Service Worker bereits eingerichtet (`vite-plugin-pwa`)
- Sync-Queue-Struktur existiert bereits

### Implementierung

**Neue Komponenten:**
- `src/components/OfflineIndicator.tsx` - Zeigt Offline-Status in der UI an
- `src/hooks/useOfflineSync.ts` - Verwaltet automatische Synchronisation

**Änderungen:**
- Erweiterung von `src/lib/db.ts` um vollständige Datenspeicherung für alle Entitäten (Links, TikToks, Tags, Folders)
- Service Worker-Konfiguration in `vite.config.ts` für API-Caching erweitern
- `SyncStatusIndicator.tsx` erweitern für bessere Synchronisations-Anzeige

**Funktionsweise:**
- Bei Offline-Status werden Änderungen in IndexedDB gespeichert
- Automatische Synchronisation bei Wiederherstellung der Verbindung
- Konfliktlösung: Server-Zeitstempel hat Vorrang
- Visueller Indikator in der Sidebar/Header

---

## 2. E2E-Verschlüsselung (Erweitert)

### Aktueller Stand
- AES-256-GCM Verschlüsselung in `src/lib/encryption.ts` bereits vorhanden
- Secure Notes und Secret Texts nutzen bereits clientseitige Verschlüsselung

### Implementierung

**Neue Hooks:**
- `src/hooks/useE2EEncryption.ts` - Verwaltet Master-Key und Verschlüsselung

**Änderungen:**
- `src/pages/Settings.tsx` - Neuer Bereich "Erweiterte Verschlüsselung"
- Optionale Verschlüsselung für alle Datentypen (Fotos-Metadaten, Datei-Namen, etc.)

**Optionen:**
- Master-Passwort separat vom Login-PIN
- Automatische Verschlüsselung neuer Inhalte
- Batch-Verschlüsselung bestehender Daten

---

## 3. Mehrere Themes

### Aktueller Stand
- 8 Farbschemas in `src/hooks/useThemeCustomizer.ts`
- Nur Primary/Accent-Farben werden geändert

### Implementierung

**Neue Dateien:**
- `src/lib/themes.ts` - Theme-Definitionen mit vollständigen Farbpaletten

**Erweiterte Theme-Optionen:**
```typescript
interface FullTheme {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  colors: {
    background: string;
    foreground: string;
    card: string;
    primary: string;
    accent: string;
    muted: string;
    border: string;
  };
}
```

**Neue Themes:**
- Light Mode Varianten (Hell-Lila, Hell-Blau, etc.)
- AMOLED Black (tiefes Schwarz für OLED-Displays)
- High Contrast (Barrierefreiheit)
- Sepia (Augenfreundlich)

**UI-Änderungen:**
- Erweiterung von `ThemeCustomizer.tsx` mit Vorschau-Karten
- System-Theme-Erkennung (prefers-color-scheme)
- Zeitgesteuerte Theme-Wechsel (z.B. Nachtmodus ab 22:00)

---

## 4. Kalender-Ansicht

### Aktueller Stand
- Calendar-Komponente existiert in `src/components/ui/calendar.tsx`
- Break-Tracker hat bereits eine Kalender-Ansicht

### Implementierung

**Neue Seite:**
- `src/pages/CalendarView.tsx` - Vollständige Kalender-Übersicht

**Features:**
- Monats-, Wochen- und Tagesansicht
- Anzeige aller Inhalte nach Erstellungs-/Änderungsdatum:
  - Notizen (blaue Punkte)
  - Fotos/Videos (rosa Punkte)
  - Dateien (grüne Punkte)
  - Links (orange Punkte)
- Klick auf Tag öffnet gefilterte Liste
- Filterung nach Inhaltstyp
- Heatmap für Aktivität

**Navigation:**
- Neuer Sidebar-Eintrag "Kalender"
- Route `/calendar`

---

## 5. Volltextsuche (Erweitert)

### Aktueller Stand
- `useGlobalSearch.ts` durchsucht Titel, Inhalt und Dateinamen
- Keine Indizierung, direkte SQL-Abfragen

### Implementierung

**Verbesserungen:**
- Lokaler Suchindex in IndexedDB für schnellere Suche
- Fuzzy-Suche mit Typo-Toleranz
- Suchergebnisse mit Kontext-Hervorhebung
- Suchhistorie mit gespeicherten Suchen

**Neue Features:**
- OCR-Text von Bildern durchsuchbar machen (bereits OCRScanner vorhanden)
- Tag-basierte Suche mit AND/OR Operatoren
- Datum-Filter in Suche integrieren
- Erweiterte Suchsyntax:
  - `tag:wichtig` - Suche in Tags
  - `type:note` - Filterung nach Typ
  - `"exakter text"` - Phrasensuche

**UI-Änderungen:**
- Erweiterung von `GlobalSearch.tsx` mit erweiterten Filtern
- Such-Vorschläge basierend auf vorherigen Suchen
- Tastaturnavigation verbessern

---

## 6. Markdown-Templates

### Aktueller Stand
- Markdown-Rendering existiert bereits in `MarkdownRenderer.tsx`
- Keine Template-Funktion

### Implementierung

**Neue Komponenten:**
- `src/components/notes/MarkdownTemplates.tsx` - Template-Auswahl-Dialog
- `src/hooks/useNoteTemplates.ts` - Template-Verwaltung

**Vordefinierte Templates:**
```typescript
const DEFAULT_TEMPLATES = [
  { id: 'meeting', name: 'Meeting-Notiz', icon: 'Users' },
  { id: 'todo', name: 'To-Do Liste', icon: 'CheckSquare' },
  { id: 'journal', name: 'Tagebuch', icon: 'BookOpen' },
  { id: 'project', name: 'Projekt-Plan', icon: 'Layers' },
  { id: 'recipe', name: 'Rezept', icon: 'ChefHat' },
  { id: 'workout', name: 'Workout-Log', icon: 'Dumbbell' },
];
```

**Features:**
- Eigene Templates erstellen und speichern
- Template beim Erstellen einer neuen Notiz auswählen
- Variables (z.B. `{{date}}`, `{{time}}`) automatisch ausfüllen
- Favoriten-Templates für schnellen Zugriff

**Datenbank:**
- Neue Tabelle `note_templates` für benutzerdefinierte Templates

---

## 7. Widgets (Erweitert)

### Aktueller Stand
- Dashboard-Widgets existieren in `useDashboardWidgets.ts`
- Widgets: quick-stats, recent-activity, quick-capture, quick-actions, storage, recently-viewed

### Implementierung

**Neue Widget-Typen:**
```typescript
type WidgetType = 
  | 'calendar-mini'      // Mini-Kalender mit heutigem Datum
  | 'weather'            // Wetter (optional, benötigt API)
  | 'pinned-notes'       // Angepinnte Notizen
  | 'random-photo'       // Zufälliges Foto aus Sammlung
  | 'storage-pie'        // Speicheraufteilung als Kreisdiagramm
  | 'streak-counter'     // Break-Tracker Streak
  | 'quick-note'         // Schnelle Notiz-Eingabe
  | 'tag-cloud'          // Mini-Tag-Cloud
```

**Neue Dateien:**
- `src/components/dashboard/MiniCalendarWidget.tsx`
- `src/components/dashboard/PinnedNotesWidget.tsx`
- `src/components/dashboard/RandomPhotoWidget.tsx`
- `src/components/dashboard/StoragePieWidget.tsx`
- `src/components/dashboard/QuickNoteWidget.tsx`
- `src/components/dashboard/TagCloudWidget.tsx`

**UI-Verbesserungen:**
- Widget-Größenanpassung (small, medium, large)
- Drag & Drop Neuordnung (bereits vorhanden)
- Widget-Konfiguration pro Widget-Typ

---

## 8. Voice Notes

### Aktueller Stand
- Keine Audio-Aufnahme-Funktion vorhanden
- Audio-Dateien werden als normale Dateien behandelt

### Implementierung

**Neue Dateien:**
- `src/components/VoiceRecorder.tsx` - Aufnahme-UI mit Wellenform
- `src/hooks/useVoiceRecording.ts` - MediaRecorder API Wrapper

**Features:**
- Audio-Aufnahme direkt in der App
- Visuelle Wellenform während Aufnahme
- Automatische Transkription (optional, mit Web Speech API)
- Voice Notes als eigener Bereich oder als Notiz-Anhang

**Integration:**
- Button in Notes-Toolbar
- Eigener "Voice Notes" Bereich in Sidebar
- Speicherung in Supabase Storage (bucket: `voice-notes`)

**Datenbank-Änderungen:**
- Neue Tabelle `voice_notes`:
  - `id`, `user_id`, `title`, `filename`, `duration`, `transcript`
  - `created_at`, `updated_at`, `deleted_at`, `is_favorite`

---

## Technische Details

### Datenbank-Migrationen benötigt:

1. **note_templates Tabelle:**
```sql
CREATE TABLE note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  icon TEXT DEFAULT 'FileText',
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

2. **voice_notes Tabelle:**
```sql
CREATE TABLE voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT DEFAULT '',
  filename TEXT NOT NULL,
  duration INTEGER NOT NULL,
  transcript TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  folder_id UUID,
  tags UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

3. **Storage Bucket:**
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice-notes', 'voice-notes', false);
```

### Reihenfolge der Implementierung:

1. **Mehrere Themes** (Schnellste Umsetzung, direkte Benutzerfreundlichkeit)
2. **Markdown-Templates** (Erweiterung bestehender Notizen-Funktion)
3. **Widgets** (Erweiterung des bestehenden Dashboard-Systems)
4. **Volltextsuche** (Verbesserung bestehender Suche)
5. **Kalender-Ansicht** (Neue Seite, unabhängig)
6. **Voice Notes** (Neue Funktion, benötigt Datenbank-Änderungen)
7. **E2E-Verschlüsselung** (Komplexe Erweiterung bestehender Verschlüsselung)
8. **Offline-Mode** (Komplexeste Änderung, benötigt umfangreiche Tests)

---

## Zusammenfassung

| Feature | Neue Dateien | DB-Änderungen | Komplexität |
|---------|-------------|---------------|-------------|
| Offline-Mode | 2 | Nein | Hoch |
| E2E-Verschlüsselung | 1 | Nein | Mittel |
| Mehrere Themes | 1 | Nein | Niedrig |
| Kalender-Ansicht | 1 | Nein | Mittel |
| Volltextsuche | 0 | Nein | Mittel |
| Markdown-Templates | 2 | Ja | Mittel |
| Widgets | 6 | Nein | Niedrig |
| Voice Notes | 2 | Ja | Hoch |
