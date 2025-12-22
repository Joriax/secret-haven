import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ViewHistoryItem {
  id: string;
  item_type: string;
  item_id: string;
  viewed_at: string;
}

export const useViewHistory = () => {
  const [history, setHistory] = useState<ViewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId, isDecoyMode } = useAuth();

  const fetchHistory = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setHistory([]);
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('view_history')
        .select('*')
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching view history:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const recordView = async (itemType: string, itemId: string) => {
    if (!userId || isDecoyMode) return;

    try {
      // Remove old entry for same item if exists
      await supabase
        .from('view_history')
        .delete()
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .eq('item_id', itemId);

      // Insert new entry
      await supabase.from('view_history').insert({
        user_id: userId,
        item_type: itemType,
        item_id: itemId
      });

      fetchHistory();
    } catch (error) {
      console.error('Error recording view:', error);
    }
  };

  const clearHistory = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('view_history')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      setHistory([]);
      return true;
    } catch (error) {
      console.error('Error clearing history:', error);
      return false;
    }
  };

  return { history, loading, fetchHistory, recordView, clearHistory };
};
