import React, { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderPlus, ChevronRight, ChevronLeft, ChevronDown, 
  Trash2, Pin, PinOff, Pencil, Folder, Star, Heart, 
  Video, Music, Image as ImageIcon, Plus, MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HierarchicalAlbum } from '@/hooks/useHierarchicalAlbums';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: Folder,
  star: Star,
  heart: Heart,
  image: ImageIcon,
  video: Video,
  music: Music,
};

interface UnifiedAlbumSidebarProps {
  albums: HierarchicalAlbum[];
  flattenedAlbums: HierarchicalAlbum[];
  isOpen: boolean;
  onToggle: () => void;
  dragOverAlbum: string | null;
  onDragOver: (e: React.DragEvent, albumId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, albumId: string) => void;
  onCreateAlbum: (parentId?: string | null) => void;
  onDeleteAlbum?: (albumId: string) => void;
  onTogglePin?: (albumId: string) => void;
  onEditAlbum?: (album: HierarchicalAlbum) => void;
  selectedAlbum?: HierarchicalAlbum | null;
  onSelectAlbum?: (album: HierarchicalAlbum | null) => void;
  title?: string;
  dragHintText?: string;
}

interface AlbumItemProps {
  album: HierarchicalAlbum;
  isSelected: boolean;
  isDragOver: boolean;
  expandedAlbums: Set<string>;
  onToggleExpand: (albumId: string) => void;
  onDragOver: (e: React.DragEvent, albumId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, albumId: string) => void;
  onSelect: (album: HierarchicalAlbum) => void;
  onEdit?: (album: HierarchicalAlbum) => void;
  onTogglePin?: (albumId: string) => void;
  onDelete?: (albumId: string) => void;
  onCreateSub: (parentId: string) => void;
}

