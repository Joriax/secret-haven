import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FileAlbum {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_pinned: boolean;
  created_at: string;
  count?: number;
}

export function useFileAlbums() {
  const [albums, setAlbums] = useState<FileAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode } = useAuth();

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
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlbums(data || []);
    } catch (error) {
      console.error('Error fetching file albums:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const createAlbum = async (name: string) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('file_albums')
        .insert({
          user_id: userId,
          name: name.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setAlbums(prev => [{ ...data, count: 0 }, ...prev]);
      toast.success('Album erstellt');
      return data;
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Fehler beim Erstellen');
      return null;
    }
  };

  const deleteAlbum = async (albumId: string) => {
    if (!userId) return false;

    try {
      // First unlink files from this album
      await supabase
        .from('files')
        .update({ album_id: null })
        .eq('album_id', albumId);

      const { error } = await supabase
        .from('file_albums')
        .delete()
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev => prev.filter(a => a.id !== albumId));
      toast.success('Album gelöscht');
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
        // Re-sort: pinned first
        return updated.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
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

  return {
    albums,
    isLoading,
    fetchAlbums,
    createAlbum,
    deleteAlbum,
    togglePin,
    renameAlbum,
  };
}
