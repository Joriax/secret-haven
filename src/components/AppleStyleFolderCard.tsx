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
  Star,
  Video,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  FolderPlus,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppleStyleFolderCardProps {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  count: number;
  countLabel?: string;
  isPinned?: boolean;
  coverUrl?: string | null;
  isDragOver?: boolean;
  onSelect: () => void;
  onCreateSubfolder?: () => void;
  onEdit?: () => void;
  onTogglePin?: () => void;
  onDelete?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  folder: Folder,
  music: Music,
  book: BookOpen,
  archive: Archive,
  briefcase: Briefcase,
  camera: Camera,
  film: Film,
  heart: Heart,
  home: Home,
  image: ImageIcon,
  inbox: Inbox,
  layers: Layers,
  package: Package,
  star: Star,
  video: Video,
};

export const AppleStyleFolderCard = memo(function AppleStyleFolderCard({
  id,
  name,
  color = '#6366f1',
  icon = 'folder',
  count,
  countLabel = 'Elemente',
  isPinned,
  coverUrl,
  isDragOver,
  onSelect,
  onCreateSubfolder,
  onEdit,
  onTogglePin,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: AppleStyleFolderCardProps) {
  const IconComponent = iconMap[icon || 'folder'] || Folder;
  const folderColor = color || '#6366f1';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative cursor-pointer rounded-2xl p-4 transition-all duration-200 group",
        "bg-card/50 hover:bg-card border border-border/50 hover:border-border",
        "hover:shadow-lg hover:shadow-black/5",
        isDragOver && "ring-2 ring-primary scale-105 bg-primary/5"
      )}
    >
      {/* Folder Icon / Cover */}
      <div className="flex flex-col items-center text-center">
        {coverUrl ? (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden mb-3 shadow-sm">
            <img
              src={coverUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div 
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center mb-3 transition-transform"
            style={{ backgroundColor: `${folderColor}15` }}
          >
            <IconComponent 
              className="w-8 h-8 sm:w-10 sm:h-10" 
              style={{ color: folderColor }} 
            />
          </div>
        )}
        
        {/* Name */}
        <h4 className="text-sm font-medium text-foreground truncate w-full px-1">
          {name}
        </h4>
        
        {/* Count */}
        <p className="text-xs text-muted-foreground mt-0.5">
          {count} {countLabel}
        </p>
      </div>

      {/* Pin Indicator */}
      {isPinned && (
        <div className="absolute top-2 left-2">
          <div className="p-1 rounded-md bg-primary/10">
            <Pin className="w-3 h-3 text-primary" />
          </div>
        </div>
      )}

      {/* Actions Menu */}
      {(onCreateSubfolder || onEdit || onTogglePin || onDelete) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg bg-background/80 hover:bg-background border border-border/50 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onCreateSubfolder && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateSubfolder(); }}>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Unterordner erstellen
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Bearbeiten
                </DropdownMenuItem>
              )}
              {onTogglePin && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(); }}>
                  {isPinned ? (
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
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
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
      )}

      {/* Drag Over Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 rounded-2xl bg-primary/10 flex items-center justify-center pointer-events-none">
          <p className="text-sm font-medium text-primary">Hierher ziehen</p>
        </div>
      )}
    </motion.div>
  );
});

// Grid wrapper for consistent folder layout
interface FolderGridProps {
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  count?: number;
}

export function FolderGrid({ children, title, icon, count }: FolderGridProps) {
  if (React.Children.count(children) === 0) return null;
  
  return (
    <div className="mb-6">
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          {icon}
          {title}
          {count !== undefined && <span className="text-xs">({count})</span>}
        </h3>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {children}
      </div>
    </div>
  );
}