const AlbumItem = memo(function AlbumItem({
  album,
  isSelected,
  isDragOver,
  expandedAlbums,
  onToggleExpand,
  onDragOver,
  onDragLeave,
  onDrop,
  onSelect,
  onEdit,
  onTogglePin,
  onDelete,
  onCreateSub,
}: AlbumItemProps) {
  const hasChildren = album.children && album.children.length > 0;
  const isExpanded = expandedAlbums.has(album.id);
  const depth = album.depth || 0;
  const IconComponent = iconMap[album.icon || 'folder'] || Folder;

  return (
    <div>
      <motion.div
        onDragOver={(e) => onDragOver(e, album.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, album.id)}
        className={cn(
          "rounded-xl overflow-hidden transition-all cursor-pointer group",
          isSelected 
            ? "bg-primary/10 ring-1 ring-primary/50"
            : isDragOver 
            ? "ring-2 ring-primary scale-[1.02] bg-primary/10" 
            : "hover:bg-muted/50"
        )}
        style={{ marginLeft: depth * 12 }}
      >
        <div className="flex items-center gap-2 p-2">
          {/* Expand/Collapse button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) onToggleExpand(album.id);
            }}
            className={cn(
              "p-0.5 rounded transition-all flex-shrink-0",
              hasChildren ? "hover:bg-muted" : "opacity-0 pointer-events-none"
            )}
          >
            {hasChildren && (
              isExpanded 
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>

          {/* Album Thumbnail */}
          <div 
            className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{ backgroundColor: album.color || '#6366f1' }}
            onClick={() => onSelect(album)}
          >
            {album.cover_url ? (
              <img
                src={album.cover_url}
                alt={album.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <IconComponent className="w-4 h-4 text-white" />
            )}
          </div>

          {/* Album Info */}
          <div className="flex-1 min-w-0" onClick={() => onSelect(album)}>
            <div className="flex items-center gap-1">
              {album.is_pinned && (
                <Pin className="w-3 h-3 text-primary flex-shrink-0" />
              )}
              <p className="font-medium text-foreground text-sm truncate">
                {album.name}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {album.count || 0} Elemente
            </p>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onCreateSub(album.id)}>
                <Plus className="h-4 w-4 mr-2" />
                Unterordner erstellen
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(album)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Bearbeiten
                </DropdownMenuItem>
              )}
              {onTogglePin && (
                <DropdownMenuItem onClick={() => onTogglePin(album.id)}>
                  {album.is_pinned ? (
                    <>
                      <PinOff className="h-4 w-4 mr-2" />
                      Loslösen
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4 mr-2" />
                      Anpinnen
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDelete(album.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Löschen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Drop Indicator */}
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-3 pb-2"
          >
            <div className="w-full py-1 rounded bg-primary/20 text-center">
              <span className="text-xs text-primary font-medium">Hier ablegen</span>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {album.children!.map((child) => (
              <AlbumItem
                key={child.id}
                album={child}
                isSelected={false}
                isDragOver={false}
                expandedAlbums={expandedAlbums}
                onToggleExpand={onToggleExpand}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onSelect={onSelect}
                onEdit={onEdit}
                onTogglePin={onTogglePin}
                onDelete={onDelete}
                onCreateSub={onCreateSub}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export const UnifiedAlbumSidebar = memo(function UnifiedAlbumSidebar({
  albums,
  flattenedAlbums,
  isOpen,
  onToggle,
  dragOverAlbum,
  onDragOver,
  onDragLeave,
  onDrop,
  onCreateAlbum,
  onDeleteAlbum,
  onTogglePin,
  onEditAlbum,
  selectedAlbum,
  onSelectAlbum,
  title = 'Alben',
  dragHintText = 'Element auf Ordner ziehen',
}: UnifiedAlbumSidebarProps) {
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((albumId: string) => {
    setExpandedAlbums(prev => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });
  }, []);

  const handleCreateSub = useCallback((parentId: string) => {
    // Expand parent when creating sub-album
    setExpandedAlbums(prev => new Set(prev).add(parentId));
    onCreateAlbum(parentId);
  }, [onCreateAlbum]);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-40 p-2 rounded-l-xl bg-card border border-r-0 border-border shadow-lg transition-all hover:bg-muted",
          isOpen && "right-64"
        )}
      >
        {isOpen ? (
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{ 
          x: isOpen ? 0 : 256,
          opacity: isOpen ? 1 : 0 
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 w-64 bg-card border-l border-border z-30 flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <button
              onClick={() => onCreateAlbum(null)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Neuer Ordner"
            >
              <FolderPlus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {dragHintText}
          </p>
        </div>

        {/* All Items Option */}
        <div className="px-2 pt-2">
          <button
            onClick={() => onSelectAlbum?.(null)}
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-xl transition-all",
              selectedAlbum === null
                ? "bg-primary/10 ring-1 ring-primary/50"
                : "hover:bg-muted/50"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Folder className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-foreground text-sm">Alle anzeigen</p>
              <p className="text-xs text-muted-foreground">
                Alle Elemente
              </p>
            </div>
          </button>
        </div>

        {/* Albums List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {albums.length === 0 ? (
            <div className="text-center py-8">
              <FolderPlus className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Keine Ordner</p>
              <button
                onClick={() => onCreateAlbum(null)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Ordner erstellen
              </button>
            </div>
          ) : (
            albums.map((album) => (
              <AlbumItem
                key={album.id}
                album={album}
                isSelected={selectedAlbum?.id === album.id}
                isDragOver={dragOverAlbum === album.id}
                expandedAlbums={expandedAlbums}
                onToggleExpand={toggleExpand}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onSelect={(a) => onSelectAlbum?.(a)}
                onEdit={onEditAlbum}
                onTogglePin={onTogglePin}
                onDelete={onDeleteAlbum}
                onCreateSub={handleCreateSub}
              />
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            📁 {dragHintText}
          </p>
        </div>
      </motion.div>
    </>
  );
});
