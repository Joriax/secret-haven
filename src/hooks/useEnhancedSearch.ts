import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';

export interface SearchResult {
  id: string;
  type: 'note' | 'photo' | 'file' | 'album' | 'secret_text' | 'link' | 'tiktok' | 'voice_note';
  title: string;
  subtitle?: string;
  matchedField: string;
  date?: string;
  tags?: string[];
  highlight?: string;
}

interface SearchFilters {
  types: string[];
  dateFrom?: Date;
  dateTo?: Date;
  hasTags?: boolean;
  isFavorite?: boolean;
}

// Parse advanced search syntax
const parseSearchQuery = (query: string) => {
  const result = {
    text: '',
    type: null as string | null,
    tag: null as string | null,
    exact: null as string | null,
  };

  let remaining = query;

  // Parse type: filter
  const typeMatch = remaining.match(/type:(\w+)/i);
  if (typeMatch) {
    result.type = typeMatch[1].toLowerCase();
    remaining = remaining.replace(typeMatch[0], '');
  }

  // Parse tag: filter
  const tagMatch = remaining.match(/tag:(\w+)/i);
  if (tagMatch) {
    result.tag = tagMatch[1];
    remaining = remaining.replace(tagMatch[0], '');
  }

  // Parse "exact phrase"
  const exactMatch = remaining.match(/"([^"]+)"/);
  if (exactMatch) {
    result.exact = exactMatch[1];
    remaining = remaining.replace(exactMatch[0], '');
  }

  result.text = remaining.trim();
  return result;
};

// Fuzzy match with typo tolerance
const fuzzyMatch = (text: string, query: string, maxDistance = 2): boolean => {
  if (!text || !query) return false;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Direct inclusion check
  if (textLower.includes(queryLower)) return true;
  
  // Check if query words are present (order-independent)
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const matchedWords = queryWords.filter(word => textLower.includes(word));
  
  if (matchedWords.length >= Math.ceil(queryWords.length * 0.6)) {
    return true;
  }
  
  return false;
};

// Extract context around match
const extractHighlight = (content: string, query: string, contextLength = 50): string | undefined => {
  if (!content || !query) return undefined;
  
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);
  
  if (index === -1) return undefined;
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + query.length + contextLength);
  
  let highlight = content.slice(start, end);
  if (start > 0) highlight = '...' + highlight;
  if (end < content.length) highlight = highlight + '...';
  
  return highlight;
};

