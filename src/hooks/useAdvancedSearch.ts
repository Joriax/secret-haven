import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface AdvancedSearchFilters {
  types: string[];
  tags: string[];
  dateFrom?: Date;
  dateTo?: Date;
  sizeMin?: number; // in bytes
  sizeMax?: number;
  isFavorite?: boolean;
  operator: 'AND' | 'OR';
}

export interface AdvancedSearchResult {
  id: string;
  type: 'note' | 'photo' | 'file' | 'link' | 'tiktok';
  title: string;
  subtitle?: string;
  date?: string;
  size?: number;
  tags?: string[];
  isFavorite?: boolean;
  matchScore: number;
}

interface ParsedQuery {
  terms: string[];
  excludeTerms: string[];
  exactPhrases: string[];
  operator: 'AND' | 'OR';
}

/**
 * Parses advanced search query with operators
 * Supports: AND, OR, NOT (-), exact phrases ("...")
 * Example: "project notes" AND report -draft
 */
export function parseAdvancedQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    terms: [],
    excludeTerms: [],
    exactPhrases: [],
    operator: 'AND', // default
  };

  if (!query.trim()) return result;

  // Extract exact phrases first
  const phraseMatches = query.match(/"([^"]+)"/g);
  if (phraseMatches) {
    result.exactPhrases = phraseMatches.map(p => p.replace(/"/g, '').toLowerCase());
    query = query.replace(/"[^"]+"/g, '');
  }

  // Detect global operator
  if (query.toUpperCase().includes(' OR ')) {
    result.operator = 'OR';
  }

  // Split by operators and spaces
  const tokens = query
    .replace(/\s+(AND|OR)\s+/gi, ' ')
    .split(/\s+/)
    .filter(Boolean);

  tokens.forEach(token => {
    if (token.startsWith('-') || token.startsWith('NOT:')) {
      const term = token.replace(/^(-|NOT:)/, '').toLowerCase();
      if (term) result.excludeTerms.push(term);
    } else {
      result.terms.push(token.toLowerCase());
    }
  });

  return result;
}

export function useAdvancedSearch() {
  const [results, setResults] = useState<AdvancedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();

  const search = useCallback(async (
    query: string, 
    filters: Partial<AdvancedSearchFilters> = {}
  ) => {
    if (!userId || isDecoyMode) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchResults: AdvancedSearchResult[] = [];
    const parsed = parseAdvancedQuery(query);

    try {
      // Build type filter
      const activeTypes = filters.types?.length 
        ? filters.types 
        : ['note', 'photo', 'file', 'link', 'tiktok'];

      // Search notes
      if (activeTypes.includes('note')) {
        let notesQuery = supabase
          .from('notes')
          .select('id, title, content, updated_at, tags, is_favorite')
          .eq('user_id', userId)
          .is('deleted_at', null);

        // Date filters
        if (filters.dateFrom) {
          notesQuery = notesQuery.gte('updated_at', filters.dateFrom.toISOString());
        }
        if (filters.dateTo) {
          notesQuery = notesQuery.lte('updated_at', filters.dateTo.toISOString());
        }
        if (filters.isFavorite !== undefined) {
          notesQuery = notesQuery.eq('is_favorite', filters.isFavorite);
        }

        const { data: notes } = await notesQuery;

        notes?.forEach(note => {
          const score = calculateMatchScore(
            note.title || '',
            note.content || '',
            parsed,
            note.tags || [],
            filters.tags || []
          );

          if (score > 0 || !query.trim()) {
            searchResults.push({
              id: note.id,
              type: 'note',
              title: note.title || 'Unbenannte Notiz',
              subtitle: note.content?.slice(0, 80),
              date: note.updated_at,
              tags: note.tags || [],
              isFavorite: note.is_favorite,
              matchScore: score,
            });
          }
        });
      }

      // Search files
      if (activeTypes.includes('file')) {
        let filesQuery = supabase
          .from('files')
          .select('id, filename, mime_type, size, uploaded_at, tags, is_favorite')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (filters.dateFrom) {
          filesQuery = filesQuery.gte('uploaded_at', filters.dateFrom.toISOString());
        }
        if (filters.dateTo) {
          filesQuery = filesQuery.lte('uploaded_at', filters.dateTo.toISOString());
        }
        if (filters.sizeMin !== undefined) {
          filesQuery = filesQuery.gte('size', filters.sizeMin);
        }
        if (filters.sizeMax !== undefined) {
          filesQuery = filesQuery.lte('size', filters.sizeMax);
        }
        if (filters.isFavorite !== undefined) {
          filesQuery = filesQuery.eq('is_favorite', filters.isFavorite);
        }

        const { data: files } = await filesQuery;

        files?.forEach(file => {
          const score = calculateMatchScore(
            file.filename || '',
            file.mime_type || '',
            parsed,
            file.tags || [],
            filters.tags || []
          );

          if (score > 0 || !query.trim()) {
            searchResults.push({
              id: file.id,
              type: 'file',
              title: file.filename,
              subtitle: file.mime_type,
              date: file.uploaded_at,
              size: file.size,
              tags: file.tags || [],
              isFavorite: file.is_favorite,
              matchScore: score,
            });
          }
        });
      }

      // Search photos
      if (activeTypes.includes('photo')) {
        let photosQuery = supabase
          .from('photos')
          .select('id, filename, caption, uploaded_at, tags, is_favorite')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (filters.dateFrom) {
          photosQuery = photosQuery.gte('uploaded_at', filters.dateFrom.toISOString());
        }
        if (filters.dateTo) {
          photosQuery = photosQuery.lte('uploaded_at', filters.dateTo.toISOString());
        }
        if (filters.isFavorite !== undefined) {
          photosQuery = photosQuery.eq('is_favorite', filters.isFavorite);
        }

        const { data: photos } = await photosQuery;

        photos?.forEach(photo => {
          const score = calculateMatchScore(
            photo.filename || '',
            photo.caption || '',
            parsed,
            photo.tags || [],
            filters.tags || []
          );

          if (score > 0 || !query.trim()) {
            searchResults.push({
              id: photo.id,
              type: 'photo',
              title: photo.filename,
              subtitle: photo.caption,
              date: photo.uploaded_at,
              tags: photo.tags || [],
              isFavorite: photo.is_favorite,
              matchScore: score,
            });
          }
        });
      }

      // Search links
      if (activeTypes.includes('link')) {
        let linksQuery = supabase
          .from('links')
          .select('id, title, url, description, created_at, tags, is_favorite')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (filters.dateFrom) {
          linksQuery = linksQuery.gte('created_at', filters.dateFrom.toISOString());
        }
        if (filters.dateTo) {
          linksQuery = linksQuery.lte('created_at', filters.dateTo.toISOString());
        }
        if (filters.isFavorite !== undefined) {
          linksQuery = linksQuery.eq('is_favorite', filters.isFavorite);
        }

        const { data: links } = await linksQuery;

        links?.forEach(link => {
          const score = calculateMatchScore(
            link.title || link.url,
            link.description || '',
            parsed,
            link.tags || [],
            filters.tags || []
          );

          if (score > 0 || !query.trim()) {
            searchResults.push({
              id: link.id,
              type: 'link',
              title: link.title || link.url,
              subtitle: link.description,
              date: link.created_at,
              tags: link.tags || [],
              isFavorite: link.is_favorite,
              matchScore: score,
            });
          }
        });
      }

      // Sort by match score (descending), then by date
      searchResults.sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        if (!a.date || !b.date) return 0;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setResults(searchResults);
    } catch (error) {
      console.error('Advanced search error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, isDecoyMode, supabase]);

  const clearResults = useCallback(() => setResults([]), []);

  return { results, loading, search, clearResults };
}

/**
 * Calculate match score for a document
 */
function calculateMatchScore(
  title: string,
  content: string,
  parsed: ParsedQuery,
  itemTags: string[],
  filterTags: string[]
): number {
  let score = 0;
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();
  const tagsLower = itemTags.map(t => t.toLowerCase());

  // Check exclude terms first - if any match, return 0
  for (const excludeTerm of parsed.excludeTerms) {
    if (titleLower.includes(excludeTerm) || contentLower.includes(excludeTerm)) {
      return 0;
    }
  }

  // Check exact phrases
  for (const phrase of parsed.exactPhrases) {
    if (titleLower.includes(phrase)) score += 10;
    else if (contentLower.includes(phrase)) score += 5;
  }

  // Check regular terms
  if (parsed.operator === 'AND') {
    // All terms must match
    const allMatch = parsed.terms.every(term =>
      titleLower.includes(term) || contentLower.includes(term) || tagsLower.some(t => t.includes(term))
    );
    if (!allMatch && parsed.terms.length > 0) return 0;
    
    // Score based on where matches occur
    for (const term of parsed.terms) {
      if (titleLower.includes(term)) score += 5;
      if (contentLower.includes(term)) score += 2;
      if (tagsLower.some(t => t.includes(term))) score += 3;
    }
  } else {
    // OR - any term can match
    for (const term of parsed.terms) {
      if (titleLower.includes(term)) score += 5;
      if (contentLower.includes(term)) score += 2;
      if (tagsLower.some(t => t.includes(term))) score += 3;
    }
  }

  // Tag filter bonus
  if (filterTags.length > 0) {
    const matchingTags = filterTags.filter(ft => 
      itemTags.some(it => it.toLowerCase() === ft.toLowerCase())
    );
    score += matchingTags.length * 3;
  }

  // Base score for empty query (show all)
  if (parsed.terms.length === 0 && parsed.exactPhrases.length === 0) {
    score = 1;
  }

  return score;
}
