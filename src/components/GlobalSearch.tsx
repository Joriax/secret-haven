import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, FileText, Image, FolderOpen, Music, Lock } from 'lucide-react';
import { useGlobalSearch, SearchResult } from '@/hooks/useGlobalSearch';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeIcons: Record<string, React.ElementType> = {
  note: FileText,
  photo: Image,
  file: FolderOpen,
  album: Music,
  secret_text: Lock
};

const typeLabels: Record<string, string> = {
  note: 'Notiz',
  photo: 'Foto',
  file: 'Datei',
  album: 'Album',
  secret_text: 'Geheimer Text'
};

const typeRoutes: Record<string, string> = {
  note: '/notes',
  photo: '/photos',
  file: '/files',
  album: '/photos',
  secret_text: '/secret-texts'
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const { results, loading, search, clearResults } = useGlobalSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setQuery('');
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
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 p-4"
          >
            <div className="glass-card overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 border-b border-white/10">
                <Search className="w-5 h-5 text-white/50" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Suche über alles..."
                  className="flex-1 bg-transparent text-white placeholder:text-white/40 outline-none text-lg"
                />
                <kbd className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-white/40 text-xs">
                  <span>ESC</span>
                </kbd>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
                  <X className="w-5 h-5 text-white/50" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto">
                {loading && (
                  <div className="p-8 text-center text-white/50">
                    Suche...
                  </div>
                )}

                {!loading && query.length >= 2 && results.length === 0 && (
                  <div className="p-8 text-center text-white/50">
                    Keine Ergebnisse für "{query}"
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <div className="p-2">
                    {results.map((result, index) => {
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
                            "hover:bg-white/10 transition-colors text-left"
                          )}
                        >
                          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{result.title}</p>
                            <p className="text-white/50 text-sm truncate">
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
                  <div className="p-8 text-center text-white/40 text-sm">
                    Mindestens 2 Zeichen eingeben
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
