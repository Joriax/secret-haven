import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Link {
  id: string;
  user_id: string;
  folder_id: string | null;
  url: string;
  title: string;
  description: string | null;
  favicon_url: string | null;
  image_url: string | null;
  is_favorite: boolean;
  tags: string[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useLinks() {
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode, sessionToken } = useAuth();

  const fetchLinks = useCallback(async () => {
    if (!userId || isDecoyMode || !sessionToken) {
      setLinks([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: { 
          action: 'get-links',
          sessionToken,
          data: {}
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setLinks(data.data || []);
    } catch (error) {
      console.error('Error fetching links:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode, sessionToken]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const createLink = async (url: string, title: string, folderId?: string, description?: string, imageUrl?: string) => {
    if (!userId || !sessionToken) return null;

    try {
      // Try to get favicon
      let faviconUrl = null;
      try {
        const urlObj = new URL(url);
        faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
      } catch {}

      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'create-link',
          sessionToken,
          data: {
            url,
            title: title || url,
            folder_id: folderId || null,
            favicon_url: faviconUrl,
            description: description || null,
            image_url: imageUrl || null,
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setLinks(prev => [data.data, ...prev]);
      toast.success('Link gespeichert');
      return data.data;
    } catch (error) {
      console.error('Error creating link:', error);
      toast.error('Fehler beim Speichern');
      return null;
    }
  };

  const updateLink = async (id: string, updates: Partial<Pick<Link, 'url' | 'title' | 'description' | 'folder_id' | 'is_favorite' | 'tags' | 'image_url'>>) => {
    if (!sessionToken) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'update-link',
          sessionToken,
          data: { id, updates }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setLinks(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
      toast.success('Link aktualisiert');
    } catch (error) {
      console.error('Error updating link:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const deleteLink = async (id: string) => {
    if (!sessionToken) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'delete-link',
          sessionToken,
          data: { id }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setLinks(prev => prev.filter(l => l.id !== id));
      toast.success('Link gelöscht');
    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const toggleFavorite = async (id: string) => {
    const link = links.find(l => l.id === id);
    if (!link) return;

    await updateLink(id, { is_favorite: !link.is_favorite });
  };

  const moveToFolder = async (id: string, folderId: string | null) => {
    await updateLink(id, { folder_id: folderId });
  };

  return {
    links,
    isLoading,
    createLink,
    updateLink,
    deleteLink,
    toggleFavorite,
    moveToFolder,
    refetch: fetchLinks,
  };
}
