import React, { useState, memo, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  Check,
  X,
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
  Video
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Album {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  parent_id?: string | null;
  children?: Album[];
  count?: number;
}

interface HierarchicalAlbumPickerProps {
  albums: Album[];
  selectedAlbumId: string | null;
  onSelect: (albumId: string | null) => void;
  onClose: () => void;
  title?: string;
  showNoAlbumOption?: boolean;
  itemName?: string;
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

interface AlbumTreeItemProps {
  album: Album;
  depth: number;
  selectedAlbumId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (albumId: string) => void;
}

const AlbumTreeItem = memo(function AlbumTreeItem({
  album,
  depth,
  selectedAlbumId,
  expandedIds,
  onToggleExpand,
  onSelect,
}: AlbumTreeItemProps) {
  const hasChildren = album.children && album.children.length > 0;
  const isExpanded = expandedIds.has(album.id);
  const isSelected = selectedAlbumId === album.id;
  const IconComponent = iconMap[album.icon || 'folder'] || Folder;
  const color = album.color || '#6366f1';

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(album.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(album.id);
          }
        }}
        className={cn(
          "w-full flex items-center gap-2 p-2.5 rounded-xl transition-all text-left group",
          isSelected 
            ? "bg-primary/10 ring-1 ring-primary/50" 
            : "hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {/* Expand/Collapse button */}
        <button
          type="button"
          aria-label={hasChildren ? (isExpanded ? 'Ordner einklappen' : 'Ordner ausklappen') : undefined}
          aria-expanded={hasChildren ? isExpanded : undefined}
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
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Icon */}
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <IconComponent className="w-4 h-4" style={{ color }} />
        </div>

        {/* Name */}
        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {album.name}
        </span>

        {/* Count */}
        {typeof album.count === 'number' && (
          <span className="text-xs text-muted-foreground mr-1">
            {album.count}
          </span>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </div>

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
              <AlbumTreeItem
                key={child.id}
                album={child}
                depth={depth + 1}
                selectedAlbumId={selectedAlbumId}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Build hierarchical tree from flat album list
function buildAlbumTree(albums: Album[]): Album[] {
  const albumMap = new Map<string, Album>();
  const roots: Album[] = [];

  // First pass: create map of all albums with children array
  albums.forEach(album => {
    albumMap.set(album.id, { ...album, children: [] });
  });

  // Second pass: build tree structure
  albums.forEach(album => {
    const node = albumMap.get(album.id)!;
    if (album.parent_id && albumMap.has(album.parent_id)) {
      const parent = albumMap.get(album.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort: pinned first, then alphabetically
  const sortAlbums = (arr: Album[]) => {
    arr.sort((a, b) => a.name.localeCompare(b.name));
    arr.forEach(album => {
      if (album.children && album.children.length > 0) {
        sortAlbums(album.children);
      }
    });
  };
  sortAlbums(roots);

  return roots;
}

export const HierarchicalAlbumPicker = memo(
  forwardRef<HTMLDivElement, HierarchicalAlbumPickerProps>(function HierarchicalAlbumPicker(
    {
      albums,
      selectedAlbumId,
      onSelect,
      onClose,
      title = 'In Album verschieben',
      showNoAlbumOption = true,
      itemName,
    },
    ref
  ) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Auto-expand parent of selected album
    if (!selectedAlbumId) return new Set<string>();
    
    const expanded = new Set<string>();
    let current = albums.find(a => a.id === selectedAlbumId);
    while (current?.parent_id) {
      expanded.add(current.parent_id);
      current = albums.find(a => a.id === current!.parent_id);
    }
    return expanded;
  });

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback((albumId: string | null) => {
    onSelect(albumId);
  }, [onSelect]);

  const albumTree = buildAlbumTree(albums);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          {itemName && (
            <p className="text-sm text-muted-foreground mt-1 truncate">{itemName}</p>
          )}
        </div>

        {/* Album List */}
        <ScrollArea className="h-[50vh] max-h-[400px]">
          <div className="p-2 space-y-1">
            {/* No Album Option */}
            {showNoAlbumOption && (
              <button
                onClick={() => handleSelect(null)}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all",
                  selectedAlbumId === null 
                    ? "bg-primary/10 ring-1 ring-primary/50" 
                    : "hover:bg-muted/50"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Folder className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground text-left">
                  Kein Album
                </span>
                {selectedAlbumId === null && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            )}

            {/* Album Tree */}
            {albumTree.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Keine Alben vorhanden
              </div>
            ) : (
              albumTree.map((album) => (
                <AlbumTreeItem
                  key={album.id}
                  album={album}
                  depth={0}
                  selectedAlbumId={selectedAlbumId}
                  expandedIds={expandedIds}
                  onToggleExpand={toggleExpand}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-all text-sm font-medium"
          >
            Abbrechen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
  })
);

export default HierarchicalAlbumPicker;
