import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useVaultData } from './useVaultData';

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
  const { callVaultData, getFileAlbums } = useVaultData();

  const fetchAlbums = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setAlbums([]);
      setIsLoading(false);
      return;
    }

    try {
      const result = await getFileAlbums();
      if (result?.success) {
        setAlbums(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching file albums:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode, getFileAlbums]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const createAlbum = async (name: string, color?: string, icon?: string) => {
    if (!userId) return null;

    try {
      const result = await callVaultData('create-file-album', {
        name: name.trim(),
        color: color || '#6366f1',
        icon: icon || 'folder',
      });

      if (result?.success && result.data) {
        setAlbums(prev => [{ ...result.data, count: 0 }, ...prev]);
        toast.success('Album erstellt');
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Fehler beim Erstellen');
      return null;
    }
  };

  const deleteAlbum = async (albumId: string) => {
    if (!userId) return false;

    try {
      const result = await callVaultData('delete-file-album', { id: albumId });

      if (result?.success) {
        setAlbums(prev => prev.filter(a => a.id !== albumId));
        toast.success('Album gelöscht');
        return true;
      }
      return false;
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
      const result = await callVaultData('toggle-file-album-pin', { 
        id: albumId, 
        is_pinned: newPinned 
      });

      if (result?.success) {
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
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const renameAlbum = async (albumId: string, newName: string) => {
    try {
      const result = await callVaultData('update-file-album', { 
        id: albumId, 
        updates: { name: newName.trim() } 
      });

      if (result?.success) {
        setAlbums(prev => prev.map(a => 
          a.id === albumId ? { ...a, name: newName.trim() } : a
        ));
        toast.success('Umbenannt');
      }
    } catch (error) {
      console.error('Error renaming album:', error);
      toast.error('Fehler beim Umbenennen');
    }
  };

  const updateAlbum = async (albumId: string, updates: { name?: string; color?: string; icon?: string }) => {
    try {
      const result = await callVaultData('update-file-album', { 
        id: albumId, 
        updates 
      });

      if (result?.success) {
        setAlbums(prev => prev.map(a => 
          a.id === albumId ? { ...a, ...updates } : a
        ));
        toast.success('Album aktualisiert');
      }
    } catch (error) {
      console.error('Error updating album:', error);
      toast.error('Fehler beim Aktualisieren');
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
    updateAlbum,
  };
}
