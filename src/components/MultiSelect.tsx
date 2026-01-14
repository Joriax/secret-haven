import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Trash2, 
  Tag, 
  FolderOpen, 
  Star, 
  RotateCcw, 
  Share2, 
  CheckCheck, 
  Calendar, 
  ChevronDown,
  MoreHorizontal 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TagOption {
  id: string;
  name: string;
  color: string;
}

interface DateOption {
  date: string;
  label: string;
  count: number;
}

interface MultiSelectBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onTag?: () => void;
  onMove?: () => void;
  onFavorite?: () => void;
  onRestore?: () => void;
  onShare?: () => void;
  onSelectAll?: () => void;
  onSelectByTag?: (tagId: string) => void;
  onSelectByDate?: (date: string) => void;
  totalCount?: number;
  isTrash?: boolean;
  availableTags?: TagOption[];
  availableDates?: DateOption[];
}

export const MultiSelectBar: React.FC<MultiSelectBarProps> = ({
  selectedCount,
  onClear,
  onDelete,
  onTag,
  onMove,
  onFavorite,
  onRestore,
  onShare,
  onSelectAll,
  onSelectByTag,
  onSelectByDate,
  totalCount,
  isTrash = false,
  availableTags = [],
  availableDates = [],
}) => {
  const hasQuickSelect = (onSelectByTag && availableTags.length > 0) || (onSelectByDate && availableDates.length > 0);

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95vw] max-w-lg"
        >
          <div className="glass-card flex items-center justify-between gap-2 px-3 py-3">
            {/* Left: Count */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-medium text-sm">
                {selectedCount}
              </span>
              <span className="text-white/80 text-sm hidden sm:inline">
                ausgewählt{totalCount ? ` / ${totalCount}` : ''}
              </span>
            </div>

            {/* Center: Actions */}
            <div className="flex items-center gap-1">
              {/* Select All Button - visible on desktop */}
              {onSelectAll && totalCount && selectedCount < totalCount && (
                <button
                  onClick={onSelectAll}
                  className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm text-primary hover:bg-primary/10"
                  title="Alle auswählen"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Alle</span>
                </button>
              )}

              {/* Quick Actions - visible on desktop */}
              {isTrash ? (
                <>
                  {onRestore && (
                    <button
                      onClick={onRestore}
                      className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm text-white/80 hover:bg-white/10"
                      title="Wiederherstellen"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={onDelete}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm text-red-400 hover:bg-red-500/10"
                    title="Endgültig löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Löschen</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Primary actions always visible */}
                  <button
                    onClick={onDelete}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-sm text-red-400 hover:bg-red-500/10"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Secondary actions visible on larger screens */}
                  {onShare && (
                    <button
                      onClick={onShare}
                      className="hidden sm:flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-sm text-primary hover:bg-primary/10"
                      title="Teilen"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* More Actions Dropdown - contains all actions for mobile */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1 px-2 py-2 rounded-lg transition-colors text-sm text-white/80 hover:bg-white/10"
                        title="Mehr Aktionen"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" side="top" className="w-52">
                      <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      {/* Select All - mobile */}
                      {onSelectAll && totalCount && selectedCount < totalCount && (
                        <DropdownMenuItem onClick={onSelectAll}>
                          <CheckCheck className="w-4 h-4 mr-2" />
                          Alle auswählen ({totalCount})
                        </DropdownMenuItem>
                      )}

                      {/* Share - mobile fallback */}
                      {onShare && (
                        <DropdownMenuItem onClick={onShare} className="sm:hidden">
                          <Share2 className="w-4 h-4 mr-2" />
                          Teilen
                        </DropdownMenuItem>
                      )}

                      {onFavorite && (
                        <DropdownMenuItem onClick={onFavorite}>
                          <Star className="w-4 h-4 mr-2" />
                          Zu Favoriten
                        </DropdownMenuItem>
                      )}

                      {onTag && (
                        <DropdownMenuItem onClick={onTag}>
                          <Tag className="w-4 h-4 mr-2" />
                          Tags bearbeiten
                        </DropdownMenuItem>
                      )}

                      {onMove && (
                        <DropdownMenuItem onClick={onMove}>
                          <FolderOpen className="w-4 h-4 mr-2" />
                          Verschieben
                        </DropdownMenuItem>
                      )}

                      {/* Quick Select Section */}
                      {hasQuickSelect && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Schnellauswahl</DropdownMenuLabel>
                          
                          {onSelectByTag && availableTags.length > 0 && (
                            availableTags.slice(0, 5).map(tag => (
                              <DropdownMenuItem
                                key={tag.id}
                                onClick={() => onSelectByTag(tag.id)}
                              >
                                <span 
                                  className="w-3 h-3 rounded-full mr-2" 
                                  style={{ backgroundColor: tag.color }} 
                                />
                                Alle mit "{tag.name}"
                              </DropdownMenuItem>
                            ))
                          )}

                          {onSelectByDate && availableDates.length > 0 && (
                            <>
                              {onSelectByTag && availableTags.length > 0 && <DropdownMenuSeparator />}
                              {availableDates.slice(0, 5).map(dateOption => (
                                <DropdownMenuItem
                                  key={dateOption.date}
                                  onClick={() => onSelectByDate(dateOption.date)}
                                >
                                  <Calendar className="w-3 h-3 mr-2" />
                                  {dateOption.label} ({dateOption.count})
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>

            {/* Right: Clear */}
            <button
              onClick={onClear}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0"
              title="Auswahl aufheben"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
