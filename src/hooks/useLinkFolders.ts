import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface LinkFolder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export function useLinkFolders() {
  const [folders, setFolders] = useState<LinkFolder[]>([]);
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
          action: 'get-link-folders',
          sessionToken,
          data: {}
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setFolders(data.data || []);
    } catch (error) {
      console.error('Error fetching link folders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode, sessionToken]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const createFolder = async (name: string, color: string = '#6366f1', icon: string = 'folder') => {
    if (!userId || !sessionToken) return null;

    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'create-link-folder',
          sessionToken,
          data: { name, color, icon }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setFolders(prev => [...prev, data.data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Ordner erstellt');
      return data.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Fehler beim Erstellen');
      return null;
    }
  };

  const updateFolder = async (id: string, updates: Partial<Pick<LinkFolder, 'name' | 'color' | 'icon'>>) => {
    if (!sessionToken) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'update-link-folder',
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
          action: 'delete-link-folder',
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
