import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTikTokVideos, TikTokVideo } from '@/hooks/useTikTokVideos';
import {
  Plus,
  Trash2,
  Star,
  ChevronUp,
  ChevronDown,
  Loader2,
  ExternalLink,
  Play,
  List,
  Maximize2,
  X,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ViewMode = 'feed' | 'grid';

export default function TikTok() {
  const { videos, isLoading, addVideo, deleteVideo, toggleFavorite } = useTikTokVideos();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  const filteredVideos = filterFavorites 
    ? videos.filter(v => v.is_favorite) 
    : videos;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'feed') return;
      
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setCurrentIndex(prev => Math.min(prev + 1, filteredVideos.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredVideos.length, viewMode]);

  // Handle touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe up - next video
        setCurrentIndex(prev => Math.min(prev + 1, filteredVideos.length - 1));
      } else {
        // Swipe down - previous video
        setCurrentIndex(prev => Math.max(prev - 1, 0));
      }
    }
    
    touchStartY.current = null;
  };

  // Handle wheel scroll
  const handleWheel = useCallback((e: WheelEvent) => {
    if (viewMode !== 'feed') return;
    
    e.preventDefault();
    
    if (e.deltaY > 0) {
      setCurrentIndex(prev => Math.min(prev + 1, filteredVideos.length - 1));
    } else if (e.deltaY < 0) {
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  }, [filteredVideos.length, viewMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewMode !== 'feed') return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel, viewMode]);

  const handleAddVideo = async () => {
    if (!newUrl.trim()) return;
    
    // Validate TikTok URL
    if (!newUrl.includes('tiktok.com')) {
      toast.error('Bitte gib eine gültige TikTok URL ein');
      return;
    }

    setIsAdding(true);
    try {
      await addVideo(newUrl.trim());
      setNewUrl('');
      setIsAddDialogOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  const getEmbedUrl = (video: TikTokVideo) => {
    if (video.video_id) {
      return `https://www.tiktok.com/embed/v2/${video.video_id}`;
    }
    return null;
  };

  const openInTikTok = (url: string) => {
    window.open(url, '_blank');
  };

  // Reset current index when filtered videos change
  useEffect(() => {
    setCurrentIndex(0);
  }, [filterFavorites]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">TikTok Videos</h1>
          <p className="text-sm text-muted-foreground">
            {filteredVideos.length} Video{filteredVideos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filterFavorites ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterFavorites(!filterFavorites)}
          >
            <Star className={cn("h-4 w-4", filterFavorites && "fill-current")} />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode(viewMode === 'feed' ? 'grid' : 'feed')}
          >
            {viewMode === 'feed' ? <List className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Hinzufügen
          </Button>
        </div>
      </div>

      {filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-muted-foreground">
          <Play className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg mb-2">Keine TikTok Videos</p>
          <p className="text-sm mb-4">Füge dein erstes Video hinzu</p>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Video hinzufügen
          </Button>
        </div>
      ) : viewMode === 'feed' ? (
        /* Feed Mode - TikTok-like scrolling */
        <div 
          ref={containerRef}
          className="h-[calc(100vh-8rem)] overflow-hidden relative bg-black"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait">
            {filteredVideos[currentIndex] && (
              <motion.div
                key={filteredVideos[currentIndex].id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {getEmbedUrl(filteredVideos[currentIndex]) ? (
                  <iframe
                    src={getEmbedUrl(filteredVideos[currentIndex])!}
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
                      className="mt-4"
                      onClick={() => openInTikTok(filteredVideos[currentIndex].url)}
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
                    onClick={() => toggleFavorite(filteredVideos[currentIndex].id)}
                  >
                    <Heart 
                      className={cn(
                        "h-6 w-6",
                        filteredVideos[currentIndex].is_favorite && "fill-red-500 text-red-500"
                      )} 
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20"
                    onClick={() => openInTikTok(filteredVideos[currentIndex].url)}
                  >
                    <ExternalLink className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:text-red-400"
                    onClick={() => deleteVideo(filteredVideos[currentIndex].id)}
                  >
                    <Trash2 className="h-6 w-6" />
                  </Button>
                </div>

                {/* Navigation Hints */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 text-white/50">
                  {currentIndex > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-white/10"
                      onClick={() => setCurrentIndex(prev => prev - 1)}
                    >
                      <ChevronUp className="h-5 w-5" />
                    </Button>
                  )}
                  {currentIndex < filteredVideos.length - 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-white/10"
                      onClick={() => setCurrentIndex(prev => prev + 1)}
                    >
                      <ChevronDown className="h-5 w-5" />
                    </Button>
                  )}
                </div>

                {/* Progress Indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                  {currentIndex + 1} / {filteredVideos.length}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* Grid Mode */
        <ScrollArea className="h-[calc(100vh-8rem)] p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredVideos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="relative aspect-[9/16] bg-muted rounded-xl overflow-hidden group cursor-pointer"
                onClick={() => {
                  setCurrentIndex(index);
                  setViewMode('feed');
                }}
              >
                {getEmbedUrl(video) ? (
                  <iframe
                    src={getEmbedUrl(video)!}
                    className="w-full h-full pointer-events-none"
                    style={{ border: 'none', transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Favorite Badge */}
                {video.is_favorite && (
                  <div className="absolute top-2 right-2">
                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                  </div>
                )}

                {/* Actions on Hover */}
                <div className="absolute bottom-2 left-2 right-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(video.id);
                    }}
                  >
                    <Heart className={cn("h-4 w-4", video.is_favorite && "fill-red-500 text-red-500")} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-black/50 text-white hover:bg-red-500/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteVideo(video.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Add Video Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>TikTok Video hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">TikTok URL</label>
              <Input
                placeholder="https://www.tiktok.com/@user/video/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="mt-1"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Kopiere die URL direkt von TikTok
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              setNewUrl('');
            }}>
              Abbrechen
            </Button>
            <Button onClick={handleAddVideo} disabled={!newUrl.trim() || isAdding}>
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
