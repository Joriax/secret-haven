import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

  const fetchAlbums = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch albums I own
      const { data: myAlbums, error: myError } = await supabase
        .from('shared_albums')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (myError) throw myError;

      // Fetch albums shared with me
      const { data: accessData, error: accessError } = await supabase
        .from('shared_album_access')
        .select('shared_album_id')
        .eq('user_id', userId);

      if (accessError) throw accessError;

      let sharedAlbums: SharedAlbum[] = [];
      if (accessData && accessData.length > 0) {
        const albumIds = accessData.map(a => a.shared_album_id);
        const { data, error } = await supabase
          .from('shared_albums')
          .select('*')
          .in('id', albumIds);

        if (!error && data) {
          sharedAlbums = data as SharedAlbum[];
        }
      }

      setAlbums((myAlbums || []) as SharedAlbum[]);
      setSharedWithMe(sharedAlbums);
    } catch (error) {
      console.error('Error fetching shared albums:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

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
      const { data, error } = await supabase
        .from('shared_albums')
        .insert({
          owner_id: userId,
          name,
          content_type: contentType,
          color: color || '#6366f1',
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newAlbum = data as SharedAlbum;
      setAlbums(prev => [newAlbum, ...prev]);
      return newAlbum;
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
      const { error } = await supabase
        .from('shared_albums')
        .update(updates)
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev =>
        prev.map(a => (a.id === albumId ? { ...a, ...updates } : a))
      );
      return true;
    } catch (error) {
      console.error('Error updating shared album:', error);
      return false;
    }
  };

  const deleteAlbum = async (albumId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('shared_albums')
        .delete()
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev => prev.filter(a => a.id !== albumId));
      return true;
    } catch (error) {
      console.error('Error deleting shared album:', error);
      return false;
    }
  };

  const generatePublicLink = async (albumId: string): Promise<string | null> => {
    try {
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

      const { error } = await supabase
        .from('shared_albums')
        .update({
          public_link_enabled: true,
          public_link_token: token,
        })
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev =>
        prev.map(a =>
          a.id === albumId
            ? { ...a, public_link_enabled: true, public_link_token: token }
            : a
        )
      );

      return `${window.location.origin}/shared/${token}`;
    } catch (error) {
      console.error('Error generating public link:', error);
      return null;
    }
  };

  const disablePublicLink = async (albumId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('shared_albums')
        .update({
          public_link_enabled: false,
          public_link_token: null,
        })
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev =>
        prev.map(a =>
          a.id === albumId
            ? { ...a, public_link_enabled: false, public_link_token: null }
            : a
        )
      );
      return true;
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
      const { error } = await supabase
        .from('shared_album_access')
        .upsert({
          shared_album_id: albumId,
          user_id: targetUserId,
          permission,
        });

      if (error) throw error;
      return true;
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
      const { error } = await supabase
        .from('shared_album_access')
        .delete()
        .eq('shared_album_id', albumId)
        .eq('user_id', targetUserId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing user access:', error);
      return false;
    }
  };

  const getAlbumAccess = async (albumId: string): Promise<SharedAlbumAccess[]> => {
    try {
      const { data, error } = await supabase
        .from('shared_album_access')
        .select('*')
        .eq('shared_album_id', albumId);

      if (error) throw error;
      return (data || []) as SharedAlbumAccess[];
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
      const insertData: Record<string, string> = {
        shared_album_id: albumId,
        added_by: userId,
      };
      insertData[`${itemType}_id`] = itemId;
      
      const { error } = await supabase
        .from('shared_album_items')
        .insert(insertData as any);

      if (error) throw error;
      return true;
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
      const { error } = await (supabase
        .from('shared_album_items')
        .delete()
        .eq('shared_album_id', albumId) as any)
        .eq(`${itemType}_id`, itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing item from album:', error);
      return false;
    }
  };

  const getAlbumItems = async (albumId: string): Promise<SharedAlbumItem[]> => {
    try {
      const { data, error } = await supabase
        .from('shared_album_items')
        .select('*')
        .eq('shared_album_id', albumId)
        .order('added_at', { ascending: false });

      if (error) throw error;
      return (data || []) as SharedAlbumItem[];
    } catch (error) {
      console.error('Error fetching album items:', error);
      return [];
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
  };
}
