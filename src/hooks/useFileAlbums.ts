import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FileAlbum {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_pinned: boolean;
  parent_id: string | null;
  created_at: string;
  count?: number;
  children?: FileAlbum[];
  depth?: number;
}

export function useFileAlbums() {
  const [albums, setAlbums] = useState<FileAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();

  const fetchAlbums = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setAlbums([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('file_albums')
        .select('*')
        .eq('user_id', userId)
        .order('is_pinned', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setAlbums((data || []) as FileAlbum[]);
    } catch (error) {
      console.error('Error fetching file albums:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode, supabase]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  // Build hierarchical tree from flat list
  const hierarchicalAlbums = useMemo(() => {
    const buildTree = (items: FileAlbum[], parentId: string | null = null, depth: number = 0): FileAlbum[] => {
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

  // Get direct children of a specific album
  const getChildAlbums = useCallback((parentId: string | null): FileAlbum[] => {
    return albums
      .filter(a => a.parent_id === parentId)
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
  }, [albums]);

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
  const getBreadcrumb = useCallback((albumId: string): FileAlbum[] => {
    const path: FileAlbum[] = [];
    let current = albums.find(a => a.id === albumId);
    
    while (current) {
      path.unshift(current);
      current = current.parent_id ? albums.find(a => a.id === current!.parent_id) : undefined;
    }
    
    return path;
  }, [albums]);

  const createAlbum = async (
    name: string, 
    color?: string, 
    icon?: string, 
    parentId?: string | null
  ): Promise<FileAlbum | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('file_albums')
        .insert({
          user_id: userId,
          name: name.trim(),
          color: color || '#6366f1',
          icon: icon || 'folder',
          parent_id: parentId ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      setAlbums(prev => [{ ...data, count: 0 } as FileAlbum, ...prev]);
      toast.success(parentId ? 'Unterordner erstellt' : 'Ordner erstellt');
      return data as FileAlbum;
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Fehler beim Erstellen');
      return null;
    }
  };

  const deleteAlbum = async (albumId: string, deleteContents: boolean = false): Promise<boolean> => {
    if (!userId) return false;

    try {
      const album = albums.find(a => a.id === albumId);
      
      if (deleteContents) {
        // Delete all files in this album
        await supabase
          .from('files')
          .update({ deleted_at: new Date().toISOString() })
          .eq('album_id', albumId);
        
        // Delete all child albums recursively (and their contents)
        const childAlbums = albums.filter(a => a.parent_id === albumId);
        for (const child of childAlbums) {
          await deleteAlbum(child.id, true);
        }
      } else {
        // Move files to no album
        await supabase
          .from('files')
          .update({ album_id: null })
          .eq('album_id', albumId);
        
        // Move child albums to parent of deleted album
        const childAlbums = albums.filter(a => a.parent_id === albumId);
        if (childAlbums.length > 0) {
          await supabase
            .from('file_albums')
            .update({ parent_id: album?.parent_id || null })
            .eq('parent_id', albumId);
        }
      }

      // Delete the album itself
      const { error } = await supabase
        .from('file_albums')
        .delete()
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev => {
        if (deleteContents) {
          // Remove album and all children
          const descendants = getDescendantIds(albumId);
          return prev.filter(a => !descendants.includes(a.id));
        } else {
          // Update children's parent_id and remove deleted album
          return prev
            .map(a => a.parent_id === albumId ? { ...a, parent_id: album?.parent_id || null } : a)
            .filter(a => a.id !== albumId);
        }
      });
      
      toast.success('Ordner gelöscht');
      return true;
    } catch (error) {
      console.error('Error deleting album:', error);
      toast.error('Fehler beim Löschen');
      return false;
    }
  };

  const togglePin = async (albumId: string) => {
    const album = albums.find(a => a.id === albumId);
    if (!album) return;

    try {
      const newPinned = !album.is_pinned;
      const { error } = await supabase
        .from('file_albums')
        .update({ is_pinned: newPinned })
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev => {
        const updated = prev.map(a => 
          a.id === albumId ? { ...a, is_pinned: newPinned } : a
        );
        return updated;
      });
      
      toast.success(newPinned ? 'Angepinnt' : 'Losgelöst');
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const renameAlbum = async (albumId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('file_albums')
        .update({ name: newName.trim() })
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev => prev.map(a => 
        a.id === albumId ? { ...a, name: newName.trim() } : a
      ));
      toast.success('Umbenannt');
    } catch (error) {
      console.error('Error renaming album:', error);
      toast.error('Fehler beim Umbenennen');
    }
  };

  const updateAlbum = async (albumId: string, updates: { name?: string; color?: string; icon?: string; parent_id?: string | null }) => {
    try {
      // Prevent moving album into itself or its descendants
      if (updates.parent_id !== undefined) {
        const descendants = getDescendantIds(albumId);
        if (updates.parent_id && descendants.includes(updates.parent_id)) {
          toast.error('Ordner kann nicht in sich selbst verschoben werden');
          return;
        }
      }

      const { error } = await supabase
        .from('file_albums')
        .update(updates)
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev => prev.map(a => 
        a.id === albumId ? { ...a, ...updates } : a
      ));
      toast.success('Ordner aktualisiert');
    } catch (error) {
      console.error('Error updating album:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  return {
    albums,
    hierarchicalAlbums,
    isLoading,
    fetchAlbums,
    createAlbum,
    deleteAlbum,
    togglePin,
    renameAlbum,
    updateAlbum,
    getChildAlbums,
    getDescendantIds,
    getBreadcrumb,
  };
}
