import { useMemo } from 'react';
import { formatDistanceToNow, subDays, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';

export interface SmartAlbumRule {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  filter: (item: SmartAlbumItem) => boolean;
  priority: number;
}

export interface SmartAlbumItem {
  id: string;
  filename?: string;
  name?: string;
  title?: string;
  created_at?: string;
  uploaded_at?: string;
  updated_at?: string;
  is_favorite?: boolean;
  tags?: string[];
  size?: number;
  mime_type?: string;
  type?: 'photo' | 'video' | 'file' | 'note' | 'link' | 'tiktok';
}

export interface SmartAlbum {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  count: number;
  rule: SmartAlbumRule;
}

// Size threshold in bytes (50MB)
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;

// Default smart album rules
export const defaultSmartAlbumRules: SmartAlbumRule[] = [
  {
    id: 'favorites',
    name: 'Favoriten',
    icon: 'Heart',
    color: '#ef4444',
    description: 'Alle als Favorit markierten Elemente',
    filter: (item) => item.is_favorite === true,
    priority: 1,
  },
  {
    id: 'recent-7-days',
    name: 'Letzte 7 Tage',
    icon: 'Clock',
    color: '#3b82f6',
    description: 'In den letzten 7 Tagen hinzugefügt',
    filter: (item) => {
      const date = item.uploaded_at || item.created_at || item.updated_at;
      if (!date) return false;
      const itemDate = new Date(date);
      const now = new Date();
      return isWithinInterval(itemDate, { start: subDays(now, 7), end: now });
    },
    priority: 2,
  },
  {
    id: 'recent-30-days',
    name: 'Letzte 30 Tage',
    icon: 'Calendar',
    color: '#8b5cf6',
    description: 'In den letzten 30 Tagen hinzugefügt',
    filter: (item) => {
      const date = item.uploaded_at || item.created_at || item.updated_at;
      if (!date) return false;
      const itemDate = new Date(date);
      const now = new Date();
      return isWithinInterval(itemDate, { start: subDays(now, 30), end: now });
    },
    priority: 3,
  },
  {
    id: 'videos',
    name: 'Alle Videos',
    icon: 'Video',
    color: '#f59e0b',
    description: 'Alle Video-Dateien',
    filter: (item) => {
      if (item.type === 'video') return true;
      const mime = item.mime_type?.toLowerCase() || '';
      const filename = (item.filename || item.name || '').toLowerCase();
      return mime.startsWith('video/') || 
             /\.(mp4|mov|webm|avi|mkv|m4v|3gp|ogv|wmv|flv)$/i.test(filename);
    },
    priority: 4,
  },
  {
    id: 'images',
    name: 'Alle Bilder',
    icon: 'Image',
    color: '#10b981',
    description: 'Alle Bild-Dateien',
    filter: (item) => {
      if (item.type === 'photo') return true;
      const mime = item.mime_type?.toLowerCase() || '';
      const filename = (item.filename || item.name || '').toLowerCase();
      return mime.startsWith('image/') || 
             /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|avif|tiff|svg)$/i.test(filename);
    },
    priority: 5,
  },
  {
    id: 'documents',
    name: 'Dokumente',
    icon: 'FileText',
    color: '#6366f1',
    description: 'PDF, Word, Excel und andere Dokumente',
    filter: (item) => {
      const mime = item.mime_type?.toLowerCase() || '';
      const filename = (item.filename || item.name || '').toLowerCase();
      return mime.includes('pdf') || 
             mime.includes('document') || 
             mime.includes('spreadsheet') ||
             mime.includes('presentation') ||
             /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|txt|rtf)$/i.test(filename);
    },
    priority: 6,
  },
  {
    id: 'audio',
    name: 'Audio-Dateien',
    icon: 'Music',
    color: '#ec4899',
    description: 'Musik und Audio-Dateien',
    filter: (item) => {
      const mime = item.mime_type?.toLowerCase() || '';
      const filename = (item.filename || item.name || '').toLowerCase();
      return mime.startsWith('audio/') || 
             /\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i.test(filename);
    },
    priority: 7,
  },
  {
    id: 'large-files',
    name: 'Große Dateien (>50MB)',
    icon: 'HardDrive',
    color: '#f97316',
    description: 'Dateien größer als 50 Megabyte',
    filter: (item) => (item.size || 0) > LARGE_FILE_THRESHOLD,
    priority: 8,
  },
  {
    id: 'untagged',
    name: 'Ohne Tags',
    icon: 'Tag',
    color: '#94a3b8',
    description: 'Elemente ohne zugewiesene Tags',
    filter: (item) => !item.tags || item.tags.length === 0,
    priority: 9,
  },
  {
    id: 'tagged',
    name: 'Mit Tags',
    icon: 'Tags',
    color: '#14b8a6',
    description: 'Elemente mit mindestens einem Tag',
    filter: (item) => item.tags && item.tags.length > 0,
    priority: 10,
  },
];

export function useSmartAlbums<T extends SmartAlbumItem>(
  items: T[],
  customRules?: SmartAlbumRule[]
) {
  const rules = customRules || defaultSmartAlbumRules;

  const smartAlbums = useMemo(() => {
    return rules
      .map((rule) => {
        const matchingItems = items.filter(rule.filter);
        return {
          id: rule.id,
          name: rule.name,
          icon: rule.icon,
          color: rule.color,
          description: rule.description,
          count: matchingItems.length,
          rule,
        };
      })
      .filter((album) => album.count > 0)
      .sort((a, b) => a.rule.priority - b.rule.priority);
  }, [items, rules]);

  const getItemsForSmartAlbum = useMemo(() => {
    return (albumId: string): T[] => {
      const rule = rules.find((r) => r.id === albumId);
      if (!rule) return [];
      return items.filter(rule.filter);
    };
  }, [items, rules]);

  const getSmartAlbumById = useMemo(() => {
    return (albumId: string): SmartAlbum | undefined => {
      return smartAlbums.find((a) => a.id === albumId);
    };
  }, [smartAlbums]);

  return {
    smartAlbums,
    getItemsForSmartAlbum,
    getSmartAlbumById,
    rules,
  };
}
