import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface HiddenAlbumsHook {
  hiddenAlbumIds: Set<string>;
  allHiddenAlbumIds: Set<string>; // Includes children recursively
  isHidden: (albumId: string) => boolean;
  isContentHidden: (albumId: string | null) => boolean;
  toggleHidden: (albumId: string) => Promise<void>;
  setHidden: (albumId: string, hidden: boolean) => Promise<void>;
  getVisibleAlbums: <T extends { id: string; parent_id?: string | null; is_hidden?: boolean }>(albums: T[]) => T[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook to manage hidden albums. Hidden albums and all their sub-albums
 * (plus all content inside them) are completely invisible across the app.
 */
export function useHiddenAlbums(): HiddenAlbumsHook {
  const [hiddenAlbumIds, setHiddenAlbumIds] = useState<Set<string>>(new Set());
  const [allAlbums, setAllAlbums] = useState<Array<{ id: string; parent_id: string | null; is_hidden: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();

  const fetchHiddenAlbums = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setHiddenAlbumIds(new Set());
      setAllAlbums([]);
      setIsLoading(false);
      return;
    }

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

      setAllAlbums(albums);

      const hidden = new Set<string>();
      albums.forEach(a => {
        if (a.is_hidden) hidden.add(a.id);
      });
      setHiddenAlbumIds(hidden);
    } catch (error) {
      console.error('Error fetching hidden albums:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode, supabase]);

  useEffect(() => {
    fetchHiddenAlbums();
  }, [fetchHiddenAlbums]);

  // Compute all hidden album IDs including children of hidden parents
  const allHiddenAlbumIds = useMemo(() => {
    const result = new Set<string>();
    
    const collectDescendants = (albumId: string) => {
      result.add(albumId);
      allAlbums
        .filter(a => a.parent_id === albumId)
        .forEach(child => collectDescendants(child.id));
    };

    // Start with explicitly hidden albums
    hiddenAlbumIds.forEach(id => collectDescendants(id));

    return result;
  }, [hiddenAlbumIds, allAlbums]);

  const isHidden = useCallback((albumId: string): boolean => {
    return allHiddenAlbumIds.has(albumId);
  }, [allHiddenAlbumIds]);

  // Check if content in an album should be hidden (album itself is hidden or is a child of hidden)
  const isContentHidden = useCallback((albumId: string | null): boolean => {
    if (!albumId) return false;
    return allHiddenAlbumIds.has(albumId);
  }, [allHiddenAlbumIds]);

  const setHidden = useCallback(async (albumId: string, hidden: boolean) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('albums')
        .update({ is_hidden: hidden })
        .eq('id', albumId);

      if (error) throw error;

      // Update local state
      setHiddenAlbumIds(prev => {
        const next = new Set(prev);
        if (hidden) {
          next.add(albumId);
        } else {
          next.delete(albumId);
        }
        return next;
      });

      setAllAlbums(prev => prev.map(a => 
        a.id === albumId ? { ...a, is_hidden: hidden } : a
      ));

      toast.success(hidden ? 'Album ausgeblendet' : 'Album eingeblendet');
    } catch (error) {
      console.error('Error toggling hidden:', error);
      toast.error('Fehler beim Ändern der Sichtbarkeit');
    }
  }, [userId, supabase]);

  const toggleHidden = useCallback(async (albumId: string) => {
    const currentlyHidden = hiddenAlbumIds.has(albumId);
    await setHidden(albumId, !currentlyHidden);
  }, [hiddenAlbumIds, setHidden]);

  // Filter out hidden albums from a list
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
