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
  const { userId, isDecoyMode } = useAuth();

  const fetchFolders = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setFolders([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('link_folders')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error('Error fetching link folders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const createFolder = async (name: string, color: string = '#6366f1', icon: string = 'folder') => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('link_folders')
        .insert({
          user_id: userId,
          name,
          color,
          icon,
        })
        .select()
        .single();

      if (error) throw error;
      
      setFolders(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Ordner erstellt');
      return data;
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Fehler beim Erstellen');
      return null;
    }
  };

  const updateFolder = async (id: string, updates: Partial<Pick<LinkFolder, 'name' | 'color' | 'icon'>>) => {
    try {
      const { error } = await supabase
        .from('link_folders')
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
        .from('link_folders')
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
