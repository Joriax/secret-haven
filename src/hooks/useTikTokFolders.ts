import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TikTokFolder {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  created_at: string | null;
}

export function useTikTokFolders() {
  const [folders, setFolders] = useState<TikTokFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode, sessionToken } = useAuth();

  const fetchFolders = useCallback(async () => {
    if (!userId || isDecoyMode || !sessionToken) {
      setFolders([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: { 
          action: 'get-tiktok-folders',
          sessionToken,
          data: {}
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setFolders((data.data as TikTokFolder[]) || []);
    } catch (error) {
      console.error('Error fetching TikTok folders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode, sessionToken]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const createFolder = async (name: string, icon?: string, color?: string) => {
    if (!userId || !sessionToken) return null;

    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'create-tiktok-folder',
          sessionToken,
          data: { 
            name, 
            icon: icon || 'folder', 
            color: color || '#6366f1' 
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setFolders(prev => [...prev, data.data as TikTokFolder]);
      toast.success('Ordner erstellt');
      return data.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Fehler beim Erstellen');
      return null;
    }
  };

  const updateFolder = async (id: string, updates: Partial<Pick<TikTokFolder, 'name' | 'icon' | 'color'>>) => {
    if (!sessionToken) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'update-tiktok-folder',
          sessionToken,
          data: { id, updates }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      toast.success('Ordner aktualisiert');
    } catch (error) {
      console.error('Error updating folder:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const deleteFolder = async (id: string) => {
    if (!sessionToken) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'delete-tiktok-folder',
          sessionToken,
          data: { id }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setFolders(prev => prev.filter(f => f.id !== id));
      toast.success('Ordner gelöscht');
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  return {
    folders,
    isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    refetch: fetchFolders,
  };
}
