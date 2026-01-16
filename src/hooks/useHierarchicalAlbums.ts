import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface HierarchicalAlbum {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  is_pinned?: boolean;
  color?: string;
  icon?: string;
  created_at: string;
  cover_url?: string;
  count?: number;
  children?: HierarchicalAlbum[];
  depth?: number;
}

export interface UseHierarchicalAlbumsOptions {
  tableName: 'albums' | 'file_albums' | 'tiktok_folders' | 'link_folders';
}

export function useHierarchicalAlbums({ tableName }: UseHierarchicalAlbumsOptions) {
  const [albums, setAlbums] = useState<HierarchicalAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const createAlbumLockRef = useRef(false);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();

  const fetchAlbums = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setAlbums([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      setAlbums((data || []) as HierarchicalAlbum[]);
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode, tableName, supabase]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  // Build hierarchical tree from flat list
  const hierarchicalAlbums = useMemo(() => {
    const buildTree = (items: HierarchicalAlbum[], parentId: string | null = null, depth: number = 0): HierarchicalAlbum[] => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          depth,
          children: buildTree(items, item.id, depth + 1)
        }))
        .sort((a, b) => {
          // Pinned first, then alphabetically
          if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
    };
    return buildTree(albums);
  }, [albums]);

  // Flatten tree for display (with depth info)
  const flattenedAlbums = useMemo(() => {
    const flatten = (items: HierarchicalAlbum[]): HierarchicalAlbum[] => {
      const result: HierarchicalAlbum[] = [];
      for (const item of items) {
        result.push(item);
        if (item.children && item.children.length > 0) {
          result.push(...flatten(item.children));
        }
      }
      return result;
    };
    return flatten(hierarchicalAlbums);
  }, [hierarchicalAlbums]);

  const createAlbum = async (
    name: string, 
    parentId: string | null = null,
    color: string = '#6366f1', 
    icon: string = 'folder'
  ): Promise<HierarchicalAlbum | null> => {
    const trimmed = name.trim();
    if (!userId || !trimmed || isDecoyMode) return null;

    if (createAlbumLockRef.current) return null;
    createAlbumLockRef.current = true;

    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert({
          user_id: userId,
          name: trimmed,
          parent_id: parentId,
          color,
          icon,
        })
        .select()
        .single();

      if (error) throw error;

      setAlbums((prev) => {
        const next = [...prev, data as HierarchicalAlbum];
        const seen = new Set<string>();
        return next.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });
      });

      toast.success(parentId ? 'Unterordner erstellt' : 'Ordner erstellt');
      return data as HierarchicalAlbum;
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Fehler beim Erstellen');
      return null;
    } finally {
      createAlbumLockRef.current = false;
    }
  };

  const updateAlbum = async (
    id: string, 
    updates: Partial<Pick<HierarchicalAlbum, 'name' | 'color' | 'icon' | 'parent_id' | 'is_pinned'>>
  ): Promise<void> => {
    try {
      // Prevent moving album into itself or its descendants
      if (updates.parent_id) {
        const isDescendant = (albumId: string, targetId: string): boolean => {
          const album = albums.find(a => a.id === albumId);
          if (!album) return false;
          if (album.parent_id === targetId) return true;
          if (album.parent_id) return isDescendant(album.parent_id, targetId);
          return false;
        };
        
        if (updates.parent_id === id || isDescendant(updates.parent_id, id)) {
          toast.error('Ordner kann nicht in sich selbst verschoben werden');
          return;
        }
      }

      const { error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setAlbums(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
      toast.success('Ordner aktualisiert');
    } catch (error) {
      console.error('Error updating album:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const deleteAlbum = async (id: string): Promise<void> => {
    try {
      // Move children to parent of deleted album
      const album = albums.find(a => a.id === id);
      const childAlbums = albums.filter(a => a.parent_id === id);
      
      if (childAlbums.length > 0) {
        const { error: moveError } = await supabase
          .from(tableName)
          .update({ parent_id: album?.parent_id || null })
          .eq('parent_id', id);
        
        if (moveError) throw moveError;
      }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAlbums(prev => {
        // Update children's parent_id and remove deleted album
        return prev
          .map(a => a.parent_id === id ? { ...a, parent_id: album?.parent_id || null } : a)
          .filter(a => a.id !== id);
      });
      toast.success('Ordner gelöscht');
    } catch (error) {
      console.error('Error deleting album:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const togglePin = async (id: string): Promise<void> => {
    const album = albums.find(a => a.id === id);
    if (!album) return;
    await updateAlbum(id, { is_pinned: !album.is_pinned });
  };

  const moveAlbum = async (id: string, newParentId: string | null): Promise<void> => {
    await updateAlbum(id, { parent_id: newParentId });
  };

  // Get all descendant IDs (for filtering items in album + sub-albums)
  const getDescendantIds = useCallback((albumId: string): string[] => {
    const result: string[] = [albumId];
    const children = albums.filter(a => a.parent_id === albumId);
    for (const child of children) {
      result.push(...getDescendantIds(child.id));
    }
    return result;
  }, [albums]);

  // Get breadcrumb path for an album
  const getBreadcrumb = useCallback((albumId: string): HierarchicalAlbum[] => {
    const path: HierarchicalAlbum[] = [];
    let current = albums.find(a => a.id === albumId);
    
    while (current) {
      path.unshift(current);
      current = current.parent_id ? albums.find(a => a.id === current!.parent_id) : undefined;
    }
    
    return path;
  }, [albums]);

  return {
    albums,
    hierarchicalAlbums,
    flattenedAlbums,
    isLoading,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    togglePin,
    moveAlbum,
    getDescendantIds,
    getBreadcrumb,
    refetch: fetchAlbums,
  };
}
