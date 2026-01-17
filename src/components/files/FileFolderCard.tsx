import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  Folder,
  Music,
  BookOpen,
  Archive,
  Briefcase,
  Camera,
  Film,
  Heart,
  Home,
  Image as ImageIcon,
  Inbox,
  Layers,
  Package,
  Pin,
  PinOff,
  FolderPlus,
  Pencil,
  Trash2,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FileAlbum {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  is_pinned?: boolean;
  parent_id?: string | null;
}

interface FileFolderCardProps {
  album: FileAlbum;
  fileCount: number;
  onClick: () => void;
  onCreateSubfolder: () => void;
  onEdit: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

const getIconComponent = (iconName: string, color: string, size: string = "w-10 h-10") => {
  const icons: Record<string, React.ReactNode> = {
    folder: <Folder className={size} style={{ color }} />,
    music: <Music className={size} style={{ color }} />,
    book: <BookOpen className={size} style={{ color }} />,
    archive: <Archive className={size} style={{ color }} />,
    briefcase: <Briefcase className={size} style={{ color }} />,
    camera: <Camera className={size} style={{ color }} />,
    film: <Film className={size} style={{ color }} />,
    heart: <Heart className={size} style={{ color }} />,
    home: <Home className={size} style={{ color }} />,
    image: <ImageIcon className={size} style={{ color }} />,
    inbox: <Inbox className={size} style={{ color }} />,
    layers: <Layers className={size} style={{ color }} />,
    package: <Package className={size} style={{ color }} />,
  };
  return icons[iconName] || icons.folder;
};

export const FileFolderCard = memo(function FileFolderCard({
  album,
  fileCount,
  onClick,
  onCreateSubfolder,
  onEdit,
  onTogglePin,
  onDelete,
}: FileFolderCardProps) {
  const color = album.color || '#6366f1';
  const iconName = album.icon || 'folder';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative cursor-pointer rounded-2xl p-4 transition-all duration-200 group bg-card/50 hover:bg-card border border-border/50 hover:border-border hover:shadow-lg hover:shadow-black/5"
    >
      <div className="flex flex-col items-center text-center">
        <div 
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center mb-3"
          style={{ backgroundColor: `${color}15` }}
        >
          {getIconComponent(iconName, color)}
        </div>
        <h4 className="text-sm font-medium text-foreground truncate w-full">{album.name}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{fileCount} Dateien</p>
      </div>
      
      {/* Pin indicator */}
      {album.is_pinned && (
        <div className="absolute top-2 left-2">
          <div className="p-1 rounded-md bg-primary/10">
            <Pin className="w-3 h-3 text-primary" />
          </div>
        </div>
      )}
      
      {/* Actions Menu */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg bg-background/80 hover:bg-background border border-border/50 transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateSubfolder(); }}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Unterordner erstellen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="w-4 h-4 mr-2" />
              Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(); }}>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
});
