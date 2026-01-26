/**
 * PhantomVault Export Module
 * 
 * Exports data to .phantomvault ZIP format with chunked media handling
 */

import { zipSync, strToU8 } from 'fflate';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  PhantomVaultManifest, 
  ManifestTableData, 
  ExportProgress, 
  ExportOptions 
} from './types';
import { PHANTOMVAULT_EXTENSION } from './types';
import { createManifest, serializeManifest, generateChecksum, createMediaEntry } from './manifest';
import { encryptBackup } from '@/lib/encryption';

const MEDIA_BATCH_SIZE = 5;
const DOWNLOAD_TIMEOUT_MS = 30000;

export type ProgressCallback = (progress: ExportProgress) => void;

/**
 * Fetch all table data from Supabase
 */
async function fetchTableData(
  supabase: SupabaseClient,
  userId: string,
  onProgress: ProgressCallback
): Promise<ManifestTableData> {
  onProgress({ phase: 'metadata', percent: 5, message: 'Lade Datenbank-Tabellen...' });

  const fetchTable = async (table: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from(table as any)
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        console.warn(`Warning: Could not fetch ${table}:`, error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn(`Warning: Error fetching ${table}:`, e);
      return [];
    }
  };

  const [
    notes, photos, files, links,
    tiktok_videos, secret_texts, tags,
    albums, file_albums, note_folders,
    link_folders, tiktok_folders
  ] = await Promise.all([
    fetchTable('notes'),
    fetchTable('photos'),
    fetchTable('files'),
    fetchTable('links'),
    fetchTable('tiktok_videos'),
    fetchTable('secret_texts'),
    fetchTable('tags'),
    fetchTable('albums'),
    fetchTable('file_albums'),
    fetchTable('note_folders'),
    fetchTable('link_folders'),
    fetchTable('tiktok_folders'),
  ]);

  onProgress({ phase: 'metadata', percent: 15, message: 'Metadaten geladen' });

  return {
    notes,
    photos,
    files,
    links,
    tiktok_videos,
    secret_texts,
    tags,
    albums,
    file_albums,
    note_folders,
    link_folders,
    tiktok_folders,
  };
}

/**
 * Download media files and add to ZIP entries
 */
async function downloadMediaFiles(
  supabase: SupabaseClient,
  userId: string,
  manifest: PhantomVaultManifest,
  onProgress: ProgressCallback
): Promise<Record<string, Uint8Array>> {
  const zipEntries: Record<string, Uint8Array> = {};
  
  const photos = manifest.data.photos.filter((p: any) => !p.deleted_at);
  const files = manifest.data.files.filter((f: any) => !f.deleted_at);
  const totalMedia = photos.length + files.length;
  
  if (totalMedia === 0) {
    return zipEntries;
  }

  let downloaded = 0;
  let failed = 0;
  let totalSize = 0;

  const downloadFile = async (bucket: string, filename: string, itemId: string): Promise<{ data: Uint8Array; size: number } | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(`${userId}/${filename}`);
      
      if (error || !data) {
        console.warn(`Failed to download ${bucket}/${filename}:`, error?.message);
        return null;
      }
      
      const arrayBuffer = await data.arrayBuffer();
      return { 
        data: new Uint8Array(arrayBuffer), 
        size: arrayBuffer.byteLength 
      };
    } catch (e) {
      console.warn(`Error downloading ${bucket}/${filename}:`, e);
      return null;
    }
  };

  // Download photos in batches
  for (let i = 0; i < photos.length; i += MEDIA_BATCH_SIZE) {
    const batch = photos.slice(i, i + MEDIA_BATCH_SIZE);
    
    onProgress({
      phase: 'media',
      percent: 20 + Math.round((downloaded / totalMedia) * 40),
      message: `Lade Fotos: ${Math.min(i + MEDIA_BATCH_SIZE, photos.length)}/${photos.length}`,
      current: downloaded,
      total: totalMedia,
    });
    
    const results = await Promise.allSettled(
      batch.map(async (photo: any) => {
        const result = await downloadFile('photos', photo.filename, photo.id);
        if (result) {
          const entry = createMediaEntry(photo.id, 'photos', photo.filename, result.size);
          manifest.media.push(entry);
          zipEntries[entry.path_in_zip] = result.data;
          totalSize += result.size;
          return true;
        }
        return false;
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) downloaded++;
      else failed++;
    });
  }

  // Download files in batches
  for (let i = 0; i < files.length; i += MEDIA_BATCH_SIZE) {
    const batch = files.slice(i, i + MEDIA_BATCH_SIZE);
    
    onProgress({
      phase: 'media',
      percent: 20 + Math.round((downloaded / totalMedia) * 40),
      message: `Lade Dateien: ${Math.min(i + MEDIA_BATCH_SIZE, files.length)}/${files.length}`,
      current: downloaded,
      total: totalMedia,
    });
    
    const results = await Promise.allSettled(
      batch.map(async (file: any) => {
        const result = await downloadFile('files', file.filename, file.id);
        if (result) {
          const entry = createMediaEntry(file.id, 'files', file.filename, result.size);
          manifest.media.push(entry);
          zipEntries[entry.path_in_zip] = result.data;
          totalSize += result.size;
          return true;
        }
        return false;
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) downloaded++;
      else failed++;
    });
  }

  // Update manifest checksums
  manifest.metadata.checksums.media_count = manifest.media.length;
  manifest.metadata.checksums.total_size_bytes = totalSize;

  if (failed > 0) {
    console.warn(`${failed} media files could not be downloaded`);
  }

  return zipEntries;
}

