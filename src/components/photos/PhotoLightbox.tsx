import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Heart, 
  Download, 
  Trash2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  PlayCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Tag,
  Folder,
  Share2,
  Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaItem } from './PhotoGridItem';

interface PhotoLightboxProps {
  items: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onToggleFavorite: (item: MediaItem) => void;
  onDownload: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onRename: (item: MediaItem) => void;
  onMoveToAlbum: (item: MediaItem) => void;
  onManageTags: (itemId: string) => void;
  onShare: (item: MediaItem) => void;
  isSlideshow?: boolean;
  onToggleSlideshow?: () => void;
  slideshowInterval?: number;
  isMobile?: boolean;
}

export function PhotoLightbox({
  items,
  currentIndex,
  onClose,
  onNavigate,
  onToggleFavorite,
  onDownload,
  onDelete,
  onRename,
  onMoveToAlbum,
  onManageTags,
  onShare,
  isSlideshow = false,
  onToggleSlideshow,
  slideshowInterval = 3000,
  isMobile = false,
}: PhotoLightboxProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);
  
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const currentItem = items[currentIndex];

  // Reset zoom on navigation
  useEffect(() => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
    setIsVideoPlaying(false);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          onNavigate('prev');
          break;
        case 'ArrowRight':
          onNavigate('next');
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, onClose]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    } else if (e.touches.length === 2 && currentItem?.type !== 'video') {
      // Pinch to zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistanceRef.current = distance;
      initialPinchZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current && currentItem?.type !== 'video') {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = distance / initialPinchDistanceRef.current;
      const newZoom = Math.min(Math.max(initialPinchZoomRef.current * scale, 1), 4);
      setZoomLevel(newZoom);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    initialPinchDistanceRef.current = null;
    
    if (touchStartX.current !== null && zoomLevel <= 1) {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        onNavigate(diff > 0 ? 'next' : 'prev');
      }
    }
    touchStartX.current = null;
  };

  // Zoom functions
  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 4));
  const zoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setImagePosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };
  const resetZoom = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (currentItem?.type === 'video') return;
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  // Image drag handlers for panning when zoomed
  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: imagePosition.x,
      posY: imagePosition.y
    };
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    setImagePosition({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY
    });
  };

  const handleImageMouseUp = () => {
    setIsDragging(false);
  };

  // Double click to toggle zoom
  const handleImageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoomLevel > 1) {
      resetZoom();
    } else {
      setZoomLevel(2);
    }
  };

  // Video controls
  const toggleVideoPlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (!currentItem) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col"
      onWheel={handleWheel}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <span className="text-white/80 text-sm">
            {currentIndex + 1} / {items.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls - only for images */}
          {currentItem.type === 'photo' && (
            <>
              <button
                onClick={zoomIn}
                className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={zoomOut}
                className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
                disabled={zoomLevel <= 1}
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5 text-white" />
              </button>
              {zoomLevel > 1 && (
                <button
                  onClick={resetZoom}
                  className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-5 h-5 text-white" />
                </button>
              )}
            </>
          )}

          {/* Slideshow button */}
          {onToggleSlideshow && currentItem.type === 'photo' && (
            <button
              onClick={onToggleSlideshow}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                isSlideshow ? "bg-primary text-primary-foreground" : "bg-black/30 hover:bg-black/50"
              )}
              title="Slideshow"
            >
              <PlayCircle className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => onToggleFavorite(currentItem)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Heart className={cn("w-5 h-5", currentItem.is_favorite ? "text-red-500" : "text-white")} fill={currentItem.is_favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => onDownload(currentItem)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Download className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => onManageTags(currentItem.id)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Tag className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => onMoveToAlbum(currentItem)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Folder className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => onShare(currentItem)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => onDelete(currentItem)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-red-500/50 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleImageMouseDown}
        onMouseMove={handleImageMouseMove}
        onMouseUp={handleImageMouseUp}
        onMouseLeave={handleImageMouseUp}
      >
        {/* Navigation Arrows */}
        {!isMobile && currentIndex > 0 && (
          <button
            onClick={() => onNavigate('prev')}
            className="absolute left-4 z-20 w-12 h-12 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
        {!isMobile && currentIndex < items.length - 1 && (
          <button
            onClick={() => onNavigate('next')}
            className="absolute right-4 z-20 w-12 h-12 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Media Display */}
        {currentItem.type === 'video' ? (
          <div className="relative max-w-full max-h-full">
            <video
              ref={videoRef}
              src={currentItem.url}
              className="max-w-full max-h-[calc(100vh-8rem)] object-contain"
              onClick={toggleVideoPlayback}
              onEnded={() => setIsVideoPlaying(false)}
              muted={isMuted}
              playsInline
            />
            {/* Video Controls Overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full px-4 py-2">
              <button
                onClick={toggleVideoPlayback}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                {isVideoPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white" fill="white" />
                )}
              </button>
              <button
                onClick={toggleMute}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <motion.img
            src={currentItem.url}
            alt={currentItem.caption || currentItem.filename}
            className={cn(
              "max-w-full max-h-full object-contain select-none",
              zoomLevel > 1 ? "cursor-grab" : "cursor-zoom-in",
              isDragging && "cursor-grabbing"
            )}
            style={{
              transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
            onDoubleClick={handleImageDoubleClick}
            draggable={false}
          />
        )}
      </div>

      {/* Caption */}
      {currentItem.caption && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 text-white text-sm max-w-[80%] truncate">
          {currentItem.caption}
        </div>
      )}
    </motion.div>
  );
}

export default PhotoLightbox;
