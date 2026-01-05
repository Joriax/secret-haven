import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, BookmarkPlus, Trash2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSavedSearches, SavedSearch } from '@/hooks/useSavedSearches';
import { cn } from '@/lib/utils';

interface SavedSearchesProps {
  currentQuery: string;
  currentFilters: {
    types: string[];
    tags: string[];
    dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  };
  onSelectSearch: (search: SavedSearch) => void;
}

export const SavedSearches: React.FC<SavedSearchesProps> = ({
  currentQuery,
  currentFilters,
  onSelectSearch,
}) => {
  const { savedSearches, saveSearch, deleteSearch } = useSavedSearches();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');

  const handleSave = () => {
    if (!searchName.trim()) return;
    
    saveSearch(searchName.trim(), currentQuery, currentFilters);
    setSearchName('');
    setShowSaveDialog(false);
  };

  const canSave = currentQuery.length >= 2 || 
    currentFilters.types.length > 0 || 
    currentFilters.tags.length > 0 || 
    currentFilters.dateRange !== 'all';

  return (
    <div className="border-t border-border/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Gespeicherte Suchen</span>
        </div>
        
        {canSave && !showSaveDialog && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSaveDialog(true)}
            className="h-7 text-xs"
          >
            <BookmarkPlus className="w-3.5 h-3.5 mr-1" />
            Speichern
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex gap-2">
              <Input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Name der Suche..."
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setShowSaveDialog(false);
                }}
              />
              <Button size="sm" onClick={handleSave} className="h-8">
                Speichern
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowSaveDialog(false)}
                className="h-8 px-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {savedSearches.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          Keine gespeicherten Suchen
        </p>
      ) : (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {savedSearches.map((search) => (
            <motion.div
              key={search.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg",
                "hover:bg-muted/50 transition-colors group cursor-pointer"
              )}
              onClick={() => onSelectSearch(search)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground truncate">{search.name}</span>
                {search.query && (
                  <span className="text-xs text-muted-foreground truncate">
                    "{search.query}"
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSearch(search.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
