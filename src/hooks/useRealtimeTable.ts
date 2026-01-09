import { useEffect, useCallback } from 'react';
import { useRealtimeSync } from '@/contexts/RealtimeSyncContext';

type TableName = 'notes' | 'photos' | 'files' | 'albums' | 'links' | 'tiktok_videos' | 'tags' | 'view_history' | 'security_logs';

/**
 * Hook to easily subscribe to realtime updates for a table
 * @param table - The table name to subscribe to
 * @param onUpdate - Callback when any change happens
 * @param deps - Dependencies to re-subscribe
 */
export const useRealtimeTable = (
  table: TableName,
  onUpdate: () => void,
  deps: React.DependencyList = []
) => {
  const { subscribe, isOnline } = useRealtimeSync();

  useEffect(() => {
    const unsubscribe = subscribe(table, () => {
      onUpdate();
    });

    return () => {
      unsubscribe();
    };
  }, [table, subscribe, ...deps]);

  return { isOnline };
};

/**
 * Hook to subscribe to multiple tables at once
 * @param tables - Array of table names
 * @param onUpdate - Callback when any change happens
 * @param deps - Dependencies to re-subscribe
 */
export const useRealtimeTables = (
  tables: TableName[],
  onUpdate: () => void,
  deps: React.DependencyList = []
) => {
  const { subscribe, isOnline } = useRealtimeSync();

  useEffect(() => {
    const unsubscribes = tables.map(table => 
      subscribe(table, () => {
        onUpdate();
      })
    );

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [tables.join(','), subscribe, ...deps]);

  return { isOnline };
};
