import React, { memo, useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Play, 
  Pause, 
  Scissors,
  Image as ImageIcon,
  Download,
  Save,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Film
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoEditorProps {
  isOpen: boolean;
  videoUrl: string;
  filename: string;
  onSave: (blob: Blob, thumbnailBlob: Blob | null, startTime: number, endTime: number) => void;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export const VideoEditor = memo(function VideoEditor({
  isOpen,
  videoUrl,
  filename,
  onSave,
  onClose
}: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [thumbnailTime, setThumbnailTime] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'trim' | 'thumbnail'>('trim');
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);

  // Load video metadata
  useEffect(() => {
    if (!isOpen || !videoRef.current) return;
    
    const video = videoRef.current;
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setTrimEnd(video.duration);
      setThumbnailTime(0);
      generateThumbnails();
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Stop at trim end
      if (video.currentTime >= trimEnd) {
        video.pause();
        setIsPlaying(false);
        video.currentTime = trimStart;
      }
    };
    
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isOpen, trimEnd, trimStart]);

  // Generate timeline thumbnails
  const generateThumbnails = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const thumbCount = 10;
    const thumbs: string[] = [];
    
    canvas.width = 120;
    canvas.height = 68;

    for (let i = 0; i < thumbCount; i++) {
      const time = (i / thumbCount) * video.duration;
      
      await new Promise<void>((resolve) => {
        const seekHandler = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbs.push(canvas.toDataURL('image/jpeg', 0.6));
          video.removeEventListener('seeked', seekHandler);
          resolve();
        };
        video.addEventListener('seeked', seekHandler);
        video.currentTime = time;
      });
    }

    setThumbnails(thumbs);
    video.currentTime = 0;
  }, []);

  // Playback controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(trimStart, Math.min(trimEnd, time));
    }
  };

  const skipBack = () => seekTo(currentTime - 5);
  const skipForward = () => seekTo(currentTime + 5);

  // Timeline click handler
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || isDragging) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * duration);
  };

  // Trim handle drag
  const handleTrimDrag = (e: React.MouseEvent, type: 'start' | 'end') => {
    e.stopPropagation();
    setIsDragging(type);

    const handleMove = (moveEvent: MouseEvent) => {
      if (!timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const time = percent * duration;

      if (type === 'start') {
        setTrimStart(Math.min(time, trimEnd - 0.5));
      } else {
        setTrimEnd(Math.max(time, trimStart + 0.5));
      }
    };

    const handleUp = () => {
      setIsDragging(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  // Set thumbnail time to current position
  const setCurrentAsThumbnail = () => {
    setThumbnailTime(currentTime);
  };

  // Extract thumbnail at specified time
  const extractThumbnail = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = 640;
    canvas.height = 480;

    return new Promise((resolve) => {
      const currentTimeBackup = video.currentTime;
      
      const seekHandler = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            video.currentTime = currentTimeBackup;
            resolve(blob);
          },
          'image/jpeg',
          0.85
        );
        video.removeEventListener('seeked', seekHandler);
      };
      
      video.addEventListener('seeked', seekHandler);
      video.currentTime = thumbnailTime;
    });
  }, [thumbnailTime]);

  // Save trimmed video (note: actual trimming would need server-side processing)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const thumbnailBlob = await extractThumbnail();
      
      // For now, we'll just return the original video with trim metadata
      // Actual video trimming would require FFmpeg or server-side processing
      const response = await fetch(videoUrl);
      const videoBlob = await response.blob();
      
      onSave(videoBlob, thumbnailBlob, trimStart, trimEnd);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const trimmedDuration = trimEnd - trimStart;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <Film className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Video bearbeiten</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video Preview */}
          <div className="flex-1 flex items-center justify-center p-4 bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              className="max-w-full max-h-[calc(100vh-20rem)] object-contain"
              muted={isMuted}
              playsInline
              onClick={togglePlay}
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Controls */}
          <div className="bg-card border-t border-border p-4 space-y-4">
            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={skipBack}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <button
                onClick={skipForward}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            {/* Time Display */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span className="text-primary font-medium">
                Trimmed: {formatTime(trimmedDuration)}
              </span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('trim')}
                className={cn(
                  "flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  activeTab === 'trim' 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Scissors className="w-4 h-4" />
                Trimmen
              </button>
              <button
                onClick={() => setActiveTab('thumbnail')}
                className={cn(
                  "flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  activeTab === 'thumbnail' 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ImageIcon className="w-4 h-4" />
                Thumbnail
              </button>
            </div>

            {/* Timeline */}
            <div 
              ref={timelineRef}
              className="relative h-16 rounded-lg overflow-hidden cursor-pointer"
              onClick={handleTimelineClick}
            >
              {/* Thumbnail Strip */}
              <div className="absolute inset-0 flex">
                {thumbnails.map((thumb, i) => (
                  <img
                    key={i}
                    src={thumb}
                    alt=""
                    className="h-full flex-1 object-cover"
                    style={{ filter: 'brightness(0.7)' }}
                  />
                ))}
              </div>

              {/* Trim Overlay */}
              {activeTab === 'trim' && (
                <>
                  {/* Dimmed areas outside trim range */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-black/70"
                    style={{ width: `${(trimStart / duration) * 100}%` }}
                  />
                  <div 
                    className="absolute inset-y-0 right-0 bg-black/70"
                    style={{ width: `${((duration - trimEnd) / duration) * 100}%` }}
                  />

                  {/* Trim handles */}
                  <div 
                    className="absolute inset-y-0 w-3 bg-primary cursor-ew-resize flex items-center justify-center"
                    style={{ left: `${(trimStart / duration) * 100}%` }}
                    onMouseDown={(e) => handleTrimDrag(e, 'start')}
                  >
                    <div className="w-1 h-8 bg-white rounded-full" />
                  </div>
                  <div 
                    className="absolute inset-y-0 w-3 bg-primary cursor-ew-resize flex items-center justify-center"
                    style={{ left: `calc(${(trimEnd / duration) * 100}% - 12px)` }}
                    onMouseDown={(e) => handleTrimDrag(e, 'end')}
                  >
                    <div className="w-1 h-8 bg-white rounded-full" />
                  </div>
                </>
              )}

              {/* Thumbnail marker */}
              {activeTab === 'thumbnail' && (
                <div 
                  className="absolute inset-y-0 w-1 bg-yellow-400"
                  style={{ left: `${(thumbnailTime / duration) * 100}%` }}
                />
              )}

              {/* Playhead */}
              <div 
                className="absolute inset-y-0 w-0.5 bg-white"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>

            {/* Tab Content */}
            {activeTab === 'trim' && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Start:</span>
                  <span className="font-mono text-foreground">{formatTime(trimStart)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Ende:</span>
                  <span className="font-mono text-foreground">{formatTime(trimEnd)}</span>
                </div>
              </div>
            )}

            {activeTab === 'thumbnail' && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Thumbnail bei: <span className="font-mono text-foreground">{formatTime(thumbnailTime)}</span>
                </div>
                <button
                  onClick={setCurrentAsThumbnail}
                  className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors text-sm"
                >
                  Aktuelle Position verwenden
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

export default VideoEditor;
