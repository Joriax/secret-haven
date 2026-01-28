import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface ViewHistoryItem {
  id: string;
  item_type: string;
  item_id: string;
  viewed_at: string;
}

// Global cache for view history
const historyCache = new Map<string, {
  data: ViewHistoryItem[];
  timestamp: number;
}>();
const CACHE_TTL = 30000; // 30 seconds

export const useViewHistory = () => {
  const [history, setHistory] = useState<ViewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchHistory = useCallback(async (skipCache = false) => {
    if (!userId || isDecoyMode) {
      setHistory([]);
      setLoading(false);
      return;
    }

    // Check cache first
    if (!skipCache) {
      const cached = historyCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setHistory(cached.data);
        setLoading(false);
        return;
      }
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    try {
      const { data, error } = await supabase
        .from('view_history')
        .select('*')
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const items = data || [];
      
      if (mountedRef.current) {
        setHistory(items);
        historyCache.set(userId, { data: items, timestamp: Date.now() });
      }
    } catch (error) {
      console.error('Error fetching view history:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [userId, isDecoyMode, supabase]);

  useEffect(() => {
    mountedRef.current = true;
    fetchHistory();
    return () => { mountedRef.current = false; };
  }, [fetchHistory]);

  const recordView = useCallback(async (itemType: string, itemId: string) => {
    if (!userId || isDecoyMode) return;

    try {
      // Optimistic update
      const newItem: ViewHistoryItem = {
        id: crypto.randomUUID(),
        item_type: itemType,
        item_id: itemId,
        viewed_at: new Date().toISOString(),
      };
      
      setHistory(prev => {
        const filtered = prev.filter(h => !(h.item_type === itemType && h.item_id === itemId));
        return [newItem, ...filtered].slice(0, 50);
      });

      // Background sync
      await supabase
        .from('view_history')
        .delete()
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .eq('item_id', itemId);

      await supabase.from('view_history').insert({
        user_id: userId,
        item_type: itemType,
        item_id: itemId
      });

      // Invalidate cache
      historyCache.delete(userId);
    } catch (error) {
      console.error('Error recording view:', error);
      // Refetch on error
      fetchHistory(true);
    }
  }, [userId, isDecoyMode, supabase, fetchHistory]);

  const clearHistory = useCallback(async () => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('view_history')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      setHistory([]);
      historyCache.delete(userId);
      return true;
    } catch (error) {
      console.error('Error clearing history:', error);
      return false;
    }
  }, [userId, supabase]);

  return { 
    history, 
    loading, 
    fetchHistory: () => fetchHistory(true), 
    recordView, 
    clearHistory 
  };
};
