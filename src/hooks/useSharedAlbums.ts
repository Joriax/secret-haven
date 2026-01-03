import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useVaultData } from './useVaultData';

export type ContentType = 'photos' | 'notes' | 'files' | 'links' | 'tiktoks' | 'mixed';
export type Permission = 'view' | 'edit';

export interface SharedAlbum {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  content_type: ContentType;
  public_link_enabled: boolean;
  public_link_token: string | null;
  public_link_password: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
  shared_with_count?: number;
}

export interface SharedAlbumItem {
  id: string;
  shared_album_id: string;
  photo_id: string | null;
  note_id: string | null;
  file_id: string | null;
  link_id: string | null;
  tiktok_id: string | null;
  added_at: string;
  added_by: string;
}

export interface SharedAlbumAccess {
  id: string;
  shared_album_id: string;
  user_id: string;
  permission: Permission;
  created_at: string;
}

export function useSharedAlbums() {
  const [albums, setAlbums] = useState<SharedAlbum[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId } = useAuth();
  const { callVaultData } = useVaultData();

  const fetchAlbums = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await callVaultData('get-shared-albums', {});
      
      if (result?.success && result.data) {
        setAlbums((result.data.albums || []) as SharedAlbum[]);
        setSharedWithMe((result.data.sharedWithMe || []) as SharedAlbum[]);
      }
    } catch (error) {
      console.error('Error fetching shared albums:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, callVaultData]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const createAlbum = async (
    name: string,
    contentType: ContentType = 'mixed',
    color?: string,
    description?: string
  ): Promise<SharedAlbum | null> => {
    if (!userId) return null;

    try {
      const result = await callVaultData('create-shared-album', {
        name,
        content_type: contentType,
        color: color || '#6366f1',
        description: description || null,
      });

      if (result?.success && result.data) {
        const newAlbum = result.data as SharedAlbum;
        setAlbums(prev => [newAlbum, ...prev]);
        return newAlbum;
      }
      return null;
    } catch (error) {
      console.error('Error creating shared album:', error);
      return null;
    }
  };

  const updateAlbum = async (
    albumId: string,
    updates: Partial<Pick<SharedAlbum, 'name' | 'description' | 'color' | 'icon'>>
  ): Promise<boolean> => {
    try {
      const result = await callVaultData('update-shared-album', { id: albumId, updates });

      if (result?.success) {
        setAlbums(prev =>
          prev.map(a => (a.id === albumId ? { ...a, ...updates } : a))
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating shared album:', error);
      return false;
    }
  };

  const deleteAlbum = async (albumId: string): Promise<boolean> => {
    try {
      const result = await callVaultData('delete-shared-album', { id: albumId });

      if (result?.success) {
        setAlbums(prev => prev.filter(a => a.id !== albumId));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting shared album:', error);
      return false;
    }
  };

  const generatePublicLink = async (albumId: string): Promise<string | null> => {
    try {
      const result = await callVaultData('generate-public-link', { id: albumId });

      if (result?.success && result.data?.token) {
        const token = result.data.token;
        setAlbums(prev =>
          prev.map(a =>
            a.id === albumId
              ? { ...a, public_link_enabled: true, public_link_token: token }
              : a
          )
        );
        return `${window.location.origin}/shared/${token}`;
      }
      return null;
    } catch (error) {
      console.error('Error generating public link:', error);
      return null;
    }
  };

  const disablePublicLink = async (albumId: string): Promise<boolean> => {
    try {
      const result = await callVaultData('disable-public-link', { id: albumId });

      if (result?.success) {
        setAlbums(prev =>
          prev.map(a =>
            a.id === albumId
              ? { ...a, public_link_enabled: false, public_link_token: null }
              : a
          )
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error disabling public link:', error);
      return false;
    }
  };

  const shareWithUser = async (
    albumId: string,
    targetUserId: string,
    permission: Permission = 'view'
  ): Promise<boolean> => {
    try {
      const result = await callVaultData('share-album-with-user', {
        album_id: albumId,
        target_user_id: targetUserId,
        permission,
      });
      return result?.success || false;
    } catch (error) {
      console.error('Error sharing album:', error);
      return false;
    }
  };

  const removeUserAccess = async (
    albumId: string,
    targetUserId: string
  ): Promise<boolean> => {
    try {
      const result = await callVaultData('remove-album-user-access', {
        album_id: albumId,
        target_user_id: targetUserId,
      });
      return result?.success || false;
    } catch (error) {
      console.error('Error removing user access:', error);
      return false;
    }
  };

  const getAlbumAccess = async (albumId: string): Promise<SharedAlbumAccess[]> => {
    try {
      const result = await callVaultData('get-album-access', { album_id: albumId });
      if (result?.success) {
        return (result.data || []) as SharedAlbumAccess[];
      }
      return [];
    } catch (error) {
      console.error('Error fetching album access:', error);
      return [];
    }
  };

  const addItemToAlbum = async (
    albumId: string,
    itemType: 'photo' | 'note' | 'file' | 'link' | 'tiktok',
    itemId: string
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      const result = await callVaultData('add-item-to-shared-album', {
        album_id: albumId,
        item_type: itemType,
        item_id: itemId,
      });
      return result?.success || false;
    } catch (error) {
      console.error('Error adding item to album:', error);
      return false;
    }
  };

  const removeItemFromAlbum = async (
    albumId: string,
    itemType: 'photo' | 'note' | 'file' | 'link' | 'tiktok',
    itemId: string
  ): Promise<boolean> => {
    try {
      const result = await callVaultData('remove-item-from-shared-album', {
        album_id: albumId,
        item_type: itemType,
        item_id: itemId,
      });
      return result?.success || false;
    } catch (error) {
      console.error('Error removing item from album:', error);
      return false;
    }
  };

  const getAlbumItems = async (albumId: string): Promise<SharedAlbumItem[]> => {
    try {
      const result = await callVaultData('get-shared-album-items', { album_id: albumId });
      if (result?.success) {
        return (result.data || []) as SharedAlbumItem[];
      }
      return [];
    } catch (error) {
      console.error('Error fetching album items:', error);
      return [];
    }
  };

  const togglePin = async (albumId: string): Promise<boolean> => {
    try {
      const album = albums.find(a => a.id === albumId);
      if (!album) return false;

      const newPinnedState = !album.is_pinned;
      
      const result = await callVaultData('toggle-shared-album-pin', {
        id: albumId,
        is_pinned: newPinnedState,
      });

      if (result?.success) {
        // Update local state and re-sort
        setAlbums(prev => {
          const updated = prev.map(a =>
            a.id === albumId ? { ...a, is_pinned: newPinnedState } : a
          );
          // Sort: pinned first, then by created_at descending
          return updated.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) {
              return a.is_pinned ? -1 : 1;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error toggling pin:', error);
      return false;
    }
  };

  return {
    albums,
    sharedWithMe,
    isLoading,
    fetchAlbums,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    generatePublicLink,
    disablePublicLink,
    shareWithUser,
    removeUserAccess,
    getAlbumAccess,
    addItemToAlbum,
    removeItemFromAlbum,
    getAlbumItems,
    togglePin,
  };
}
