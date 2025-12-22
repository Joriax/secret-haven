import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  StarOff, 
  Trash2, 
  Edit3, 
  Copy, 
  Tag, 
  Share2, 
  FolderOpen,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ItemContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  actions: ContextMenuAction[];
}

export const ItemContextMenu: React.FC<ItemContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  actions
}) => {
  React.useEffect(() => {
    const handleClickOutside = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-50 min-w-[180px] py-2 glass-card"
          style={{
            left: position.x,
            top: position.y,
            transformOrigin: 'top left'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action, index) => (
            <React.Fragment key={action.id}>
              {index > 0 && action.variant === 'danger' && (
                <div className="my-1 border-t border-white/10" />
              )}
              <button
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                disabled={action.disabled}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                  action.disabled && "opacity-50 cursor-not-allowed",
                  action.variant === 'danger'
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-white/80 hover:bg-white/10"
                )}
              >
                <action.icon className="w-4 h-4" />
                {action.label}
              </button>
            </React.Fragment>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Helper to create common actions
export const createContextActions = {
  favorite: (isFavorite: boolean, onToggle: () => void): ContextMenuAction => ({
    id: 'favorite',
    label: isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren',
    icon: isFavorite ? StarOff : Star,
    onClick: onToggle
  }),
  
  rename: (onRename: () => void): ContextMenuAction => ({
    id: 'rename',
    label: 'Umbenennen',
    icon: Edit3,
    onClick: onRename
  }),
  
  copy: (onCopy: () => void): ContextMenuAction => ({
    id: 'copy',
    label: 'Kopieren',
    icon: Copy,
    onClick: onCopy
  }),
  
  tag: (onTag: () => void): ContextMenuAction => ({
    id: 'tag',
    label: 'Tags bearbeiten',
    icon: Tag,
    onClick: onTag
  }),
  
  share: (onShare: () => void): ContextMenuAction => ({
    id: 'share',
    label: 'Teilen',
    icon: Share2,
    onClick: onShare
  }),
  
  move: (onMove: () => void): ContextMenuAction => ({
    id: 'move',
    label: 'Verschieben',
    icon: FolderOpen,
    onClick: onMove
  }),
  
  restore: (onRestore: () => void): ContextMenuAction => ({
    id: 'restore',
    label: 'Wiederherstellen',
    icon: RotateCcw,
    onClick: onRestore
  }),
  
  delete: (onDelete: () => void): ContextMenuAction => ({
    id: 'delete',
    label: 'Löschen',
    icon: Trash2,
    onClick: onDelete,
    variant: 'danger'
  }),
  
  deletePermanently: (onDelete: () => void): ContextMenuAction => ({
    id: 'delete-permanent',
    label: 'Endgültig löschen',
    icon: Trash2,
    onClick: onDelete,
    variant: 'danger'
  })
};
