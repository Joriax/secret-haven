import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, addToSyncQueue, getPendingSyncItems, removeSyncItem, updateSyncItemRetry } from '@/lib/db';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  error: string | null;
}

export function useOfflineSync() {
  const { userId, supabaseClient: supabase } = useAuth();
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
  });
  const syncInProgressRef = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      // Trigger sync when coming online
      syncPendingChanges();
    };
    
    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Count pending changes
  const updatePendingCount = useCallback(async () => {
    try {
      const items = await getPendingSyncItems();
      setStatus(prev => ({ ...prev, pendingCount: items.length }));
    } catch (error) {
      console.error('Error counting pending items:', error);
    }
  }, []);

  // Update pending count periodically
  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Sync pending changes to server
  const syncPendingChanges = useCallback(async () => {
    if (!userId || !status.isOnline || syncInProgressRef.current) return;
    
    syncInProgressRef.current = true;
    setStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const pendingItems = await getPendingSyncItems();
      
      for (const item of pendingItems) {
        try {
          const tableName = item.table as 'notes' | 'photos' | 'files' | 'albums';
          switch (item.operation) {
            case 'INSERT':
              await supabase.from(tableName).insert([item.data]);
              break;
            case 'UPDATE':
              await supabase
                .from(tableName)
                .update(item.data)
                .eq('id', item.data.id);
              break;
            case 'DELETE':
              await supabase
                .from(tableName)
                .delete()
                .eq('id', item.data.id);
              break;
          }
          
          // Remove successfully synced item
          if (item.id) {
            await removeSyncItem(item.id);
          }
        } catch (error) {
          console.error(`Sync error for ${item.table}:`, error);
          
          // Update retry count
          if (item.id) {
            await updateSyncItemRetry(item.id, String(error));
          }
          
          // If too many retries, skip this item
          if (item.retries >= 5) {
            console.warn(`Skipping item after ${item.retries} retries:`, item);
          }
        }
      }

      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
      }));
      
      await updatePendingCount();
    } catch (error) {
      console.error('Sync error:', error);
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: String(error),
      }));
    } finally {
      syncInProgressRef.current = false;
    }
  }, [userId, status.isOnline, supabase, updatePendingCount]);

  // Set up periodic sync
  useEffect(() => {
    if (status.isOnline) {
      syncPendingChanges();
      syncIntervalRef.current = setInterval(syncPendingChanges, 30000); // Sync every 30 seconds
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [status.isOnline, syncPendingChanges]);

  // Queue offline changes
  const queueChange = useCallback(async (
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    data: Record<string, any>
  ) => {
    await addToSyncQueue(table, operation, data);
    await updatePendingCount();
    
    // Try to sync immediately if online
    if (status.isOnline) {
      syncPendingChanges();
    }
  }, [status.isOnline, syncPendingChanges, updatePendingCount]);

  // Cache data locally
  const cacheData = useCallback(async (
    table: 'notes' | 'photos' | 'files' | 'albums',
    data: any[]
  ) => {
    try {
      // Mark all as synced since they came from server
      const items = data.map(item => ({ ...item, synced: true }));
      
      switch (table) {
        case 'notes':
          await db.notes.bulkPut(items);
          break;
        case 'photos':
          await db.photos.bulkPut(items);
          break;
        case 'files':
          await db.files.bulkPut(items);
          break;
        case 'albums':
          await db.albums.bulkPut(items);
          break;
      }
    } catch (error) {
      console.error(`Error caching ${table}:`, error);
    }
  }, []);

  // Get cached data
  const getCachedData = useCallback(async <T>(
    table: 'notes' | 'photos' | 'files' | 'albums'
  ): Promise<T[]> => {
    try {
      switch (table) {
        case 'notes':
          return (await db.notes.toArray()) as T[];
        case 'photos':
          return (await db.photos.toArray()) as T[];
        case 'files':
          return (await db.files.toArray()) as T[];
        case 'albums':
          return (await db.albums.toArray()) as T[];
        default:
          return [];
      }
    } catch (error) {
      console.error(`Error getting cached ${table}:`, error);
      return [];
    }
  }, []);

  // Clear all cached data
  const clearCache = useCallback(async () => {
    try {
      await db.notes.clear();
      await db.photos.clear();
      await db.files.clear();
      await db.albums.clear();
      await db.syncQueue.clear();
      await updatePendingCount();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, [updatePendingCount]);

  return {
    ...status,
    syncNow: syncPendingChanges,
    queueChange,
    cacheData,
    getCachedData,
    clearCache,
  };
}
