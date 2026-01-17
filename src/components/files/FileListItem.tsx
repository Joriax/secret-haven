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
  Eye,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

interface FileListItemProps {
  file: FileItem;
  index: number;
  isMultiSelectMode: boolean;
  isSelected: boolean;
  tags: Tag[];
  onToggleSelection: (id: string) => void;
  onPreview: () => void;
  onToggleFavorite: (file: FileItem) => void;
  onShowTagSelector: (id: string | null) => void;
  onMoveToAlbum: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  formatDate: (date: string) => string;
  formatFileSize: (bytes: number) => string;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('pdf')) return FileText;
  return File;
};

export const FileListItem = memo(function FileListItem({
  file,
  index,
  isMultiSelectMode,
  isSelected,
  tags,
  onToggleSelection,
  onPreview,
  onToggleFavorite,
  onShowTagSelector,
  onMoveToAlbum,
  onDownload,
  onRename,
  onDelete,
  onContextMenu,
  formatDate,
  formatFileSize,
}: FileListItemProps) {
  const FileIcon = getFileIcon(file.mime_type);
  const canPreview = file.mime_type.startsWith('image/') || 
                     file.mime_type.startsWith('video/') || 
                     file.mime_type === 'application/pdf';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="glass-card-hover p-4 flex items-center gap-4 group"
      onContextMenu={(e) => onContextMenu(e, file)}
    >
      {/* Selection checkbox */}
      {isMultiSelectMode && (
        <button
          onClick={() => onToggleSelection(file.id)}
          className="flex-shrink-0"
        >
          <div className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
            isSelected 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted border border-border"
          )}>
            {isSelected ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>
      )}

      {/* Icon/Thumbnail */}
      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        {file.mime_type.startsWith('image/') && file.url ? (
          <img src={file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <FileIcon className="w-6 h-6 text-primary" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-medium truncate">
          {file.filename.replace(/^\d+-/, '')}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatFileSize(file.size)}</span>
          <span>{formatDate(file.uploaded_at)}</span>
          {file.tags && file.tags.length > 0 && (
            <div className="flex gap-1">
              {file.tags.slice(0, 3).map(tagId => {
                const tag = tags.find(t => t.id === tagId);
                return tag ? (
                  <span key={tagId} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Favorite */}
      {file.is_favorite && (
        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canPreview && (
          <button
            onClick={onPreview}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Vorschau"
          >
            <Eye className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={() => onToggleFavorite(file)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title={file.is_favorite ? 'Favorit entfernen' : 'Als Favorit'}
        >
          <Star className={cn("w-4 h-4", file.is_favorite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground")} />
        </button>
        <button
          onClick={() => onDownload(file)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="Herunterladen"
        >
          <Download className="w-4 h-4 text-muted-foreground" />
        </button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors">
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onShowTagSelector(file.id)}>
              <Tag className="w-4 h-4 mr-2" />
              Tags bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveToAlbum(file)}>
              <Folder className="w-4 h-4 mr-2" />
              In Album verschieben
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(file)}>
              <Pencil className="w-4 h-4 mr-2" />
              Umbenennen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(file)} className="text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
});
