import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface DashboardStats {
  notes: number;
  photos: number;
  files: number;
  favorites: number;
  secureNotes: number;
  secretTexts: number;
  totalFilesSize: number;
  totalPhotosSize: number;
  totalAttachmentsSize: number;
  totalStorageSize: number;
  trashedFilesSize: number;
  trashedPhotosSize: number;
  trashedItems: number;
  tiktokVideos: number;
  links: number;
}

export interface RecentItem {
  id: string;
  type: 'note' | 'photo' | 'file' | 'secret_text';
  title: string;
  date: string;
  isFavorite?: boolean;
}

// Global cache for dashboard stats
const statsCache = new Map<string, {
  stats: DashboardStats;
  recentItems: RecentItem[];
  timestamp: number;
}>();
const CACHE_TTL = 60000; // 1 minute cache

const DEFAULT_STATS: DashboardStats = {
  notes: 0, photos: 0, files: 0, favorites: 0,
  secureNotes: 0, secretTexts: 0,
  totalFilesSize: 0, totalPhotosSize: 0, totalAttachmentsSize: 0, totalStorageSize: 0,
  trashedFilesSize: 0, trashedPhotosSize: 0,
  trashedItems: 0, tiktokVideos: 0, links: 0
};

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  
  const isFetchingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async (skipCache = false) => {
    if (!userId || isFetchingRef.current) return;
    
    // Check cache first
    if (!skipCache) {
      const cached = statsCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setStats(cached.stats);
        setRecentItems(cached.recentItems);
        setIsLoading(false);
        return;
      }
    }

    if (isDecoyMode) {
      setStats(DEFAULT_STATS);
      setRecentItems([]);
      setIsLoading(false);
      return;
    }

    isFetchingRef.current = true;

    try {
      // Batch all count queries - these are fast HEAD requests
      const [
        notesRes, photosRes, filesRes,
        favNotesRes, favPhotosRes, favFilesRes,
        secureNotesRes, secretTextsRes,
        trashedNotesRes, trashedPhotosRes, trashedFilesRes,
        tiktokRes, trashedTiktokRes, linksRes,
        recentNotesRes, recentPhotosRes, recentFilesRes,
      ] = await Promise.all([
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('files').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
        supabase.from('files').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_secure', true).is('deleted_at', null),
        supabase.from('secret_texts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('files').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('tiktok_videos').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('tiktok_videos').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('links').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('notes').select('id, title, updated_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(5),
        supabase.from('photos').select('id, filename, uploaded_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('uploaded_at', { ascending: false }).limit(5),
        supabase.from('files').select('id, filename, uploaded_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('uploaded_at', { ascending: false }).limit(5),
      ]);

      if (!mountedRef.current) return;

      const totalFavorites = (favNotesRes.count || 0) + (favPhotosRes.count || 0) + (favFilesRes.count || 0);
      const totalTrashed = (trashedNotesRes.count || 0) + (trashedPhotosRes.count || 0) + (trashedFilesRes.count || 0) + (trashedTiktokRes.count || 0);

      // Build stats without storage calculation first (faster initial load)
      const quickStats: DashboardStats = {
        notes: notesRes.count || 0,
        photos: photosRes.count || 0,
        files: filesRes.count || 0,
        favorites: totalFavorites,
        secureNotes: secureNotesRes.count || 0,
        secretTexts: secretTextsRes.count || 0,
        totalFilesSize: 0,
        totalPhotosSize: 0,
        totalAttachmentsSize: 0,
        totalStorageSize: 0,
        trashedFilesSize: 0,
        trashedPhotosSize: 0,
        trashedItems: totalTrashed,
        tiktokVideos: tiktokRes.count || 0,
        links: linksRes.count || 0,
      };

      // Build recent items
      const allRecent: RecentItem[] = [
        ...(recentNotesRes.data || []).map(n => ({
          id: n.id,
          type: 'note' as const,
          title: n.title || 'Unbenannt',
          date: n.updated_at || new Date().toISOString(),
          isFavorite: n.is_favorite,
        })),
        ...(recentPhotosRes.data || []).map(p => ({
          id: p.id,
          type: 'photo' as const,
          title: p.filename?.replace(/^\d+-/, '') || 'Foto',
          date: p.uploaded_at || new Date().toISOString(),
          isFavorite: p.is_favorite,
        })),
        ...(recentFilesRes.data || []).map(f => ({
          id: f.id,
          type: 'file' as const,
          title: f.filename?.replace(/^\d+-/, '') || 'Datei',
          date: f.uploaded_at || new Date().toISOString(),
          isFavorite: f.is_favorite,
        })),
      ];

      allRecent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const recentSlice = allRecent.slice(0, 5);

      // Set quick stats immediately for fast UI update
      setStats(quickStats);
      setRecentItems(recentSlice);
      setIsLoading(false);

      // Fetch storage sizes in background (slower operation)
      fetchStorageSizes(userId, quickStats, recentSlice);

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      if (mountedRef.current) {
        setIsLoading(false);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [userId, isDecoyMode, supabase]);

  const fetchStorageSizes = useCallback(async (
    uid: string, 
    currentStats: DashboardStats, 
    currentRecent: RecentItem[]
  ) => {
    try {
      // Single storage list call per bucket (much faster than pagination)
      const [photosStorage, filesStorage, attachmentsStorage] = await Promise.all([
        supabase.storage.from('photos').list(uid, { limit: 1000 }),
        supabase.storage.from('files').list(uid, { limit: 1000 }),
        supabase.storage.from('note-attachments').list(uid, { limit: 1000 }),
      ]);

      const sumSize = (items: any[]) => 
        items.reduce((acc, f) => {
          if (f.id === null) return acc; // Skip folders
          const size = f?.metadata?.size;
          return acc + (typeof size === 'number' ? size : parseInt(size || '0', 10) || 0);
        }, 0);

      const photosSize = sumSize(photosStorage.data || []);
      const filesSize = sumSize(filesStorage.data || []);
      const attachmentsSize = sumSize(attachmentsStorage.data || []);

      const updatedStats: DashboardStats = {
        ...currentStats,
        totalPhotosSize: photosSize,
        totalFilesSize: filesSize,
        totalAttachmentsSize: attachmentsSize,
        totalStorageSize: photosSize + filesSize + attachmentsSize,
      };

      if (mountedRef.current) {
        setStats(updatedStats);
        
        // Update cache
        statsCache.set(uid, {
          stats: updatedStats,
          recentItems: currentRecent,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('Error fetching storage sizes:', error);
    }
  }, [supabase]);

  // Debounced refresh for realtime updates
  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchStats(true);
    }, 1000); // 1 second debounce
  }, [fetchStats]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchStats();
    
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchStats]);

  // Realtime subscription with debouncing
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'secret_texts' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiktok_videos' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' }, debouncedRefresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, debouncedRefresh]);

  return {
    stats,
    recentItems,
    isLoading,
    refresh: () => fetchStats(true),
  };
}
