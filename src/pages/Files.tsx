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
  Pencil,
  Star,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  Grid3X3,
  List,
  Tag,
  CheckSquare,
  Square,
  Folder,
  Music,
  BookOpen,
  Archive,
  Briefcase,
  Camera,
  Film,
  Heart,
  Home,
  Image as ImageIcon,
  Inbox,
  Layers,
  Package,
  ArrowUpDown,
  Pin,
  PinOff,
  MoreVertical,
  QrCode,
  Clock,
  Link2,
  Share2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTags } from '@/hooks/useTags';
import { useViewHistory } from '@/hooks/useViewHistory';
import { useFileAlbums, FileAlbum } from '@/hooks/useFileAlbums';
import { useFiles as useFilesHook, FileItem } from '@/hooks/useFiles';
import { cn, formatFileSize } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { RenameDialog } from '@/components/RenameDialog';
import { MultiSelectBar } from '@/components/MultiSelect';
import { TagManager } from '@/components/TagManager';
import { SharedAlbumButton } from '@/components/SharedAlbumButton';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
import { HierarchicalAlbumPicker } from '@/components/HierarchicalAlbumPicker';
import { TemporaryShareLink } from '@/components/TemporaryShareLink';
import { useDuplicatePrevention } from '@/hooks/useDuplicatePrevention';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { DocumentPreview, isOfficeDocument, isOfficeDocumentByExtension, isTextFile } from '@/components/DocumentPreview';
import { MAX_FILE_SIZE_BYTES } from '@/config';

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'images' | 'videos' | 'documents' | 'audio';
type SortMode = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc' | 'favorites';

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('pdf')) return FileText;
  return File;
};

