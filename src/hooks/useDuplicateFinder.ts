import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DuplicateGroup {
  hash: string;
  items: DuplicateItem[];
  size: number;
  type: 'photo' | 'file';
  originalName: string;
}

interface DuplicateItem {
  id: string;
  filename: string;
  size: number;
  uploaded_at: string;
  url?: string;
  thumbnailUrl?: string;
  type: 'photo' | 'file';
  mime_type?: string;
}

interface ScanProgress {
  phase: 'loading' | 'hashing' | 'analyzing' | 'done';
  current: number;
  total: number;
  message: string;
}

// Video file extensions for thumbnail handling
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|avi|mkv|m4v|3gp)$/i;

export function useDuplicateFinder() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>({ 
    phase: 'loading', 
    current: 0, 
    total: 0, 
    message: '' 
  });
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { userId, supabaseClient: supabase } = useAuth();

  // Calculate hash from file content (first 64KB for speed)
  const calculatePartialHash = async (blob: Blob): Promise<string> => {
    const chunkSize = 64 * 1024; // 64KB
    const chunk = blob.slice(0, chunkSize);
    const buffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Batch fetch signed URLs
  const batchGetSignedUrls = async (
    bucket: string, 
    paths: string[]
  ): Promise<Map<string, string>> => {
    const urlMap = new Map<string, string>();
    const batchSize = 50;
    
    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (path) => {
          const { data } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);
          return { path, url: data?.signedUrl };
        })
      );
      
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.url) {
          urlMap.set(result.value.path, result.value.url);
        }
      });
    }
    
    return urlMap;
  };

  const scanForDuplicates = useCallback(async () => {
    if (!userId || !supabase) return;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsScanning(true);
    setProgress({ phase: 'loading', current: 0, total: 0, message: 'Lade Dateien...' });
    setDuplicates([]);

    // Fetch 1 byte with Range header to read total size from Content-Range
    const getRemoteSize = async (signedUrl: string): Promise<number> => {
      try {
        const res = await fetch(signedUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          signal,
        });
        const contentRange = res.headers.get('content-range');
        const match = contentRange?.match(/\/(\d+)$/);
        if (match?.[1]) return Number(match[1]);
        const contentLength = res.headers.get('content-length');
        if (contentLength) return Number(contentLength);
      } catch {
        // ignore
      }
      return 0;
    };

    try {
      // Phase 1: Fetch all photos and files in parallel
      const [photosRes, filesRes] = await Promise.all([
        supabase.from('photos')
          .select('id, filename, uploaded_at')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase.from('files')
          .select('id, filename, size, uploaded_at, mime_type')
          .eq('user_id', userId)
          .is('deleted_at', null),
      ]);

      if (signal.aborted) return;

      const photos = (photosRes.data || []).map(p => ({ 
        ...p, 
        type: 'photo' as const, 
        size: 0,
        mime_type: VIDEO_EXTENSIONS.test(p.filename) ? 'video/mp4' : 'image/jpeg'
      }));
      const files = (filesRes.data || []).map(f => ({ ...f, type: 'file' as const }));
      const allItems = [...photos, ...files];

      if (allItems.length === 0) {
        setProgress({ phase: 'done', current: 0, total: 0, message: 'Keine Dateien gefunden' });
        setIsScanning(false);
        return;
      }

      setProgress({ 
        phase: 'loading', 
        current: 0, 
        total: allItems.length, 
        message: `${allItems.length} Dateien gefunden` 
      });

      // Phase 2: Batch get file metadata and URLs
      setProgress({ 
        phase: 'hashing', 
        current: 0, 
        total: allItems.length, 
        message: 'Ermittle Dateigrößen...' 
      });

      // Get storage metadata for photos (to get sizes) - PAGINATED
      const photoSizes = new Map<string, number>();
      
      try {
        let offset = 0;
        const STORAGE_BATCH_SIZE = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data: photoList, error } = await supabase.storage
            .from('photos')
            .list(userId, { limit: STORAGE_BATCH_SIZE, offset });
          
          if (error) {
            console.warn('Could not list photos storage:', error);
            break;
          }
          
          if (photoList) {
            for (const file of photoList) {
              // skip folder entries like "thumbnails"
              if ((file as any)?.id === null && !(file as any)?.metadata) continue;
              const size = (file.metadata as any)?.size || (file.metadata as any)?.contentLength || 0;
              if (size > 0) photoSizes.set(file.name, size);
            }
          }
          
          if (!photoList || photoList.length < STORAGE_BATCH_SIZE) {
            hasMore = false;
          } else {
            offset += STORAGE_BATCH_SIZE;
          }
          
          if (signal.aborted) return;
        }
      } catch (e) {
        console.warn('Could not list photos storage:', e);
      }

      if (signal.aborted) return;

      // Build paths for signed URLs
      const photoPaths = photos.map(p => `${userId}/${p.filename}`);
      const filePaths = files.map(f => `${userId}/${f.filename}`);

      // Get signed URLs in batches
      setProgress({ 
        phase: 'hashing', 
        current: Math.floor(allItems.length * 0.3), 
        total: allItems.length, 
        message: 'Generiere Preview-URLs...' 
      });

      const photoUrls = await batchGetSignedUrls('photos', photoPaths);
      const fileUrls = await batchGetSignedUrls('files', filePaths);

      if (signal.aborted) return;

      // Fallback: if storage listing didn't give sizes (often happens), derive size via signed URL
      const missingSizePhotos = photos.filter(p => (photoSizes.get(p.filename) || 0) === 0);
      if (missingSizePhotos.length > 0) {
        setProgress({
          phase: 'hashing',
          current: Math.floor(allItems.length * 0.45),
          total: allItems.length,
          message: 'Ermittle fehlende Größen...' 
        });

        const CONCURRENCY = 8;
        for (let i = 0; i < missingSizePhotos.length; i += CONCURRENCY) {
          const batch = missingSizePhotos.slice(i, i + CONCURRENCY);
          await Promise.allSettled(
            batch.map(async (p) => {
              if (signal.aborted) return;
              const url = photoUrls.get(`${userId}/${p.filename}`);
              if (!url) return;
              const size = await getRemoteSize(url);
              if (size > 0) photoSizes.set(p.filename, size);
            })
          );
          if (signal.aborted) return;
        }
      }

      // Phase 3: Group by normalized filename + size (fallback to name-only when size is unknown)
      setProgress({ 
        phase: 'analyzing', 
        current: Math.floor(allItems.length * 0.6), 
        total: allItems.length, 
        message: 'Analysiere Duplikate...' 
      });

      const duplicateMap = new Map<string, DuplicateItem[]>();
      
      for (const item of allItems) {
        // Normalize filename: remove timestamp prefix, lowercase
        const normalizedName = item.filename
          .replace(/^\d+-/, '') // Remove timestamp prefix
          .replace(/\s*\(\d+\)\s*/, '') // Remove (1), (2) suffixes
          .toLowerCase()
          .trim();
        
        // Get size
        let size = item.type === 'file' ? item.size : (photoSizes.get(item.filename) || 0);
        
        // Create hash key from normalized name + size (or name-only if size unknown)
        const hashKey = size > 0 ? `${normalizedName}_${size}` : normalizedName;
        
        // Get URL
        const path = `${userId}/${item.filename}`;
        const url = item.type === 'photo' ? photoUrls.get(path) : fileUrls.get(path);

        const duplicateItem: DuplicateItem = {
          id: item.id,
          filename: item.filename,
          size,
          uploaded_at: item.uploaded_at,
          url,
          thumbnailUrl: url, // For videos, we'll handle this in the UI
          type: item.type,
          mime_type: item.mime_type
        };
        
        if (!duplicateMap.has(hashKey)) {
          duplicateMap.set(hashKey, []);
        }
        duplicateMap.get(hashKey)!.push(duplicateItem);
      }

      if (signal.aborted) return;

      // Phase 4: Filter to actual duplicates and sort
      setProgress({ 
        phase: 'analyzing', 
        current: Math.floor(allItems.length * 0.9), 
        total: allItems.length, 
        message: 'Finalisiere Ergebnisse...' 
      });

      const duplicateGroups: DuplicateGroup[] = [];
      
      duplicateMap.forEach((items, hash) => {
        if (items.length > 1) {
          // Sort by upload date, oldest first (keep oldest as original)
          items.sort((a, b) => 
            new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
          );
          
          // Extract original name for display
          const originalName = items[0].filename
            .replace(/^\d+-/, '')
            .replace(/\s*\(\d+\)\s*/, '');
          
          duplicateGroups.push({
            hash,
            items,
            size: items[0].size,
            type: items[0].type,
            originalName
          });
        }
      });

      // Sort groups by potential space savings (descending)
      duplicateGroups.sort((a, b) => {
        const savingsA = a.size * (a.items.length - 1);
        const savingsB = b.size * (b.items.length - 1);
        return savingsB - savingsA;
      });

      setDuplicates(duplicateGroups);
      setProgress({ 
        phase: 'done', 
        current: allItems.length, 
        total: allItems.length, 
        message: duplicateGroups.length > 0 
          ? `${duplicateGroups.length} Duplikat-Gruppen gefunden` 
          : 'Keine Duplikate gefunden' 
      });
    } catch (error) {
      if (!signal.aborted) {
        console.error('Error scanning for duplicates:', error);
        setProgress({ 
          phase: 'done', 
          current: 0, 
          total: 0, 
          message: 'Fehler beim Scannen' 
        });
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsScanning(false);
      }
    }
  }, [userId, supabase]);

  const cancelScan = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsScanning(false);
    setProgress({ phase: 'done', current: 0, total: 0, message: 'Scan abgebrochen' });
  }, []);

  const deleteDuplicate = useCallback(async (item: DuplicateItem) => {
    if (!userId || !supabase) return false;

    try {
      const table = item.type === 'photo' ? 'photos' : 'files';
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;

      // Update duplicates list
      setDuplicates(prev => prev.map(group => ({
        ...group,
        items: group.items.filter(i => i.id !== item.id),
      })).filter(group => group.items.length > 1));

      return true;
    } catch (error) {
      console.error('Error deleting duplicate:', error);
      return false;
    }
  }, [userId, supabase]);

  const deleteAllDuplicates = useCallback(async (group: DuplicateGroup) => {
    if (!userId || !supabase) return false;

    try {
      // Keep the first (oldest) item, delete the rest
      const toDelete = group.items.slice(1);
      const photoIds = toDelete.filter(i => i.type === 'photo').map(i => i.id);
      const fileIds = toDelete.filter(i => i.type === 'file').map(i => i.id);
      
      // Batch delete by type
      if (photoIds.length > 0) {
        const { error } = await supabase
          .from('photos')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', photoIds);
        if (error) throw error;
      }
      
      if (fileIds.length > 0) {
        const { error } = await supabase
          .from('files')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', fileIds);
        if (error) throw error;
      }

      // Remove this group from duplicates
      setDuplicates(prev => prev.filter(g => g.hash !== group.hash));

      return true;
    } catch (error) {
      console.error('Error deleting duplicates:', error);
      return false;
    }
  }, [userId, supabase]);

  const deleteAllDuplicatesGlobally = useCallback(async () => {
    if (!userId || !supabase || duplicates.length === 0) return false;

    try {
      // Collect all items to delete (keep first/oldest of each group)
      const allToDelete: DuplicateItem[] = [];
      duplicates.forEach(group => {
        allToDelete.push(...group.items.slice(1));
      });

      const photoIds = allToDelete.filter(i => i.type === 'photo').map(i => i.id);
      const fileIds = allToDelete.filter(i => i.type === 'file').map(i => i.id);
      
      if (photoIds.length > 0) {
        const { error } = await supabase
          .from('photos')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', photoIds);
        if (error) throw error;
      }
      
      if (fileIds.length > 0) {
        const { error } = await supabase
          .from('files')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', fileIds);
        if (error) throw error;
      }

      setDuplicates([]);
      return true;
    } catch (error) {
      console.error('Error deleting all duplicates:', error);
      return false;
    }
  }, [userId, supabase, duplicates]);

  const totalDuplicateSize = duplicates.reduce((acc, group) => {
    return acc + (group.size * (group.items.length - 1));
  }, 0);

  const totalDuplicateCount = duplicates.reduce((acc, group) => {
    return acc + group.items.length - 1;
  }, 0);

  const progressPercent = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return {
    isScanning,
    progress,
    progressPercent,
    duplicates,
    totalDuplicateSize,
    totalDuplicateCount,
    scanForDuplicates,
    cancelScan,
    deleteDuplicate,
    deleteAllDuplicates,
    deleteAllDuplicatesGlobally,
  };
}
