import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  Folder, 
  FolderPlus, 
  Image as ImageIcon, 
  Pin, 
  PinOff, 
  MoreVertical,
  Pencil,
  Trash2,
  Music,
  BookOpen,
  Archive,
  Briefcase,
  Camera,
  Film,
  Heart,
  Home,
  Inbox,
  Layers,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface Album {
  id: string;
  name: string;
  created_at: string;
  parent_id?: string | null;
  cover_url?: string;
  count?: number;
  is_pinned?: boolean;
  color?: string;
  icon?: string;
  children?: Album[];
  depth?: number;
}

interface AlbumCardProps {
  album: Album;
  onSelect: (album: Album) => void;
  onEdit?: (album: Album) => void;
  onDelete?: (album: Album) => void;
  onTogglePin?: (albumId: string) => void;
  onCreateSubAlbum?: (parentId: string) => void;
  onDragOver?: (e: React.DragEvent, albumId: string) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, albumId: string) => void;
  isDragOver?: boolean;
  hasMedia?: boolean;
}

const getAlbumIcon = (iconId: string, color: string, className?: string) => {
  const iconProps = { className: cn("w-6 h-6", className), style: { color } };
  const icons: Record<string, React.ReactNode> = {
    folder: <Folder {...iconProps} />,
    music: <Music {...iconProps} />,
    book: <BookOpen {...iconProps} />,
    archive: <Archive {...iconProps} />,
    briefcase: <Briefcase {...iconProps} />,
    camera: <Camera {...iconProps} />,
    film: <Film {...iconProps} />,
    heart: <Heart {...iconProps} />,
    home: <Home {...iconProps} />,
    image: <ImageIcon {...iconProps} />,
    inbox: <Inbox {...iconProps} />,
    layers: <Layers {...iconProps} />,
    package: <Package {...iconProps} />,
  };
  return icons[iconId] || icons.folder;
};

export const AlbumCard = memo(function AlbumCard({
  album,
  onSelect,
  onEdit,
  onDelete,
  onTogglePin,
  onCreateSubAlbum,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver = false,
  hasMedia = false,
}: AlbumCardProps) {
  const color = album.color || '#6366f1';
  const iconId = album.icon || 'folder';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative group cursor-pointer transition-all",
        isDragOver && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={() => onSelect(album)}
      onDragOver={(e) => onDragOver?.(e, album.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop?.(e, album.id)}
    >
      {/* Album Cover */}
      <div 
        className="aspect-square rounded-xl overflow-hidden relative"
        style={{ backgroundColor: `${color}15` }}
      >
        {album.cover_url ? (
          <img 
            src={album.cover_url} 
            alt={album.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {getAlbumIcon(iconId, color, "w-16 h-16 opacity-50")}
          </div>
        )}

        {/* Pinned Indicator */}
        {album.is_pinned && (
          <div className="absolute top-2 left-2">
            <Pin className="w-4 h-4 text-primary" fill="currentColor" />
          </div>
        )}

        {/* Dropdown Menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4 text-white" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-48 bg-popover border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {onTogglePin && (
                <DropdownMenuItem onClick={() => onTogglePin(album.id)}>
                  {album.is_pinned ? (
                    <>
                      <PinOff className="w-4 h-4 mr-2" />
                      Loslösen
                    </>
                  ) : (
                    <>
                      <Pin className="w-4 h-4 mr-2" />
                      Anpinnen
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(album)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Bearbeiten
                </DropdownMenuItem>
              )}
              {onCreateSubAlbum && (
                <DropdownMenuItem onClick={() => onCreateSubAlbum(album.id)}>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Unterordner erstellen
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDelete(album)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Löschen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Count Badge */}
        {typeof album.count === 'number' && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs">
            {album.count}
          </div>
        )}
      </div>

      {/* Album Name */}
      <div className="mt-2 flex items-center gap-2">
        {getAlbumIcon(iconId, color, "w-4 h-4")}
        <span className="text-sm font-medium text-foreground truncate">{album.name}</span>
      </div>
    </motion.div>
  );
});

export default AlbumCard;
