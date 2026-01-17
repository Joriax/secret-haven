import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  File, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio,
  Download, 
  Trash2, 
  Pencil,
  Star,
  Tag,
  CheckSquare,
  Square,
  Folder,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileItem {
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

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Album {
  id: string;
  name: string;
  color?: string;
}

interface FileGridItemProps {
  file: FileItem;
  index: number;
  isMultiSelectMode: boolean;
  isSelected: boolean;
  albums: Album[];
  tags: Tag[];
  showTagSelector: string | null;
  onToggleSelection: (id: string) => void;
  onPreview: () => void;
  onToggleFavorite: (file: FileItem) => void;
  onShowTagSelector: (id: string | null) => void;
  onMoveToAlbum: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onUpdateTags: (fileId: string, tags: string[]) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  onLongPressStart: (file: FileItem, e: React.TouchEvent) => void;
  onLongPressEnd: () => void;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('pdf')) return FileText;
  return File;
};

export const FileGridItem = memo(function FileGridItem({
  file,
  index,
  isMultiSelectMode,
  isSelected,
  albums,
  tags,
  showTagSelector,
  onToggleSelection,
  onPreview,
  onToggleFavorite,
  onShowTagSelector,
  onMoveToAlbum,
  onDownload,
  onShare,
  onRename,
  onDelete,
  onUpdateTags,
  onContextMenu,
  onLongPressStart,
  onLongPressEnd,
}: FileGridItemProps) {
  const FileIcon = getFileIcon(file.mime_type);
  const canPreview = file.mime_type.startsWith('image/') || 
                     file.mime_type.startsWith('video/') || 
                     file.mime_type === 'application/pdf';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02 }}
      className={cn(
        "glass-card-hover overflow-hidden cursor-pointer aspect-square relative group",
        isMultiSelectMode && isSelected && "ring-2 ring-primary"
      )}
      onClick={() => {
        if (isMultiSelectMode) {
          onToggleSelection(file.id);
        } else if (canPreview) {
          onPreview();
        }
      }}
      onContextMenu={(e) => onContextMenu(e, file)}
      onTouchStart={(e) => onLongPressStart(file, e)}
      onTouchEnd={onLongPressEnd}
      onTouchMove={onLongPressEnd}
    >
      {/* Selection checkbox */}
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

      {/* File preview */}
      {file.mime_type.startsWith('image/') && file.url ? (
        <img
          src={file.url}
          alt={file.filename}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : file.mime_type.startsWith('video/') && file.url ? (
        <div className="relative w-full h-full">
          <video src={file.url} className="w-full h-full object-cover" muted />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <FileVideo className="w-10 h-10 text-white" />
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
          <FileIcon className="w-12 h-12 text-primary mb-2" />
          <p className="text-xs text-muted-foreground px-2 text-center truncate w-full">
            {file.filename.replace(/^\d+-/, '')}
          </p>
        </div>
      )}

      {/* Favorite indicator */}
      {file.is_favorite && !isMultiSelectMode && (
        <div className="absolute top-2 left-2">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        </div>
      )}

      {/* Album indicator */}
      {file.album_id && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 text-white text-xs">
          <Folder className="w-3 h-3" />
          <span className="truncate max-w-[4rem]">
            {albums.find((a) => a.id === file.album_id)?.name || 'Album'}
          </span>
        </div>
      )}

      {/* Tags indicator */}
      {file.tags && file.tags.length > 0 && (
        <div className="absolute top-2 right-2 flex gap-1">
          {file.tags.slice(0, 2).map(tagId => {
            const tag = tags.find(t => t.id === tagId);
            return tag ? (
              <span key={tagId} className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
            ) : null;
          })}
        </div>
      )}

      {/* Overlay with actions */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white text-xs truncate mb-2">
            {file.filename.replace(/^\d+-/, '')}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(file); }}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Star className={cn("w-4 h-4", file.is_favorite ? "text-yellow-500 fill-yellow-500" : "text-white")} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShowTagSelector(file.id); }}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Tag className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveToAlbum(file); }}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Folder className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(file); }}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShare(file); }}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Teilen"
            >
              <Share2 className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRename(file); }}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(file); }}
              className="p-1.5 hover:bg-red-500/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Tag Selector Dropdown */}
      {showTagSelector === file.id && (
        <div 
          className="absolute top-full left-0 mt-2 w-48 glass-card p-2 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => {
                const newTags = file.tags?.includes(tag.id)
                  ? file.tags.filter(t => t !== tag.id)
                  : [...(file.tags || []), tag.id];
                onUpdateTags(file.id, newTags);
              }}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-all text-sm",
                file.tags?.includes(tag.id) ? "bg-white/10" : "hover:bg-white/5"
              )}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
              <span className="text-foreground">{tag.name}</span>
            </button>
          ))}
          <button
            onClick={() => onShowTagSelector(null)}
            className="w-full mt-2 px-3 py-2 rounded-lg text-center text-sm text-muted-foreground hover:bg-muted"
          >
            Schließen
          </button>
        </div>
      )}
    </motion.div>
  );
});
