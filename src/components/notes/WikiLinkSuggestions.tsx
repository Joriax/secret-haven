import React, { memo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Note {
  id: string;
  title: string;
}

interface WikiLinkSuggestionsProps {
  isOpen: boolean;
  query: string;
  suggestions: Note[];
  position: { top: number; left: number };
  onSelect: (note: Note) => void;
  onCreate?: (title: string) => void;
  onClose: () => void;
}

export const WikiLinkSuggestions = memo(function WikiLinkSuggestions({
  isOpen,
  query,
  suggestions,
  position,
  onSelect,
  onCreate,
  onClose
}: WikiLinkSuggestionsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            Math.min(prev + 1, suggestions.length + (onCreate ? 0 : -1))
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex < suggestions.length) {
            onSelect(suggestions[selectedIndex]);
          } else if (onCreate && query) {
            onCreate(query);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, suggestions, query, onSelect, onCreate, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="fixed z-50 w-64 max-h-64 overflow-hidden rounded-xl bg-popover border border-border shadow-lg"
          style={{ top: position.top, left: position.left }}
        >
          <div ref={listRef} className="overflow-y-auto max-h-56">
            {suggestions.length === 0 && !query ? (
              <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                Tippe, um Notizen zu suchen
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                Keine Notizen gefunden
              </div>
            ) : (
              suggestions.map((note, index) => (
                <button
                  key={note.id}
                  onClick={() => onSelect(note)}
                  className={cn(
                    "w-full px-3 py-2 flex items-center gap-2 text-left transition-colors",
                    index === selectedIndex 
                      ? "bg-primary/10 text-foreground" 
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{note.title}</span>
                </button>
              ))
            )}
            
            {onCreate && query && (
              <button
                onClick={() => onCreate(query)}
                className={cn(
                  "w-full px-3 py-2 flex items-center gap-2 text-left border-t border-border transition-colors",
                  selectedIndex === suggestions.length 
                    ? "bg-primary/10 text-foreground" 
                    : "hover:bg-muted text-foreground"
                )}
              >
                <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="truncate">
                  Neue Notiz: <span className="text-primary font-medium">"{query}"</span>
                </span>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default WikiLinkSuggestions;