export const useEnhancedSearch = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();

  // Load search history from localStorage
  React.useEffect(() => {
    if (!userId) return;
    const saved = localStorage.getItem(`search-history-${userId}`);
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved).slice(0, 10));
      } catch {}
    }
  }, [userId]);

  const addToHistory = useCallback((query: string) => {
    if (!userId || !query.trim()) return;
    
    setSearchHistory(prev => {
      const filtered = prev.filter(q => q !== query);
      const updated = [query, ...filtered].slice(0, 10);
      localStorage.setItem(`search-history-${userId}`, JSON.stringify(updated));
      return updated;
    });
  }, [userId]);

  const clearHistory = useCallback(() => {
    if (!userId) return;
    setSearchHistory([]);
    localStorage.removeItem(`search-history-${userId}`);
  }, [userId]);

  const search = useCallback(async (query: string, filters?: SearchFilters) => {
    if (!userId || !query.trim() || isDecoyMode) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchResults: SearchResult[] = [];
    
    // Parse advanced syntax
    const parsed = parseSearchQuery(query);
    const searchText = parsed.text || parsed.exact || query;

    try {
      // Build type filter
      const allowedTypes = parsed.type 
        ? [parsed.type] 
        : filters?.types?.length 
          ? filters.types 
          : ['note', 'photo', 'file', 'album', 'secret_text', 'link', 'tiktok', 'voice_note'];

      // Parallel searches based on allowed types
      const promises: Promise<void>[] = [];

      if (allowedTypes.includes('note')) {
        promises.push((async () => {
          const { data: notes } = await supabase
            .from('notes')
            .select('id, title, content, updated_at, tags')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .or(`title.ilike.%${searchText}%,content.ilike.%${searchText}%`);

          notes?.forEach(note => {
            const titleMatch = fuzzyMatch(note.title || '', searchText);
            const highlight = extractHighlight(note.content || '', searchText);
            
            searchResults.push({
              id: note.id,
              type: 'note',
              title: note.title || 'Unbenannte Notiz',
              subtitle: note.content?.slice(0, 100),
              matchedField: titleMatch ? 'Titel' : 'Inhalt',
              date: note.updated_at,
              tags: note.tags || [],
              highlight,
            });
          });
        })());
      }

      if (allowedTypes.includes('photo')) {
        promises.push((async () => {
          const { data: photos } = await supabase
            .from('photos')
            .select('id, filename, caption, uploaded_at, tags')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .or(`filename.ilike.%${searchText}%,caption.ilike.%${searchText}%`);

          photos?.forEach(photo => {
            searchResults.push({
              id: photo.id,
              type: 'photo',
              title: photo.filename?.replace(/^\d+-/, '') || 'Foto',
              subtitle: photo.caption || undefined,
              matchedField: fuzzyMatch(photo.caption || '', searchText) ? 'Beschreibung' : 'Dateiname',
              date: photo.uploaded_at,
              tags: photo.tags || [],
            });
          });
        })());
      }

      if (allowedTypes.includes('file')) {
        promises.push((async () => {
          const { data: files } = await supabase
            .from('files')
            .select('id, filename, mime_type, uploaded_at, tags')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .ilike('filename', `%${searchText}%`);

          files?.forEach(file => {
            searchResults.push({
              id: file.id,
              type: 'file',
              title: file.filename?.replace(/^\d+-/, '') || 'Datei',
              subtitle: file.mime_type,
              matchedField: 'Dateiname',
              date: file.uploaded_at,
              tags: file.tags || [],
            });
          });
        })());
      }

      if (allowedTypes.includes('link')) {
        promises.push((async () => {
          const { data: links } = await supabase
            .from('links')
            .select('id, title, url, description, created_at, tags')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .or(`title.ilike.%${searchText}%,url.ilike.%${searchText}%,description.ilike.%${searchText}%`);

          links?.forEach(link => {
            const highlight = extractHighlight(link.description || '', searchText);
            searchResults.push({
              id: link.id,
              type: 'link',
              title: link.title || link.url,
              subtitle: link.description || link.url,
              matchedField: fuzzyMatch(link.title || '', searchText) ? 'Titel' : 'URL',
              date: link.created_at,
              tags: link.tags || [],
              highlight,
            });
          });
        })());
      }

      if (allowedTypes.includes('tiktok')) {
        promises.push((async () => {
          const { data: tiktoks } = await supabase
            .from('tiktok_videos')
            .select('id, title, author_name, created_at')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .or(`title.ilike.%${searchText}%,author_name.ilike.%${searchText}%`);

          tiktoks?.forEach(tiktok => {
            searchResults.push({
              id: tiktok.id,
              type: 'tiktok',
              title: tiktok.title || `@${tiktok.author_name}` || 'TikTok',
              subtitle: tiktok.author_name ? `@${tiktok.author_name}` : undefined,
              matchedField: fuzzyMatch(tiktok.title || '', searchText) ? 'Titel' : 'Autor',
              date: tiktok.created_at,
            });
          });
        })());
      }

      if (allowedTypes.includes('voice_note')) {
        promises.push((async () => {
          const { data: voiceNotes } = await supabase
            .from('voice_notes')
            .select('id, title, transcript, created_at')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .or(`title.ilike.%${searchText}%,transcript.ilike.%${searchText}%`);

          voiceNotes?.forEach(note => {
            const highlight = extractHighlight(note.transcript || '', searchText);
            searchResults.push({
              id: note.id,
              type: 'voice_note',
              title: note.title || 'Sprachnotiz',
              subtitle: note.transcript?.slice(0, 100),
              matchedField: fuzzyMatch(note.title || '', searchText) ? 'Titel' : 'Transkript',
              date: note.created_at,
              highlight,
            });
          });
        })());
      }

      await Promise.all(promises);

      // Filter by tag if specified
      let filtered = searchResults;
      if (parsed.tag) {
        // Would need to fetch tag names and match - simplified for now
        filtered = searchResults.filter(r => 
          r.tags?.some(t => t.toLowerCase().includes(parsed.tag!.toLowerCase()))
        );
      }

      // Apply date filters
      if (filters?.dateFrom || filters?.dateTo) {
        filtered = filtered.filter(r => {
          if (!r.date) return false;
          const date = new Date(r.date);
          if (filters.dateFrom && date < filters.dateFrom) return false;
          if (filters.dateTo && date > filters.dateTo) return false;
          return true;
        });
      }

      // Sort by date (newest first)
      filtered.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setResults(filtered);
      addToHistory(query);
    } catch (error) {
      console.error('Enhanced search error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, isDecoyMode, supabase, addToHistory]);

  const clearResults = useCallback(() => setResults([]), []);

  return { 
    results, 
    loading, 
    search, 
    clearResults,
    searchHistory,
    clearHistory,
  };
};
