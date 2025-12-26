import { useState, useEffect, useRef, useCallback } from 'react';
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const lastScrollTime = useRef(0);

  // Reset to initial index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      // Scroll to initial position after a short delay
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const videoHeight = scrollContainerRef.current.clientHeight;
          scrollContainerRef.current.scrollTo({
            top: initialIndex * videoHeight,
            behavior: 'instant'
          });
        }
      }, 50);
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

  const scrollToVideo = useCallback((index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const videoHeight = container.clientHeight;
    container.scrollTo({
      top: index * videoHeight,
      behavior: 'smooth'
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isScrolling.current) return;
    
    const now = Date.now();
    if (now - lastScrollTime.current < 100) return;
    lastScrollTime.current = now;

    const container = scrollContainerRef.current;
    const videoHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const newIndex = Math.round(scrollTop / videoHeight);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, videos.length]);

  const handleScrollEnd = useCallback(() => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const videoHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const targetIndex = Math.round(scrollTop / videoHeight);
    
    isScrolling.current = true;
    container.scrollTo({
      top: targetIndex * videoHeight,
      behavior: 'smooth'
    });
    
    setTimeout(() => {
      isScrolling.current = false;
    }, 300);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    
    const onScroll = () => {
      handleScroll();
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScrollEnd, 150);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(scrollTimeout);
    };
  }, [handleScroll, handleScrollEnd, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const newIndex = Math.min(currentIndex + 1, videos.length - 1);
        setCurrentIndex(newIndex);
        scrollToVideo(newIndex);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const newIndex = Math.max(currentIndex - 1, 0);
        setCurrentIndex(newIndex);
        scrollToVideo(newIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, videos.length, scrollToVideo, onClose]);

  const getEmbedUrl = (video: TikTokVideo) => {
    if (video.video_id) {
      return `https://www.tiktok.com/embed/v2/${video.video_id}`;
    }
    return null;
  };

  const openInTikTok = (url: string) => {
    window.open(url, '_blank');
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      scrollToVideo(newIndex);
    }
  };

  const goToNext = () => {
    if (currentIndex < videos.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      scrollToVideo(newIndex);
    }
  };

  if (!isOpen || videos.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
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

        {/* Navigation Arrows - Desktop */}
        <div className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-50 flex-col gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 disabled:opacity-30"
            onClick={goToPrevious}
            disabled={currentIndex === 0}
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 disabled:opacity-30"
            onClick={goToNext}
            disabled={currentIndex === videos.length - 1}
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>

        {/* Video Container with Snap Scroll */}
        <div 
          ref={scrollContainerRef}
          className="h-full w-full overflow-y-auto snap-y snap-mandatory"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {videos.map((video, index) => (
            <div 
              key={video.id}
              className="h-full w-full snap-start snap-always relative flex items-center justify-center"
            >
              {getEmbedUrl(video) ? (
                <iframe
                  src={getEmbedUrl(video)!}
                  className="w-full h-full max-w-[400px] mx-auto"
                  style={{ border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-white">
                  <Play className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-sm opacity-70">Video kann nicht geladen werden</p>
                  <Button 
                    variant="outline" 
                    className="mt-4 border-white/30 text-white hover:bg-white/10"
                    onClick={() => openInTikTok(video.url)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    In TikTok öffnen
                  </Button>
                </div>
              )}

              {/* Side Actions */}
              <div className="absolute right-4 bottom-20 flex flex-col gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20"
                  onClick={() => onToggleFavorite(video.id)}
                >
                  <Heart 
                    className={cn(
                      "h-6 w-6",
                      video.is_favorite && "fill-red-500 text-red-500"
                    )} 
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20"
                  onClick={() => openInTikTok(video.url)}
                >
                  <ExternalLink className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:text-red-400"
                  onClick={() => onDelete(video.id)}
                >
                  <Trash2 className="h-6 w-6" />
                </Button>
              </div>

              {/* Video Info */}
              <div className="absolute left-4 bottom-20 max-w-[200px] text-white">
                {video.author_name && (
                  <p className="font-semibold text-sm">@{video.author_name}</p>
                )}
                {video.title && (
                  <p className="text-xs opacity-80 line-clamp-2 mt-1">{video.title}</p>
                )}
              </div>

              {/* Progress Indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                {index + 1} / {videos.length}
              </div>
            </div>
          ))}
        </div>

        {/* Progress Dots - Mobile */}
        <div className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-50">
          {videos.slice(
            Math.max(0, currentIndex - 2),
            Math.min(videos.length, currentIndex + 3)
          ).map((_, i) => {
            const actualIndex = Math.max(0, currentIndex - 2) + i;
            return (
              <div
                key={actualIndex}
                className={cn(
                  "w-1.5 rounded-full transition-all",
                  actualIndex === currentIndex 
                    ? "h-4 bg-white" 
                    : "h-1.5 bg-white/40"
                )}
              />
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}