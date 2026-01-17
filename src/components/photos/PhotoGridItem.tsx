import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, 
  MoreVertical, 
  Play, 
  CheckSquare, 
  Square, 
  Tag,
  Download,
  Pencil,
  Trash2,
  Folder,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/hooks/useVideoThumbnail';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface MediaItem {
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

interface PhotoGridItemProps {
  item: MediaItem;
  index: number;
  isMultiSelectMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onView: (index: number) => void;
  onToggleFavorite: (item: MediaItem) => void;
  onDownload: (item: MediaItem) => void;
  onRename: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onMoveToAlbum: (item: MediaItem) => void;
  onManageTags: (itemId: string) => void;
  onShare: (item: MediaItem) => void;
  onDragStart?: (e: React.DragEvent, item: MediaItem) => void;
  onDragEnd?: () => void;
  albums?: Album[];
  isMobile?: boolean;
}

export const PhotoGridItem = memo(function PhotoGridItem({
  item,
  index,
  isMultiSelectMode,
  isSelected,
  onSelect,
  onView,
  onToggleFavorite,
  onDownload,
  onRename,
  onDelete,
  onMoveToAlbum,
  onManageTags,
  onShare,
  onDragStart,
  onDragEnd,
  albums = [],
  isMobile = false,
}: PhotoGridItemProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleClick = useCallback(() => {
    if (isMultiSelectMode) {
      onSelect(item.id);
    } else {
      onView(index);
    }
  }, [isMultiSelectMode, item.id, index, onSelect, onView]);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    onDragStart?.(e, item);
  }, [onDragStart, item]);

  return (
    <div
      ref={elementRef}
      className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-muted"
      onClick={handleClick}
      draggable={!isMultiSelectMode}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Skeleton loader */}
      {(!isInView || !isLoaded) && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {/* Media Content */}
      {isInView && (
        item.type === 'video' ? (
          <div className="relative w-full h-full">
            {item.thumbnail_url ? (
              <img
                src={item.thumbnail_url}
                alt={item.caption || item.filename}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  isLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setIsLoaded(true)}
              />
            ) : item.url ? (
              <video
                src={item.url}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  isLoaded ? "opacity-100" : "opacity-0"
                )}
                muted
                playsInline
                preload="metadata"
                onLoadedData={() => setIsLoaded(true)}
              />
            ) : null}
          </div>
        ) : (
          <img
            src={item.url}
            alt={item.caption || item.filename}
            className={cn(
              "w-full h-full object-cover transition-all duration-300 group-hover:scale-105",
              isLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setIsLoaded(true)}
          />
        )
      )}

      {/* Video Duration Badge */}
      {item.type === 'video' && item.duration && (
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-medium">
          {formatDuration(item.duration)}
        </div>
      )}

      {/* Video Play Icon */}
      {item.type === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-6 h-6 text-white" fill="white" />
          </div>
        </div>
      )}

      {/* Multi-select Checkbox */}
      {isMultiSelectMode && (
        <div 
          className="absolute top-2 left-2 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item.id);
          }}
        >
          {isSelected ? (
            <CheckSquare className="w-6 h-6 text-primary" />
          ) : (
            <Square className="w-6 h-6 text-white/80" />
          )}
        </div>
      )}

      {/* Favorite Indicator */}
      {item.is_favorite && !isMultiSelectMode && (
        <div className="absolute top-2 left-2">
          <Heart className="w-5 h-5 text-red-500" fill="currentColor" />
        </div>
      )}

      {/* Tags Indicator */}
      {item.tags && item.tags.length > 0 && !isMultiSelectMode && (
        <div className="absolute top-2 right-12 flex gap-1">
          <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
            <Tag className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      )}

      {/* Hover Actions */}
      {!isMultiSelectMode && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
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
              <DropdownMenuItem onClick={() => onToggleFavorite(item)}>
                <Heart className={cn("w-4 h-4 mr-2", item.is_favorite && "text-red-500")} />
                {item.is_favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload(item)}>
                <Download className="w-4 h-4 mr-2" />
                Herunterladen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(item)}>
                <Pencil className="w-4 h-4 mr-2" />
                Umbenennen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onManageTags(item.id)}>
                <Tag className="w-4 h-4 mr-2" />
                Tags verwalten
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onMoveToAlbum(item)}>
                <Folder className="w-4 h-4 mr-2" />
                Zu Album hinzufügen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShare(item)}>
                <Share2 className="w-4 h-4 mr-2" />
                Teilen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(item)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Selection Overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-primary/20 pointer-events-none" />
      )}
    </div>
  );
});

export default PhotoGridItem;
