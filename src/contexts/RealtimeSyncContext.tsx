import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db, getPendingSyncItems, removeSyncItem, updateSyncItemRetry } from '@/lib/db';
import { toast } from 'sonner';

type TableName = 'notes' | 'photos' | 'files' | 'albums' | 'links' | 'tiktok_videos' | 'tags' | 'view_history' | 'security_logs';

interface RealtimeEvent {
  table: TableName;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any> | null;
  old: Record<string, any> | null;
}

interface RealtimeSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingChanges: number;
  lastSyncTime: Date | null;
  subscribe: (table: TableName, callback: (event: RealtimeEvent) => void) => () => void;
  triggerSync: () => Promise<void>;
  notifyChange: (table: TableName) => void;
}

const RealtimeSyncContext = createContext<RealtimeSyncContextType | undefined>(undefined);

export const useRealtimeSync = () => {
  const context = useContext(RealtimeSyncContext);
  if (!context) {
    throw new Error('useRealtimeSync must be used within a RealtimeSyncProvider');
  }
  return context;
};

interface RealtimeSyncProviderProps {
  children: ReactNode;
}

// All tables to listen to
const REALTIME_TABLES: TableName[] = [
  'notes',
  'photos',
  'files',
  'albums',
  'links',
  'tiktok_videos',
  'tags',
  'view_history',
  'security_logs',
];

export const RealtimeSyncProvider: React.FC<RealtimeSyncProviderProps> = ({ children }) => {
  const { isAuthenticated, userId, supabaseClient } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // Subscription callbacks per table
  const subscriptions = useRef<Map<TableName, Set<(event: RealtimeEvent) => void>>>(new Map());
  
  // Channel reference
  const channelRef = useRef<ReturnType<typeof supabaseClient.channel> | null>(null);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Verbindung wiederhergestellt', { duration: 2000 });
      // Trigger sync when coming back online
      triggerSync();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Offline-Modus aktiv', { duration: 3000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Count pending sync items
  useEffect(() => {
    const countPending = async () => {
      const items = await getPendingSyncItems();
      setPendingChanges(items.length);
    };
    
    countPending();
    const interval = setInterval(countPending, 5000);
    return () => clearInterval(interval);
  }, []);

  // Setup global realtime subscription
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      return;
    }

    // Clean up existing channel
    if (channelRef.current) {
      supabaseClient.removeChannel(channelRef.current);
    }

    // Create a new channel for all tables
    const channel = supabaseClient.channel('global-realtime-sync');

    // Subscribe to all tables
    REALTIME_TABLES.forEach(table => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          const event: RealtimeEvent = {
            table,
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as Record<string, any> | null,
            old: payload.old as Record<string, any> | null,
          };

          // Notify all subscribers for this table
          const tableSubscribers = subscriptions.current.get(table);
          if (tableSubscribers) {
            tableSubscribers.forEach(callback => {
              try {
                callback(event);
              } catch (error) {
                console.error(`Error in realtime callback for ${table}:`, error);
              }
            });
          }
        }
      );
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Global realtime sync connected');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Realtime channel error');
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabaseClient.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isAuthenticated, userId, supabaseClient]);

  // Subscribe to a specific table
  const subscribe = useCallback((table: TableName, callback: (event: RealtimeEvent) => void) => {
    if (!subscriptions.current.has(table)) {
      subscriptions.current.set(table, new Set());
    }
    subscriptions.current.get(table)!.add(callback);

    // Return unsubscribe function
    return () => {
      const tableSubscribers = subscriptions.current.get(table);
      if (tableSubscribers) {
        tableSubscribers.delete(callback);
      }
    };
  }, []);

  // Notify change to all subscribers of a table (for local changes)
  const notifyChange = useCallback((table: TableName) => {
    const tableSubscribers = subscriptions.current.get(table);
    if (tableSubscribers) {
      const event: RealtimeEvent = {
        table,
        eventType: 'UPDATE',
        new: null,
        old: null,
      };
      tableSubscribers.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in notify callback for ${table}:`, error);
        }
      });
    }
  }, []);

  // Sync pending offline changes
  const triggerSync = useCallback(async () => {
    if (!isOnline || isSyncing || !isAuthenticated) return;

    setIsSyncing(true);
    
    try {
      const pendingItems = await getPendingSyncItems();
      
      if (pendingItems.length === 0) {
        setLastSyncTime(new Date());
        setIsSyncing(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const item of pendingItems) {
        // Skip items with too many retries
        if (item.retries >= 5) {
          continue;
        }

        try {
          let result;
          
          switch (item.operation) {
            case 'INSERT':
              result = await supabaseClient
                .from(item.table as any)
                .insert(item.data);
              break;
            case 'UPDATE':
              const { id, ...updateData } = item.data;
              result = await supabaseClient
                .from(item.table as any)
                .update(updateData)
                .eq('id', id);
              break;
            case 'DELETE':
              result = await supabaseClient
                .from(item.table as any)
                .delete()
                .eq('id', item.data.id);
              break;
          }

          if (result?.error) {
            throw result.error;
          }

          // Remove from queue on success
          if (item.id) {
            await removeSyncItem(item.id);
          }
          successCount++;
          
        } catch (error: any) {
          console.error(`Sync error for ${item.table}:`, error);
          if (item.id) {
            await updateSyncItemRetry(item.id, error.message);
          }
          failCount++;
        }
      }

      // Update pending count
      const remaining = await getPendingSyncItems();
      setPendingChanges(remaining.length);
      setLastSyncTime(new Date());

      if (successCount > 0) {
        toast.success(`${successCount} Änderungen synchronisiert`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} Synchronisierungen fehlgeschlagen`);
      }
      
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, isAuthenticated, supabaseClient]);

  // Periodic sync check
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const syncInterval = setInterval(() => {
      if (isOnline && pendingChanges > 0) {
        triggerSync();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(syncInterval);
  }, [isAuthenticated, isOnline, pendingChanges, triggerSync]);

  // Initial sync on mount
  useEffect(() => {
    if (isAuthenticated && isOnline) {
      triggerSync();
    }
  }, [isAuthenticated]);

  return (
    <RealtimeSyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingChanges,
        lastSyncTime,
        subscribe,
        triggerSync,
        notifyChange,
      }}
    >
      {children}
    </RealtimeSyncContext.Provider>
  );
};
