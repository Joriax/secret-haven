import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface SearchResult {
  id: string;
  type: 'note' | 'photo' | 'file' | 'album' | 'secret_text' | 'link' | 'tiktok';
  title: string;
  subtitle?: string;
  matchedField: string;
  date?: string;
  tags?: string[];
}

export const useGlobalSearch = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();

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
        .select('id, title, content, updated_at, tags')
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
          matchedField: titleMatch ? 'Titel' : 'Inhalt',
          date: note.updated_at,
          tags: note.tags || [],
        });
      });

      // Search photos
      const { data: photos } = await supabase
        .from('photos')
        .select('id, filename, caption, uploaded_at, tags')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or(`filename.ilike.%${query}%,caption.ilike.%${query}%`);

      photos?.forEach(photo => {
        searchResults.push({
          id: photo.id,
          type: 'photo',
          title: photo.filename,
          subtitle: photo.caption || undefined,
          matchedField: photo.caption?.toLowerCase().includes(lowerQuery) ? 'Beschreibung' : 'Dateiname',
          date: photo.uploaded_at,
          tags: photo.tags || [],
        });
      });

      // Search files
      const { data: files } = await supabase
        .from('files')
        .select('id, filename, mime_type, uploaded_at, tags')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .ilike('filename', `%${query}%`);

      files?.forEach(file => {
        searchResults.push({
          id: file.id,
          type: 'file',
          title: file.filename,
          subtitle: file.mime_type,
          matchedField: 'Dateiname',
          date: file.uploaded_at,
          tags: file.tags || [],
        });
      });

      // Search albums
      const { data: albums } = await supabase
        .from('albums')
        .select('id, name, created_at')
        .eq('user_id', userId)
        .ilike('name', `%${query}%`);

      albums?.forEach(album => {
        searchResults.push({
          id: album.id,
          type: 'album',
          title: album.name,
          matchedField: 'Albumname',
          date: album.created_at,
        });
      });

      // Search secret texts
      const { data: secretTexts } = await supabase
        .from('secret_texts')
        .select('id, title, created_at')
        .eq('user_id', userId)
        .ilike('title', `%${query}%`);

      secretTexts?.forEach(text => {
        searchResults.push({
          id: text.id,
          type: 'secret_text',
          title: text.title || 'Geheimer Text',
          matchedField: 'Titel',
          date: text.created_at,
        });
      });

      // Search links
      const { data: links } = await supabase
        .from('links')
        .select('id, title, url, description, created_at, tags')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or(`title.ilike.%${query}%,url.ilike.%${query}%,description.ilike.%${query}%`);

      links?.forEach(link => {
        searchResults.push({
          id: link.id,
          type: 'link',
          title: link.title || link.url,
          subtitle: link.description || link.url,
          matchedField: link.title?.toLowerCase().includes(lowerQuery) ? 'Titel' : 'URL',
          date: link.created_at,
          tags: link.tags || [],
        });
      });

      // Search TikTok videos
      const { data: tiktoks } = await supabase
        .from('tiktok_videos')
        .select('id, title, author_name, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or(`title.ilike.%${query}%,author_name.ilike.%${query}%`);

      tiktoks?.forEach(tiktok => {
        searchResults.push({
          id: tiktok.id,
          type: 'tiktok',
          title: tiktok.title || `@${tiktok.author_name}` || 'TikTok Video',
          subtitle: tiktok.author_name ? `@${tiktok.author_name}` : undefined,
          matchedField: tiktok.title?.toLowerCase().includes(lowerQuery) ? 'Titel' : 'Autor',
          date: tiktok.created_at,
        });
      });

      // Sort by date
      searchResults.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
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
