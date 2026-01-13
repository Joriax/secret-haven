import React from 'react';
import { motion } from 'framer-motion';
import { 
  FolderPlus, 
  ChevronRight, 
  ChevronLeft, 
  Folder, 
  Trash2, 
  Pin, 
  PinOff,
  Pencil,
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
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileAlbum } from '@/hooks/useFileAlbums';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FileAlbumSidebarProps {
  albums: FileAlbum[];
  isOpen: boolean;
  onToggle: () => void;
  dragOverAlbum: string | null;
  onDragOver: (e: React.DragEvent, albumId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, albumId: string) => void;
  onCreateAlbum: () => void;
  onDeleteAlbum?: (albumId: string) => void;
  onTogglePin?: (albumId: string) => void;
  onEditAlbum?: (album: FileAlbum) => void;
  selectedAlbum?: FileAlbum | null;
  onSelectAlbum?: (album: FileAlbum | null) => void;
  fileCounts?: Record<string, number>;
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
};

export function FileAlbumSidebar({
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
  fileCounts = {},
}: FileAlbumSidebarProps) {
  // Sort: pinned first
  const sortedAlbums = [...albums].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
    return 0;
  });

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
            <h3 className="font-semibold text-foreground">Datei-Alben</h3>
            <button
              onClick={onCreateAlbum}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Neues Album"
            >
              <FolderPlus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Dateien hierher ziehen
          </p>
        </div>

        {/* All Files Option */}
        <div className="p-2 border-b border-border">
          <button
            onClick={() => onSelectAlbum?.(null)}
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-xl transition-all",
              !selectedAlbum 
                ? "bg-primary/10 ring-1 ring-primary/50"
                : "hover:bg-muted/50"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Folder className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-foreground text-sm">Alle Dateien</p>
            </div>
          </button>
        </div>

        {/* Albums List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
            sortedAlbums.map((album) => {
              const IconComponent = iconMap[album.icon] || Folder;
              
              return (
                <motion.div
                  key={album.id}
                  onDragOver={(e) => onDragOver(e, album.id)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, album.id)}
                  onClick={() => onSelectAlbum?.(album)}
                  className={cn(
                    "rounded-xl overflow-hidden transition-all cursor-pointer group relative",
                    selectedAlbum?.id === album.id 
                      ? "bg-primary/10 ring-1 ring-primary/50"
                      : dragOverAlbum === album.id 
                      ? "ring-2 ring-primary scale-[1.02] bg-primary/10" 
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3 p-2">
                    {/* Album Icon */}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center relative"
                      style={{ backgroundColor: `${album.color}20` }}
                    >
                      <IconComponent className="w-5 h-5" style={{ color: album.color }} />
                      {/* Pinned indicator - subtle corner badge */}
                      {album.is_pinned && (
                        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                          <Pin className="w-2 h-2 text-primary-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Album Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">
                        {album.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fileCounts[album.id] || 0} Dateien
                      </p>
                    </div>

                    {/* Context Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg hover:bg-muted transition-all opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {onEditAlbum && (
                          <DropdownMenuItem onClick={() => onEditAlbum(album)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                        )}
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
                        {onDeleteAlbum && (
                          <DropdownMenuItem 
                            onClick={() => onDeleteAlbum(album.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            📁 Datei auf Album ziehen zum Hinzufügen
          </p>
        </div>
      </motion.div>
    </>
  );
}
