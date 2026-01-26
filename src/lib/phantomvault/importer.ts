/**
 * PhantomVault Import Module
 * 
 * Imports data from .phantomvault ZIP format with chunked media handling
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
import { parseManifest, validateManifest } from './manifest';
import { 
  decryptBackup, 
  isNewEncryptionFormat, 
  isOldEncryptionFormat, 
  decryptOldBackup 
} from '@/lib/encryption';

const MEDIA_UPLOAD_BATCH_SIZE = 3;

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
 * Read and parse file content
 */
async function readFileContent(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsArrayBuffer(file);
  });
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
  password: string | undefined,
  onProgress: ProgressCallback
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
 * Import tags
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
  
  for (const tag of tags) {
    if (existingNames.has(tag.name.toLowerCase()) && options.conflictResolution === 'skip') {
      stats.tags.skipped++;
      continue;
    }
    
    const name = options.conflictResolution === 'duplicate' && existingNames.has(tag.name.toLowerCase())
      ? `${tag.name} (Import)`
      : tag.name;
    
    const { error } = await supabase.from('tags').insert({
      user_id: userId,
      name,
      color: tag.color,
    });
    
    if (!error) stats.tags.imported++;
    else stats.tags.skipped++;
  }
}

/**
 * Import folders with ID mapping
 */
async function importFolders(
  supabase: SupabaseClient,
  userId: string,
  data: any,
  stats: ImportStats,
  idMappings: IdMappings
): Promise<void> {
  const folderTypes = ['note_folders', 'link_folders', 'tiktok_folders'] as const;
  
  for (const folderType of folderTypes) {
    const folders = data[folderType] as any[];
    if (!folders?.length) continue;
    
    stats.folders.total += folders.length;
    
    for (const folder of folders) {
      const oldId = folder.id;
      const { data: newFolder, error } = await supabase.from(folderType).insert({
        user_id: userId,
        name: folder.name,
        color: folder.color,
        icon: folder.icon,
      }).select('id').single();
      
      if (!error && newFolder) {
        stats.folders.imported++;
        idMappings[folderType][oldId] = newFolder.id;
      } else {
        stats.folders.skipped++;
      }
    }
  }
}

/**
 * Import albums with ID mapping
 */
async function importAlbums(
  supabase: SupabaseClient,
  userId: string,
  data: any,
  stats: ImportStats,
  idMappings: IdMappings
): Promise<void> {
  const albumTypes = ['albums', 'file_albums'] as const;
  
  for (const albumType of albumTypes) {
    const albums = data[albumType] as any[];
    if (!albums?.length) continue;
    
    stats.albums.total += albums.length;
    
    for (const album of albums) {
      const oldId = album.id;
      const { data: newAlbum, error } = await supabase.from(albumType).insert({
        user_id: userId,
        name: album.name,
        color: album.color,
        icon: album.icon,
        is_pinned: album.is_pinned,
      }).select('id').single();
      
      if (!error && newAlbum) {
        stats.albums.imported++;
        idMappings[albumType][oldId] = newAlbum.id;
      } else {
        stats.albums.skipped++;
      }
    }
  }
}

/**
 * Import notes with folder mapping
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
  
  for (const note of notes) {
    if (note.deleted_at) {
      stats.notes.skipped++;
      continue;
    }
    
    const newFolderId = note.folder_id ? idMappings.note_folders[note.folder_id] : null;
    
    const { error } = await supabase.from('notes').insert({
      user_id: userId,
      title: note.title || 'Importierte Notiz',
      content: note.content,
      folder_id: newFolderId || null,
      is_favorite: note.is_favorite,
      is_secure: note.is_secure,
      secure_content: note.secure_content,
      tags: note.tags,
    });
    
    if (!error) stats.notes.imported++;
    else stats.notes.skipped++;
  }
}

/**
 * Import links with folder mapping
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
  
  for (const link of links) {
    if (link.deleted_at) {
      stats.links.skipped++;
      continue;
    }
    
    const newFolderId = link.folder_id ? idMappings.link_folders[link.folder_id] : null;
    
    const { error } = await supabase.from('links').insert({
      user_id: userId,
      url: link.url,
      title: link.title || 'Importierter Link',
      description: link.description,
      favicon_url: link.favicon_url,
      image_url: link.image_url,
      folder_id: newFolderId || null,
      is_favorite: link.is_favorite,
      tags: link.tags,
    });
    
    if (!error) stats.links.imported++;
    else stats.links.skipped++;
  }
}

/**
 * Import TikTok videos with folder mapping
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
  
  for (const video of videos) {
    if (video.deleted_at) {
      stats.tiktoks.skipped++;
      continue;
    }
    
    const newFolderId = video.folder_id ? idMappings.tiktok_folders[video.folder_id] : null;
    
    const { error } = await supabase.from('tiktok_videos').insert({
      user_id: userId,
      url: video.url,
      title: video.title,
      author_name: video.author_name,
      thumbnail_url: video.thumbnail_url,
      video_id: video.video_id,
      folder_id: newFolderId || null,
      is_favorite: video.is_favorite,
    });
    
    if (!error) stats.tiktoks.imported++;
    else stats.tiktoks.skipped++;
  }
}

/**
 * Import photos metadata with album mapping
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
  
  for (const photo of photos) {
    if (photo.deleted_at) {
      stats.photos.skipped++;
      continue;
    }
    
    const newAlbumId = photo.album_id ? idMappings.albums[photo.album_id] : null;
    const oldId = photo.id;
    
    const { data: newPhoto, error } = await supabase.from('photos').insert({
      user_id: userId,
      filename: photo.filename,
      caption: photo.caption,
      taken_at: photo.taken_at,
      album_id: newAlbumId || null,
      is_favorite: photo.is_favorite,
      tags: photo.tags,
      thumbnail_filename: photo.thumbnail_filename,
    }).select('id').single();
    
    if (!error && newPhoto) {
      stats.photos.imported++;
      idMappings.photos[oldId] = newPhoto.id;
    } else {
      stats.photos.skipped++;
    }
  }
}

/**
 * Import files metadata with album mapping
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
  
  for (const file of files) {
    if (file.deleted_at) {
      stats.files.skipped++;
      continue;
    }
    
    const newAlbumId = file.album_id ? idMappings.file_albums[file.album_id] : null;
    const oldId = file.id;
    
    const { data: newFile, error } = await supabase.from('files').insert({
      user_id: userId,
      filename: file.filename,
      mime_type: file.mime_type,
      size: file.size,
      album_id: newAlbumId || null,
      is_favorite: file.is_favorite,
      tags: file.tags,
    }).select('id').single();
    
    if (!error && newFile) {
      stats.files.imported++;
      idMappings.files[oldId] = newFile.id;
    } else {
      stats.files.skipped++;
    }
  }
}

/**
 * Import secret texts
 */
