import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, FileText, Image, FolderOpen, Music, Lock, Filter, Link2, Play } from 'lucide-react';
import { useGlobalSearch, SearchResult } from '@/hooks/useGlobalSearch';
import { useTags } from '@/hooks/useTags';
import { useSavedSearches, SavedSearch } from '@/hooks/useSavedSearches';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { GlobalSearchFilters } from './GlobalSearchFilters';
import { SavedSearches } from './SavedSearches';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeIcons: Record<string, React.ElementType> = {
  note: FileText,
  photo: Image,
  file: FolderOpen,
  album: Music,
  secret_text: Lock,
  link: Link2,
  tiktok: Play
};

const typeLabels: Record<string, string> = {
  note: 'Notiz',
  photo: 'Foto',
  file: 'Datei',
  album: 'Album',
  secret_text: 'Geheimer Text',
  link: 'Link',
  tiktok: 'TikTok'
};

const typeRoutes: Record<string, string> = {
  note: '/notes',
  photo: '/photos',
  file: '/files',
  album: '/photos',
  secret_text: '/secret-texts',
  link: '/links',
  tiktok: '/tiktok'
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const { results, loading, search, clearResults } = useGlobalSearch();
  const { tags } = useTags();
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setQuery('');
      setShowFilters(false);
      clearResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.length >= 2) {
        search(query);
      } else {
        clearResults();
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, search, clearResults]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleResultClick = (result: SearchResult) => {
    navigate(typeRoutes[result.type], { state: { selectedId: result.id } });
    onClose();
  };

  const handleSelectSavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query);
    setSelectedTypes(savedSearch.filters.types);
    setSelectedTags(savedSearch.filters.tags);
    setDateRange(savedSearch.filters.dateRange);
    if (savedSearch.filters.types.length > 0 || savedSearch.filters.tags.length > 0 || savedSearch.filters.dateRange !== 'all') {
      setShowFilters(true);
    }
  };

  // Apply filters to results
  const filteredResults = results.filter(result => {
    // Type filter
    if (selectedTypes.length > 0 && !selectedTypes.includes(result.type)) {
      return false;
    }

    // Date filter
    if (dateRange !== 'all' && result.date) {
      const resultDate = new Date(result.date);
      const now = new Date();
      
      switch (dateRange) {
        case 'today':
          if (resultDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (resultDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (resultDate < monthAgo) return false;
          break;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          if (resultDate < yearAgo) return false;
          break;
      }
    }

    return true;
  });

  const hasActiveFilters = selectedTypes.length > 0 || selectedTags.length > 0 || dateRange !== 'all';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Search Modal */}
          <div className="fixed top-[10%] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-50">
            {/* NOTE: framer-motion overrides CSS transforms; keep centering on wrapper */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full"
            >
              <div className="glass-card overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center gap-3 p-4 border-b border-border/30">
                  <Search className="w-5 h-5 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Suche über alles..."
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-lg"
                  />
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      showFilters || hasActiveFilters
                        ? "bg-primary/20 text-primary"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                    title="Filter"
                  >
                    <Filter className="w-4 h-4" />
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                    )}
                  </button>
                  <kbd className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-muted text-muted-foreground text-xs">
                    <span>ESC</span>
                  </kbd>
                  <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Filters */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <GlobalSearchFilters
                        selectedTypes={selectedTypes}
                        onTypeChange={setSelectedTypes}
                        selectedTags={selectedTags}
                        onTagChange={setSelectedTags}
                        dateRange={dateRange}
                        onDateRangeChange={setDateRange}
                        availableTags={tags}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Results */}
                <div className="max-h-[50vh] overflow-y-auto">
                  {loading && (
                    <div className="p-8 text-center text-muted-foreground">
                      Suche...
                    </div>
                  )}

                  {!loading && query.length >= 2 && filteredResults.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      Keine Ergebnisse für "{query}"
                      {hasActiveFilters && (
                        <button
                          onClick={() => {
                            setSelectedTypes([]);
                            setSelectedTags([]);
                            setDateRange('all');
                          }}
                          className="block mx-auto mt-2 text-primary text-sm hover:underline"
                        >
                          Filter zurücksetzen
                        </button>
                      )}
                    </div>
                  )}

                  {!loading && filteredResults.length > 0 && (
                    <div className="p-2">
                      {filteredResults.map((result, index) => {
                        const Icon = typeIcons[result.type] || FileText;
                        return (
                          <motion.button
                            key={`${result.type}-${result.id}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => handleResultClick(result)}
                            className={cn(
                              "w-full flex items-center gap-4 p-3 rounded-xl",
                              "hover:bg-muted transition-colors text-left"
                            )}
                          >
                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground font-medium truncate">{result.title}</p>
                              <p className="text-muted-foreground text-sm truncate">
                                {typeLabels[result.type]} · {result.matchedField}
                                {result.subtitle && ` · ${result.subtitle}`}
                              </p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {!loading && query.length < 2 && (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      Mindestens 2 Zeichen eingeben
                    </div>
                  )}
                </div>

                {/* Saved Searches */}
                <SavedSearches
                  currentQuery={query}
                  currentFilters={{
                    types: selectedTypes,
                    tags: selectedTags,
                    dateRange,
                  }}
                  onSelectSearch={handleSelectSavedSearch}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
