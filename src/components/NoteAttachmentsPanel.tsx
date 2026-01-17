import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  Film, 
  Music, 
  File, 
  X, 
  Download, 
  Loader2,
  Plus
} from 'lucide-react';
import { NoteAttachment } from '@/hooks/useNoteAttachments';
import { cn, formatFileSize } from '@/lib/utils';

interface NoteAttachmentsProps {
  attachments: NoteAttachment[];
  isLoading: boolean;
  isUploading: boolean;
  isEditing: boolean;
  onUpload: (file: File) => void;
  onDelete: (attachment: NoteAttachment) => void;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('document')) return FileText;
  return File;
};

export function NoteAttachmentsPanel({
  attachments,
  isLoading,
  isUploading,
  isEditing,
  onUpload,
  onDelete,
}: NoteAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => onUpload(file));
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => onUpload(file));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="w-4 h-4" />
          <span>Anhänge ({attachments.length})</span>
        </div>
        {isEditing && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Hinzufügen</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Content */}
      <div 
        className="p-4"
        onDrop={isEditing ? handleDrop : undefined}
        onDragOver={isEditing ? handleDragOver : undefined}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : attachments.length === 0 ? (
          <div 
            className={cn(
              "text-center py-6 rounded-xl border-2 border-dashed transition-colors",
              isEditing ? "border-border hover:border-primary/50 cursor-pointer" : "border-transparent"
            )}
            onClick={isEditing ? () => fileInputRef.current?.click() : undefined}
          >
            <Paperclip className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {isEditing ? 'Dateien hier ablegen oder klicken zum Hochladen' : 'Keine Anhänge'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <AnimatePresence>
              {attachments.map((attachment) => {
                const Icon = getFileIcon(attachment.mime_type);
                const isImage = attachment.mime_type.startsWith('image/');

                return (
                  <motion.div
                    key={attachment.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative group rounded-xl overflow-hidden bg-muted/50 border border-border"
                  >
                    {isImage && attachment.url ? (
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={attachment.url}
                          alt={attachment.original_name}
                          className="w-full aspect-square object-cover"
                        />
                      </a>
                    ) : (
                      <a 
                        href={attachment.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center w-full aspect-square p-3"
                      >
                        <Icon className="w-8 h-8 text-primary mb-2" />
                        <p className="text-xs text-foreground truncate max-w-full px-2">
                          {attachment.original_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </p>
                      </a>
                    )}

                    {/* Overlay with actions */}
                    <div className={cn(
                      "absolute inset-0 bg-black/60 flex items-center justify-center gap-2 transition-opacity",
                      isEditing ? "opacity-0 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <a
                        href={attachment.url}
                        download={attachment.original_name}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        title="Herunterladen"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </a>
                      {isEditing && (
                        <button
                          onClick={() => onDelete(attachment)}
                          className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors"
                          title="Löschen"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
