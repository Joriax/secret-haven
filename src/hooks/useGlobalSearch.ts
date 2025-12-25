import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SearchResult {
  id: string;
  type: 'note' | 'photo' | 'file' | 'album' | 'secret_text';
  title: string;
  subtitle?: string;
  matchedField: string;
}

export const useGlobalSearch = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { userId, isDecoyMode } = useAuth();

  const search = useCallback(async (query: string) => {
    if (!userId || !query.trim() || isDecoyMode) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchResults: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    try {
      // Search notes
      const { data: notes } = await supabase
        .from('notes')
        .select('id, title, content')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`);

      notes?.forEach(note => {
        const titleMatch = note.title?.toLowerCase().includes(lowerQuery);
        searchResults.push({
          id: note.id,
          type: 'note',
          title: note.title || 'Unbenannte Notiz',
          subtitle: note.content?.slice(0, 100),
          matchedField: titleMatch ? 'Titel' : 'Inhalt'
        });
      });

      // Search photos
      const { data: photos } = await supabase
        .from('photos')
        .select('id, filename, caption')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or(`filename.ilike.%${query}%,caption.ilike.%${query}%`);

      photos?.forEach(photo => {
        searchResults.push({
          id: photo.id,
          type: 'photo',
          title: photo.filename,
          subtitle: photo.caption || undefined,
          matchedField: photo.caption?.toLowerCase().includes(lowerQuery) ? 'Beschreibung' : 'Dateiname'
        });
      });

      // Search files
      const { data: files } = await supabase
        .from('files')
        .select('id, filename, mime_type')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .ilike('filename', `%${query}%`);

      files?.forEach(file => {
        searchResults.push({
          id: file.id,
          type: 'file',
          title: file.filename,
          subtitle: file.mime_type,
          matchedField: 'Dateiname'
        });
      });

      // Search albums
      const { data: albums } = await supabase
        .from('albums')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', `%${query}%`);

      albums?.forEach(album => {
        searchResults.push({
          id: album.id,
          type: 'album',
          title: album.name,
          matchedField: 'Albumname'
        });
      });

      // Search secret texts
      const { data: secretTexts } = await supabase
        .from('secret_texts')
        .select('id, title')
        .eq('user_id', userId)
        .ilike('title', `%${query}%`);

      secretTexts?.forEach(text => {
        searchResults.push({
          id: text.id,
          type: 'secret_text',
          title: text.title || 'Geheimer Text',
          matchedField: 'Titel'
        });
      });

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, isDecoyMode]);

  const clearResults = useCallback(() => setResults([]), []);

  return { results, loading, search, clearResults };
};
