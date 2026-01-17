import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Star, 
  Trash2,
  Pencil,
  Tag,
  Folder,
  Share2
} from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { DocumentPreview, isOfficeDocument, isOfficeDocumentByExtension, isTextFile } from '@/components/DocumentPreview';

export interface FileItem {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  is_favorite?: boolean;
  tags?: string[];
  url?: string;
  album_id?: string | null;
}

interface FilePreviewLightboxProps {
  files: FileItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onToggleFavorite: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onManageTags: (fileId: string) => void;
  onMoveToAlbum: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
  isMobile?: boolean;
}

export function FilePreviewLightbox({
  files,
  currentIndex,
  onClose,
  onNavigate,
  onToggleFavorite,
  onDownload,
  onDelete,
  onRename,
  onManageTags,
  onMoveToAlbum,
  onShare,
  isMobile = false,
}: FilePreviewLightboxProps) {
  const touchStartX = useRef<number | null>(null);
  const currentFile = files[currentIndex];

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
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      onNavigate(diff > 0 ? 'next' : 'prev');
    }
    touchStartX.current = null;
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');
  const isVideo = (mimeType: string) => mimeType.startsWith('video/');
  const isPdf = (mimeType: string) => mimeType === 'application/pdf';
  const canShowDocumentPreview = (file: FileItem) => 
    isPdf(file.mime_type) || 
    isOfficeDocument(file.mime_type) || 
    isOfficeDocumentByExtension(file.filename) ||
    isTextFile(file.mime_type, file.filename);

  if (!currentFile) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col"
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
          <div className="flex flex-col">
            <span className="text-white text-sm font-medium truncate max-w-[200px] md:max-w-[400px]">
              {currentFile.filename.replace(/^\d+-/, '')}
            </span>
            <span className="text-white/60 text-xs">
              {formatFileSize(currentFile.size)} • {formatDate(currentFile.uploaded_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white/80 text-sm mr-2">
            {currentIndex + 1} / {files.length}
          </span>
          <button
            onClick={() => onToggleFavorite(currentFile)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Star className={cn("w-5 h-5", currentFile.is_favorite ? "text-yellow-400" : "text-white")} fill={currentFile.is_favorite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => onDownload(currentFile)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Download className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => onRename(currentFile)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Pencil className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => onManageTags(currentFile.id)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Tag className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => onMoveToAlbum(currentFile)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <Folder className="w-5 h-5 text-white" />
          </button>
          {onShare && (
            <button
              onClick={() => onShare(currentFile)}
              className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
          )}
          <button
            onClick={() => onDelete(currentFile)}
            className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center hover:bg-red-500/50 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 flex items-center justify-center relative overflow-hidden pt-16 pb-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
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
        {!isMobile && currentIndex < files.length - 1 && (
          <button
            onClick={() => onNavigate('next')}
            className="absolute right-4 z-20 w-12 h-12 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}

        {/* File Preview */}
        <div className="w-full h-full flex items-center justify-center p-4">
          {isImage(currentFile.mime_type) && currentFile.url && (
            <img
              src={currentFile.url}
              alt={currentFile.filename}
              className="max-w-full max-h-full object-contain"
            />
          )}
          {isVideo(currentFile.mime_type) && currentFile.url && (
            <video
              src={currentFile.url}
              controls
              className="max-w-full max-h-full"
              playsInline
            />
          )}
          {canShowDocumentPreview(currentFile) && currentFile.url && (
            <div className="w-full h-full max-w-4xl">
              <DocumentPreview 
                url={currentFile.url} 
                mimeType={currentFile.mime_type}
                filename={currentFile.filename}
                onClose={onClose}
                onPrevious={currentIndex > 0 ? () => onNavigate('prev') : undefined}
                onNext={currentIndex < files.length - 1 ? () => onNavigate('next') : undefined}
                hasPrevious={currentIndex > 0}
                hasNext={currentIndex < files.length - 1}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default FilePreviewLightbox;
