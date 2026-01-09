import Dexie, { Table } from 'dexie';

// IndexedDB for offline caching
export interface LocalNote {
  id?: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface LocalPhoto {
  id?: string;
  album_id?: string;
  filename: string;
  caption: string;
  data: string; // base64 for offline
  taken_at: string;
  uploaded_at: string;
  synced: boolean;
}

export interface LocalFile {
  id?: string;
  filename: string;
  mime_type: string;
  size: number;
  data: string; // base64 for offline
  uploaded_at: string;
  synced: boolean;
}

export interface LocalAlbum {
  id?: string;
  name: string;
  created_at: string;
  synced: boolean;
}

// Offline sync queue for pending operations
export interface SyncQueueItem {
  id?: number;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, any>;
  createdAt: string;
  retries: number;
  lastError?: string;
}

export class VaultDatabase extends Dexie {
  notes!: Table<LocalNote>;
  photos!: Table<LocalPhoto>;
  files!: Table<LocalFile>;
  albums!: Table<LocalAlbum>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('VaultDB');
    this.version(2).stores({
      notes: 'id, title, created_at, updated_at, synced',
      photos: 'id, album_id, filename, taken_at, synced',
      files: 'id, filename, mime_type, uploaded_at, synced',
      albums: 'id, name, created_at, synced',
      syncQueue: '++id, table, operation, createdAt, retries',
    });
  }
}

export const db = new VaultDatabase();

// Helper to add items to sync queue
export const addToSyncQueue = async (
  table: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  data: Record<string, any>
) => {
  await db.syncQueue.add({
    table,
    operation,
    data,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
};

// Get pending sync items
export const getPendingSyncItems = async () => {
  return db.syncQueue.toArray();
};

// Remove synced item from queue
export const removeSyncItem = async (id: number) => {
  await db.syncQueue.delete(id);
};

// Update retry count on failure
export const updateSyncItemRetry = async (id: number, error: string) => {
  const item = await db.syncQueue.get(id);
  if (item) {
    await db.syncQueue.update(id, {
      retries: item.retries + 1,
      lastError: error,
    });
  }
};
