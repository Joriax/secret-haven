/**
 * PhantomVault Backup Format Types
 * 
 * .phantomvault files are ZIP archives containing:
 * - manifest.json: metadata, table data, checksums
 * - media/photos/[filename]: photo files
 * - media/files/[filename]: document files
 */

export const PHANTOMVAULT_VERSION = '1.0';
export const PHANTOMVAULT_EXTENSION = '.phantomvault';

export interface ManifestMetadata {
  version: string;
  format: 'phantomvault';
  created_at: string;
  user_id: string;
  includes_media: boolean;
  encryption: null | {
    algorithm: 'AES-GCM';
    iterations: number;
  };
  checksums: {
    manifest: string;
    media_count: number;
    total_size_bytes: number;
  };
}

export interface ManifestTableData {
  notes: any[];
  photos: any[];
  files: any[];
  links: any[];
  tiktok_videos: any[];
  secret_texts: any[];
  tags: any[];
  albums: any[];
  file_albums: any[];
  note_folders: any[];
  link_folders: any[];
  tiktok_folders: any[];
}

export interface ManifestMediaEntry {
  original_id: string;
  bucket: 'photos' | 'files';
  filename: string;
  path_in_zip: string;
  size_bytes: number;
  checksum?: string;
}

export interface PhantomVaultManifest {
  metadata: ManifestMetadata;
  data: ManifestTableData;
  media: ManifestMediaEntry[];
}

export interface ExportProgress {
  phase: 'init' | 'metadata' | 'media' | 'packaging' | 'complete' | 'error';
  percent: number;
  message: string;
  current?: number;
  total?: number;
}

export interface ImportProgress {
  phase: 'init' | 'reading' | 'validating' | 'database' | 'media' | 'complete' | 'error';
  percent: number;
  message: string;
  current?: number;
  total?: number;
}

export interface ExportOptions {
  includeMedia: boolean;
  password?: string;
  saveToCloud: boolean;
  isAutoBackup?: boolean;
}

export interface ImportOptions {
  conflictResolution: 'skip' | 'overwrite' | 'duplicate';
  password?: string;
}

export interface ImportStats {
  notes: { total: number; imported: number; skipped: number };
  photos: { total: number; imported: number; skipped: number };
  files: { total: number; imported: number; skipped: number };
  links: { total: number; imported: number; skipped: number };
  tiktoks: { total: number; imported: number; skipped: number };
  secrets: { total: number; imported: number; skipped: number };
  tags: { total: number; imported: number; skipped: number };
  albums: { total: number; imported: number; skipped: number };
  folders: { total: number; imported: number; skipped: number };
  media: { total: number; uploaded: number; failed: number };
}

export type IdMappings = {
  note_folders: Record<string, string>;
  link_folders: Record<string, string>;
  tiktok_folders: Record<string, string>;
  albums: Record<string, string>;
  file_albums: Record<string, string>;
  photos: Record<string, string>;
  files: Record<string, string>;
};
