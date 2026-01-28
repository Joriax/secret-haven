/**
 * PhantomVault Import Module - Optimized for Performance
 * 
 * Imports data from .phantomvault ZIP format with:
 * - Bulk database inserts
 * - Parallel media uploads
 * - Memory-efficient streaming
 */

import { unzipSync, strFromU8 } from 'fflate';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  PhantomVaultManifest, 
  ImportProgress, 
  ImportOptions,
  ImportStats,
  IdMappings
} from './types';
import { 
  MEDIA_UPLOAD_BATCH_SIZE, 
  DB_INSERT_BATCH_SIZE,
  batchItems,
  yieldToMain
} from './types';
import { parseManifest } from './manifest';
import { 
  decryptBackup, 
  isNewEncryptionFormat, 
  isOldEncryptionFormat, 
  decryptOldBackup 
} from '@/lib/encryption';

export type ProgressCallback = (progress: ImportProgress) => void;

/**
 * Create initial import stats
 */
function createInitialStats(): ImportStats {
  return {
    notes: { total: 0, imported: 0, skipped: 0 },
    photos: { total: 0, imported: 0, skipped: 0 },
    files: { total: 0, imported: 0, skipped: 0 },
    links: { total: 0, imported: 0, skipped: 0 },
    tiktoks: { total: 0, imported: 0, skipped: 0 },
    secrets: { total: 0, imported: 0, skipped: 0 },
    tags: { total: 0, imported: 0, skipped: 0 },
    albums: { total: 0, imported: 0, skipped: 0 },
    folders: { total: 0, imported: 0, skipped: 0 },
    media: { total: 0, uploaded: 0, failed: 0 },
  };
}

/**
 * Read file content efficiently
 */
