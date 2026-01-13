import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Tag, FolderOpen, Star, RotateCcw, Share2, CheckCheck, Calendar, ChevronDown } from 'lucide-react';
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
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
        >
          <div className="glass-card flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 max-w-[95vw] overflow-x-auto">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-medium text-sm">
                {selectedCount}
              </span>
              <span className="text-white/80 text-sm">
                ausgewählt{totalCount ? ` / ${totalCount}` : ''}
              </span>
            </div>

            <div className="h-6 w-px bg-white/20" />

            <div className="flex items-center gap-1">
              {/* Select All Button */}
              {onSelectAll && totalCount && selectedCount < totalCount && (
                <ActionButton 
                  icon={CheckCheck} 
                  label="Alle auswählen" 
                  onClick={onSelectAll} 
                  variant="primary" 
                />
              )}

              {/* Quick Select Dropdown */}
              {hasQuickSelect && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg transition-colors text-sm text-white/80 hover:bg-white/10"
                      title="Schnellauswahl"
                    >
                      <Tag className="w-4 h-4" />
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top" className="w-56 max-h-80 overflow-y-auto">
                    {onSelectByTag && availableTags.length > 0 && (
                      <>
                        <DropdownMenuLabel className="flex items-center gap-2">
                          <Tag className="w-3 h-3" />
                          Nach Tag auswählen
                        </DropdownMenuLabel>
                        {availableTags.map(tag => (
                          <DropdownMenuItem
                            key={tag.id}
                            onClick={() => onSelectByTag(tag.id)}
                            className="flex items-center gap-2"
                          >
                            <span 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: tag.color }} 
                            />
                            {tag.name}
                          </DropdownMenuItem>
                        ))}
                        {onSelectByDate && availableDates.length > 0 && <DropdownMenuSeparator />}
                      </>
                    )}
                    {onSelectByDate && availableDates.length > 0 && (
                      <>
                        <DropdownMenuLabel className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          Nach Datum auswählen
                        </DropdownMenuLabel>
                        {availableDates.slice(0, 10).map(dateOption => (
                          <DropdownMenuItem
                            key={dateOption.date}
                            onClick={() => onSelectByDate(dateOption.date)}
                            className="flex items-center justify-between"
                          >
                            <span>{dateOption.label}</span>
                            <span className="text-xs text-muted-foreground">{dateOption.count}</span>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {isTrash ? (
                <>
                  {onRestore && (
                    <ActionButton icon={RotateCcw} label="Wiederherstellen" onClick={onRestore} />
                  )}
                  <ActionButton icon={Trash2} label="Endgültig löschen" onClick={onDelete} variant="danger" />
                </>
              ) : (
                <>
                  {onShare && (
                    <ActionButton icon={Share2} label="Teilen" onClick={onShare} variant="primary" />
                  )}
                  {onFavorite && (
                    <ActionButton icon={Star} label="Favorit" onClick={onFavorite} />
                  )}
                  {onTag && (
                    <ActionButton icon={Tag} label="Tags" onClick={onTag} />
                  )}
                  {onMove && (
                    <ActionButton icon={FolderOpen} label="Verschieben" onClick={onMove} />
                  )}
                  <ActionButton icon={Trash2} label="Löschen" onClick={onDelete} variant="danger" />
                </>
              )}
            </div>

            <div className="h-6 w-px bg-white/20" />

            <button
              onClick={onClear}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'primary';
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, onClick, variant = 'default' }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm",
      variant === 'danger'
        ? "text-red-400 hover:bg-red-500/10"
        : variant === 'primary'
        ? "text-primary hover:bg-primary/10"
        : "text-white/80 hover:bg-white/10"
    )}
    title={label}
  >
    <Icon className="w-4 h-4" />
    <span className="hidden md:inline">{label}</span>
  </button>
);
