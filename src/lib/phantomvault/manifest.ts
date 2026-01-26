/**
 * PhantomVault Manifest Utilities
 */

import type { PhantomVaultManifest, ManifestTableData, ManifestMetadata, ManifestMediaEntry } from './types';
import { PHANTOMVAULT_VERSION } from './types';

/**
 * Generate a simple checksum for data integrity verification
 */
export async function generateChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Create a new manifest with default values
 */
export function createManifest(
  userId: string,
  data: ManifestTableData,
  includesMedia: boolean
): PhantomVaultManifest {
  return {
    metadata: {
      version: PHANTOMVAULT_VERSION,
      format: 'phantomvault',
      created_at: new Date().toISOString(),
      user_id: userId,
      includes_media: includesMedia,
      encryption: null,
      checksums: {
        manifest: '', // Will be set after data is finalized
        media_count: 0,
        total_size_bytes: 0,
      },
    },
    data,
    media: [],
  };
}

/**
 * Validate manifest structure
 */
export function validateManifest(manifest: any): manifest is PhantomVaultManifest {
  if (!manifest || typeof manifest !== 'object') return false;
  if (!manifest.metadata || !manifest.data) return false;
  if (manifest.metadata.format !== 'phantomvault') return false;
  if (!manifest.metadata.version || !manifest.metadata.created_at) return false;
  return true;
}

/**
 * Parse manifest from JSON string
 */
export function parseManifest(json: string): PhantomVaultManifest | null {
  try {
    const parsed = JSON.parse(json);
    if (!validateManifest(parsed)) {
      console.error('Invalid manifest structure');
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to parse manifest:', error);
    return null;
  }
}

/**
 * Serialize manifest to JSON string
 */
export function serializeManifest(manifest: PhantomVaultManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Get item counts from manifest data
 */
export function getItemCounts(data: ManifestTableData): Record<string, number> {
  return {
    notes: data.notes?.length || 0,
    photos: data.photos?.length || 0,
    files: data.files?.length || 0,
    links: data.links?.length || 0,
    tiktoks: data.tiktok_videos?.length || 0,
    secrets: data.secret_texts?.length || 0,
    tags: data.tags?.length || 0,
    albums: (data.albums?.length || 0) + (data.file_albums?.length || 0),
    folders: (data.note_folders?.length || 0) + (data.link_folders?.length || 0) + (data.tiktok_folders?.length || 0),
  };
}

/**
 * Create a media entry for the manifest
 */
export function createMediaEntry(
  originalId: string,
  bucket: 'photos' | 'files',
  filename: string,
  sizeBytes: number
): ManifestMediaEntry {
  return {
    original_id: originalId,
    bucket,
    filename,
    path_in_zip: `media/${bucket}/${filename}`,
    size_bytes: sizeBytes,
  };
}
