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

export class VaultDatabase extends Dexie {
  notes!: Table<LocalNote>;
  photos!: Table<LocalPhoto>;
  files!: Table<LocalFile>;
  albums!: Table<LocalAlbum>;

  constructor() {
    super('VaultDB');
    this.version(1).stores({
      notes: 'id, title, created_at, updated_at, synced',
      photos: 'id, album_id, filename, taken_at, synced',
      files: 'id, filename, mime_type, uploaded_at, synced',
      albums: 'id, name, created_at, synced',
    });
  }
}

export const db = new VaultDatabase();
