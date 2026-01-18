import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export const useTags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId, supabaseClient: supabase } = useAuth();
  const channelRef = useRef<any>(null);

  const fetchTags = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Real-time updates
  useEffect(() => {
    if (!userId) return;

    // Cleanup previous channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('tags-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, fetchTags)
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchTags, supabase]);

  const createTag = async (name: string, color: string = '#6366f1') => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ user_id: userId, name, color })
        .select()
        .single();

      if (error) throw error;
      setTags(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error creating tag:', error);
      return null;
    }
  };

  const updateTag = async (id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>) => {
    try {
      const { error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      return true;
    } catch (error) {
      console.error('Error updating tag:', error);
      return false;
    }
  };

  const deleteTag = async (id: string) => {
    try {
      // First, remove the tag ID from all items that reference it
      // This prevents stale tag references in photos, files, notes, and links
      const removeTagFromTable = async (table: 'photos' | 'files' | 'notes' | 'links') => {
        const { data: items } = await supabase
          .from(table)
          .select('id, tags')
          .contains('tags', [id]);
        
        if (items && items.length > 0) {
          for (const item of items) {
            const newTags = (item.tags || []).filter((t: string) => t !== id);
            await supabase
              .from(table)
              .update({ tags: newTags })
              .eq('id', item.id);
          }
        }
      };

      // Clean up tag references from all tables in parallel
      await Promise.all([
        removeTagFromTable('photos'),
        removeTagFromTable('files'),
        removeTagFromTable('notes'),
        removeTagFromTable('links'),
      ]);

      // Now delete the tag itself
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTags(prev => prev.filter(t => t.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting tag:', error);
      return false;
    }
  };

  return { tags, loading, fetchTags, createTag, updateTag, deleteTag };
};