async function readFileContent(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/**
 * Extract manifest from ZIP data
 */
function extractManifest(unzipped: Record<string, Uint8Array>): PhantomVaultManifest | null {
  const manifestData = unzipped['manifest.json'];
  if (!manifestData) {
    console.error('No manifest.json found in archive');
    return null;
  }
  
  const manifestJson = strFromU8(manifestData);
  return parseManifest(manifestJson);
}

/**
 * Handle legacy JSON/vault format imports
 */
async function importLegacyFormat(
  text: string,
  password: string | undefined
): Promise<{ data: any; isLegacy: true }> {
  let importData: any;

  if (password) {
    const encrypted = JSON.parse(text);
    
    if (isNewEncryptionFormat(encrypted)) {
      const decrypted = await decryptBackup(encrypted, password);
      if (!decrypted) throw new Error('Falsches Passwort');
      importData = JSON.parse(decrypted);
    } else if (isOldEncryptionFormat(encrypted)) {
      const decrypted = decryptOldBackup(encrypted, password);
      if (!decrypted) throw new Error('Falsches Passwort');
      importData = JSON.parse(decrypted);
    } else {
      throw new Error('Ungültiges verschlüsseltes Format');
    }
  } else {
    importData = JSON.parse(text);
  }

  if (!importData.version || !importData.exported_at) {
    throw new Error('Ungültiges Backup-Format');
  }

  return { data: importData, isLegacy: true };
}

/**
 * Bulk insert helper with conflict handling
 */
async function bulkInsert(
  supabase: SupabaseClient,
  table: string,
  items: any[],
  userId: string,
  prepareItem: (item: any) => any
): Promise<{ imported: number; skipped: number; idMappings: Record<string, string> }> {
  const idMappings: Record<string, string> = {};
  let imported = 0;
  let skipped = 0;
  
  if (!items?.length) return { imported, skipped, idMappings };
  
  const batches = batchItems(items, DB_INSERT_BATCH_SIZE);
  
  for (const batch of batches) {
    const preparedItems = batch
      .filter(item => !item.deleted_at)
      .map(item => {
        const oldId = item.id;
        const prepared = prepareItem(item);
        return { oldId, prepared };
      });
    
    if (preparedItems.length === 0) {
      skipped += batch.length;
      continue;
    }
    
    const { data, error } = await supabase
      .from(table)
      .insert(preparedItems.map(p => p.prepared))
      .select('id');
    
    if (error) {
      console.warn(`Bulk insert to ${table} failed:`, error.message);
      skipped += batch.length;
    } else if (data) {
      data.forEach((newItem, idx) => {
        if (preparedItems[idx]) {
          idMappings[preparedItems[idx].oldId] = newItem.id;
        }
      });
      imported += data.length;
      skipped += batch.length - preparedItems.length;
    }
    
    await yieldToMain();
  }
  
  return { imported, skipped, idMappings };
}

/**
 * Import tags with bulk insert
 */
async function importTags(
  supabase: SupabaseClient,
  userId: string,
  tags: any[],
  options: ImportOptions,
  stats: ImportStats
): Promise<void> {
  if (!tags?.length) return;
  
  stats.tags.total = tags.length;
  
  const { data: existingTags } = await supabase
    .from('tags')
    .select('name')
    .eq('user_id', userId);
  
  const existingNames = new Set((existingTags || []).map(t => t.name.toLowerCase()));
  
  const tagsToInsert = tags
    .filter(tag => {
      if (existingNames.has(tag.name.toLowerCase()) && options.conflictResolution === 'skip') {
        stats.tags.skipped++;
        return false;
      }
      return true;
    })
    .map(tag => ({
      user_id: userId,
      name: options.conflictResolution === 'duplicate' && existingNames.has(tag.name.toLowerCase())
        ? `${tag.name} (Import)`
        : tag.name,
      color: tag.color,
    }));
  
  if (tagsToInsert.length > 0) {
    const { data, error } = await supabase.from('tags').insert(tagsToInsert).select('id');
    if (data) stats.tags.imported = data.length;
    if (error) stats.tags.skipped += tagsToInsert.length;
  }
}

/**
 * Import folders with bulk insert
 */
async function importFolders(
  supabase: SupabaseClient,
  userId: string,
  data: any,
  stats: ImportStats,
  idMappings: IdMappings
): Promise<void> {
  const folderTypes = [
    { key: 'note_folders', table: 'note_folders' },
    { key: 'link_folders', table: 'link_folders' },
    { key: 'tiktok_folders', table: 'tiktok_folders' },
  ] as const;
  
  for (const { key, table } of folderTypes) {
    const folders = data[key] as any[];
    if (!folders?.length) continue;
    
    stats.folders.total += folders.length;
    
    const result = await bulkInsert(
      supabase,
      table,
      folders,
      userId,
      (folder) => ({
        user_id: userId,
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
      })
    );
    
    stats.folders.imported += result.imported;
    stats.folders.skipped += result.skipped;
    Object.assign(idMappings[key], result.idMappings);
  }
}

/**
 * Import albums with bulk insert
 */
async function importAlbums(
  supabase: SupabaseClient,
  userId: string,
  data: any,
  stats: ImportStats,
  idMappings: IdMappings
): Promise<void> {
  const albumTypes = [
    { key: 'albums', table: 'albums' },
    { key: 'file_albums', table: 'file_albums' },
  ] as const;
  
  for (const { key, table } of albumTypes) {
    const albums = data[key] as any[];
    if (!albums?.length) continue;
    
    stats.albums.total += albums.length;
    
    const result = await bulkInsert(
      supabase,
      table,
      albums,
      userId,
      (album) => ({
        user_id: userId,
        name: album.name,
        color: album.color,
        icon: album.icon,
        is_pinned: album.is_pinned,
      })
    );
    
    stats.albums.imported += result.imported;
    stats.albums.skipped += result.skipped;
    Object.assign(idMappings[key], result.idMappings);
  }
}

/**
 * Import notes with folder mapping and bulk insert
 */
async function importNotes(
  supabase: SupabaseClient,
  userId: string,
  notes: any[],
  stats: ImportStats,
  idMappings: IdMappings
): Promise<void> {
  if (!notes?.length) return;
  
  stats.notes.total = notes.length;
  
  const result = await bulkInsert(
    supabase,
    'notes',
    notes,
    userId,
    (note) => ({
      user_id: userId,
      title: note.title || 'Importierte Notiz',
      content: note.content,
      folder_id: note.folder_id ? idMappings.note_folders[note.folder_id] || null : null,
      is_favorite: note.is_favorite,
      is_secure: note.is_secure,
      secure_content: note.secure_content,
      tags: note.tags,
    })
  );
  
  stats.notes.imported = result.imported;
  stats.notes.skipped = result.skipped;
}

/**
 * Import links with folder mapping and bulk insert
 */
async function importLinks(
  supabase: SupabaseClient,
  userId: string,
  links: any[],
  stats: ImportStats,
  idMappings: IdMappings
): Promise<void> {
  if (!links?.length) return;
  
  stats.links.total = links.length;
  
  const result = await bulkInsert(
    supabase,
    'links',
    links,
    userId,
    (link) => ({
      user_id: userId,
      url: link.url,
      title: link.title || 'Importierter Link',
      description: link.description,
      favicon_url: link.favicon_url,
      image_url: link.image_url,
      folder_id: link.folder_id ? idMappings.link_folders[link.folder_id] || null : null,
      is_favorite: link.is_favorite,
      tags: link.tags,
    })
  );
  
  stats.links.imported = result.imported;
  stats.links.skipped = result.skipped;
}

/**
 * Import TikTok videos with bulk insert
 */
async function importTikToks(
  supabase: SupabaseClient,
  userId: string,
  videos: any[],
  stats: ImportStats,
  idMappings: IdMappings
): Promise<void> {
  if (!videos?.length) return;
  
  stats.tiktoks.total = videos.length;
  
  const result = await bulkInsert(
    supabase,
    'tiktok_videos',
    videos,
    userId,
    (video) => ({
      user_id: userId,
      url: video.url,
      title: video.title,
      author_name: video.author_name,
      thumbnail_url: video.thumbnail_url,
      video_id: video.video_id,
      folder_id: video.folder_id ? idMappings.tiktok_folders[video.folder_id] || null : null,
      is_favorite: video.is_favorite,
    })
  );
  
  stats.tiktoks.imported = result.imported;
  stats.tiktoks.skipped = result.skipped;
}

/**
 * Import photos metadata with bulk insert
 */
async function importPhotos(
  supabase: SupabaseClient,
  userId: string,
  photos: any[],
  stats: ImportStats,
  idMappings: IdMappings
): Promise<void> {
  if (!photos?.length) return;
  
  stats.photos.total = photos.length;
  
  const result = await bulkInsert(
    supabase,
    'photos',
    photos,
    userId,
    (photo) => ({
      user_id: userId,
      filename: photo.filename,
      caption: photo.caption,
      taken_at: photo.taken_at,
      album_id: photo.album_id ? idMappings.albums[photo.album_id] || null : null,
      is_favorite: photo.is_favorite,
      tags: photo.tags,
      thumbnail_filename: photo.thumbnail_filename,
    })
  );
  
  stats.photos.imported = result.imported;
  stats.photos.skipped = result.skipped;
  Object.assign(idMappings.photos, result.idMappings);
}

/**
 * Import files metadata with bulk insert
 */
async function importFiles(
  supabase: SupabaseClient,
  userId: string,
  files: any[],
  stats: ImportStats,
  idMappings: IdMappings
): Promise<void> {
  if (!files?.length) return;
  
  stats.files.total = files.length;
  
  const result = await bulkInsert(
    supabase,
    'files',
    files,
    userId,
    (file) => ({
      user_id: userId,
      filename: file.filename,
      mime_type: file.mime_type,
      size: file.size,
      album_id: file.album_id ? idMappings.file_albums[file.album_id] || null : null,
      is_favorite: file.is_favorite,
      tags: file.tags,
    })
  );
  
  stats.files.imported = result.imported;
  stats.files.skipped = result.skipped;
  Object.assign(idMappings.files, result.idMappings);
}

/**
 * Import secret texts with bulk insert
 */
async function importSecrets(
  supabase: SupabaseClient,
  userId: string,
  secrets: any[],
  stats: ImportStats
): Promise<void> {
  if (!secrets?.length) return;
  
  stats.secrets.total = secrets.length;
  
  const toInsert = secrets.map(secret => ({
    user_id: userId,
    title: secret.title || 'Importierter Text',
    encrypted_content: secret.encrypted_content,
  }));
  
  const { data, error } = await supabase.from('secret_texts').insert(toInsert).select('id');
  
  if (data) stats.secrets.imported = data.length;
  if (error) stats.secrets.skipped = secrets.length;
}

/**
 * Upload media files with optimized parallel batching
 */
async function uploadMediaFiles(
  supabase: SupabaseClient,
  userId: string,
  manifest: PhantomVaultManifest,
  unzipped: Record<string, Uint8Array>,
  stats: ImportStats,
  onProgress: ProgressCallback
): Promise<void> {
  if (!manifest.media?.length) return;
  
  stats.media.total = manifest.media.length;
  let processed = 0;
  
  const batches = batchItems(manifest.media, MEDIA_UPLOAD_BATCH_SIZE);
  
  for (const batch of batches) {
    onProgress({
      phase: 'media',
      percent: 75 + Math.round((processed / manifest.media.length) * 23),
      message: `Lade Medien hoch: ${processed}/${manifest.media.length}`,
      current: processed,
      total: manifest.media.length,
    });
    
    await Promise.allSettled(
      batch.map(async (entry) => {
        const fileData = unzipped[entry.path_in_zip];
        if (!fileData) {
          stats.media.failed++;
          return;
        }
        
        try {
          const blob = new Blob([new Uint8Array(fileData).buffer]);
          const storagePath = `${userId}/${entry.filename}`;
          
          const { error } = await supabase.storage
            .from(entry.bucket)
            .upload(storagePath, blob, { upsert: true });
          
          if (error) {
            stats.media.failed++;
          } else {
            stats.media.uploaded++;
          }
        } catch {
          stats.media.failed++;
        }
      })
    );
    
    processed += batch.length;
    await yieldToMain();
  }
}

/**
 * Upload legacy media files (base64 data URLs)
 */
async function uploadLegacyMedia(
  supabase: SupabaseClient,
  userId: string,
  mediaFiles: any[],
  stats: ImportStats,
  onProgress: ProgressCallback
): Promise<void> {
  if (!mediaFiles?.length) return;
  
  stats.media.total = mediaFiles.length;
  let uploaded = 0;
  
  const batches = batchItems(mediaFiles, MEDIA_UPLOAD_BATCH_SIZE);
  
  for (const batch of batches) {
    onProgress({
      phase: 'media',
      percent: 75 + Math.round((uploaded / mediaFiles.length) * 23),
      message: `Lade Medien hoch: ${uploaded}/${mediaFiles.length}`,
      current: uploaded,
      total: mediaFiles.length,
    });
    
    await Promise.allSettled(
      batch.map(async (media) => {
        try {
          const response = await fetch(media.data);
          const blob = await response.blob();
          
          const { error } = await supabase.storage
            .from(media.bucket)
            .upload(media.path, blob, { upsert: true });
          
          if (error) {
            stats.media.failed++;
          } else {
            stats.media.uploaded++;
          }
          uploaded++;
        } catch {
          stats.media.failed++;
          uploaded++;
        }
      })
    );
    
    await yieldToMain();
  }
}

/**
 * Main import function - optimized for large datasets
 */
export async function importPhantomVault(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  options: ImportOptions,
  onProgress: ProgressCallback
): Promise<{ success: boolean; stats?: ImportStats; error?: string }> {
  const stats = createInitialStats();
  
  const idMappings: IdMappings = {
    note_folders: {},
    link_folders: {},
    tiktok_folders: {},
    albums: {},
    file_albums: {},
    photos: {},
    files: {},
  };

  try {
    onProgress({ phase: 'init', percent: 0, message: 'Starte Import...' });

    // Read file
    onProgress({ phase: 'reading', percent: 5, message: 'Lese Datei...' });
    const arrayBuffer = await readFileContent(file);
    const fileData = new Uint8Array(arrayBuffer);

    let manifest: PhantomVaultManifest | null = null;
    let unzipped: Record<string, Uint8Array> = {};
    let legacyData: any = null;

    // Check if it's a PhantomVault ZIP or legacy format
    const isZip = fileData[0] === 0x50 && fileData[1] === 0x4B; // PK header
    
    if (isZip && !options.password) {
      // PhantomVault ZIP format (unencrypted)
      onProgress({ phase: 'reading', percent: 10, message: 'Entpacke Archiv...' });
      unzipped = unzipSync(fileData);
      manifest = extractManifest(unzipped);
      
      if (!manifest) {
        throw new Error('Ungültiges PhantomVault-Archiv');
      }
    } else {
      // Try to parse as JSON (legacy or encrypted)
      const text = new TextDecoder().decode(fileData);
      
      try {
        const parsed = JSON.parse(text);
        
        // Check if it's an encrypted PhantomVault
        if (isNewEncryptionFormat(parsed) && options.password) {
          onProgress({ phase: 'reading', percent: 10, message: 'Entschlüssele...' });
          const decrypted = await decryptBackup(parsed, options.password);
          if (!decrypted) throw new Error('Falsches Passwort');
          
          // Decrypted content is base64-encoded ZIP
          const binaryStr = atob(decrypted);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          
          unzipped = unzipSync(bytes);
          manifest = extractManifest(unzipped);
          
          if (!manifest) {
            throw new Error('Ungültiges verschlüsseltes PhantomVault-Archiv');
          }
        } else {
          // Legacy format
          const legacy = await importLegacyFormat(text, options.password);
          legacyData = legacy.data;
        }
      } catch (e: any) {
        if (e.message.includes('Passwort')) throw e;
        throw new Error('Ungültiges Backup-Format');
      }
    }

    onProgress({ phase: 'validating', percent: 15, message: 'Validiere Daten...' });

    // Use either manifest data or legacy data
    const data = manifest?.data || legacyData;
    if (!data) {
      throw new Error('Keine Daten im Backup gefunden');
    }

    // Import database data with bulk inserts
    onProgress({ phase: 'database', percent: 20, message: 'Importiere Tags...' });
    await importTags(supabase, userId, data.tags, options, stats);

    onProgress({ phase: 'database', percent: 28, message: 'Importiere Ordner...' });
    await importFolders(supabase, userId, data, stats, idMappings);

    onProgress({ phase: 'database', percent: 36, message: 'Importiere Alben...' });
    await importAlbums(supabase, userId, data, stats, idMappings);

    onProgress({ phase: 'database', percent: 44, message: 'Importiere Notizen...' });
    await importNotes(supabase, userId, data.notes, stats, idMappings);

    onProgress({ phase: 'database', percent: 52, message: 'Importiere Links...' });
    await importLinks(supabase, userId, data.links, stats, idMappings);

    onProgress({ phase: 'database', percent: 58, message: 'Importiere TikToks...' });
    await importTikToks(supabase, userId, data.tiktok_videos, stats, idMappings);

    onProgress({ phase: 'database', percent: 64, message: 'Importiere Fotos...' });
    await importPhotos(supabase, userId, data.photos, stats, idMappings);

    onProgress({ phase: 'database', percent: 70, message: 'Importiere Dateien...' });
    await importFiles(supabase, userId, data.files, stats, idMappings);

    onProgress({ phase: 'database', percent: 74, message: 'Importiere Secrets...' });
    await importSecrets(supabase, userId, data.secret_texts, stats);

    // Upload media files
    if (manifest && manifest.media?.length > 0) {
      await uploadMediaFiles(supabase, userId, manifest, unzipped, stats, onProgress);
    } else if (legacyData?.media_files?.length > 0) {
      await uploadLegacyMedia(supabase, userId, legacyData.media_files, stats, onProgress);
    }

    onProgress({ phase: 'complete', percent: 100, message: 'Import abgeschlossen!' });

    return { success: true, stats };
  } catch (error: any) {
    console.error('Import error:', error);
    onProgress({ phase: 'error', percent: 0, message: error.message || 'Import fehlgeschlagen' });
    return { success: false, stats, error: error.message || 'Unbekannter Fehler' };
  }
}