/**
 * Create ZIP archive from manifest and media
 */
function createZipArchive(
  manifest: PhantomVaultManifest,
  mediaEntries: Record<string, Uint8Array>,
  onProgress: ProgressCallback
): Uint8Array {
  onProgress({ phase: 'packaging', percent: 70, message: 'Erstelle ZIP-Archiv...' });

  const manifestJson = serializeManifest(manifest);
  
  const zipData: Record<string, Uint8Array> = {
    'manifest.json': strToU8(manifestJson),
    ...mediaEntries,
  };

  onProgress({ phase: 'packaging', percent: 85, message: 'Komprimiere Daten...' });
  
  const zipped = zipSync(zipData, { level: 6 });
  
  onProgress({ phase: 'packaging', percent: 95, message: 'Archiv erstellt' });
  
  return zipped;
}

/**
 * Save backup to cloud storage
 */
async function saveToCloud(
  supabase: SupabaseClient,
  userId: string,
  filename: string,
  blob: Blob,
  manifest: PhantomVaultManifest,
  isAutoBackup: boolean
): Promise<boolean> {
  const storagePath = `${userId}/${filename}`;
  
  const { error: uploadError } = await supabase.storage
    .from('backups')
    .upload(storagePath, blob, { upsert: true });
  
  if (uploadError) {
    console.error('Cloud upload error:', uploadError);
    return false;
  }

  // Save version record
  const itemCounts = {
    notes: manifest.data.notes.length,
    photos: manifest.data.photos.length,
    files: manifest.data.files.length,
    links: manifest.data.links.length,
    tiktoks: manifest.data.tiktok_videos.length,
    secrets: manifest.data.secret_texts.length,
    tags: manifest.data.tags.length,
    albums: manifest.data.albums.length + manifest.data.file_albums.length,
    folders: manifest.data.note_folders.length + manifest.data.link_folders.length + manifest.data.tiktok_folders.length,
  };

  await supabase.from('backup_versions').insert({
    user_id: userId,
    filename,
    storage_path: storagePath,
    size_bytes: blob.size,
    item_counts: itemCounts,
    includes_media: manifest.metadata.includes_media,
    is_auto_backup: isAutoBackup,
  });

  if (isAutoBackup) {
    await supabase
      .from('backup_settings')
      .upsert({
        user_id: userId,
        last_auto_backup: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
  }

  return true;
}

/**
 * Trigger file download in browser
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Main export function
 */
export async function exportPhantomVault(
  supabase: SupabaseClient,
  userId: string,
  options: ExportOptions,
  onProgress: ProgressCallback
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    onProgress({ phase: 'init', percent: 0, message: 'Starte Export...' });

    // 1. Fetch all table data
    const tableData = await fetchTableData(supabase, userId, onProgress);
    
    // 2. Create manifest
    const manifest = createManifest(userId, tableData, options.includeMedia);
    
    // 3. Download media files if requested
    let mediaEntries: Record<string, Uint8Array> = {};
    if (options.includeMedia) {
      mediaEntries = await downloadMediaFiles(supabase, userId, manifest, onProgress);
    }

    // 4. Generate manifest checksum
    const manifestJson = serializeManifest(manifest);
    manifest.metadata.checksums.manifest = await generateChecksum(manifestJson);

    // 5. Create ZIP archive
    const zipData = createZipArchive(manifest, mediaEntries, onProgress);

    // 6. Create filename
    const dateStr = new Date().toISOString().split('T')[0];
    const suffix = options.isAutoBackup ? '-auto' : '';
    const filename = `phantomvault-${dateStr}${suffix}${PHANTOMVAULT_EXTENSION}`;

    // 7. Handle encryption if password provided
    let finalBlob: Blob;
    if (options.password) {
      onProgress({ phase: 'packaging', percent: 92, message: 'Verschlüssele Backup...' });
      const base64 = btoa(String.fromCharCode(...zipData));
      const encrypted = await encryptBackup(base64, options.password);
      finalBlob = new Blob([JSON.stringify(encrypted)], { type: 'application/octet-stream' });
    } else {
      finalBlob = new Blob([new Uint8Array(zipData)], { type: 'application/zip' });
    }

    // 8. Save to cloud if requested
    if (options.saveToCloud) {
      onProgress({ phase: 'packaging', percent: 95, message: 'Speichere in Cloud...' });
      await saveToCloud(supabase, userId, filename, finalBlob, manifest, options.isAutoBackup || false);
    }

    // 9. Trigger download for manual backups
    if (!options.isAutoBackup) {
      onProgress({ phase: 'packaging', percent: 98, message: 'Starte Download...' });
      triggerDownload(finalBlob, filename);
    }

    onProgress({ phase: 'complete', percent: 100, message: 'Export abgeschlossen!' });

    return { success: true, filename };
  } catch (error: any) {
    console.error('Export error:', error);
    onProgress({ phase: 'error', percent: 0, message: error.message || 'Export fehlgeschlagen' });
    return { success: false, error: error.message || 'Unbekannter Fehler' };
  }
}
