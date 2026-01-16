import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface StorageItem {
  id: string;
  name: string;
  size: number;
  type: 'photo' | 'file' | 'note_attachment';
  mimeType: string;
  createdAt: Date;
  albumId?: string | null;
  albumName?: string;
}

interface AlbumStats {
  id: string;
  name: string;
  totalSize: number;
  itemCount: number;
  color?: string | null;
}

interface FileTypeStats {
  type: string;
  category: string;
  totalSize: number;
  itemCount: number;
  percentage: number;
}

interface MonthlyStats {
  month: string;
  monthLabel: string;
  totalSize: number;
  itemCount: number;
  photos: number;
  files: number;
}

interface SizeDistribution {
  range: string;
  count: number;
  totalSize: number;
  percentage: number;
}

export interface StorageAnalysisData {
  totalSize: number;
  totalItems: number;
  byFileType: FileTypeStats[];
  byAlbum: AlbumStats[];
  byMonth: MonthlyStats[];
  sizeDistribution: SizeDistribution[];
  largestFiles: StorageItem[];
}

const SIZE_RANGES = [
  { label: '< 100 KB', min: 0, max: 100 * 1024 },
  { label: '100 KB - 1 MB', min: 100 * 1024, max: 1024 * 1024 },
  { label: '1 MB - 10 MB', min: 1024 * 1024, max: 10 * 1024 * 1024 },
  { label: '10 MB - 100 MB', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
  { label: '> 100 MB', min: 100 * 1024 * 1024, max: Infinity },
];

const MIME_CATEGORIES: Record<string, string> = {
  'image/': 'Bilder',
  'video/': 'Videos',
  'audio/': 'Audio',
  'application/pdf': 'PDF',
  'application/msword': 'Dokumente',
  'application/vnd.openxmlformats-officedocument': 'Dokumente',
  'text/': 'Text',
  'application/zip': 'Archive',
  'application/x-rar': 'Archive',
  'application/x-7z': 'Archive',
};

function getCategoryForMimeType(mimeType: string): string {
  for (const [prefix, category] of Object.entries(MIME_CATEGORIES)) {
    if (mimeType.startsWith(prefix)) {
      return category;
    }
  }
  return 'Andere';
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'txt': 'text/plain',
    'json': 'application/json',
    'xml': 'text/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export function useStorageAnalysis() {
  const { sessionToken, userId, supabaseClient: supabase } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StorageAnalysisData | null>(null);

  const analyze = useCallback(async () => {
    if (!sessionToken || !userId) {
      setError('Nicht authentifiziert');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all database data in parallel
      const [photosRes, filesRes, attachmentsRes, albumsRes, fileAlbumsRes] = await Promise.all([
        supabase
          .from('photos')
          .select('id, filename, uploaded_at, album_id')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('files')
          .select('id, filename, mime_type, size, uploaded_at, album_id')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('note_attachments')
          .select('id, filename, original_name, mime_type, size, created_at')
          .eq('user_id', userId),
        supabase
          .from('albums')
          .select('id, name, color')
          .eq('user_id', userId),
        supabase
          .from('file_albums')
          .select('id, name, color')
          .eq('user_id', userId),
      ]);

      // Create album maps
      const photoAlbums = new Map((albumsRes.data || []).map(a => [a.id, a]));
      const fileAlbumMap = new Map((fileAlbumsRes.data || []).map(a => [a.id, a]));

      // Get photo sizes from storage - list files in user's folder
      const photoItems: StorageItem[] = [];
      const photos = photosRes.data || [];
      
      if (photos.length > 0) {
        // Fetch storage files to get actual sizes
        const { data: storageFiles, error: storageError } = await supabase.storage
          .from('photos')
          .list(userId, { limit: 1000 });
        
        if (storageError) {
          console.warn('Could not fetch storage files:', storageError);
        }

        // Create a map of filename to size from storage
        const storageSizeMap = new Map<string, number>();
        if (storageFiles) {
          for (const file of storageFiles) {
            // Storage list returns file metadata with size
            const size = (file.metadata as any)?.size || file.metadata?.contentLength || 0;
            storageSizeMap.set(file.name, size);
          }
        }

        for (const photo of photos) {
          // Try to get actual size from storage, fallback to estimated size
          let size = storageSizeMap.get(photo.filename) || 0;
          
          // If no size from storage, estimate based on typical photo sizes
          if (size === 0) {
            size = 800000; // Default 800KB for photos
          }

          const mimeType = getMimeTypeFromFilename(photo.filename);
          
          photoItems.push({
            id: photo.id,
            name: photo.filename,
            size,
            type: 'photo',
            mimeType,
            createdAt: new Date(photo.uploaded_at || Date.now()),
            albumId: photo.album_id,
            albumName: photo.album_id ? photoAlbums.get(photo.album_id)?.name : undefined,
          });
        }
      }

      // Process files
      const fileItems: StorageItem[] = (filesRes.data || []).map(file => ({
        id: file.id,
        name: file.filename,
        size: file.size || 0,
        type: 'file' as const,
        mimeType: file.mime_type || getMimeTypeFromFilename(file.filename),
        createdAt: new Date(file.uploaded_at || Date.now()),
        albumId: file.album_id,
        albumName: file.album_id ? fileAlbumMap.get(file.album_id)?.name : undefined,
      }));

      // Process note attachments
      const attachmentItems: StorageItem[] = (attachmentsRes.data || []).map(att => ({
        id: att.id,
        name: att.original_name || att.filename,
        size: att.size || 0,
        type: 'note_attachment' as const,
        mimeType: att.mime_type || getMimeTypeFromFilename(att.filename),
        createdAt: new Date(att.created_at || Date.now()),
      }));

      // Combine all items
      const allItems = [...photoItems, ...fileItems, ...attachmentItems];
      const totalSize = allItems.reduce((sum, item) => sum + item.size, 0);

      // Group by file type/category
      const typeMap = new Map<string, { totalSize: number; count: number }>();
      for (const item of allItems) {
        const category = getCategoryForMimeType(item.mimeType);
        const existing = typeMap.get(category) || { totalSize: 0, count: 0 };
        typeMap.set(category, {
          totalSize: existing.totalSize + item.size,
          count: existing.count + 1,
        });
      }

      const byFileType: FileTypeStats[] = Array.from(typeMap.entries())
        .map(([type, stats]) => ({
          type,
          category: type,
          totalSize: stats.totalSize,
          itemCount: stats.count,
          percentage: totalSize > 0 ? (stats.totalSize / totalSize) * 100 : 0,
        }))
        .sort((a, b) => b.totalSize - a.totalSize);

      // Group by album
      const albumMap = new Map<string, { name: string; totalSize: number; count: number; color?: string | null }>();
      
      // Add "Kein Album" entry
      albumMap.set('none', { name: 'Kein Album', totalSize: 0, count: 0 });

      for (const item of [...photoItems, ...fileItems]) {
        const albumId = item.albumId || 'none';
        const albumInfo = item.albumId 
          ? (photoAlbums.get(item.albumId) || fileAlbumMap.get(item.albumId))
          : null;
        
        const existing = albumMap.get(albumId) || { 
          name: albumInfo?.name || 'Kein Album', 
          totalSize: 0, 
          count: 0,
          color: albumInfo?.color 
        };
        
        albumMap.set(albumId, {
          ...existing,
          totalSize: existing.totalSize + item.size,
          count: existing.count + 1,
        });
      }

      const byAlbum: AlbumStats[] = Array.from(albumMap.entries())
        .map(([id, stats]) => ({
          id,
          name: stats.name,
          totalSize: stats.totalSize,
          itemCount: stats.count,
          color: stats.color,
        }))
        .filter(a => a.itemCount > 0)
        .sort((a, b) => b.totalSize - a.totalSize);

      // Group by month
      const monthMap = new Map<string, { totalSize: number; count: number; photos: number; files: number }>();
      
      for (const item of allItems) {
        const monthKey = formatMonth(item.createdAt);
        const existing = monthMap.get(monthKey) || { totalSize: 0, count: 0, photos: 0, files: 0 };
        monthMap.set(monthKey, {
          totalSize: existing.totalSize + item.size,
          count: existing.count + 1,
          photos: existing.photos + (item.type === 'photo' ? 1 : 0),
          files: existing.files + (item.type === 'file' || item.type === 'note_attachment' ? 1 : 0),
        });
      }

      const byMonth: MonthlyStats[] = Array.from(monthMap.entries())
        .map(([month, stats]) => ({
          month,
          monthLabel: getMonthLabel(month),
          totalSize: stats.totalSize,
          itemCount: stats.count,
          photos: stats.photos,
          files: stats.files,
        }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12); // Last 12 months

      // Size distribution
      const sizeDistribution: SizeDistribution[] = SIZE_RANGES.map(range => {
        const items = allItems.filter(item => item.size >= range.min && item.size < range.max);
        const totalRangeSize = items.reduce((sum, item) => sum + item.size, 0);
        return {
          range: range.label,
          count: items.length,
          totalSize: totalRangeSize,
          percentage: allItems.length > 0 ? (items.length / allItems.length) * 100 : 0,
        };
      });

      // Largest files
      const largestFiles = [...allItems]
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      setData({
        totalSize,
        totalItems: allItems.length,
        byFileType,
        byAlbum,
        byMonth,
        sizeDistribution,
        largestFiles,
      });
    } catch (err) {
      console.error('Storage analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analyse fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, userId]);

  return {
    data,
    isLoading,
    error,
    analyze,
  };
}

// Utility function to format bytes
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
