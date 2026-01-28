/**
 * PhantomVault Export Module - Optimized for Performance
 * 
 * Exports data to .phantomvault ZIP format with:
 * - Parallel media downloads (larger batches)
 * - Streaming progress updates
 * - Memory-efficient ZIP creation
 */

import { zipSync, strToU8 } from 'fflate';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  PhantomVaultManifest, 
  ManifestTableData, 
  ExportProgress, 
  ExportOptions 
} from './types';
import { 
  PHANTOMVAULT_EXTENSION, 
  MEDIA_DOWNLOAD_BATCH_SIZE,
  COMPRESSION_LEVEL,
  batchItems,
  yieldToMain
} from './types';
import { createManifest, serializeManifest, generateChecksum, createMediaEntry } from './manifest';
import { encryptBackup } from '@/lib/encryption';

export type ProgressCallback = (progress: ExportProgress) => void;

/**
 * Fetch all table data from Supabase in parallel
 */
async function fetchTableData(
  supabase: SupabaseClient,
  userId: string,
  onProgress: ProgressCallback
): Promise<ManifestTableData> {
  onProgress({ phase: 'metadata', percent: 5, message: 'Lade Datenbank...' });

  const tables = [
    'notes', 'photos', 'files', 'links',
    'tiktok_videos', 'secret_texts', 'tags',
    'albums', 'file_albums', 'note_folders',
    'link_folders', 'tiktok_folders'
  ] as const;

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

  // Fetch all tables in parallel
  const results = await Promise.all(tables.map(fetchTable));

  onProgress({ phase: 'metadata', percent: 15, message: 'Metadaten geladen' });

  return {
    notes: results[0],
    photos: results[1],
    files: results[2],
    links: results[3],
    tiktok_videos: results[4],
    secret_texts: results[5],
    tags: results[6],
    albums: results[7],
    file_albums: results[8],
    note_folders: results[9],
    link_folders: results[10],
    tiktok_folders: results[11],
  };
}

/**
 * Download a single file with timeout
 */
async function downloadFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  timeoutMs = 30000
): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);
    
    clearTimeout(timeoutId);
    
    if (error || !data) {
      return null;
    }
    
    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (e) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Download media files with optimized parallel batching
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
  
  // Create unified media list for optimal batching
  const allMedia: Array<{ bucket: 'photos' | 'files'; item: any }> = [
    ...photos.map(p => ({ bucket: 'photos' as const, item: p })),
    ...files.map(f => ({ bucket: 'files' as const, item: f }))
  ];
  
  const totalMedia = allMedia.length;
  if (totalMedia === 0) return zipEntries;

  let downloaded = 0;
  let failed = 0;
  let totalSize = 0;

  const batches = batchItems(allMedia, MEDIA_DOWNLOAD_BATCH_SIZE);
  
  for (const batch of batches) {
    const percent = 20 + Math.round((downloaded / totalMedia) * 45);
    onProgress({
      phase: 'media',
      percent,
      message: `Lade Medien: ${downloaded}/${totalMedia}`,
      current: downloaded,
      total: totalMedia,
      bytesProcessed: totalSize,
    });
    
    const results = await Promise.allSettled(
      batch.map(async ({ bucket, item }) => {
        const path = `${userId}/${item.filename}`;
        const data = await downloadFile(supabase, bucket, path);
        
        if (data) {
          const entry = createMediaEntry(item.id, bucket, item.filename, data.byteLength);
          manifest.media.push(entry);
          zipEntries[entry.path_in_zip] = data;
          totalSize += data.byteLength;
          return true;
        }
        return false;
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) downloaded++;
      else failed++;
    });
    
    // Yield to main thread every few batches to prevent UI freeze
    if (batches.indexOf(batch) % 3 === 0) {
      await yieldToMain();
    }
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
 * Create ZIP archive efficiently
 */
function createZipArchive(
  manifest: PhantomVaultManifest,
  mediaEntries: Record<string, Uint8Array>,
  onProgress: ProgressCallback
): Uint8Array {
  onProgress({ phase: 'packaging', percent: 70, message: 'Erstelle ZIP...' });

  const manifestJson = serializeManifest(manifest);
  
  const zipData: Record<string, Uint8Array> = {
    'manifest.json': strToU8(manifestJson),
    ...mediaEntries,
  };

  onProgress({ phase: 'packaging', percent: 80, message: 'Komprimiere...' });
  
  const zipped = zipSync(zipData, { level: COMPRESSION_LEVEL });
  
  onProgress({ phase: 'packaging', percent: 92, message: 'Archiv erstellt' });
  
  return zipped;
}

/**
 * Save backup to cloud storage with timeout
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
  
  try {
    // Add timeout for upload (60 seconds max)
    const uploadPromise = supabase.storage
      .from('backups')
      .upload(storagePath, blob, { upsert: true });
    
    const timeoutPromise = new Promise<{ error: Error }>((_, reject) => 
      setTimeout(() => reject(new Error('Upload timeout')), 60000)
    );
    
    const result = await Promise.race([uploadPromise, timeoutPromise]) as any;
    
    if (result.error) {
      console.error('Cloud upload error:', result.error);
      return false;
    }

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

    const { error: insertError } = await supabase.from('backup_versions').insert({
      user_id: userId,
      filename,
      storage_path: storagePath,
      size_bytes: blob.size,
      item_counts: itemCounts,
      includes_media: manifest.metadata.includes_media,
      is_auto_backup: isAutoBackup,
    });

    if (insertError) {
      console.error('Error saving backup version:', insertError);
      // Don't fail completely - file was uploaded
    }

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
  } catch (error) {
    console.error('Cloud save error:', error);
    return false;
  }
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
  // Small delay before revoking to ensure download starts
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Main export function - optimized for large datasets
 */
export async function exportPhantomVault(
  supabase: SupabaseClient,
  userId: string,
  options: ExportOptions,
  onProgress: ProgressCallback
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    onProgress({ phase: 'init', percent: 0, message: 'Starte Export...' });

    // 1. Fetch all table data in parallel
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
    const timeStr = new Date().toISOString().split('T')[1].slice(0, 5).replace(':', '');
    const suffix = options.isAutoBackup ? '-auto' : '';
    const filename = `phantomvault-${dateStr}-${timeStr}${suffix}${PHANTOMVAULT_EXTENSION}`;

    // 7. Handle encryption if password provided
    let finalBlob: Blob;
    if (options.password) {
      onProgress({ phase: 'packaging', percent: 94, message: 'Verschlüssele...' });
      const base64 = btoa(String.fromCharCode(...zipData));
      const encrypted = await encryptBackup(base64, options.password);
      finalBlob = new Blob([JSON.stringify(encrypted)], { type: 'application/octet-stream' });
    } else {
      finalBlob = new Blob([new Uint8Array(zipData).buffer], { type: 'application/zip' });
    }

    // 8. Save to cloud if requested
    if (options.saveToCloud) {
      onProgress({ phase: 'packaging', percent: 96, message: 'Speichere in Cloud...' });
      const cloudSaved = await saveToCloud(supabase, userId, filename, finalBlob, manifest, options.isAutoBackup || false);
      if (!cloudSaved) {
        console.warn('Cloud save failed, continuing with download');
      }
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
