/**
 * Shared constants used across the application
 * Centralizes magic values for maintainability
 * 
 * HINWEIS: Für Self-Hosting relevante Einstellungen
 * befinden sich in src/config/index.ts
 */

// Re-export config values for convenience
export { 
  TRASH_RETENTION_DAYS,
  AUTO_LOCK_TIMEOUT_MINUTES,
  SESSION_VALIDITY_HOURS,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  APP_NAME,
  APP_VERSION,
  DEFAULT_LOCALE,
} from '@/config';

// ==================== Colors ====================

/** Default folder/album colors for selection */
export const FOLDER_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
] as const;

/** Default primary color for folders/albums */
export const DEFAULT_FOLDER_COLOR = '#6366f1';

/** Tag color palette */
export const TAG_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
] as const;

// ==================== Icons ====================

/** Available folder icons (used in album/folder creation) */
export const FOLDER_ICONS = [
  'folder',
  'music',
  'book',
  'archive',
  'briefcase',
  'camera',
  'film',
  'heart',
  'home',
  'image',
  'inbox',
  'layers',
  'package',
  'star',
  'video',
] as const;

export type FolderIcon = typeof FOLDER_ICONS[number];

// ==================== Pagination ====================

/** Default items per page for lists */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum items to load at once */
export const MAX_ITEMS_PER_LOAD = 100;

/** Pagination defaults */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  INITIAL_PAGE: 1,
} as const;

// ==================== Debounce/Throttle ====================

/** Debounce delay for search inputs (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Auto-save delay for notes (ms) */
export const AUTOSAVE_DELAY_MS = 2000;

/** Debounce delays in milliseconds */
export const DEBOUNCE_DELAYS = {
  SEARCH: 300,
  AUTO_SAVE: 2000,
  RESIZE: 100,
  SCROLL: 50,
} as const;

// ==================== Dates ====================

/** Locale for date formatting - uses DEFAULT_LOCALE from config */
import { DEFAULT_LOCALE } from '@/config';

/** Format date for display */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString(DEFAULT_LOCALE, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Format date without time */
export const formatDateOnly = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString(DEFAULT_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ==================== Storage ====================

/** Maximum file size for uploads (bytes) - 50MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Maximum image size for thumbnails (bytes) - 5MB */
export const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;

/** Supported image types */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

/** Supported video types */
export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
] as const;

// ==================== UI ====================

/** Breakpoints matching Tailwind defaults */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/** Animation durations (ms) */
export const ANIMATION_DURATION = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

/** Z-index layers */
export const Z_INDEX = {
  dropdown: 50,
  modal: 100,
  toast: 150,
  tooltip: 200,
} as const;

// ==================== Trash ====================

/** Default days before trash items are permanently deleted */
export const DEFAULT_TRASH_RETENTION_DAYS = 30;

// ==================== Session ====================

/** Auto-lock timeout (ms) - 5 minutes */
export const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/** Session expiry time (ms) - 24 hours */
export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;
