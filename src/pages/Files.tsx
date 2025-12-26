import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  File, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio,
  Download, 
  Trash2, 
  Loader2,
  Upload,
  Pencil,
  MoreVertical,
  Star,
  Eye,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { RenameDialog } from '@/components/RenameDialog';
import { toast } from 'sonner';
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
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('pdf')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function Files() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; file: FileItem | null }>({ isOpen: false, file: null });
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; file: FileItem | null }>({ isOpen: false, file: null });
  const [previewFile, setPreviewFile] = useState<{ file: FileItem; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { userId } = useAuth();
  const location = useLocation();

  const fetchFiles = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Real-time updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('files-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, fetchFiles)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchFiles]);

  useEffect(() => {
    if (location.state?.action === 'upload-file') {
      fileInputRef.current?.click();
    }
  }, [location.state]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || !userId) return;

    const filesToUpload = Array.from(fileList).filter(f => f.size <= MAX_FILE_SIZE);
    if (filesToUpload.length === 0) {
      toast.error('Dateien sind zu groß (max. 100MB)');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const filename = `${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('files')
          .upload(`${userId}/${filename}`, file);

        if (uploadError) throw uploadError;

        const { data, error: dbError } = await supabase
          .from('files')
          .insert({
            user_id: userId,
            filename,
            mime_type: file.type || 'application/octet-stream',
            size: file.size,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        setFiles(prev => [data, ...prev]);
        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }
      toast.success(`${filesToUpload.length} ${filesToUpload.length === 1 ? 'Datei' : 'Dateien'} hochgeladen`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Fehler beim Hochladen');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const downloadFile = async (file: FileItem) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.storage
        .from('files')
        .download(`${userId}/${file.filename}`);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename.replace(/^\d+-/, '');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download gestartet');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Fehler beim Download');
    }
  };

  const handleDelete = async () => {
    if (!userId || !deleteConfirm.file) return;

    try {
      const { error } = await supabase
        .from('files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteConfirm.file.id);

      if (error) throw error;

      setFiles(files.filter(f => f.id !== deleteConfirm.file!.id));
      setDeleteConfirm({ isOpen: false, file: null });
      toast.success('In Papierkorb verschoben');
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleRename = async (newName: string) => {
    if (!userId || !renameDialog.file) return;

    try {
      const oldFilename = renameDialog.file.filename;
      const extension = oldFilename.substring(oldFilename.lastIndexOf('.'));
      const timestamp = oldFilename.split('-')[0];
      const newFilename = `${timestamp}-${newName}${extension}`;

      // Rename in storage
      const { error: copyError } = await supabase.storage
        .from('files')
        .copy(`${userId}/${oldFilename}`, `${userId}/${newFilename}`);

      if (copyError) throw copyError;

      // Delete old file
      await supabase.storage.from('files').remove([`${userId}/${oldFilename}`]);

      // Update database
      const { error: dbError } = await supabase
        .from('files')
        .update({ filename: newFilename })
        .eq('id', renameDialog.file.id);

      if (dbError) throw dbError;

      setFiles(prev => prev.map(f => 
        f.id === renameDialog.file?.id ? { ...f, filename: newFilename } : f
      ));
      toast.success('Umbenannt');
    } catch (error) {
      console.error('Error renaming file:', error);
      toast.error('Fehler beim Umbenennen');
    }
  };

  const toggleFavorite = async (file: FileItem) => {
    try {
      const newValue = !file.is_favorite;
      const { error } = await supabase
        .from('files')
        .update({ is_favorite: newValue })
        .eq('id', file.id);

      if (error) throw error;

      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, is_favorite: newValue } : f
      ));
      toast.success(newValue ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt');
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const previewFileItem = async (file: FileItem) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.storage
        .from('files')
        .createSignedUrl(`${userId}/${file.filename}`, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        setPreviewFile({ file, url: data.signedUrl });
      }
    } catch (error) {
      console.error('Error previewing file:', error);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  }, [userId]);

  const filteredFiles = files.filter(file =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const canPreview = (mimeType: string) => {
    return mimeType.startsWith('image/') || 
           mimeType.startsWith('video/') || 
           mimeType.startsWith('audio/') ||
           mimeType === 'application/pdf';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dateien</h1>
          <p className="text-muted-foreground text-sm">
            {files.length} Dateien • {formatFileSize(files.reduce((acc, f) => acc + f.size, 0))} gesamt
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all text-primary-foreground"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Hochladen</span>
        </button>
      </motion.div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Dateien suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground"
        />
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        ref={dropZoneRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "glass-card p-8 border-2 border-dashed transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/50"
        )}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <Upload className={cn(
            "w-12 h-12 mb-4 transition-colors",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
          <p className="text-foreground mb-2">
            Dateien hierher ziehen
          </p>
          <p className="text-muted-foreground text-sm">
            oder klicke zum Auswählen (max. 100MB)
          </p>
        </div>
      </motion.div>

      {/* Upload Progress */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-foreground">Wird hochgeladen...</span>
              <span className="text-muted-foreground ml-auto">{Math.round(uploadProgress)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-primary"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Files List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 text-center"
        >
          <File className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium text-foreground mb-2">Keine Dateien</h3>
          <p className="text-muted-foreground">
            Lade deine ersten Dateien hoch
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map((file, index) => {
            const FileIcon = getFileIcon(file.mime_type);
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="glass-card-hover p-4 flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <FileIcon className="w-6 h-6 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">
                      {file.filename.replace(/^\d+-/, '')}
                    </h3>
                    {file.is_favorite && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)} • {formatDate(file.uploaded_at)}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {/* Quick Actions */}
                  <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canPreview(file.mime_type) && (
                      <button
                        onClick={() => previewFileItem(file)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Vorschau"
                      >
                        <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                    <button
                      onClick={() => downloadFile(file)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>

                  {/* More Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <MoreVertical className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {canPreview(file.mime_type) && (
                        <DropdownMenuItem onClick={() => previewFileItem(file)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Vorschau
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => downloadFile(file)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRenameDialog({ isOpen: true, file })}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Umbenennen
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleFavorite(file)}>
                        <Star className={cn("w-4 h-4 mr-2", file.is_favorite && "fill-yellow-500 text-yellow-500")} />
                        {file.is_favorite ? 'Aus Favoriten' : 'Zu Favoriten'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteConfirm({ isOpen: true, file })}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
            onClick={() => setPreviewFile(null)}
          >
            <button
              onClick={() => setPreviewFile(null)}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            <div className="max-w-4xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              {previewFile.file.mime_type.startsWith('image/') && (
                <img src={previewFile.url} alt={previewFile.file.filename} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
              )}
              {previewFile.file.mime_type.startsWith('video/') && (
                <video src={previewFile.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg" />
              )}
              {previewFile.file.mime_type.startsWith('audio/') && (
                <div className="glass-card p-8">
                  <audio src={previewFile.url} controls autoPlay className="w-full" />
                  <p className="text-foreground mt-4 text-center">{previewFile.file.filename.replace(/^\d+-/, '')}</p>
                </div>
              )}
              {previewFile.file.mime_type === 'application/pdf' && (
                <iframe src={previewFile.url} className="w-full h-[80vh] rounded-lg bg-white" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, file: null })}
        onConfirm={handleDelete}
        itemName={deleteConfirm.file?.filename.replace(/^\d+-/, '')}
      />

      {/* Rename Dialog */}
      <RenameDialog
        isOpen={renameDialog.isOpen}
        onClose={() => setRenameDialog({ isOpen: false, file: null })}
        onRename={handleRename}
        currentName={renameDialog.file?.filename.replace(/^\d+-/, '').replace(/\.[^/.]+$/, '') || ''}
        title="Datei umbenennen"
      />
    </div>
  );
}