async function importSecrets(
  supabase: SupabaseClient,
  userId: string,
  secrets: any[],
  stats: ImportStats
): Promise<void> {
  if (!secrets?.length) return;
  
  stats.secrets.total = secrets.length;
  
  for (const secret of secrets) {
    const { error } = await supabase.from('secret_texts').insert({
      user_id: userId,
      title: secret.title || 'Importierter Text',
      encrypted_content: secret.encrypted_content,
    });
    
    if (!error) stats.secrets.imported++;
    else stats.secrets.skipped++;
  }
}

/**
 * Upload media files from ZIP
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
  
  for (let i = 0; i < manifest.media.length; i += MEDIA_UPLOAD_BATCH_SIZE) {
    const batch = manifest.media.slice(i, i + MEDIA_UPLOAD_BATCH_SIZE);
    
    onProgress({
      phase: 'media',
      percent: 80 + Math.round((processed / manifest.media.length) * 18),
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
          const blob = new Blob([new Uint8Array(fileData)]);
          const storagePath = `${userId}/${entry.filename}`;
          
          const { error } = await supabase.storage
            .from(entry.bucket)
            .upload(storagePath, blob, { upsert: true });
          
          if (error) {
            console.warn(`Failed to upload ${entry.path_in_zip}:`, error.message);
            stats.media.failed++;
          } else {
            stats.media.uploaded++;
          }
        } catch (e) {
          console.warn(`Error uploading ${entry.path_in_zip}:`, e);
          stats.media.failed++;
        }
      })
    );
    
    processed += batch.length;
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
  
  for (let i = 0; i < mediaFiles.length; i += MEDIA_UPLOAD_BATCH_SIZE) {
    const batch = mediaFiles.slice(i, i + MEDIA_UPLOAD_BATCH_SIZE);
    
    onProgress({
      phase: 'media',
      percent: 80 + Math.round((uploaded / mediaFiles.length) * 18),
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
        } catch (e) {
          stats.media.failed++;
          uploaded++;
        }
      })
    );
  }
}

/**
 * Main import function
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
          onProgress({ phase: 'reading', percent: 10, message: 'Entschlüssele Backup...' });
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
          const legacy = await importLegacyFormat(text, options.password, onProgress);
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

    // Import database data
    onProgress({ phase: 'database', percent: 20, message: 'Importiere Tags...' });
    await importTags(supabase, userId, data.tags, options, stats);

    onProgress({ phase: 'database', percent: 30, message: 'Importiere Ordner...' });
    await importFolders(supabase, userId, data, stats, idMappings);

    onProgress({ phase: 'database', percent: 40, message: 'Importiere Alben...' });
    await importAlbums(supabase, userId, data, stats, idMappings);

    onProgress({ phase: 'database', percent: 50, message: 'Importiere Notizen...' });
    await importNotes(supabase, userId, data.notes, stats, idMappings);

    onProgress({ phase: 'database', percent: 55, message: 'Importiere Links...' });
    await importLinks(supabase, userId, data.links, stats, idMappings);

    onProgress({ phase: 'database', percent: 60, message: 'Importiere TikToks...' });
    await importTikToks(supabase, userId, data.tiktok_videos, stats, idMappings);

    onProgress({ phase: 'database', percent: 65, message: 'Importiere Fotos-Metadaten...' });
    await importPhotos(supabase, userId, data.photos, stats, idMappings);

    onProgress({ phase: 'database', percent: 70, message: 'Importiere Dateien-Metadaten...' });
    await importFiles(supabase, userId, data.files, stats, idMappings);

    onProgress({ phase: 'database', percent: 75, message: 'Importiere geheime Texte...' });
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
