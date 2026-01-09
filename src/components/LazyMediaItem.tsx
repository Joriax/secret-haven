import React, { memo, useRef, useCallback, useState, useEffect } from 'react';
import { Play, Heart, CheckSquare, Square, Tag, Folder, Share2, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/hooks/useVideoThumbnail';

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface LazyMediaItemProps {
  item: any;
  index: number;
  isSelected: boolean;
  isMultiSelectMode: boolean;
  tags: TagData[];
  onToggleSelect: (id: string) => void;
  onOpenLightbox: (index: number) => void;
  onToggleFavorite: (item: any) => void;
  onShowTagSelector: (id: string) => void;
  onShowAlbumPicker: (item: any) => void;
  onShareToAlbum: (item: any) => void;
  onDownload: (item: any) => void;
  onDelete: (item: any) => void;
  onDragStart: (e: React.DragEvent, item: any) => void;
  onDragEnd: () => void;
}

/**
 * Lazy-loaded media item component using Intersection Observer
 * Optimized for large photo grids
 */
export const LazyMediaItem = memo(function LazyMediaItem({
  item,
  index,
  isSelected,
  isMultiSelectMode,
  tags,
  onToggleSelect,
  onOpenLightbox,
  onToggleFavorite,
  onShowTagSelector,
  onShowAlbumPicker,
  onShareToAlbum,
  onDownload,
  onDelete,
  onDragStart,
  onDragEnd,
}: LazyMediaItemProps) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
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
      { 
        threshold: 0.1, 
        rootMargin: '200px' // Start loading 200px before visible
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const handleClick = useCallback(() => {
    if (isMultiSelectMode) {
      onToggleSelect(item.id);
    } else {
      onOpenLightbox(index);
    }
  }, [isMultiSelectMode, item.id, index, onToggleSelect, onOpenLightbox]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div
      ref={elementRef}
      className={cn(
        "relative aspect-square group",
        isMultiSelectMode && isSelected && "ring-2 ring-primary rounded-xl"
      )}
      draggable={!isMultiSelectMode}
      onDragStart={(e) => onDragStart(e, item)}
      onDragEnd={onDragEnd}
    >
      <div
        onClick={handleClick}
        className="glass-card-hover overflow-hidden cursor-pointer w-full h-full"
      >
        {/* Multi-select checkbox */}
        {isMultiSelectMode && (
          <div className="absolute top-2 left-2 z-10">
            <div className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
              isSelected 
                ? "bg-primary text-primary-foreground" 
                : "bg-black/50 text-white"
            )}>
              {isSelected ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </div>
          </div>
        )}

        {/* Skeleton loader while not in view or loading */}
        {(!isInView || !isLoaded) && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}

        {isInView && (
          <>
            {item.type === 'video' ? (
              <div className="relative w-full h-full bg-muted">
                {/* Use thumbnail if available, otherwise show placeholder */}
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.caption || item.filename}
                    className={cn(
                      "w-full h-full object-cover transition-opacity duration-300",
                      isLoaded ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={handleImageLoad}
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
                    onLoadedData={handleImageLoad}
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      if (video.duration > 1) {
                        video.currentTime = 1;
                      }
                    }}
                  />
                ) : null}

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                  <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-7 h-7 sm:w-6 sm:h-6 text-white ml-0.5" fill="white" />
                  </div>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium pointer-events-none flex items-center gap-1">
                  {item.duration ? formatDuration(item.duration) : 'Video'}
                </div>
              </div>
            ) : (
              <img
                src={item.url}
                alt={item.caption || item.filename}
                className={cn(
                  "w-full h-full object-cover transition-all duration-300 group-hover:scale-105",
                  isLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={handleImageLoad}
              />
            )}
          </>
        )}

        {/* Favorite indicator */}
        {item.is_favorite && (
          <div className="absolute top-2 right-2">
            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
          </div>
        )}

        {/* Tags indicator */}
        {item.tags && item.tags.length > 0 && !isMultiSelectMode && (
          <div className="absolute top-2 left-2 flex gap-1">
            {item.tags.slice(0, 2).map(tagId => {
              const tag = tags.find(t => t.id === tagId);
              return tag ? (
                <span key={tagId} className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
              ) : null;
            })}
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <p className="text-white text-xs truncate mb-2">
              {item.caption || item.filename.replace(/^\d+-/, '')}
            </p>
            {!isMultiSelectMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <Heart className={cn("w-4 h-4", item.is_favorite ? "text-red-500 fill-red-500" : "text-white")} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onShowTagSelector(item.id); }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <Tag className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onShowAlbumPicker(item); }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <Folder className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onShareToAlbum(item); }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="Zu geteiltem Album hinzufügen"
                >
                  <Share2 className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDownload(item); }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <Download className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                  className="p-1.5 hover:bg-red-500/30 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default LazyMediaItem;
