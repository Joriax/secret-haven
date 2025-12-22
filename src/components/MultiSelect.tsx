import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Tag, FolderOpen, Star, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiSelectBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onTag?: () => void;
  onMove?: () => void;
  onFavorite?: () => void;
  onRestore?: () => void;
  isTrash?: boolean;
}

export const MultiSelectBar: React.FC<MultiSelectBarProps> = ({
  selectedCount,
  onClear,
  onDelete,
  onTag,
  onMove,
  onFavorite,
  onRestore,
  isTrash = false
}) => {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
        >
          <div className="glass-card flex items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-medium text-sm">
                {selectedCount}
              </span>
              <span className="text-white/80 text-sm">ausgewählt</span>
            </div>

            <div className="h-6 w-px bg-white/20" />

            <div className="flex items-center gap-1">
              {isTrash ? (
                <>
                  {onRestore && (
                    <ActionButton icon={RotateCcw} label="Wiederherstellen" onClick={onRestore} />
                  )}
                  <ActionButton icon={Trash2} label="Endgültig löschen" onClick={onDelete} variant="danger" />
                </>
              ) : (
                <>
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
  variant?: 'default' | 'danger';
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, onClick, variant = 'default' }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm",
      variant === 'danger'
        ? "text-red-400 hover:bg-red-500/10"
        : "text-white/80 hover:bg-white/10"
    )}
    title={label}
  >
    <Icon className="w-4 h-4" />
    <span className="hidden md:inline">{label}</span>
  </button>
);
