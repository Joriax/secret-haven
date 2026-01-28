import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface HiddenAlbumsHook {
  hiddenAlbumIds: Set<string>;
  allHiddenAlbumIds: Set<string>;
  isHidden: (albumId: string) => boolean;
  isContentHidden: (albumId: string | null) => boolean;
  toggleHidden: (albumId: string) => Promise<void>;
  setHidden: (albumId: string, hidden: boolean) => Promise<void>;
  getVisibleAlbums: <T extends { id: string; parent_id?: string | null; is_hidden?: boolean }>(albums: T[]) => T[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

// Simple in-memory cache for hidden albums
const hiddenAlbumsCache = new Map<string, {
  data: Array<{ id: string; parent_id: string | null; is_hidden: boolean }>;
  timestamp: number;
}>();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Hook to manage hidden albums with caching and optimized renders.
 */
export function useHiddenAlbums(): HiddenAlbumsHook {
  const [hiddenAlbumIds, setHiddenAlbumIds] = useState<Set<string>>(new Set());
  const [allAlbums, setAllAlbums] = useState<Array<{ id: string; parent_id: string | null; is_hidden: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const isFetchingRef = useRef(false);

  const fetchHiddenAlbums = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setHiddenAlbumIds(new Set());
      setAllAlbums([]);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cached = hiddenAlbumsCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const albums = cached.data;
      setAllAlbums(albums);
      const hidden = new Set<string>();
      albums.forEach(a => { if (a.is_hidden) hidden.add(a.id); });
      setHiddenAlbumIds(hidden);
      setIsLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const { data, error } = await supabase
        .from('albums')
        .select('id, parent_id, is_hidden')
        .eq('user_id', userId);

      if (error) throw error;

      const albums = (data || []).map(a => ({
        id: a.id,
        parent_id: a.parent_id,
        is_hidden: a.is_hidden ?? false,
      }));

      // Update cache
      hiddenAlbumsCache.set(userId, { data: albums, timestamp: Date.now() });

      setAllAlbums(albums);

      const hidden = new Set<string>();
      albums.forEach(a => { if (a.is_hidden) hidden.add(a.id); });
      setHiddenAlbumIds(hidden);
    } catch (error) {
      console.error('Error fetching hidden albums:', error);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [userId, isDecoyMode, supabase]);

  useEffect(() => {
    fetchHiddenAlbums();
  }, [fetchHiddenAlbums]);

  // Compute all hidden album IDs including children of hidden parents
  const allHiddenAlbumIds = useMemo(() => {
    const result = new Set<string>();
    
    // Create parent->children map for O(n) traversal
    const childrenMap = new Map<string | null, string[]>();
    allAlbums.forEach(a => {
      const children = childrenMap.get(a.parent_id) || [];
      children.push(a.id);
      childrenMap.set(a.parent_id, children);
    });
    
    const collectDescendants = (albumId: string) => {
      result.add(albumId);
      const children = childrenMap.get(albumId) || [];
      children.forEach(childId => collectDescendants(childId));
    };

    hiddenAlbumIds.forEach(id => collectDescendants(id));

    return result;
  }, [hiddenAlbumIds, allAlbums]);

  const isHidden = useCallback((albumId: string): boolean => {
    return allHiddenAlbumIds.has(albumId);
  }, [allHiddenAlbumIds]);

  const isContentHidden = useCallback((albumId: string | null): boolean => {
    if (!albumId) return false;
    return allHiddenAlbumIds.has(albumId);
  }, [allHiddenAlbumIds]);

  const setHidden = useCallback(async (albumId: string, hidden: boolean) => {
    if (!userId) return;

    // Optimistic update
    setHiddenAlbumIds(prev => {
      const next = new Set(prev);
      if (hidden) next.add(albumId);
      else next.delete(albumId);
      return next;
    });

    setAllAlbums(prev => prev.map(a => 
      a.id === albumId ? { ...a, is_hidden: hidden } : a
    ));

    try {
      const { error } = await supabase
        .from('albums')
        .update({ is_hidden: hidden })
        .eq('id', albumId);

      if (error) throw error;

      // Invalidate cache
      hiddenAlbumsCache.delete(userId);

      toast.success(hidden ? 'Album ausgeblendet' : 'Album eingeblendet');
    } catch (error) {
      console.error('Error toggling hidden:', error);
      toast.error('Fehler beim Ändern der Sichtbarkeit');
      // Rollback on error
      fetchHiddenAlbums();
    }
  }, [userId, supabase, fetchHiddenAlbums]);

  const toggleHidden = useCallback(async (albumId: string) => {
    const currentlyHidden = hiddenAlbumIds.has(albumId);
    await setHidden(albumId, !currentlyHidden);
  }, [hiddenAlbumIds, setHidden]);

  const getVisibleAlbums = useCallback(<T extends { id: string; parent_id?: string | null; is_hidden?: boolean }>(
    albums: T[]
  ): T[] => {
    return albums.filter(album => !allHiddenAlbumIds.has(album.id));
  }, [allHiddenAlbumIds]);

  return {
    hiddenAlbumIds,
    allHiddenAlbumIds,
    isHidden,
    isContentHidden,
    toggleHidden,
    setHidden,
    getVisibleAlbums,
    isLoading,
    refetch: fetchHiddenAlbums,
  };
}

export default useHiddenAlbums;
