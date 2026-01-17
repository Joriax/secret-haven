import React, { memo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Star, 
  Tag, 
  Folder, 
  Download, 
  Share2, 
  Trash2, 
  Pencil 
} from 'lucide-react';

interface MediaItem {
  id: string;
  filename: string;
  caption: string;
  album_id: string | null;
  taken_at: string;
  uploaded_at: string;
  url?: string;
  thumbnail_url?: string;
  is_favorite?: boolean;
  type: 'photo' | 'video';
  mime_type?: string;
  tags?: string[];
  duration?: number;
}

interface PhotoContextMenuProps {
  isOpen: boolean;
  item: MediaItem | null;
  position: { x: number; y: number };
  onClose: () => void;
  onToggleFavorite: (item: MediaItem) => void;
  onShowTagSelector: (id: string | null) => void;
  onMoveToAlbum: (item: MediaItem) => void;
  onShareToAlbum: (item: MediaItem) => void;
  onDownload: (item: MediaItem) => void;
  onRename: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

export const PhotoContextMenu = memo(function PhotoContextMenu({
  isOpen,
  item,
  position,
  onClose,
  onToggleFavorite,
  onShowTagSelector,
  onMoveToAlbum,
  onShareToAlbum,
  onDownload,
  onRename,
  onDelete,
}: PhotoContextMenuProps) {
  // Close on escape or click outside
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

  if (!isOpen || !item) return null;

  const menuItems = [
    {
      icon: Star,
      label: item.is_favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten',
      onClick: () => { onToggleFavorite(item); onClose(); },
      className: item.is_favorite ? 'text-yellow-500' : '',
    },
    {
      icon: Tag,
      label: 'Tags bearbeiten',
      onClick: () => { onShowTagSelector(item.id); onClose(); },
    },
    {
      icon: Folder,
      label: 'In Album verschieben',
      onClick: () => { onMoveToAlbum(item); onClose(); },
    },
    {
      icon: Share2,
      label: 'In geteiltes Album',
      onClick: () => { onShareToAlbum(item); onClose(); },
    },
    {
      icon: Download,
      label: 'Herunterladen',
      onClick: () => { onDownload(item); onClose(); },
    },
    {
      icon: Pencil,
      label: 'Umbenennen',
      onClick: () => { onRename(item); onClose(); },
    },
    {
      icon: Trash2,
      label: 'Löschen',
      onClick: () => { onDelete(item); onClose(); },
      className: 'text-destructive hover:bg-destructive/10',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed z-50 glass-card p-2 min-w-[180px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 200),
        top: Math.min(position.y, window.innerHeight - 300),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((menuItem, index) => (
        <button
          key={index}
          onClick={menuItem.onClick}
          className={`w-full px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-colors hover:bg-muted text-sm ${menuItem.className || ''}`}
        >
          <menuItem.icon className="w-4 h-4" />
          {menuItem.label}
        </button>
      ))}
    </motion.div>
  );
});
