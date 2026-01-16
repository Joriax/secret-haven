import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface DuplicateGroup {
  hash: string;
  items: DuplicateItem[];
  size: number;
  type: 'photo' | 'file';
  originalName: string;
  matchType: 'exact' | 'similar' | 'name-only';
}

export interface DuplicateItem {
  id: string;
  filename: string;
  size: number;
  uploaded_at: string;
  url?: string;
  thumbnailUrl?: string;
  type: 'photo' | 'file';
  mime_type?: string;
  contentHash?: string;
}

export interface ScanProgress {
  phase: 'loading' | 'fetching-sizes' | 'hashing' | 'analyzing' | 'done';
  current: number;
  total: number;
  message: string;
}

export type ScanMode = 'exact' | 'similar' | 'all';

// Video/image extensions for handling
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|avi|mkv|m4v|3gp)$/i;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i;

export function useDuplicateFinder() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('all');
  const [progress, setProgress] = useState<ScanProgress>({ 
    phase: 'loading', 
    current: 0, 
    total: 0, 
    message: '' 
  });
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { userId, supabaseClient: supabase } = useAuth();

  // Calculate hash from file content - more reliable with larger chunk
  const calculateContentHash = async (blob: Blob, fullHash = false): Promise<string> => {
    try {
      // For full hash, use entire file (slower but more accurate)
      // For quick hash, use first + last 32KB + middle 32KB (faster but still reliable)
      let dataToHash: ArrayBuffer;
      
      if (fullHash || blob.size <= 100 * 1024) {
        // For small files or full hash request, hash entire file
        dataToHash = await blob.arrayBuffer();
      } else {
        // For larger files, sample from beginning, middle, and end
        const chunkSize = 32 * 1024; // 32KB
        const chunks: ArrayBuffer[] = [];
        
        // First 32KB
        chunks.push(await blob.slice(0, chunkSize).arrayBuffer());
        
        // Middle 32KB
        const middleStart = Math.floor(blob.size / 2) - (chunkSize / 2);
        chunks.push(await blob.slice(middleStart, middleStart + chunkSize).arrayBuffer());
        
        // Last 32KB
        chunks.push(await blob.slice(-chunkSize).arrayBuffer());
        
        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }
        dataToHash = combined.buffer;
      }
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Error calculating hash:', error);
      return '';
    }
  };

  // Normalize filename for similar matching
  const normalizeFilename = (filename: string): string => {
    return filename
      .replace(/^\d{10,13}-/, '') // Remove timestamp prefix (10-13 digits)
      .replace(/^[a-f0-9]{8}-[a-f0-9-]+-/, '') // Remove UUID prefix
      .replace(/\s*[\(\[\{]\d+[\)\]\}]\s*/g, '') // Remove (1), [2], {3} suffixes
      .replace(/_\d+\./g, '.') // Remove _1. suffixes before extension
      .replace(/-copy\d*/gi, '') // Remove -copy suffixes
      .replace(/_copy\d*/gi, '') // Remove _copy suffixes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase()
      .trim();
  };

  // Get file extension
  const getExtension = (filename: string): string => {
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  };

  // Batch fetch signed URLs with proper error handling
  const batchGetSignedUrls = async (
    bucket: string, 
    paths: string[],
    signal: AbortSignal
  ): Promise<Map<string, string>> => {
    const urlMap = new Map<string, string>();
    const batchSize = 50;
    
    for (let i = 0; i < paths.length; i += batchSize) {
      if (signal.aborted) break;
      
      const batch = paths.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (path) => {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 7200); // 2 hour expiry
          if (error) throw error;
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

  // Fetch file size from URL using Range header
  const getFileSize = async (url: string, signal: AbortSignal): Promise<number> => {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal,
      });
      
      const contentLength = res.headers.get('content-length');
      if (contentLength) return parseInt(contentLength, 10);
      
      // Fallback: try Range request
      const rangeRes = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal,
      });
      const contentRange = rangeRes.headers.get('content-range');
      const match = contentRange?.match(/\/(\d+)$/);
      if (match?.[1]) return parseInt(match[1], 10);
      
      return 0;
    } catch {
      return 0;
    }
  };

  // Fetch file content for hashing
  const fetchFileForHashing = async (url: string, signal: AbortSignal): Promise<Blob | null> => {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  };

  const scanForDuplicates = useCallback(async (mode: ScanMode = 'all') => {
    if (!userId || !supabase) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsScanning(true);
    setScanMode(mode);
    setProgress({ phase: 'loading', current: 0, total: 0, message: 'Lade Dateien...' });
    setDuplicates([]);

    try {
      // Phase 1: Fetch all photos and files
      const [photosRes, filesRes] = await Promise.all([
        supabase.from('photos')
          .select('id, filename, uploaded_at, thumbnail_filename')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('uploaded_at', { ascending: true }),
        supabase.from('files')
          .select('id, filename, size, uploaded_at, mime_type')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('uploaded_at', { ascending: true }),
      ]);

      if (signal.aborted) return;

      const photos = (photosRes.data || []).map(p => ({ 
        ...p, 
        type: 'photo' as const, 
        size: 0, // Will be fetched
        mime_type: VIDEO_EXTENSIONS.test(p.filename) ? 'video/mp4' : 
                   IMAGE_EXTENSIONS.test(p.filename) ? 'image/jpeg' : 'application/octet-stream'
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
        message: `${allItems.length} Dateien gefunden, generiere URLs...` 
      });

      // Phase 2: Get signed URLs
      const photoPaths = photos.map(p => `${userId}/${p.filename}`);
      const filePaths = files.map(f => `${userId}/${f.filename}`);

      const [photoUrls, fileUrls] = await Promise.all([
        batchGetSignedUrls('photos', photoPaths, signal),
        batchGetSignedUrls('files', filePaths, signal),
      ]);

      if (signal.aborted) return;

      // Phase 3: Fetch file sizes for photos (files already have size in DB)
      setProgress({ 
        phase: 'fetching-sizes', 
        current: 0, 
        total: photos.length, 
        message: 'Ermittle Dateigrößen...' 
      });

      const photoSizes = new Map<string, number>();
      const CONCURRENT_SIZE_FETCHES = 10;
      
      for (let i = 0; i < photos.length; i += CONCURRENT_SIZE_FETCHES) {
        if (signal.aborted) return;
        
        const batch = photos.slice(i, i + CONCURRENT_SIZE_FETCHES);
        await Promise.all(
          batch.map(async (photo) => {
            const url = photoUrls.get(`${userId}/${photo.filename}`);
            if (url) {
              const size = await getFileSize(url, signal);
              if (size > 0) {
                photoSizes.set(photo.id, size);
              }
            }
          })
        );
        
        setProgress(prev => ({ 
          ...prev, 
          current: Math.min(i + CONCURRENT_SIZE_FETCHES, photos.length),
          message: `Dateigrößen: ${Math.min(i + CONCURRENT_SIZE_FETCHES, photos.length)}/${photos.length}`
        }));
      }

      if (signal.aborted) return;

      // Build items with all data
      const itemsWithData: DuplicateItem[] = allItems.map(item => {
        const path = `${userId}/${item.filename}`;
        const url = item.type === 'photo' ? photoUrls.get(path) : fileUrls.get(path);
        const size = item.type === 'photo' ? (photoSizes.get(item.id) || 0) : item.size;
        
        return {
          id: item.id,
          filename: item.filename,
          size,
          uploaded_at: item.uploaded_at,
          url,
          type: item.type,
          mime_type: item.mime_type,
        };
      });

      // Phase 4: Group by size first (quick filter for potential duplicates)
      setProgress({ 
        phase: 'analyzing', 
        current: 0, 
        total: itemsWithData.length, 
        message: 'Analysiere nach Größe...' 
      });

      const sizeGroups = new Map<number, DuplicateItem[]>();
      for (const item of itemsWithData) {
        if (item.size > 0) {
          const key = item.size;
          if (!sizeGroups.has(key)) {
            sizeGroups.set(key, []);
          }
          sizeGroups.get(key)!.push(item);
        }
      }

      // Filter to potential duplicates (same size)
      const potentialDuplicates = Array.from(sizeGroups.values())
        .filter(group => group.length > 1);

      if (signal.aborted) return;

      // Phase 5: For exact mode, hash files with same size to confirm duplicates
      const duplicateGroups: DuplicateGroup[] = [];
      
      if (mode === 'exact' || mode === 'all') {
        setProgress({ 
          phase: 'hashing', 
          current: 0, 
          total: potentialDuplicates.reduce((sum, g) => sum + g.length, 0), 
          message: 'Berechne Datei-Hashes für exakte Duplikate...' 
        });

        let processedCount = 0;
        const CONCURRENT_HASHES = 4;

        for (const sizeGroup of potentialDuplicates) {
          if (signal.aborted) return;

          const hashGroups = new Map<string, DuplicateItem[]>();
          
          // Hash files in this size group
          for (let i = 0; i < sizeGroup.length; i += CONCURRENT_HASHES) {
            if (signal.aborted) return;
            
            const batch = sizeGroup.slice(i, i + CONCURRENT_HASHES);
            await Promise.all(
              batch.map(async (item) => {
                if (!item.url) return;
                
                const blob = await fetchFileForHashing(item.url, signal);
                if (!blob) return;
                
                const hash = await calculateContentHash(blob, false);
                if (!hash) return;
                
                item.contentHash = hash;
                
                if (!hashGroups.has(hash)) {
                  hashGroups.set(hash, []);
                }
                hashGroups.get(hash)!.push(item);
              })
            );
            
            processedCount += batch.length;
            setProgress(prev => ({ 
              ...prev, 
              current: processedCount,
              message: `Hash-Berechnung: ${processedCount}/${prev.total}`
            }));
          }

          // Add exact duplicates to results
          hashGroups.forEach((items, hash) => {
            if (items.length > 1) {
              // Sort by upload date (oldest first = original)
              items.sort((a, b) => 
                new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
              );
              
              duplicateGroups.push({
                hash,
                items,
                size: items[0].size,
                type: items[0].type,
                originalName: items[0].filename.replace(/^\d+-/, ''),
                matchType: 'exact',
              });
            }
          });
        }
      }

      // Phase 6: For similar mode, also check name-based duplicates
      if ((mode === 'similar' || mode === 'all') && !signal.aborted) {
        setProgress({ 
          phase: 'analyzing', 
          current: 0, 
          total: itemsWithData.length, 
          message: 'Suche ähnliche Dateinamen...' 
        });

        // Group by normalized name + extension + size tolerance (±5%)
        const nameGroups = new Map<string, DuplicateItem[]>();
        
        for (const item of itemsWithData) {
          const normalizedName = normalizeFilename(item.filename);
          const ext = getExtension(item.filename);
          // Round size to nearest 5% bucket for tolerance
          const sizeBucket = item.size > 0 ? Math.round(item.size / (item.size * 0.05)) * (item.size * 0.05) : 0;
          const key = `${normalizedName}:${ext}:${Math.round(sizeBucket)}`;
          
          if (!nameGroups.has(key)) {
            nameGroups.set(key, []);
          }
          nameGroups.get(key)!.push(item);
        }

        // Add similar duplicates (but exclude exact duplicates we already found)
        const exactHashSet = new Set(
          duplicateGroups.flatMap(g => g.items.map(i => i.id))
        );

        nameGroups.forEach((items, key) => {
          // Filter out items already in exact duplicate groups
          const newItems = items.filter(i => !exactHashSet.has(i.id));
          
          if (newItems.length > 1) {
            // Sort by upload date
            newItems.sort((a, b) => 
              new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
            );
            
            duplicateGroups.push({
              hash: `similar-${key}`,
              items: newItems,
              size: newItems[0].size,
              type: newItems[0].type,
              originalName: normalizeFilename(newItems[0].filename),
              matchType: 'similar',
            });
          }
        });
      }

      // Sort groups by potential savings (descending)
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
      const allToDelete: DuplicateItem[] = [];
      duplicates.forEach(group => {
        allToDelete.push(...group.items.slice(1));
      });

      const photoIds = allToDelete.filter(i => i.type === 'photo').map(i => i.id);
      const fileIds = allToDelete.filter(i => i.type === 'file').map(i => i.id);
      
      // Delete in batches to avoid hitting limits
      const BATCH_SIZE = 100;
      
      for (let i = 0; i < photoIds.length; i += BATCH_SIZE) {
        const batch = photoIds.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('photos')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', batch);
        if (error) throw error;
      }
      
      for (let i = 0; i < fileIds.length; i += BATCH_SIZE) {
        const batch = fileIds.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('files')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', batch);
        if (error) throw error;
      }

      setDuplicates([]);
      return true;
    } catch (error) {
      console.error('Error deleting all duplicates:', error);
      return false;
    }
  }, [userId, supabase, duplicates]);

  // Keep selected item as original (swap with current original)
  const keepAsOriginal = useCallback((groupHash: string, itemId: string) => {
    setDuplicates(prev => prev.map(group => {
      if (group.hash !== groupHash) return group;
      
      const itemIndex = group.items.findIndex(i => i.id === itemId);
      if (itemIndex <= 0) return group; // Already original or not found
      
      const newItems = [...group.items];
      const [selectedItem] = newItems.splice(itemIndex, 1);
      newItems.unshift(selectedItem);
      
      return { ...group, items: newItems };
    }));
  }, []);

  const totalDuplicateSize = duplicates.reduce((acc, group) => {
    return acc + (group.size * (group.items.length - 1));
  }, 0);

  const totalDuplicateCount = duplicates.reduce((acc, group) => {
    return acc + group.items.length - 1;
  }, 0);

  const exactDuplicateCount = duplicates
    .filter(g => g.matchType === 'exact')
    .reduce((acc, group) => acc + group.items.length - 1, 0);

  const similarDuplicateCount = duplicates
    .filter(g => g.matchType === 'similar')
    .reduce((acc, group) => acc + group.items.length - 1, 0);

  const progressPercent = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return {
    isScanning,
    scanMode,
    progress,
    progressPercent,
    duplicates,
    totalDuplicateSize,
    totalDuplicateCount,
    exactDuplicateCount,
    similarDuplicateCount,
    scanForDuplicates,
    cancelScan,
    deleteDuplicate,
    deleteAllDuplicates,
    deleteAllDuplicatesGlobally,
    keepAsOriginal,
  };
}
