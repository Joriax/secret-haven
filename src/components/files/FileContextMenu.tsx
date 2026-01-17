import React, { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  Tag, 
  Folder, 
  Download, 
  Pencil, 
  Trash2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileItem {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  is_favorite?: boolean;
  tags?: string[];
  url?: string;
  album_id?: string | null;
}

interface FileContextMenuProps {
  isOpen: boolean;
  file: FileItem | null;
  position: { x: number; y: number };
  onClose: () => void;
  onToggleFavorite: (file: FileItem) => void;
  onShowTagSelector: (id: string) => void;
  onMoveToAlbum: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
}

export const FileContextMenu = memo(function FileContextMenu({
  isOpen,
  file,
  position,
  onClose,
  onToggleFavorite,
  onShowTagSelector,
  onMoveToAlbum,
  onDownload,
  onRename,
  onDelete,
}: FileContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('click', handleClick);
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && file && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[100] min-w-[200px] py-2 bg-card border border-border rounded-xl shadow-xl"
          style={{
            left: Math.min(position.x, window.innerWidth - 220),
            top: Math.min(position.y, window.innerHeight - 320),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onToggleFavorite(file);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Star className={cn("w-4 h-4", file.is_favorite ? "text-yellow-500 fill-yellow-500" : "")} />
            {file.is_favorite ? 'Favorit entfernen' : 'Als Favorit'}
          </button>
          <button
            onClick={() => {
              onShowTagSelector(file.id);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Tag className="w-4 h-4" />
            Tags bearbeiten
          </button>
          <button
            onClick={() => {
              onMoveToAlbum(file);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Folder className="w-4 h-4" />
            In Album verschieben
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onClick={() => {
              onDownload(file);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4" />
            Herunterladen
          </button>
          <button
            onClick={() => {
              onRename(file);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Umbenennen
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onClick={() => {
              onDelete(file);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Löschen
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
