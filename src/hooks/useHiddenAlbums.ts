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

// Global singleton cache
const globalCache = {
  data: null as {
    userId: string;
    albums: Array<{ id: string; parent_id: string | null; is_hidden: boolean }>;
    timestamp: number;
  } | null,
};
const CACHE_TTL = 60000; // 1 minute

/**
 * Optimized hook to manage hidden albums with global caching.
 */
export function useHiddenAlbums(): HiddenAlbumsHook {
  const [hiddenAlbumIds, setHiddenAlbumIds] = useState<Set<string>>(new Set());
  const [allAlbums, setAllAlbums] = useState<Array<{ id: string; parent_id: string | null; is_hidden: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchHiddenAlbums = useCallback(async (skipCache = false) => {
    if (!userId || isDecoyMode) {
      setHiddenAlbumIds(new Set());
      setAllAlbums([]);
      setIsLoading(false);
      return;
    }

    // Check global cache
    if (!skipCache && globalCache.data && 
        globalCache.data.userId === userId && 
        Date.now() - globalCache.data.timestamp < CACHE_TTL) {
      const albums = globalCache.data.albums;
      setAllAlbums(albums);
      const hidden = new Set<string>();
      albums.forEach(a => { if (a.is_hidden) hidden.add(a.id); });
      setHiddenAlbumIds(hidden);
      setIsLoading(false);
      return;
    }

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

      // Update global cache
      globalCache.data = { userId, albums, timestamp: Date.now() };

      if (mountedRef.current) {
        setAllAlbums(albums);
        const hidden = new Set<string>();
        albums.forEach(a => { if (a.is_hidden) hidden.add(a.id); });
        setHiddenAlbumIds(hidden);
      }
    } catch (error) {
      console.error('Error fetching hidden albums:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [userId, isDecoyMode, supabase]);

  useEffect(() => {
    mountedRef.current = true;
    fetchHiddenAlbums();
    return () => { mountedRef.current = false; };
  }, [fetchHiddenAlbums]);

  // Compute all hidden album IDs including children - memoized
  const allHiddenAlbumIds = useMemo(() => {
    if (hiddenAlbumIds.size === 0) return new Set<string>();
    
    const result = new Set<string>();
    
    // Create parent->children map
    const childrenMap = new Map<string | null, string[]>();
    allAlbums.forEach(a => {
      const children = childrenMap.get(a.parent_id) || [];
      children.push(a.id);
      childrenMap.set(a.parent_id, children);
    });
    
    const collectDescendants = (albumId: string) => {
      result.add(albumId);
      const children = childrenMap.get(albumId);
      if (children) {
        children.forEach(childId => collectDescendants(childId));
      }
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
      globalCache.data = null;

      toast.success(hidden ? 'Album ausgeblendet' : 'Album eingeblendet');
    } catch (error) {
      console.error('Error toggling hidden:', error);
      toast.error('Fehler beim Ändern der Sichtbarkeit');
      // Rollback on error
      fetchHiddenAlbums(true);
    }
  }, [userId, supabase, fetchHiddenAlbums]);

  const toggleHidden = useCallback(async (albumId: string) => {
    const currentlyHidden = hiddenAlbumIds.has(albumId);
    await setHidden(albumId, !currentlyHidden);
  }, [hiddenAlbumIds, setHidden]);

  const getVisibleAlbums = useCallback(<T extends { id: string; parent_id?: string | null; is_hidden?: boolean }>(
    albums: T[]
  ): T[] => {
    if (allHiddenAlbumIds.size === 0) return albums;
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
    refetch: () => fetchHiddenAlbums(true),
  };
}

export default useHiddenAlbums;
