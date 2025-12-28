import React from 'react';
import { motion } from 'framer-motion';
import { FolderPlus, ChevronRight, ChevronLeft, Image as ImageIcon, Trash2, Pin, PinOff, Pencil, Folder, Star, Heart, Video, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Album {
  id: string;
  name: string;
  cover_url?: string;
  count?: number;
  is_pinned?: boolean;
  color?: string;
  icon?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: Folder,
  star: Star,
  heart: Heart,
  image: Image as any,
  video: Video,
  music: Music,
};

interface AlbumSidebarProps {
  albums: Album[];
  isOpen: boolean;
  onToggle: () => void;
  dragOverAlbum: string | null;
  onDragOver: (e: React.DragEvent, albumId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, albumId: string) => void;
  onCreateAlbum: () => void;
  onDeleteAlbum?: (albumId: string) => void;
  onTogglePin?: (albumId: string) => void;
  onEditAlbum?: (album: Album) => void;
  selectedAlbum?: Album | null;
  onSelectAlbum?: (album: Album | null) => void;
}

export function AlbumSidebar({
  albums,
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
}: AlbumSidebarProps) {
  // Sort albums: pinned first
  const sortedAlbums = [...albums].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
    return 0;
  });

  return (
    <>
      {/* Toggle Button - always visible */}
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
            <h3 className="font-semibold text-foreground">Alben</h3>
            <button
              onClick={onCreateAlbum}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Neues Album"
            >
              <FolderPlus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Fotos hierher ziehen
          </p>
        </div>

        {/* Albums List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sortedAlbums.length === 0 ? (
            <div className="text-center py-8">
              <FolderPlus className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Keine Alben</p>
              <button
                onClick={onCreateAlbum}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Album erstellen
              </button>
            </div>
          ) : (
            sortedAlbums.map((album) => (
              <motion.div
                key={album.id}
                onDragOver={(e) => onDragOver(e, album.id)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, album.id)}
                onClick={() => onSelectAlbum?.(album)}
                className={cn(
                  "rounded-xl overflow-hidden transition-all cursor-pointer group",
                  selectedAlbum?.id === album.id 
                    ? "bg-primary/10 ring-1 ring-primary/50"
                    : dragOverAlbum === album.id 
                    ? "ring-2 ring-primary scale-[1.02] bg-primary/10" 
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3 p-2">
                  {/* Album Thumbnail */}
                  <div 
                    className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: album.color || '#6366f1' }}
                  >
                    {album.cover_url ? (
                      <img
                        src={album.cover_url}
                        alt={album.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (() => {
                        const IconComponent = iconMap[album.icon || 'folder'] || Folder;
                        return <IconComponent className="w-5 h-5 text-white" />;
                      })()
                    )}
                  </div>

                  {/* Album Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {album.is_pinned && (
                        <Pin className="w-3 h-3 text-primary" />
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
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {onEditAlbum && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditAlbum(album);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-all"
                        title="Album bearbeiten"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                    {onTogglePin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(album.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-all"
                        title={album.is_pinned ? 'Loslösen' : 'Anpinnen'}
                      >
                        {album.is_pinned ? (
                          <PinOff className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <Pin className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                    {onDeleteAlbum && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAlbum(album.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-destructive/20 transition-all"
                        title="Album löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Drop Indicator */}
                {dragOverAlbum === album.id && (
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
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            📸 Foto auf Album ziehen zum Hinzufügen
          </p>
        </div>
      </motion.div>
    </>
  );
}