export default function Files() {
  // Use optimized files hook with caching and background URL fetching
  const {
    files,
    setFiles,
    isLoading,
    isUploading,
    uploadProgress,
    uploadFiles: uploadFilesFromHook,
    deleteFile: deleteFileFromHook,
    toggleFavorite: toggleFavoriteFromHook,
    updateFileTags: updateFileTagsFromHook,
    moveToAlbum: moveToAlbumFromHook,
    getSignedUrl,
  } = useFilesHook();
  const [searchQuery, setSearchQuery] = useState('');
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
  const [selectedAlbum, setSelectedAlbum] = useState<FileAlbum | null>(null);
  const [deleteAlbumConfirm, setDeleteAlbumConfirm] = useState<{ isOpen: boolean; album: FileAlbum | null; deleteContents?: boolean }>({
    isOpen: false,
    album: null,
    deleteContents: false,
  });
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumColor, setNewAlbumColor] = useState('#6366f1');
  const [newAlbumIcon, setNewAlbumIcon] = useState('folder');
  const [newAlbumParentId, setNewAlbumParentId] = useState<string | null>(null);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [singleFileAlbumPicker, setSingleFileAlbumPicker] = useState<FileItem | null>(null);
  const [editingAlbum, setEditingAlbum] = useState<FileAlbum | null>(null);
  const [showEditAlbumModal, setShowEditAlbumModal] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; file: FileItem | null; position: { x: number; y: number } }>({
    isOpen: false,
    file: null,
    position: { x: 0, y: 0 }
  });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const location = useLocation();
  const { tags } = useTags();
  const { recordView } = useViewHistory();
  const { checkForDuplicate, showDuplicateWarning, registerUpload, loadExistingHashes } = useDuplicatePrevention();
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const { 
    albums, 
    createAlbum, 
    deleteAlbum, 
    togglePin, 
    updateAlbum, 
    fetchAlbums, 
    getChildAlbums, 
    getBreadcrumb 
  } = useFileAlbums();

  // Load duplicate prevention hashes on mount
  useEffect(() => {
    loadExistingHashes();
  }, [loadExistingHashes]);

  // Real-time updates for albums only (files are managed by hook)
  useEffect(() => {
    if (!userId) return;

    const albumsChannel = supabase
      .channel('file-albums-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'file_albums' }, () => {
        fetchAlbums();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(albumsChannel);
    };
  }, [userId, fetchAlbums, supabase]);

  useEffect(() => {
    if (location.state?.action === 'upload-file') {
      fileInputRef.current?.click();
    }
  }, [location.state]);

  // Use the optimized upload from hook
  const handleUpload = async (fileList: FileList | null) => {
    await uploadFilesFromHook(fileList, selectedAlbum?.id || null);
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

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = files;

    // Filter by album
    if (selectedAlbum) {
      result = result.filter(f => f.album_id === selectedAlbum.id);
    }

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

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortMode) {
        case 'date-desc':
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        case 'date-asc':
          return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
        case 'name-asc':
          return a.filename.localeCompare(b.filename);
        case 'name-desc':
          return b.filename.localeCompare(a.filename);
        case 'size-desc':
          return b.size - a.size;
        case 'size-asc':
          return a.size - b.size;
        case 'favorites':
          if (a.is_favorite && !b.is_favorite) return -1;
          if (!a.is_favorite && b.is_favorite) return 1;
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [files, filterMode, selectedTagFilter, searchQuery, selectedAlbum, sortMode]);

  // Get child albums for current view
  const currentChildAlbums = useMemo(() => {
    return getChildAlbums(selectedAlbum?.id || null);
  }, [getChildAlbums, selectedAlbum]);

  // Breadcrumb for navigation
  const breadcrumb = useMemo(() => {
    if (!selectedAlbum) return [];
    return getBreadcrumb(selectedAlbum.id);
  }, [getBreadcrumb, selectedAlbum]);

  // Calculate file counts per album
  const fileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    files.forEach(f => {
      if (f.album_id) {
        counts[f.album_id] = (counts[f.album_id] || 0) + 1;
      }
    });
    return counts;
  }, [files]);

  // Album-Dropzone wurde mit der Sidebar entfernt – Album-Zuordnung läuft über den Album-Filter.

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) return;
    await createAlbum(newAlbumName, newAlbumColor, newAlbumIcon, newAlbumParentId);
    setNewAlbumName('');
    setNewAlbumColor('#6366f1');
    setNewAlbumIcon('folder');
    setNewAlbumParentId(null);
    setShowNewAlbumModal(false);
  };

  const handleDeleteAlbum = async (deleteContents: boolean) => {
    const album = deleteAlbumConfirm.album;
    if (!album) return;
    
    await deleteAlbum(album.id, deleteContents);
    
    if (selectedAlbum?.id === album.id) {
      // Navigate to parent or root
      const parentAlbum = album.parent_id ? albums.find(a => a.id === album.parent_id) : null;
      setSelectedAlbum(parentAlbum || null);
    }
    setDeleteAlbumConfirm({ isOpen: false, album: null });
  };

  const sortOptions = [
    { id: 'date-desc', label: 'Neueste zuerst' },
    { id: 'date-asc', label: 'Älteste zuerst' },
    { id: 'name-asc', label: 'Name (A-Z)' },
    { id: 'name-desc', label: 'Name (Z-A)' },
    { id: 'size-desc', label: 'Größe (absteigend)' },
    { id: 'size-asc', label: 'Größe (aufsteigend)' },
    { id: 'favorites', label: 'Favoriten zuerst' },
  ] as const;

  const handleBulkMoveToAlbum = async (albumId: string | null) => {
    if (selectedItems.size === 0) return;

    try {
      const { error } = await supabase
        .from('files')
        .update({ album_id: albumId })
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setFiles(prev => prev.map(f => 
        selectedItems.has(f.id) ? { ...f, album_id: albumId } : f
      ));
      setSelectedItems(new Set());
      setIsMultiSelectMode(false);
      setShowAlbumPicker(false);
      toast.success(albumId ? 'Zu Album hinzugefügt' : 'Aus Album entfernt');
    } catch (error) {
      console.error('Error moving to album:', error);
    }
  };

  const handleSingleFileMoveToAlbum = async (file: FileItem, albumId: string | null) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ album_id: albumId })
        .eq('id', file.id);

      if (error) throw error;

      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, album_id: albumId } : f
      ));
      setSingleFileAlbumPicker(null);
      toast.success(albumId ? 'Zu Album hinzugefügt' : 'Aus Album entfernt');
    } catch (error) {
      console.error('Error moving file to album:', error);
      toast.error('Fehler beim Verschieben');
    }
  };

  // Previewable files for lightbox
  const previewableFiles = useMemo(() => 
    filteredFiles.filter(f => 
      f.mime_type.startsWith('image/') || 
      f.mime_type.startsWith('video/') || 
      f.mime_type === 'application/pdf' ||
      isOfficeDocument(f.mime_type) ||
      isOfficeDocumentByExtension(f.filename) ||
      isTextFile(f.mime_type, f.filename)
    ),
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

  const canPreview = (mimeType: string, filename?: string) => {
    return mimeType.startsWith('image/') || 
           mimeType.startsWith('video/') || 
           mimeType === 'application/pdf' ||
           isOfficeDocument(mimeType) ||
           (filename ? isOfficeDocumentByExtension(filename) : false) ||
           (filename ? isTextFile(mimeType, filename) : false);
  };

  const currentPreviewFile = previewIndex !== null ? previewableFiles[previewIndex] : null;

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      file,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const handleLongPressStart = (file: FileItem, e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      setContextMenu({
        isOpen: true,
        file,
        position: { x: touch.clientX, y: touch.clientY }
      });
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, file: null, position: { x: 0, y: 0 } });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };

    if (contextMenu.isOpen) {
      window.addEventListener('click', handleClick);
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.isOpen]);

  return (
    <div className="space-y-6">

      {/* New Album Modal */}
      <AnimatePresence>
        {showNewAlbumModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewAlbumModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">Neues Album</h3>
              
              {/* Preview */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/50">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${newAlbumColor}20` }}
                >
                  {(() => {
                    const icons: Record<string, React.ReactNode> = {
                      folder: <Folder className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      music: <Music className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      book: <BookOpen className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      archive: <Archive className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      briefcase: <Briefcase className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      camera: <Camera className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      film: <Film className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      heart: <Heart className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      home: <Home className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      image: <ImageIcon className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      inbox: <Inbox className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      layers: <Layers className="w-6 h-6" style={{ color: newAlbumColor }} />,
                      package: <Package className="w-6 h-6" style={{ color: newAlbumColor }} />,
                    };
                    return icons[newAlbumIcon] || icons.folder;
                  })()}
                </div>
                <span className="text-foreground font-medium">
                  {newAlbumName || 'Album-Name'}
                </span>
              </div>
              
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Album-Name"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                autoFocus
              />
              
              {/* Color Selection */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Farbe</p>
                <div className="flex flex-wrap gap-2">
                  {['#6366f1', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ef4444', '#64748b'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewAlbumColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        newAlbumColor === color && "ring-2 ring-offset-2 ring-offset-card ring-foreground"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              {/* Icon Selection */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Icon</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'folder', Icon: Folder },
                    { id: 'music', Icon: Music },
                    { id: 'book', Icon: BookOpen },
                    { id: 'archive', Icon: Archive },
                    { id: 'briefcase', Icon: Briefcase },
                    { id: 'camera', Icon: Camera },
                    { id: 'film', Icon: Film },
                    { id: 'heart', Icon: Heart },
                    { id: 'home', Icon: Home },
                    { id: 'image', Icon: ImageIcon },
                    { id: 'inbox', Icon: Inbox },
                    { id: 'layers', Icon: Layers },
                    { id: 'package', Icon: Package },
                  ].map(({ id, Icon }) => (
                    <button
                      key={id}
                      onClick={() => setNewAlbumIcon(id)}
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                        newAlbumIcon === id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Parent Album Selection */}
              {albums.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2">Überordner (optional)</p>
                  <select
                    value={newAlbumParentId || ''}
                    onChange={(e) => setNewAlbumParentId(e.target.value || null)}
                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-foreground"
                  >
                    <option value="">Kein Überordner (Hauptebene)</option>
                    {albums.map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowNewAlbumModal(false);
                    setNewAlbumName('');
                    setNewAlbumColor('#6366f1');
                    setNewAlbumIcon('folder');
                    setNewAlbumParentId(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateAlbum}
                  className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Erstellen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Album Modal */}
        {showEditAlbumModal && editingAlbum && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditAlbumModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">Album bearbeiten</h3>
              
              {/* Preview */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/50">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${editingAlbum.color}20` }}
                >
                  {(() => {
                    const icons: Record<string, React.ReactNode> = {
                      folder: <Folder className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      music: <Music className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      book: <BookOpen className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      archive: <Archive className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      briefcase: <Briefcase className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      camera: <Camera className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      film: <Film className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      heart: <Heart className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      home: <Home className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      image: <ImageIcon className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      inbox: <Inbox className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      layers: <Layers className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                      package: <Package className="w-6 h-6" style={{ color: editingAlbum.color }} />,
                    };
                    return icons[editingAlbum.icon] || icons.folder;
                  })()}
                </div>
                <span className="text-foreground font-medium">
                  {editingAlbum.name || 'Album-Name'}
                </span>
              </div>
              
              <input
                type="text"
                value={editingAlbum.name}
                onChange={(e) => setEditingAlbum({ ...editingAlbum, name: e.target.value })}
                placeholder="Album-Name"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                autoFocus
              />
              
              {/* Color Selection */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Farbe</p>
                <div className="flex flex-wrap gap-2">
                  {['#6366f1', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ef4444', '#64748b'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingAlbum({ ...editingAlbum, color })}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        editingAlbum.color === color && "ring-2 ring-offset-2 ring-offset-card ring-foreground"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              {/* Icon Selection */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Icon</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'folder', Icon: Folder },
                    { id: 'music', Icon: Music },
                    { id: 'book', Icon: BookOpen },
                    { id: 'archive', Icon: Archive },
                    { id: 'briefcase', Icon: Briefcase },
                    { id: 'camera', Icon: Camera },
                    { id: 'film', Icon: Film },
                    { id: 'heart', Icon: Heart },
                    { id: 'home', Icon: Home },
                    { id: 'image', Icon: ImageIcon },
                    { id: 'inbox', Icon: Inbox },
                    { id: 'layers', Icon: Layers },
                    { id: 'package', Icon: Package },
                  ].map(({ id, Icon }) => (
                    <button
                      key={id}
                      onClick={() => setEditingAlbum({ ...editingAlbum, icon: id })}
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                        editingAlbum.icon === id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowEditAlbumModal(false);
                    setEditingAlbum(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => {
                    if (editingAlbum) {
                      updateAlbum(editingAlbum.id, {
                        name: editingAlbum.name,
                        color: editingAlbum.color,
                        icon: editingAlbum.icon,
                      });
                      setShowEditAlbumModal(false);
                      setEditingAlbum(null);
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Speichern
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Album Picker for bulk move - Hierarchical */}
      <AnimatePresence>
        {showAlbumPicker && (
          <HierarchicalAlbumPicker
            key="bulk-album-picker"
            albums={albums}
            selectedAlbumId={null}
            onSelect={(albumId) => {
              handleBulkMoveToAlbum(albumId);
            }}
            onClose={() => setShowAlbumPicker(false)}
            title={`${selectedItems.size} Dateien zu Album hinzufügen`}
          />
        )}
      </AnimatePresence>

      {/* Album Picker for single file - Hierarchical */}
      <AnimatePresence>
        {singleFileAlbumPicker && (
          <HierarchicalAlbumPicker
            key="single-file-album-picker"
            albums={albums}
            selectedAlbumId={singleFileAlbumPicker.album_id}
            onSelect={(albumId) => {
              handleSingleFileMoveToAlbum(singleFileAlbumPicker, albumId);
            }}
            onClose={() => setSingleFileAlbumPicker(null)}
            title="In Album verschieben"
            itemName={singleFileAlbumPicker.filename.replace(/^\d+-/, '')}
          />
        )}
      </AnimatePresence>

      {/* Delete Album Confirm Dialog */}
      {deleteAlbumConfirm.isOpen && deleteAlbumConfirm.album && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteAlbumConfirm({ isOpen: false, album: null })}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">Ordner löschen</h3>
            <p className="text-muted-foreground mb-6">
              Wie soll mit den Dateien in "{deleteAlbumConfirm.album.name}" verfahren werden?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleDeleteAlbum(false)}
                className="w-full px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
              >
                <p className="font-medium text-foreground">Nur Ordner löschen</p>
                <p className="text-sm text-muted-foreground">Dateien bleiben erhalten und werden in die Hauptebene verschoben</p>
              </button>
              <button
                onClick={() => handleDeleteAlbum(true)}
                className="w-full px-4 py-3 rounded-xl border border-destructive/50 hover:bg-destructive/10 transition-colors text-left"
              >
                <p className="font-medium text-destructive">Ordner und alle Inhalte löschen</p>
                <p className="text-sm text-muted-foreground">Alle Dateien werden in den Papierkorb verschoben</p>
              </button>
              <button
                onClick={() => setDeleteAlbumConfirm({ isOpen: false, album: null })}
                className="w-full px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors mt-4"
              >
                Abbrechen
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {/* Breadcrumb Navigation */}
            {selectedAlbum ? (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <button
                  onClick={() => setSelectedAlbum(null)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dateien
                </button>
                {breadcrumb.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <button
                      onClick={() => setSelectedAlbum(item)}
                      className={cn(
                        "text-sm transition-colors",
                        index === breadcrumb.length - 1 
                          ? "text-foreground font-medium" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            ) : null}
            
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {selectedAlbum ? selectedAlbum.name : 'Dateien'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {filteredFiles.length} Dateien • {formatFileSize(filteredFiles.reduce((acc, f) => acc + f.size, 0))} gesamt
              {currentChildAlbums.length > 0 && ` • ${currentChildAlbums.length} Unterordner`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Back button when in album - FIRST on the left */}
            {selectedAlbum && (
              <button
                onClick={() => {
                  const parentAlbum = selectedAlbum.parent_id 
                    ? albums.find(a => a.id === selectedAlbum.parent_id) 
                    : null;
                  setSelectedAlbum(parentAlbum || null);
                }}
                className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-muted hover:bg-muted/80 transition-all text-sm font-medium order-first"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Zurück</span>
              </button>
            )}

            {/* Sort dropdown */}
            <DropdownMenu open={showSortMenu} onOpenChange={setShowSortMenu}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-border hover:bg-muted transition-all text-sm font-medium">
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Sortieren</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-48 z-50">
                {sortOptions.map(option => (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => setSortMode(option.id)}
                    className={cn(sortMode === option.id && "bg-primary/10 text-primary")}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* New Folder button */}
            <button
              onClick={() => {
                setNewAlbumParentId(selectedAlbum?.id || null);
                setShowNewAlbumModal(true);
              }}
              className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-border hover:bg-muted transition-all text-sm font-medium"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden sm:inline">{selectedAlbum ? 'Unterordner' : 'Ordner'}</span>
            </button>

            {/* Multi-select toggle */}
            <button
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedItems(new Set());
              }}
              className={cn(
                "flex items-center justify-center gap-2 h-9 px-3 rounded-lg border transition-all text-sm font-medium",
                isMultiSelectMode 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "border-border hover:bg-muted"
              )}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Auswählen</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center h-9 border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "h-full px-3 transition-colors flex items-center justify-center",
                  viewMode === 'grid' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "h-full px-3 transition-colors flex items-center justify-center",
                  viewMode === 'list' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Hochladen</span>
            </button>
          </div>
        </div>
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

      {/* Upload Progress */}

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
      ) : (
        <>
          {/* Child Albums Grid - Apple Files style: folders always shown first */}
          {currentChildAlbums.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Ordner ({currentChildAlbums.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {currentChildAlbums.map((album) => {
                  const albumFileCount = files.filter(f => f.album_id === album.id).length;
                  const iconName = album.icon || 'folder';
                  const icons: Record<string, React.ReactNode> = {
                    folder: <Folder className="w-10 h-10" style={{ color: album.color }} />,
                    music: <Music className="w-10 h-10" style={{ color: album.color }} />,
                    book: <BookOpen className="w-10 h-10" style={{ color: album.color }} />,
                    archive: <Archive className="w-10 h-10" style={{ color: album.color }} />,
                    briefcase: <Briefcase className="w-10 h-10" style={{ color: album.color }} />,
                    camera: <Camera className="w-10 h-10" style={{ color: album.color }} />,
                    film: <Film className="w-10 h-10" style={{ color: album.color }} />,
                    heart: <Heart className="w-10 h-10" style={{ color: album.color }} />,
                    home: <Home className="w-10 h-10" style={{ color: album.color }} />,
                    image: <ImageIcon className="w-10 h-10" style={{ color: album.color }} />,
                    inbox: <Inbox className="w-10 h-10" style={{ color: album.color }} />,
                    layers: <Layers className="w-10 h-10" style={{ color: album.color }} />,
                    package: <Package className="w-10 h-10" style={{ color: album.color }} />,
                  };
                  
                  return (
                    <motion.div
                      key={album.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedAlbum(album)}
                      className="relative cursor-pointer rounded-2xl p-4 transition-all duration-200 group bg-card/50 hover:bg-card border border-border/50 hover:border-border hover:shadow-lg hover:shadow-black/5"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div 
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center mb-3"
                          style={{ backgroundColor: `${album.color || '#6366f1'}15` }}
                        >
                          {icons[iconName] || icons.folder}
                        </div>
                        <h4 className="text-sm font-medium text-foreground truncate w-full">{album.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{albumFileCount} Dateien</p>
                      </div>
                      
                      {/* Pin indicator */}
                      {album.is_pinned && (
                        <div className="absolute top-2 left-2">
                          <div className="p-1 rounded-md bg-primary/10">
                            <Pin className="w-3 h-3 text-primary" />
                          </div>
                        </div>
                      )}
                      
                      {/* Actions Menu */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg bg-background/80 hover:bg-background border border-border/50 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setNewAlbumParentId(album.id); setShowNewAlbumModal(true); }}>
                              <FolderPlus className="w-4 h-4 mr-2" />
                              Unterordner erstellen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingAlbum(album); setShowEditAlbumModal(true); }}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); togglePin(album.id); }}>
                              {album.is_pinned ? (
                                <>
                                  <PinOff className="w-4 h-4 mr-2" />
                                  Loslösen
                                </>
                              ) : (
                                <>
                                  <Pin className="w-4 h-4 mr-2" />
                                  Anpinnen
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); setDeleteAlbumConfirm({ isOpen: true, album }); }}
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
            </div>
          )}

          {/* Files Section Header */}
          {filteredFiles.length > 0 && currentChildAlbums.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <File className="w-4 h-4" />
              Dateien ({filteredFiles.length})
            </h3>
          )}

          {/* Files Grid */}
          {filteredFiles.length === 0 && currentChildAlbums.length === 0 ? (
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
          ) : filteredFiles.length > 0 && viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredFiles.map((file, index) => {
                const FileIcon = getFileIcon(file.mime_type);
                const isPreviewable = canPreview(file.mime_type, file.filename);
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
                onContextMenu={(e) => handleContextMenu(e, file)}
                onTouchStart={(e) => handleLongPressStart(file, e)}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
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
                        onClick={(e) => { e.stopPropagation(); setSingleFileAlbumPicker(file); }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Folder className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadFile(file); }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4 text-white" />
                      </button>
                      {/* Share Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShareFile(file); }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        title="Teilen"
                      >
                        <Share2 className="w-4 h-4 text-white" />
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
          ) : filteredFiles.length > 0 && viewMode === 'list' ? (
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
                    onContextMenu={(e) => handleContextMenu(e, file)}
                    onTouchStart={(e) => handleLongPressStart(file, e)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchMove={handleLongPressEnd}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)} • {formatDate(file.uploaded_at)}
                        </p>
                        {file.album_id && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
                            <Folder className="w-3 h-3" />
                            {albums.find((a) => a.id === file.album_id)?.name || 'Album'}
                          </span>
                        )}
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
                        onClick={() => setSingleFileAlbumPicker(file)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <Folder className="w-5 h-5 text-muted-foreground" />
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
          ) : null}
        </>
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
                  ) : (isOfficeDocument(currentPreviewFile.mime_type) || isOfficeDocumentByExtension(currentPreviewFile.filename) || isTextFile(currentPreviewFile.mime_type, currentPreviewFile.filename)) ? (
                    <DocumentPreview
                      url={currentPreviewFile.url || ''}
                      filename={currentPreviewFile.filename}
                      mimeType={currentPreviewFile.mime_type}
                      onClose={() => setPreviewIndex(null)}
                      onPrevious={previewIndex! > 0 ? () => navigatePreview('prev') : undefined}
                      onNext={previewIndex! < previewableFiles.length - 1 ? () => navigatePreview('next') : undefined}
                      hasPrevious={previewIndex! > 0}
                      hasNext={previewIndex! < previewableFiles.length - 1}
                      onDownload={() => downloadFile(currentPreviewFile)}
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

      {/* Album Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={deleteAlbumConfirm.isOpen}
        onClose={() => setDeleteAlbumConfirm({ isOpen: false, album: null })}
        onConfirm={async () => {
          const album = deleteAlbumConfirm.album;
          if (!album) return;
          const ok = await deleteAlbum(album.id);
          if (ok && selectedAlbum?.id === album.id) {
            setSelectedAlbum(null);
          }
          setDeleteAlbumConfirm({ isOpen: false, album: null });
        }}
        title="Album löschen"
        itemName={deleteAlbumConfirm.album?.name || undefined}
        description={
          deleteAlbumConfirm.album?.name
            ? `Möchtest du "${deleteAlbumConfirm.album.name}" löschen? Dateien bleiben erhalten und werden aus dem Album entfernt.`
            : 'Möchtest du dieses Album löschen? Dateien bleiben erhalten und werden aus dem Album entfernt.'
        }
      />

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
        totalCount={filteredFiles.length}
        onClear={() => {
          setSelectedItems(new Set());
          setIsMultiSelectMode(false);
        }}
        onDelete={() => setDeleteConfirm({ isOpen: true, file: null, isMulti: true })}
        onTag={() => setShowBulkTagManager(true)}
        onFavorite={handleBulkFavorite}
        onMove={() => setShowAlbumPicker(true)}
        onSelectAll={() => {
          const allIds = new Set(filteredFiles.map(f => f.id));
          setSelectedItems(allIds);
        }}
        availableTags={tags}
        onSelectByTag={(tagId) => {
          const matchingIds = filteredFiles.filter(f => f.tags?.includes(tagId)).map(f => f.id);
          setSelectedItems(prev => {
            const newSet = new Set(prev);
            matchingIds.forEach(id => newSet.add(id));
            return newSet;
          });
        }}
        availableDates={(() => {
          const dateMap = new Map<string, number>();
          filteredFiles.forEach(f => {
            const date = new Date(f.uploaded_at).toISOString().split('T')[0];
            dateMap.set(date, (dateMap.get(date) || 0) + 1);
          });
          return Array.from(dateMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, count]) => ({
              date,
              label: new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }),
              count,
            }));
        })()}
        onSelectByDate={(date) => {
          const matchingIds = filteredFiles
            .filter(f => new Date(f.uploaded_at).toISOString().split('T')[0] === date)
            .map(f => f.id);
          setSelectedItems(prev => {
            const newSet = new Set(prev);
            matchingIds.forEach(id => newSet.add(id));
            return newSet;
          });
        }}
      />

      {/* Shared Album Button for Multi-Select */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
          <SharedAlbumButton
            selectedItemIds={Array.from(selectedItems)}
            itemType="file"
            contentType="files"
            onComplete={() => {
              setSelectedItems(new Set());
              setIsMultiSelectMode(false);
            }}
          />
        </div>
      )}

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

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu.isOpen && contextMenu.file && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[100] min-w-[200px] py-2 bg-card border border-border rounded-xl shadow-xl"
            style={{
              left: Math.min(contextMenu.position.x, window.innerWidth - 220),
              top: Math.min(contextMenu.position.y, window.innerHeight - 320),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                toggleFavorite(contextMenu.file!);
                closeContextMenu();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Star className={cn("w-4 h-4", contextMenu.file.is_favorite ? "text-yellow-500 fill-yellow-500" : "")} />
              {contextMenu.file.is_favorite ? 'Favorit entfernen' : 'Als Favorit'}
            </button>
            <button
              onClick={() => {
                setShowTagSelector(contextMenu.file!.id);
                closeContextMenu();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Tag className="w-4 h-4" />
              Tags bearbeiten
            </button>
            <button
              onClick={() => {
                setSingleFileAlbumPicker(contextMenu.file!);
                closeContextMenu();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Folder className="w-4 h-4" />
              In Album verschieben
            </button>
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => {
                downloadFile(contextMenu.file!);
                closeContextMenu();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Download className="w-4 h-4" />
              Herunterladen
            </button>
            <button
              onClick={() => {
                setRenameDialog({ isOpen: true, file: contextMenu.file! });
                closeContextMenu();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Umbenennen
            </button>
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => {
                setDeleteConfirm({ isOpen: true, file: contextMenu.file! });
                closeContextMenu();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Löschen
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share File Dialog */}
      {shareFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShareFile(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Datei teilen
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              "{shareFile.filename.replace(/^\d+-/, '')}"
            </p>
            <div className="space-y-3">
              {shareFile.url && (
                <QRCodeGenerator
                  url={shareFile.url}
                  title={`QR für ${shareFile.filename.replace(/^\d+-/, '')}`}
                  trigger={
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors">
                      <QrCode className="w-5 h-5 text-primary" />
                      <span className="text-foreground">QR-Code generieren</span>
                    </button>
                  }
                />
              )}
              <TemporaryShareLink
                itemId={shareFile.id}
                itemType="file"
                itemName={shareFile.filename.replace(/^\d+-/, '')}
                trigger={
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors">
                    <Clock className="w-5 h-5 text-primary" />
                    <span className="text-foreground">Temporären Link erstellen</span>
                  </button>
                }
              />
            </div>
            <button
              onClick={() => setShareFile(null)}
              className="w-full mt-4 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
