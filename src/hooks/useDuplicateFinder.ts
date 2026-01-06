import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DuplicateGroup {
  hash: string;
  items: DuplicateItem[];
  size: number;
  type: 'photo' | 'file';
}

interface DuplicateItem {
  id: string;
  filename: string;
  size: number;
  uploaded_at: string;
  url?: string;
  type: 'photo' | 'file';
}

export function useDuplicateFinder() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const { userId, supabaseClient: supabase } = useAuth();

  const scanForDuplicates = useCallback(async () => {
    if (!userId || !supabase) return;

    setIsScanning(true);
    setProgress(0);
    setDuplicates([]);

    try {
      // Fetch all photos and files
      const [photosRes, filesRes] = await Promise.all([
        supabase.from('photos').select('id, filename, uploaded_at').eq('user_id', userId).is('deleted_at', null),
        supabase.from('files').select('id, filename, size, uploaded_at').eq('user_id', userId).is('deleted_at', null),
      ]);

      setProgress(20);

      const photos = (photosRes.data || []).map(p => ({ ...p, type: 'photo' as const, size: 0 }));
      const files = (filesRes.data || []).map(f => ({ ...f, type: 'file' as const }));

      // Get file sizes from storage for photos
      const photosWithSize: DuplicateItem[] = [];
      for (let i = 0; i < photos.length; i++) {
        try {
          const { data } = await supabase.storage
            .from('photos')
            .list(userId, { search: photos[i].filename });
          
          const fileInfo = data?.find(f => f.name === photos[i].filename);
          const size = (fileInfo?.metadata as any)?.size || 0;
          
          const { data: urlData } = await supabase.storage
            .from('photos')
            .createSignedUrl(`${userId}/${photos[i].filename}`, 3600);
          
          photosWithSize.push({
            ...photos[i],
            size,
            url: urlData?.signedUrl,
          });
        } catch {
          photosWithSize.push({ ...photos[i], size: 0 });
        }
        setProgress(20 + (i / photos.length) * 40);
      }

      // Get URLs for files
      const filesWithUrls: DuplicateItem[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const { data: urlData } = await supabase.storage
            .from('files')
            .createSignedUrl(`${userId}/${files[i].filename}`, 3600);
          
          filesWithUrls.push({
            ...files[i],
            url: urlData?.signedUrl,
          });
        } catch {
          filesWithUrls.push(files[i]);
        }
        setProgress(60 + (i / files.length) * 20);
      }

      // Find duplicates by matching filename pattern (without timestamp) and size
      const allItems = [...photosWithSize, ...filesWithUrls];
      const duplicateMap = new Map<string, DuplicateItem[]>();

      for (const item of allItems) {
        // Extract original filename (remove timestamp prefix)
        const originalName = item.filename.replace(/^\\d+-/, '').toLowerCase();
        const hash = `${originalName}_${item.size}`;
        
        if (!duplicateMap.has(hash)) {
          duplicateMap.set(hash, []);
        }
        duplicateMap.get(hash)!.push(item);
      }

      setProgress(90);

      // Filter to only groups with duplicates
      const duplicateGroups: DuplicateGroup[] = [];
      duplicateMap.forEach((items, hash) => {
        if (items.length > 1) {
          // Sort by upload date, oldest first (keep oldest)
          items.sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime());
          duplicateGroups.push({
            hash,
            items,
            size: items[0].size,
            type: items[0].type,
          });
        }
      });

      // Sort by size descending (largest savings first)
      duplicateGroups.sort((a, b) => (b.size * (b.items.length - 1)) - (a.size * (a.items.length - 1)));

      setDuplicates(duplicateGroups);
      setProgress(100);
    } catch (error) {
      console.error('Error scanning for duplicates:', error);
    } finally {
      setIsScanning(false);
    }
  }, [userId, supabase]);

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
      
      for (const item of toDelete) {
        const table = item.type === 'photo' ? 'photos' : 'files';
        await supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', item.id);
      }

      // Remove this group from duplicates
      setDuplicates(prev => prev.filter(g => g.hash !== group.hash));

      return true;
    } catch (error) {
      console.error('Error deleting duplicates:', error);
      return false;
    }
  }, [userId, supabase]);

  const totalDuplicateSize = duplicates.reduce((acc, group) => {
    return acc + (group.size * (group.items.length - 1));
  }, 0);

  const totalDuplicateCount = duplicates.reduce((acc, group) => {
    return acc + group.items.length - 1;
  }, 0);

  return {
    isScanning,
    progress,
    duplicates,
    totalDuplicateSize,
    totalDuplicateCount,
    scanForDuplicates,
    deleteDuplicate,
    deleteAllDuplicates,
  };
}
