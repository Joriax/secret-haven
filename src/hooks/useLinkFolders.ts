import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface LinkFolder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  parent_id: string | null;
  created_at: string;
  children?: LinkFolder[];
  depth?: number;
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

  // Build hierarchical tree from flat list
  const hierarchicalFolders = useMemo(() => {
    const buildTree = (items: LinkFolder[], parentId: string | null = null, depth: number = 0): LinkFolder[] => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          depth,
          children: buildTree(items, item.id, depth + 1)
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    };
    return buildTree(folders);
  }, [folders]);

  // Flatten tree for display (with depth info)
  const flattenedFolders = useMemo(() => {
    const flatten = (items: LinkFolder[]): LinkFolder[] => {
      const result: LinkFolder[] = [];
      for (const item of items) {
        result.push(item);
        if (item.children && item.children.length > 0) {
          result.push(...flatten(item.children));
        }
      }
      return result;
    };
    return flatten(hierarchicalFolders);
  }, [hierarchicalFolders]);

  const createFolder = async (name: string, color: string = '#6366f1', icon: string = 'folder', parentId: string | null = null) => {
    if (!userId || !sessionToken) return null;

    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'create-link-folder',
          sessionToken,
          data: { name, color, icon, parent_id: parentId }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setFolders(prev => [...prev, data.data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(parentId ? 'Unterordner erstellt' : 'Ordner erstellt');
      return data.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Fehler beim Erstellen');
      return null;
    }
  };

  const updateFolder = async (id: string, updates: Partial<Pick<LinkFolder, 'name' | 'color' | 'icon' | 'parent_id'>>) => {
    if (!sessionToken) return;

    // Prevent moving folder into itself or descendants
    if (updates.parent_id) {
      const isDescendant = (folderId: string, targetId: string): boolean => {
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return false;
        if (folder.parent_id === targetId) return true;
        if (folder.parent_id) return isDescendant(folder.parent_id, targetId);
        return false;
      };

      if (updates.parent_id === id || isDescendant(updates.parent_id, id)) {
        toast.error('Ordner kann nicht in sich selbst verschoben werden');
        return;
      }
    }
    
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

    // Move children to parent of deleted folder
    const folder = folders.find(f => f.id === id);
    const childFolders = folders.filter(f => f.parent_id === id);

    if (childFolders.length > 0) {
      // Update children's parent_id before deleting
      for (const child of childFolders) {
        await supabase.functions.invoke('vault-data', {
          body: {
            action: 'update-link-folder',
            sessionToken,
            data: { id: child.id, updates: { parent_id: folder?.parent_id || null } }
          }
        });
      }
    }
    
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
      
      setFolders(prev => {
        // Update children's parent and remove deleted folder
        return prev
          .map(f => f.parent_id === id ? { ...f, parent_id: folder?.parent_id || null } : f)
          .filter(f => f.id !== id);
      });
      toast.success('Ordner gelöscht');
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  // Get all descendant IDs (for filtering links in folder + sub-folders)
  const getDescendantIds = useCallback((folderId: string): string[] => {
    const result: string[] = [folderId];
    const children = folders.filter(f => f.parent_id === folderId);
    for (const child of children) {
      result.push(...getDescendantIds(child.id));
    }
    return result;
  }, [folders]);

  return {
    folders,
    hierarchicalFolders,
    flattenedFolders,
    isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    getDescendantIds,
    refetch: fetchFolders,
  };
}
