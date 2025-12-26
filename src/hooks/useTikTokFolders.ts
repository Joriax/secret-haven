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
  const { userId, isDecoyMode } = useAuth();

  const fetchFolders = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setFolders([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tiktok_folders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFolders((data as TikTokFolder[]) || []);
    } catch (error) {
      console.error('Error fetching TikTok folders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const createFolder = async (name: string, icon?: string, color?: string) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('tiktok_folders')
        .insert({
          user_id: userId,
          name,
          icon: icon || 'folder',
          color: color || '#6366f1',
        })
        .select()
        .single();

      if (error) throw error;
      
      setFolders(prev => [...prev, data as TikTokFolder]);
      toast.success('Ordner erstellt');
      return data;
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Fehler beim Erstellen');
      return null;
    }
  };

  const updateFolder = async (id: string, updates: Partial<Pick<TikTokFolder, 'name' | 'icon' | 'color'>>) => {
    try {
      const { error } = await supabase
        .from('tiktok_folders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      toast.success('Ordner aktualisiert');
    } catch (error) {
      console.error('Error updating folder:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tiktok_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
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
