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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTikTokVideos, TikTokVideo } from '@/hooks/useTikTokVideos';
import { useTikTokFolders } from '@/hooks/useTikTokFolders';
import { TikTokFullscreenViewer } from '@/components/TikTokFullscreenViewer';
import {
  Plus,
  Trash2,
  Star,
  Loader2,
  ExternalLink,
  Play,
  List,
  Maximize2,
  Heart,
  FolderPlus,
  Folder,
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ViewMode = 'feed' | 'grid';

export default function TikTok() {
  const { videos, isLoading, addVideo, deleteVideo, toggleFavorite, moveToFolder } = useTikTokVideos();
  const { folders, createFolder } = useTikTokFolders();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddFolderDialogOpen, setIsAddFolderDialogOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [filterFolderId, setFilterFolderId] = useState<string | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [fullscreenStartIndex, setFullscreenStartIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const lastScrollTime = useRef(0);

  // Filter videos
  const filteredVideos = videos.filter(v => {
    if (filterFavorites && !v.is_favorite) return false;
    if (filterFolderId && v.folder_id !== filterFolderId) return false;
    if (filterFolderId === null && v.folder_id !== null && filterFolderId !== 'all') return true;
    return true;
  }).filter(v => {
    if (filterFolderId === 'all') return true;
    if (filterFolderId === null) return true;
    return v.folder_id === filterFolderId;
  });

  // Scroll to current video in feed mode
  const scrollToVideo = useCallback((index: number) => {
    if (!scrollContainerRef.current || viewMode !== 'feed') return;
    const container = scrollContainerRef.current;
    const videoHeight = container.clientHeight;
    container.scrollTo({
      top: index * videoHeight,
      behavior: 'smooth'
    });
  }, [viewMode]);

  // Handle scroll snap
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || viewMode !== 'feed' || isScrolling.current) return;
    
    const now = Date.now();
    if (now - lastScrollTime.current < 100) return;
    lastScrollTime.current = now;

    const container = scrollContainerRef.current;
    const videoHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const newIndex = Math.round(scrollTop / videoHeight);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < filteredVideos.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, filteredVideos.length, viewMode]);

  // Snap scroll after scroll ends
  const handleScrollEnd = useCallback(() => {
    if (!scrollContainerRef.current || viewMode !== 'feed') return;
    
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
  }, [viewMode]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || viewMode !== 'feed') return;

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
  }, [handleScroll, handleScrollEnd, viewMode]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'feed') return;
      
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const newIndex = Math.min(currentIndex + 1, filteredVideos.length - 1);
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
  }, [filteredVideos.length, viewMode, currentIndex, scrollToVideo]);

  const handleAddVideo = async () => {
    if (!newUrl.trim()) return;
    
    if (!newUrl.includes('tiktok.com')) {
      toast.error('Bitte gib eine gültige TikTok URL ein');
      return;
    }

    setIsAdding(true);
    try {
      await addVideo(newUrl.trim(), selectedFolderId);
      setNewUrl('');
      setSelectedFolderId(null);
      setIsAddDialogOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setNewFolderName('');
    setIsAddFolderDialogOpen(false);
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

  useEffect(() => {
    setCurrentIndex(0);
  }, [filterFavorites, filterFolderId]);

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
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">TikTok Videos</h1>
          <p className="text-sm text-muted-foreground">
            {filteredVideos.length} Video{filteredVideos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Folder Filter */}
          <Select 
            value={filterFolderId || 'all'} 
            onValueChange={(v) => setFilterFolderId(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-[140px] h-9">
              <Folder className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Videos</SelectItem>
              {folders.map(folder => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={filterFavorites ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterFavorites(!filterFavorites)}
          >
            <Star className={cn("h-4 w-4", filterFavorites && "fill-current")} />
          </Button>
          {filteredVideos.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setFullscreenStartIndex(0);
                setIsFullscreenOpen(true);
              }}
              className="gap-2"
            >
              <MonitorPlay className="h-4 w-4" />
              <span className="hidden sm:inline">Abspielen</span>
            </Button>
          )}
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode(viewMode === 'feed' ? 'grid' : 'feed')}
          >
            {viewMode === 'feed' ? <List className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsAddFolderDialogOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Hinzufügen</span>
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
        /* Feed Mode - Native scroll snap */
        <div 
          ref={scrollContainerRef}
          className="h-[calc(100vh-8rem)] overflow-y-auto snap-y snap-mandatory bg-black"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {filteredVideos.map((video, index) => (
            <div 
              key={video.id}
              className="h-[calc(100vh-8rem)] snap-start snap-always relative flex items-center justify-center"
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
                    className="mt-4"
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
                  onClick={() => toggleFavorite(video.id)}
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
                  onClick={() => deleteVideo(video.id)}
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
                {index + 1} / {filteredVideos.length}
              </div>
            </div>
          ))}
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
                className="flex flex-col"
              >
                <div
                  className="relative aspect-[9/16] bg-muted rounded-xl overflow-hidden group cursor-pointer"
                  onClick={() => {
                    setFullscreenStartIndex(index);
                    setIsFullscreenOpen(true);
                  }}
                >
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title || 'TikTok Video'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
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

                  {/* Play Icon Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-12 w-12 rounded-full bg-black/50 flex items-center justify-center">
                      <Play className="h-6 w-6 text-white fill-white" />
                    </div>
                  </div>

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
                </div>
                
                {/* Video Info */}
                <div className="mt-2 px-1">
                  {video.title && (
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
                      {video.title}
                    </p>
                  )}
                  {video.author_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      @{video.author_name}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Fullscreen Viewer */}
      <TikTokFullscreenViewer
        videos={filteredVideos}
        initialIndex={fullscreenStartIndex}
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        onToggleFavorite={toggleFavorite}
        onDelete={(id) => {
          deleteVideo(id);
          if (filteredVideos.length <= 1) {
            setIsFullscreenOpen(false);
          }
        }}
      />

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
            </div>
            {folders.length > 0 && (
              <div>
                <label className="text-sm font-medium text-foreground">Ordner (optional)</label>
                <Select 
                  value={selectedFolderId || 'none'} 
                  onValueChange={(v) => setSelectedFolderId(v === 'none' ? null : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Kein Ordner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Ordner</SelectItem>
                    {folders.map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              setNewUrl('');
              setSelectedFolderId(null);
            }}>
              Abbrechen
            </Button>
            <Button onClick={handleAddVideo} disabled={!newUrl.trim() || isAdding}>
              {isAdding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Folder Dialog */}
      <Dialog open={isAddFolderDialogOpen} onOpenChange={setIsAddFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuen Ordner erstellen</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-foreground">Ordnername</label>
            <Input
              placeholder="z.B. Lustige Videos"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="mt-1"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddFolderDialogOpen(false);
              setNewFolderName('');
            }}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
