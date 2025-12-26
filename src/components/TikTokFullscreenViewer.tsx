import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TikTokVideo } from '@/hooks/useTikTokVideos';
import {
  X,
  Heart,
  ExternalLink,
  Trash2,
  Play,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TikTokFullscreenViewerProps {
  videos: TikTokVideo[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TikTokFullscreenViewer({
  videos,
  initialIndex = 0,
  isOpen,
  onClose,
  onToggleFavorite,
  onDelete,
}: TikTokFullscreenViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  // Reset to initial index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < videos.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, videos.length]);

  // Touch handlers for swipe detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY.current - touchEndY;
    const deltaTime = Date.now() - touchStartTime.current;
    
    // Calculate velocity
    const velocity = Math.abs(deltaY) / deltaTime;
    
    // Threshold for swipe detection
    const minDistance = 50;
    const minVelocity = 0.3;
    
    if (Math.abs(deltaY) > minDistance || velocity > minVelocity) {
      if (deltaY > 0) {
        // Swiped up - go to next
        goToNext();
      } else {
        // Swiped down - go to previous
        goToPrevious();
      }
    }
    
    touchStartY.current = null;
  }, [goToNext, goToPrevious]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        goToPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNext, goToPrevious, onClose]);

  const getEmbedUrl = (video: TikTokVideo) => {
    if (video.video_id) {
      return `https://www.tiktok.com/embed/v2/${video.video_id}`;
    }
    return null;
  };

  const openInTikTok = (url: string) => {
    window.open(url, '_blank');
  };

  if (!isOpen || videos.length === 0) return null;

  const currentVideo = videos[currentIndex];

  const slideVariants = {
    enter: (direction: number) => ({
      y: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      y: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      y: direction > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-50 h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Navigation Buttons - Always visible */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 disabled:opacity-30"
          onClick={goToPrevious}
          disabled={currentIndex === 0}
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 disabled:opacity-30"
          onClick={goToNext}
          disabled={currentIndex === videos.length - 1}
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
      </div>

      {/* Invisible touch zones for swiping - top and bottom edges */}
      <div 
        className="absolute top-0 left-0 right-0 h-20 z-40 md:hidden"
        onClick={goToPrevious}
      />
      <div 
        className="absolute bottom-0 left-0 right-0 h-20 z-40 md:hidden"
        onClick={goToNext}
      />

      {/* Video Container with Animation */}
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            y: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="h-full w-full absolute inset-0 flex items-center justify-center"
        >
          {getEmbedUrl(currentVideo) ? (
            <div className="relative w-full h-full max-w-[400px] mx-auto">
              <iframe
                src={getEmbedUrl(currentVideo)!}
                className="w-full h-full"
                style={{ border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-white">
              <Play className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-sm opacity-70">Video kann nicht geladen werden</p>
              <Button 
                variant="outline" 
                className="mt-4 border-white/30 text-white hover:bg-white/10"
                onClick={() => openInTikTok(currentVideo.url)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                In TikTok öffnen
              </Button>
            </div>
          )}

          {/* Side Actions */}
          <div className="absolute right-4 bottom-24 flex flex-col gap-4 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20"
              onClick={() => onToggleFavorite(currentVideo.id)}
            >
              <Heart 
                className={cn(
                  "h-6 w-6",
                  currentVideo.is_favorite && "fill-red-500 text-red-500"
                )} 
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20"
              onClick={() => openInTikTok(currentVideo.url)}
            >
              <ExternalLink className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:text-red-400"
              onClick={() => onDelete(currentVideo.id)}
            >
              <Trash2 className="h-6 w-6" />
            </Button>
          </div>

          {/* Video Info */}
          <div className="absolute left-16 bottom-24 max-w-[180px] text-white z-10">
            {currentVideo.author_name && (
              <p className="font-semibold text-sm">@{currentVideo.author_name}</p>
            )}
            {currentVideo.title && (
              <p className="text-xs opacity-80 line-clamp-2 mt-1">{currentVideo.title}</p>
            )}
          </div>

          {/* Progress Indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm z-10">
            {currentIndex + 1} / {videos.length}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress Dots - Right side */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-50">
        {videos.slice(
          Math.max(0, currentIndex - 2),
          Math.min(videos.length, currentIndex + 3)
        ).map((_, i) => {
          const actualIndex = Math.max(0, currentIndex - 2) + i;
          return (
            <div
              key={actualIndex}
              onClick={() => {
                setDirection(actualIndex > currentIndex ? 1 : -1);
                setCurrentIndex(actualIndex);
              }}
              className={cn(
                "w-2 rounded-full transition-all cursor-pointer hover:bg-white/80",
                actualIndex === currentIndex 
                  ? "h-6 bg-white" 
                  : "h-2 bg-white/40"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}