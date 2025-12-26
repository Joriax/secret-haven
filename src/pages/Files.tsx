import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Star,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Grid3X3,
  List,
  Tag,
  CheckSquare,
  Square
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTags } from '@/hooks/useTags';
import { useViewHistory } from '@/hooks/useViewHistory';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { RenameDialog } from '@/components/RenameDialog';
import { MultiSelectBar } from '@/components/MultiSelect';
import { TagManager } from '@/components/TagManager';
import { toast } from 'sonner';

interface FileItem {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  is_favorite?: boolean;
  tags?: string[];
  url?: string;
}

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'images' | 'videos' | 'documents' | 'audio';

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
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; file: FileItem | null; isMulti?: boolean }>({ isOpen: false, file: null });
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; file: FileItem | null }>({ isOpen: false, file: null });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showTagSelector, setShowTagSelector] = useState<string | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showBulkTagManager, setShowBulkTagManager] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);
  const { userId } = useAuth();
  const location = useLocation();
  const { tags } = useTags();
  const { recordView } = useViewHistory();

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

      // Get signed URLs for previewable files
      const filesWithUrls = await Promise.all(
        (data || []).map(async (file) => {
          if (file.mime_type.startsWith('image/') || file.mime_type.startsWith('video/')) {
            const { data: urlData } = await supabase.storage
              .from('files')
              .createSignedUrl(`${userId}/${file.filename}`, 3600);
            return { ...file, url: urlData?.signedUrl };
          }
          return file;
        })
      );

      setFiles(filesWithUrls);
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
            tags: [],
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Get URL for the new file if previewable
        let url: string | undefined;
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          const { data: urlData } = await supabase.storage
            .from('files')
            .createSignedUrl(`${userId}/${filename}`, 3600);
          url = urlData?.signedUrl;
        }

        setFiles(prev => [{ ...data, url }, ...prev]);
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
      setPreviewIndex(null);
      toast.success('In Papierkorb verschoben');
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleMultiDelete = async () => {
    if (!userId || selectedItems.size === 0) return;

    try {
      const { error } = await supabase
        .from('files')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setFiles(files.filter(f => !selectedItems.has(f.id)));
      setSelectedItems(new Set());
      setIsMultiSelectMode(false);
      setDeleteConfirm({ isOpen: false, file: null });
      toast.success(`${selectedItems.size} Dateien in Papierkorb verschoben`);
    } catch (error) {
      console.error('Error deleting files:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleBulkTagUpdate = async (newTags: string[]) => {
    if (selectedItems.size === 0) return;

    try {
      const { error } = await supabase
        .from('files')
        .update({ tags: newTags })
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setFiles(prev => prev.map(f => 
        selectedItems.has(f.id) ? { ...f, tags: newTags } : f
      ));
      setShowBulkTagManager(false);
      toast.success('Tags aktualisiert');
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const handleBulkFavorite = async () => {
    if (selectedItems.size === 0) return;

    try {
      const { error } = await supabase
        .from('files')
        .update({ is_favorite: true })
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setFiles(prev => prev.map(f => 
        selectedItems.has(f.id) ? { ...f, is_favorite: true } : f
      ));
      setSelectedItems(new Set());
      setIsMultiSelectMode(false);
      toast.success('Zu Favoriten hinzugefügt');
    } catch (error) {
      console.error('Error updating favorites:', error);
    }
  };

  const handleRename = async (newName: string) => {
    if (!userId || !renameDialog.file) return;

    try {
      const oldFilename = renameDialog.file.filename;
      const extension = oldFilename.substring(oldFilename.lastIndexOf('.'));
      const timestamp = oldFilename.split('-')[0];
      const newFilename = `${timestamp}-${newName}${extension}`;

      const { error: copyError } = await supabase.storage
        .from('files')
        .copy(`${userId}/${oldFilename}`, `${userId}/${newFilename}`);

      if (copyError) throw copyError;

      await supabase.storage.from('files').remove([`${userId}/${oldFilename}`]);

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

  const updateFileTags = async (fileId: string, newTags: string[]) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ tags: newTags })
        .eq('id', fileId);

      if (error) throw error;

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, tags: newTags } : f
      ));
      toast.success('Tags aktualisiert');
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const getPreviewUrl = async (file: FileItem): Promise<string | null> => {
    if (file.url) return file.url;
    
    if (!userId) return null;
    
    const { data, error } = await supabase.storage
      .from('files')
      .createSignedUrl(`${userId}/${file.filename}`, 3600);

    if (error) return null;
    return data?.signedUrl || null;
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

  // Filter files
  const filteredFiles = useMemo(() => {
    let result = files;

    // Filter by type
    if (filterMode === 'images') {
      result = result.filter(f => f.mime_type.startsWith('image/'));
    } else if (filterMode === 'videos') {
      result = result.filter(f => f.mime_type.startsWith('video/'));
    } else if (filterMode === 'documents') {
      result = result.filter(f => f.mime_type.includes('pdf') || f.mime_type.includes('document') || f.mime_type.includes('text'));
    } else if (filterMode === 'audio') {
      result = result.filter(f => f.mime_type.startsWith('audio/'));
    }

    // Filter by tag
    if (selectedTagFilter) {
      result = result.filter(f => f.tags?.includes(selectedTagFilter));
    }

    // Search
    if (searchQuery) {
      result = result.filter(f => 
        f.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return result;
  }, [files, filterMode, selectedTagFilter, searchQuery]);

  // Previewable files for lightbox
  const previewableFiles = useMemo(() => 
    filteredFiles.filter(f => f.mime_type.startsWith('image/') || f.mime_type.startsWith('video/') || f.mime_type === 'application/pdf'),
    [filteredFiles]
  );

  const navigatePreview = (direction: 'prev' | 'next') => {
    if (previewIndex === null) return;
    
    if (direction === 'prev' && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    } else if (direction === 'next' && previewIndex < previewableFiles.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  };

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      navigatePreview(diff > 0 ? 'next' : 'prev');
    }
    touchStartX.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (previewIndex === null) return;
      if (e.key === 'ArrowLeft') navigatePreview('prev');
      if (e.key === 'ArrowRight') navigatePreview('next');
      if (e.key === 'Escape') setPreviewIndex(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, previewableFiles.length]);

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
           mimeType === 'application/pdf';
  };

  const currentPreviewFile = previewIndex !== null ? previewableFiles[previewIndex] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dateien</h1>
            <p className="text-muted-foreground text-sm">
              {files.length} Dateien • {formatFileSize(files.reduce((acc, f) => acc + f.size, 0))} gesamt
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Multi-select toggle */}
            <button
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedItems(new Set());
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm",
                isMultiSelectMode 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "border-border hover:bg-muted"
              )}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Auswählen</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === 'grid' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 transition-colors",
                  viewMode === 'list' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Hochladen</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'all', label: 'Alle', icon: File },
            { id: 'images', label: 'Bilder', icon: FileImage },
            { id: 'videos', label: 'Videos', icon: FileVideo },
            { id: 'documents', label: 'Dokumente', icon: FileText },
            { id: 'audio', label: 'Audio', icon: FileAudio },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id as FilterMode)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all text-sm",
                filterMode === tab.id
                  ? "bg-gradient-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tag Filter */}
        {tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => setSelectedTagFilter(selectedTagFilter === tag.id ? null : tag.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all",
                  selectedTagFilter === tag.id 
                    ? "ring-2 ring-primary" 
                    : "hover:opacity-80"
                )}
                style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>
        )}
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

      {/* Files Grid/List */}
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
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredFiles.map((file, index) => {
            const FileIcon = getFileIcon(file.mime_type);
            const isPreviewable = canPreview(file.mime_type);
            const previewIdx = isPreviewable ? previewableFiles.findIndex(f => f.id === file.id) : -1;

            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                className={cn(
                  "glass-card-hover overflow-hidden cursor-pointer aspect-square relative group",
                  isMultiSelectMode && selectedItems.has(file.id) && "ring-2 ring-primary"
                )}
                onClick={() => {
                  if (isMultiSelectMode) {
                    toggleItemSelection(file.id);
                  } else if (isPreviewable && previewIdx !== -1) {
                    setPreviewIndex(previewIdx);
                    recordView('file', file.id);
                  }
                }}
              >
                {/* Selection checkbox */}
                {isMultiSelectMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <div className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                      selectedItems.has(file.id) 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-black/50 text-white"
                    )}>
                      {selectedItems.has(file.id) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                )}
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
                {file.is_favorite && (
                  <div className="absolute top-2 left-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
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
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(file); }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Star className={cn("w-4 h-4", file.is_favorite ? "text-yellow-500 fill-yellow-500" : "text-white")} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowTagSelector(file.id); }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Tag className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenameDialog({ isOpen: true, file }); }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, file }); }}
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
                          updateFileTags(file.id, newTags);
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
                      onClick={() => setShowTagSelector(null)}
                      className="w-full mt-2 px-3 py-2 rounded-lg text-center text-sm text-muted-foreground hover:bg-muted"
                    >
                      Schließen
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
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
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)} • {formatDate(file.uploaded_at)}
                    </p>
                    {file.tags && file.tags.length > 0 && (
                      <div className="flex gap-1">
                        {file.tags.slice(0, 3).map(tagId => {
                          const tag = tags.find(t => t.id === tagId);
                          return tag ? (
                            <span 
                              key={tagId} 
                              className="px-2 py-0.5 rounded text-xs"
                              style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleFavorite(file)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <Star className={cn("w-5 h-5", file.is_favorite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground")} />
                  </button>
                  <button
                    onClick={() => downloadFile(file)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setRenameDialog({ isOpen: true, file })}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <Pencil className="w-5 h-5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ isOpen: true, file })}
                    className="p-2 hover:bg-destructive/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-destructive" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Lightbox Preview */}
      <AnimatePresence>
        {currentPreviewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
              <button
                onClick={() => setPreviewIndex(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              
              <span className="text-white/70 text-sm">
                {previewIndex! + 1} / {previewableFiles.length}
              </span>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleFavorite(currentPreviewFile)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Star className={cn(
                    "w-5 h-5",
                    currentPreviewFile.is_favorite ? "text-yellow-500 fill-yellow-500" : "text-white"
                  )} />
                </button>
                <button
                  onClick={() => downloadFile(currentPreviewFile)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, file: currentPreviewFile })}
                  className="p-2 hover:bg-red-500/20 rounded-full transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
              </div>
            </div>

            {/* Navigation */}
            {previewIndex! > 0 && (
              <button
                onClick={() => navigatePreview('prev')}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 hover:bg-white/10 rounded-full transition-colors z-10 hidden sm:flex"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
            )}
            {previewIndex! < previewableFiles.length - 1 && (
              <button
                onClick={() => navigatePreview('next')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 hover:bg-white/10 rounded-full transition-colors z-10 hidden sm:flex"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
            )}

            {/* Content */}
            <div className="flex-1 flex items-center justify-center p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPreviewFile.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="max-w-full max-h-full"
                >
                  {currentPreviewFile.mime_type.startsWith('image/') ? (
                    <img
                      src={currentPreviewFile.url}
                      alt={currentPreviewFile.filename}
                      className="max-w-full max-h-[80vh] object-contain rounded-lg"
                    />
                  ) : currentPreviewFile.mime_type.startsWith('video/') ? (
                    <video
                      src={currentPreviewFile.url}
                      controls
                      autoPlay
                      className="max-w-full max-h-[80vh] rounded-lg"
                    />
                  ) : currentPreviewFile.mime_type === 'application/pdf' ? (
                    <iframe
                      src={currentPreviewFile.url}
                      className="w-[90vw] h-[80vh] rounded-lg bg-white"
                    />
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* File name */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 rounded-xl">
              <p className="text-white text-sm">{currentPreviewFile.filename.replace(/^\d+-/, '')}</p>
            </div>

            {/* Swipe hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs sm:hidden">
              ← Wischen zum Navigieren →
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, file: null })}
        onConfirm={deleteConfirm.isMulti ? handleMultiDelete : handleDelete}
        itemName={deleteConfirm.isMulti ? `${selectedItems.size} Dateien` : deleteConfirm.file?.filename.replace(/^\d+-/, '')}
      />

      {/* Rename Dialog */}
      <RenameDialog
        isOpen={renameDialog.isOpen}
        onClose={() => setRenameDialog({ isOpen: false, file: null })}
        onRename={handleRename}
        currentName={renameDialog.file?.filename.replace(/^\d+-/, '').replace(/\.[^/.]+$/, '') || ''}
        title="Datei umbenennen"
      />

      {/* Click outside to close tag selector */}
      {showTagSelector && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowTagSelector(null)}
        />
      )}

      {/* Multi-select action bar */}
      <MultiSelectBar
        selectedCount={selectedItems.size}
        onClear={() => {
          setSelectedItems(new Set());
          setIsMultiSelectMode(false);
        }}
        onDelete={() => setDeleteConfirm({ isOpen: true, file: null, isMulti: true })}
        onTag={() => setShowBulkTagManager(true)}
        onFavorite={handleBulkFavorite}
      />

      {/* Bulk Tag Manager Modal */}
      <AnimatePresence>
        {showBulkTagManager && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowBulkTagManager(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-foreground mb-4">
                Tags für {selectedItems.size} Dateien
              </h2>
              <TagManager
                selectedTags={[]}
                onTagsChange={handleBulkTagUpdate}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowBulkTagManager(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-all"
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
