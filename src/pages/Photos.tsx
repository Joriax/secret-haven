import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Camera, 
  X, 
  FolderPlus, 
  Image as ImageIcon, 
  Loader2, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Heart,
  Download,
  Pencil,
  MoreVertical,
  Play,
  Pause,
  Film,
  Grid3X3,
  LayoutGrid,
  Maximize2,
  Volume2,
  VolumeX,
  Tag,
  CheckSquare,
  Square,
  Search,
  GripVertical,
  SlidersHorizontal,
  ArrowUpDown,
  PlayCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Pin,
  PinOff,
  Folder,
  Star,
  Music,
  Video,
  FileText,
  Palette,
  Share2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTags } from '@/hooks/useTags';
import { useViewHistory } from '@/hooks/useViewHistory';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { RenameDialog } from '@/components/RenameDialog';
import { MultiSelectBar } from '@/components/MultiSelect';
import { TagManager } from '@/components/TagManager';
import { SharedAlbumButton } from '@/components/SharedAlbumButton';
import { ShareToAlbumDialog } from '@/components/ShareToAlbumDialog';
import { toast } from 'sonner';
import { useSecurityLogs } from '@/hooks/useSecurityLogs';

// Video file extensions and MIME types
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|avi|mkv|m4v|3gp|ogv|wmv|flv)$/i;
const VIDEO_MIME_TYPES = [
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 
  'video/x-matroska', 'video/x-m4v', 'video/3gpp', 'video/ogg',
  'video/x-ms-wmv', 'video/x-flv'
];

// Image file extensions
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|avif|tiff|svg)$/i;

// Helper to determine if file is video
const isVideoFile = (filename: string, mimeType?: string): boolean => {
  if (mimeType && VIDEO_MIME_TYPES.some(type => mimeType.toLowerCase().startsWith(type.split('/')[0]))) {
    return mimeType.toLowerCase().startsWith('video/');
  }
  return VIDEO_EXTENSIONS.test(filename);
};

// Get appropriate MIME type for file
const getMimeType = (filename: string, originalMimeType?: string): string => {
  if (originalMimeType) return originalMimeType;
  
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    m4v: 'video/x-m4v',
    '3gp': 'video/3gpp',
    ogv: 'video/ogg',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    avif: 'image/avif',
  };
  
  return mimeMap[ext || ''] || 'application/octet-stream';
};

interface MediaItem {
  id: string;
  filename: string;
  caption: string;
  album_id: string | null;
  taken_at: string;
  uploaded_at: string;
  url?: string;
  is_favorite?: boolean;
  type: 'photo' | 'video';
  mime_type?: string;
  tags?: string[];
}

interface Album {
  id: string;
  name: string;
  created_at: string;
  cover_url?: string;
  count?: number;
  is_pinned?: boolean;
  color?: string;
  icon?: string;
}

type ViewMode = 'all' | 'photos' | 'videos' | 'albums';
type SortMode = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'favorites';

export default function Photos() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumColor, setNewAlbumColor] = useState('#6366f1');
  const [newAlbumIcon, setNewAlbumIcon] = useState('folder');
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [showEditAlbumModal, setShowEditAlbumModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; item: MediaItem | null; isMulti?: boolean }>({ isOpen: false, item: null });
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; item: MediaItem | null }>({ isOpen: false, item: null });
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showBulkTagManager, setShowBulkTagManager] = useState(false);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [singlePhotoAlbumPicker, setSinglePhotoAlbumPicker] = useState<MediaItem | null>(null);
  const [shareToAlbum, setShareToAlbum] = useState<{ isOpen: boolean; photo: MediaItem | null }>({ isOpen: false, photo: null });
  const [showTagSelector, setShowTagSelector] = useState<string | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedItem, setDraggedItem] = useState<MediaItem | null>(null);
  const [dragOverAlbum, setDragOverAlbum] = useState<string | null>(null);
  const [isAlbumSidebarOpen, setIsAlbumSidebarOpen] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [slideshowInterval, setSlideshowInterval] = useState(3000);
  const slideshowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number | null>(null);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const location = useLocation();
  const { tags } = useTags();
  const { logEvent } = useSecurityLogs();
  const { recordView } = useViewHistory();

  const fetchData = useCallback(async () => {
    if (!userId) return;

    if (isDecoyMode) {
      setMedia([]);
      setAlbums([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [photosRes, albumsRes] = await Promise.all([
        supabase.from('photos').select('*').eq('user_id', userId).is('deleted_at', null).order('uploaded_at', { ascending: false }),
        supabase.from('albums').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

      if (photosRes.error) throw photosRes.error;
      if (albumsRes.error) throw albumsRes.error;

      const photosWithUrls = await Promise.all(
        (photosRes.data || []).map(async (photo) => {
          const { data } = await supabase.storage
            .from('photos')
            .createSignedUrl(`${userId}/${photo.filename}`, 3600);
          
          const isVideo = isVideoFile(photo.filename);
          const mimeType = getMimeType(photo.filename);
          
          return { 
            ...photo, 
            url: data?.signedUrl,
            type: isVideo ? 'video' as const : 'photo' as const,
            mime_type: mimeType
          };
        })
      );

      // Get album cover and count
      const albumsWithCovers = await Promise.all(
        (albumsRes.data || []).map(async (album) => {
          const albumPhotos = photosWithUrls.filter(p => p.album_id === album.id);
          return {
            ...album,
            cover_url: albumPhotos[0]?.url,
            count: albumPhotos.length
          };
        })
      );

      setMedia(photosWithUrls);
      setAlbums(albumsWithCovers);
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time updates for photos and albums
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('photos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'albums' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  useEffect(() => {
    if (location.state?.action === 'upload-photo') {
      fileInputRef.current?.click();
    }
  }, [location.state]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !userId) return;

    setIsUploading(true);
    setUploadProgress(0);
    const totalFiles = files.length;
    let uploaded = 0;
    let skipped = 0;

    // Filter valid media files first
    const validFiles = Array.from(files).filter(file => {
      const isVideo = file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name);
      const isImage = file.type.startsWith('image/') || IMAGE_EXTENSIONS.test(file.name);
      return isVideo || isImage;
    });

    if (validFiles.length === 0) {
      toast.error('Keine gültigen Medien-Dateien gefunden');
      setIsUploading(false);
      return;
    }

    // Check file size limits (500MB for videos, 50MB for images)
    const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
    const MAX_IMAGE_SIZE = 50 * 1024 * 1024;  // 50MB

    try {
      for (const file of validFiles) {
        const isVideo = file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name);
        const isImage = file.type.startsWith('image/') || IMAGE_EXTENSIONS.test(file.name);
        
        // Check file size
        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (file.size > maxSize) {
          toast.error(`${file.name} ist zu groß (max. ${isVideo ? '500MB' : '50MB'})`);
          skipped++;
          continue;
        }

        const filename = `${Date.now()}-${file.name}`;
        const mimeType = file.type || getMimeType(file.name);
        
        // Upload with proper content type
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(`${userId}/${filename}`, file, {
            contentType: mimeType,
            cacheControl: '3600',
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Fehler bei ${file.name}: ${uploadError.message}`);
          skipped++;
          continue;
        }

        const { data: photoData, error: dbError } = await supabase
          .from('photos')
          .insert({
            user_id: userId,
            filename,
            caption: '',
            album_id: selectedAlbum?.id || null,
          })
          .select()
          .single();

        if (dbError) {
          console.error('DB error:', dbError);
          skipped++;
          continue;
        }

        const { data: urlData } = await supabase.storage
          .from('photos')
          .createSignedUrl(`${userId}/${filename}`, 3600);

        const mediaType = isVideo ? 'video' as const : 'photo' as const;

        setMedia(prev => [{
          ...photoData, 
          url: urlData?.signedUrl,
          type: mediaType,
          mime_type: mimeType
        }, ...prev]);

        uploaded++;
        setUploadProgress((uploaded / validFiles.length) * 100);
      }
      
      if (uploaded > 0) {
        toast.success(`${uploaded} ${uploaded === 1 ? 'Datei' : 'Dateien'} hochgeladen${skipped > 0 ? `, ${skipped} übersprungen` : ''}`);
        logEvent('photo_upload', { count: uploaded, album: selectedAlbum?.name || null });
      } else if (skipped > 0) {
        toast.error(`Alle ${skipped} Dateien konnten nicht hochgeladen werden`);
      }
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Fehler beim Hochladen');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const createAlbum = async () => {
    if (!newAlbumName.trim() || !userId) return;

    try {
      const { data, error } = await supabase
        .from('albums')
        .insert({
          user_id: userId,
          name: newAlbumName.trim(),
          color: newAlbumColor,
          icon: newAlbumIcon,
        })
        .select()
        .single();

      if (error) throw error;

      setAlbums([{ ...data, count: 0 }, ...albums]);
      setNewAlbumName('');
      setNewAlbumColor('#6366f1');
      setNewAlbumIcon('folder');
      setShowNewAlbumModal(false);
      toast.success('Album erstellt');
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Fehler beim Erstellen');
    }
  };

  const updateAlbum = async () => {
    if (!editingAlbum || !userId) return;

    try {
      const { error } = await supabase
        .from('albums')
        .update({
          name: editingAlbum.name,
          color: editingAlbum.color,
          icon: editingAlbum.icon,
        })
        .eq('id', editingAlbum.id);

      if (error) throw error;

      setAlbums(prev => prev.map(a => 
        a.id === editingAlbum.id ? { ...a, ...editingAlbum } : a
      ));
      setEditingAlbum(null);
      setShowEditAlbumModal(false);
      toast.success('Album aktualisiert');
    } catch (error) {
      console.error('Error updating album:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const openEditAlbumModal = (album: Album) => {
    setEditingAlbum({ ...album });
    setShowEditAlbumModal(true);
  };

  const deleteAlbum = async (albumId: string) => {
    if (!userId) return;

    try {
      // First, move all photos in this album to "no album"
      await supabase
        .from('photos')
        .update({ album_id: null })
        .eq('album_id', albumId);

      // Then delete the album
      const { error } = await supabase
        .from('albums')
        .delete()
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev => prev.filter(a => a.id !== albumId));
      if (selectedAlbum?.id === albumId) {
        setSelectedAlbum(null);
      }
      fetchData();
      toast.success('Album gelöscht');
    } catch (error) {
      console.error('Error deleting album:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const toggleAlbumPin = async (albumId: string) => {
    const album = albums.find(a => a.id === albumId);
    if (!album) return;

    try {
      const newPinned = !album.is_pinned;
      const { error } = await supabase
        .from('albums')
        .update({ is_pinned: newPinned })
        .eq('id', albumId);

      if (error) throw error;

      setAlbums(prev => {
        const updated = prev.map(a => 
          a.id === albumId ? { ...a, is_pinned: newPinned } : a
        );
        // Re-sort: pinned first
        return updated.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
      
      toast.success(newPinned ? 'Album angepinnt' : 'Album losgelöst');
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };


  const handleDelete = async () => {
    if (!userId || !deleteConfirm.item) return;

    const item = deleteConfirm.item;
    try {
      const { error } = await supabase
        .from('photos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;

      setMedia(prev => prev.filter(m => m.id !== item.id));
      setDeleteConfirm({ isOpen: false, item: null });
      setLightboxIndex(null);
      logEvent('photo_delete', { filename: item.filename });
      toast.success('In Papierkorb verschoben');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleMultiDelete = async () => {
    if (!userId || selectedItems.size === 0) return;

    try {
      const { error } = await supabase
        .from('photos')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setMedia(prev => prev.filter(m => !selectedItems.has(m.id)));
      setSelectedItems(new Set());
      setIsMultiSelectMode(false);
      setDeleteConfirm({ isOpen: false, item: null });
      logEvent('photo_bulk_delete', { count: selectedItems.size });
      toast.success(`${selectedItems.size} Elemente in Papierkorb verschoben`);
    } catch (error) {
      console.error('Error deleting:', error);
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

  const updateMediaTags = async (itemId: string, newTags: string[]) => {
    try {
      const { error } = await supabase
        .from('photos')
        .update({ tags: newTags })
        .eq('id', itemId);

      if (error) throw error;

      setMedia(prev => prev.map(m => 
        m.id === itemId ? { ...m, tags: newTags } : m
      ));
      toast.success('Tags aktualisiert');
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const handleBulkTagUpdate = async (newTags: string[]) => {
    if (selectedItems.size === 0) return;

    try {
      const { error } = await supabase
        .from('photos')
        .update({ tags: newTags })
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setMedia(prev => prev.map(m => 
        selectedItems.has(m.id) ? { ...m, tags: newTags } : m
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
        .from('photos')
        .update({ is_favorite: true })
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setMedia(prev => prev.map(m => 
        selectedItems.has(m.id) ? { ...m, is_favorite: true } : m
      ));
      setSelectedItems(new Set());
      setIsMultiSelectMode(false);
      toast.success('Zu Favoriten hinzugefügt');
    } catch (error) {
      console.error('Error updating favorites:', error);
    }
  };

  const handleBulkMoveToAlbum = async (albumId: string | null) => {
    if (selectedItems.size === 0) return;

    try {
      const { error } = await supabase
        .from('photos')
        .update({ album_id: albumId })
        .in('id', Array.from(selectedItems));

      if (error) throw error;

      setMedia(prev => prev.map(m => 
        selectedItems.has(m.id) ? { ...m, album_id: albumId } : m
      ));
      setSelectedItems(new Set());
      setIsMultiSelectMode(false);
      setShowAlbumPicker(false);
      fetchData();
      toast.success(albumId ? 'Zu Album hinzugefügt' : 'Aus Album entfernt');
    } catch (error) {
      console.error('Error moving to album:', error);
    }
  };

  const handleSinglePhotoMoveToAlbum = async (item: MediaItem, albumId: string | null) => {
    try {
      const { error } = await supabase
        .from('photos')
        .update({ album_id: albumId })
        .eq('id', item.id);

      if (error) throw error;

      setMedia(prev => prev.map(m => 
        m.id === item.id ? { ...m, album_id: albumId } : m
      ));
      setSinglePhotoAlbumPicker(null);
      fetchData();
      toast.success(albumId ? 'Zu Album hinzugefügt' : 'Aus Album entfernt');
    } catch (error) {
      console.error('Error moving photo to album:', error);
      toast.error('Fehler beim Verschieben');
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameDialog.item) return;

    try {
      const { error } = await supabase
        .from('photos')
        .update({ caption: newName })
        .eq('id', renameDialog.item.id);

      if (error) throw error;

      setMedia(prev => prev.map(m => 
        m.id === renameDialog.item?.id ? { ...m, caption: newName } : m
      ));
      toast.success('Umbenannt');
    } catch (error) {
      console.error('Error renaming:', error);
      toast.error('Fehler beim Umbenennen');
    }
  };

  const toggleFavorite = async (item: MediaItem) => {
    try {
      const newValue = !item.is_favorite;
      const { error } = await supabase
        .from('photos')
        .update({ is_favorite: newValue })
        .eq('id', item.id);

      if (error) throw error;

      setMedia(prev => prev.map(m => 
        m.id === item.id ? { ...m, is_favorite: newValue } : m
      ));
      toast.success(newValue ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt');
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const downloadMedia = async (item: MediaItem) => {
    if (!item.url) return;

    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.caption || item.filename.replace(/^\d+-/, '');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download gestartet');
      logEvent('photo_download', { filename: item.filename });
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Fehler beim Download');
    }
  };

  const moveToAlbum = async (item: MediaItem, albumId: string | null) => {
    try {
      const { error } = await supabase
        .from('photos')
        .update({ album_id: albumId })
        .eq('id', item.id);

      if (error) throw error;

      setMedia(prev => prev.map(m => 
        m.id === item.id ? { ...m, album_id: albumId } : m
      ));
      
      // Update album counts
      fetchData();
      toast.success(albumId ? 'Zu Album hinzugefügt' : 'Aus Album entfernt');
    } catch (error) {
      console.error('Error moving to album:', error);
    }
  };

  // Filter and sort media based on view mode, tags, search, and sort
  const filteredMedia = useMemo(() => {
    let result = media;
    
    if (selectedAlbum) {
      result = result.filter(m => m.album_id === selectedAlbum.id);
    } else if (viewMode === 'photos') {
      result = result.filter(m => m.type === 'photo');
    } else if (viewMode === 'videos') {
      result = result.filter(m => m.type === 'video');
    }

    // Filter by tag
    if (selectedTagFilter) {
      result = result.filter(m => m.tags?.includes(selectedTagFilter));
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.filename.toLowerCase().includes(query) ||
        (m.caption && m.caption.toLowerCase().includes(query))
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
          return (a.caption || a.filename).localeCompare(b.caption || b.filename);
        case 'name-desc':
          return (b.caption || b.filename).localeCompare(a.caption || a.filename);
        case 'favorites':
          if (a.is_favorite && !b.is_favorite) return -1;
          if (!a.is_favorite && b.is_favorite) return 1;
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        default:
          return 0;
      }
    });
    
    return result;
  }, [media, selectedAlbum, viewMode, selectedTagFilter, searchQuery, sortMode]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, item: MediaItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverAlbum(null);
  };

  const handleAlbumDragOver = (e: React.DragEvent, albumId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverAlbum(albumId);
  };

  const handleAlbumDragLeave = () => {
    setDragOverAlbum(null);
  };

  const handleAlbumDrop = async (e: React.DragEvent, albumId: string) => {
    e.preventDefault();
    setDragOverAlbum(null);
    
    if (!draggedItem) return;

    try {
      const { error } = await supabase
        .from('photos')
        .update({ album_id: albumId })
        .eq('id', draggedItem.id);

      if (error) throw error;

      setMedia(prev => prev.map(m => 
        m.id === draggedItem.id ? { ...m, album_id: albumId } : m
      ));
      fetchData();
      toast.success('Zu Album hinzugefügt');
    } catch (error) {
      console.error('Error moving to album:', error);
      toast.error('Fehler beim Verschieben');
    }
    
    setDraggedItem(null);
  };

  // Lightbox navigation
  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (lightboxIndex === null) return;
    
    if (direction === 'prev' && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
      setIsVideoPlaying(false);
      resetZoom();
    } else if (direction === 'next' && lightboxIndex < filteredMedia.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
      setIsVideoPlaying(false);
      resetZoom();
    }
  };

  // Zoom functions
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 4));
  };

  const zoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setImagePosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (currentLightboxItem?.type === 'video') return;
    e.preventDefault();
    
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  // Image drag handlers for panning when zoomed
  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: imagePosition.x,
      posY: imagePosition.y
    };
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    setImagePosition({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY
    });
  };

  const handleImageMouseUp = () => {
    setIsDragging(false);
  };

  // Double click to toggle zoom
  const handleImageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoomLevel > 1) {
      resetZoom();
    } else {
      setZoomLevel(2);
    }
  };

  // Touch handlers for swipe navigation and pinch zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistanceRef.current = distance;
      initialPinchZoomRef.current = zoomLevel;
    } else if (e.touches.length === 1) {
      // Single touch - for swipe or pan
      touchStartX.current = e.touches[0].clientX;
      if (zoomLevel > 1) {
        lastTouchRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      // Pinch zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = distance / initialPinchDistanceRef.current;
      const newZoom = Math.min(Math.max(initialPinchZoomRef.current * scale, 1), 4);
      setZoomLevel(newZoom);
      
      if (newZoom === 1) {
        setImagePosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && zoomLevel > 1 && lastTouchRef.current) {
      // Pan when zoomed
      const deltaX = e.touches[0].clientX - lastTouchRef.current.x;
      const deltaY = e.touches[0].clientY - lastTouchRef.current.y;
      
      setImagePosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Reset pinch tracking
    if (e.touches.length < 2) {
      initialPinchDistanceRef.current = null;
    }
    
    // Handle swipe navigation only if not zoomed
    if (zoomLevel <= 1 && touchStartX.current !== null && e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX.current - touchEndX;
      
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          navigateLightbox('next');
        } else {
          navigateLightbox('prev');
        }
      }
    }
    
    touchStartX.current = null;
    lastTouchRef.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      
      if (e.key === 'ArrowLeft') navigateLightbox('prev');
      if (e.key === 'ArrowRight') navigateLightbox('next');
      if (e.key === 'Escape') {
        setLightboxIndex(null);
        stopSlideshow();
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (isSlideshow) stopSlideshow();
        else startSlideshow();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, filteredMedia.length, isSlideshow]);

  // Wake Lock functions for slideshow
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Wake Lock acquired');
      }
    } catch (err) {
      console.log('Wake Lock failed:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake Lock released');
      } catch (err) {
        console.log('Wake Lock release failed:', err);
      }
    }
  };

  // Slideshow functions
  const startSlideshow = async () => {
    if (filteredMedia.length === 0) return;
    
    // Only photos for slideshow
    const photosOnly = filteredMedia.filter(m => m.type === 'photo');
    if (photosOnly.length === 0) {
      toast.error('Keine Fotos für Slideshow verfügbar');
      return;
    }
    
    if (lightboxIndex === null) {
      const firstPhotoIndex = filteredMedia.findIndex(m => m.type === 'photo');
      setLightboxIndex(firstPhotoIndex >= 0 ? firstPhotoIndex : 0);
    }
    
    // Request wake lock to prevent screen from sleeping
    await requestWakeLock();
    
    setIsSlideshow(true);
    toast.success('Slideshow gestartet');
  };

  const stopSlideshow = async () => {
    setIsSlideshow(false);
    if (slideshowTimerRef.current) {
      clearInterval(slideshowTimerRef.current);
      slideshowTimerRef.current = null;
    }
    // Release wake lock
    await releaseWakeLock();
  };

  // Slideshow timer
  useEffect(() => {
    if (isSlideshow && lightboxIndex !== null) {
      slideshowTimerRef.current = setInterval(() => {
        setLightboxIndex(prev => {
          if (prev === null) return null;
          // Find next photo (skip videos)
          let nextIndex = prev + 1;
          while (nextIndex < filteredMedia.length && filteredMedia[nextIndex]?.type === 'video') {
            nextIndex++;
          }
          if (nextIndex >= filteredMedia.length) {
            // Loop back to first photo
            nextIndex = filteredMedia.findIndex(m => m.type === 'photo');
            if (nextIndex === -1) nextIndex = 0;
          }
          return nextIndex;
        });
      }, slideshowInterval);

      return () => {
        if (slideshowTimerRef.current) {
          clearInterval(slideshowTimerRef.current);
        }
      };
    }
  }, [isSlideshow, slideshowInterval, filteredMedia.length]);

  // Cleanup slideshow and wake lock on unmount
  useEffect(() => {
    return () => {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current);
      }
      // Also release wake lock on unmount
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  const currentLightboxItem = lightboxIndex !== null ? filteredMedia[lightboxIndex] : null;

  const sortOptions = [
    { id: 'date-desc', label: 'Neueste zuerst' },
    { id: 'date-asc', label: 'Älteste zuerst' },
    { id: 'name-asc', label: 'Name (A-Z)' },
    { id: 'name-desc', label: 'Name (Z-A)' },
    { id: 'favorites', label: 'Favoriten zuerst' },
  ] as const;

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            {selectedAlbum ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedAlbum(null)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">{selectedAlbum.name}</h1>
                  <p className="text-muted-foreground text-sm">
                    {filteredMedia.length} Elemente
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fotos & Videos</h1>
                <p className="text-muted-foreground text-sm">
                  {media.filter(m => m.type === 'photo').length} Fotos • {media.filter(m => m.type === 'video').length} Videos • {albums.length} Alben
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Slideshow button */}
            {viewMode !== 'albums' && filteredMedia.filter(m => m.type === 'photo').length > 0 && (
              <button
                onClick={startSlideshow}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted transition-all text-sm"
              >
                <PlayCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Slideshow</span>
              </button>
            )}

            {/* Sort dropdown */}
            {viewMode !== 'albums' && (
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted transition-all text-sm"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Sortieren</span>
                </button>
                {showSortMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowSortMenu(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border shadow-xl rounded-xl p-2 z-50">
                      {sortOptions.map(option => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setSortMode(option.id);
                            setShowSortMenu(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg text-left text-sm transition-all",
                            sortMode === option.id 
                              ? "bg-primary/20 text-primary" 
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

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

            <button
              onClick={() => setShowNewAlbumModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted transition-all text-sm"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Album</span>
            </button>
            
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted transition-all text-sm"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Kamera</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all text-sm text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              <span>Hochladen</span>
            </button>
          </div>
        </div>

        {/* View Mode Tabs */}
        {!selectedAlbum && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { id: 'all', label: 'Alle', icon: LayoutGrid },
              { id: 'photos', label: 'Fotos', icon: ImageIcon },
              { id: 'videos', label: 'Videos', icon: Film },
              { id: 'albums', label: 'Alben', icon: Grid3X3 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as ViewMode)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all text-sm",
                  viewMode === tab.id
                    ? "bg-gradient-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Tag Filter */}
        {tags.length > 0 && viewMode !== 'albums' && !selectedAlbum && (
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

      {/* Search */}
      {viewMode !== 'albums' && !selectedAlbum && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Fotos und Videos suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground"
          />
        </motion.div>
      )}

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Upload Progress */}
      {isUploading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
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
            />
          </div>
        </motion.div>
      )}

      {/* Albums View */}
      {viewMode === 'albums' && !selectedAlbum && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {albums.map((album) => (
            <motion.div
              key={album.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedAlbum(album)}
              onDragOver={(e) => handleAlbumDragOver(e, album.id)}
              onDragLeave={handleAlbumDragLeave}
              onDrop={(e) => handleAlbumDrop(e, album.id)}
              className={cn(
                "glass-card-hover overflow-hidden cursor-pointer aspect-square relative group transition-all",
                dragOverAlbum === album.id && "ring-2 ring-primary scale-105"
              )}
            >
              {album.cover_url ? (
                <img
                  src={album.cover_url}
                  alt={album.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: album.color || '#6366f1' }}
                >
                  {(() => {
                    const iconName = album.icon || 'folder';
                    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
                      folder: Folder,
                      star: Star,
                      heart: Heart,
                      image: ImageIcon,
                      video: Video,
                      music: Music,
                    };
                    const IconComponent = icons[iconName] || Folder;
                    return <IconComponent className="w-12 h-12 text-white/80" />;
                  })()}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              
              {/* Pin indicator & actions */}
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {album.is_pinned && (
                  <div className="p-1.5 rounded-lg bg-primary/80">
                    <Pin className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditAlbumModal(album);
                  }}
                  className="p-1.5 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all"
                  title="Album bearbeiten"
                >
                  <Pencil className="w-3.5 h-3.5 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAlbumPin(album.id);
                  }}
                  className="p-1.5 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all"
                  title={album.is_pinned ? 'Loslösen' : 'Anpinnen'}
                >
                  {album.is_pinned ? (
                    <PinOff className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Pin className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAlbum(album.id);
                  }}
                  className="p-1.5 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 hover:bg-destructive/80 transition-all"
                  title="Album löschen"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="font-semibold text-white truncate">{album.name}</h3>
                <p className="text-white/70 text-sm">{album.count} Elemente</p>
              </div>
              {dragOverAlbum === album.id && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <p className="text-white font-medium">Hierher ziehen</p>
                </div>
              )}
            </motion.div>
          ))}

          {albums.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full glass-card p-12 text-center"
            >
              <FolderPlus className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-foreground mb-2">Keine Alben</h3>
              <p className="text-muted-foreground mb-4">Erstelle dein erstes Album</p>
              <button
                onClick={() => setShowNewAlbumModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary hover:shadow-glow transition-all text-primary-foreground"
              >
                <FolderPlus className="w-5 h-5" />
                Album erstellen
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Media Grid */}
      {(viewMode !== 'albums' || selectedAlbum) && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : filteredMedia.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-12 text-center"
            >
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {selectedAlbum ? 'Album ist leer' : 'Keine Medien'}
              </h3>
              <p className="text-muted-foreground mb-6">
                Lade Fotos oder Videos hoch
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary hover:shadow-glow transition-all text-primary-foreground"
              >
                <Plus className="w-5 h-5" />
                Hochladen
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {filteredMedia.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "relative aspect-square group",
                    isMultiSelectMode && selectedItems.has(item.id) && "ring-2 ring-primary rounded-xl"
                  )}
                  draggable={!isMultiSelectMode}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={handleDragEnd}
                >
                  <div
                    onClick={() => {
                      if (isMultiSelectMode) {
                        toggleItemSelection(item.id);
                      } else {
                        setLightboxIndex(index);
                        recordView('photo', item.id);
                      }
                    }}
                    className="glass-card-hover overflow-hidden cursor-pointer w-full h-full"
                  >
                    {/* Multi-select checkbox */}
                    {isMultiSelectMode && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                          selectedItems.has(item.id) 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-black/50 text-white"
                        )}>
                          {selectedItems.has(item.id) ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    )}

                    {item.type === 'video' ? (
                      <div className="relative w-full h-full bg-muted">
                        <video
                          src={item.url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                          onLoadedMetadata={(e) => {
                            // Seek to 1 second to get a better thumbnail frame
                            const video = e.currentTarget;
                            if (video.duration > 1) {
                              video.currentTime = 1;
                            }
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                          </div>
                        </div>
                        {/* Video duration badge - could be added if stored */}
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium pointer-events-none">
                          Video
                        </div>
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.caption || item.filename}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    )}
                    
                    {item.is_favorite && (
                      <div className="absolute top-2 right-2">
                        <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                      </div>
                    )}

                    {/* Tags indicator */}
                    {item.tags && item.tags.length > 0 && !isMultiSelectMode && (
                      <div className="absolute top-2 left-2 flex gap-1">
                        {item.tags.slice(0, 2).map(tagId => {
                          const tag = tags.find(t => t.id === tagId);
                          return tag ? (
                            <span key={tagId} className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                          ) : null;
                        })}
                      </div>
                    )}
                    
                    {/* Hover overlay with actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-white text-xs truncate mb-2">
                          {item.caption || item.filename.replace(/^\d+-/, '')}
                        </p>
                        {!isMultiSelectMode && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(item); }}
                              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <Heart className={cn("w-4 h-4", item.is_favorite ? "text-red-500 fill-red-500" : "text-white")} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowTagSelector(item.id); }}
                              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <Tag className="w-4 h-4 text-white" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSinglePhotoAlbumPicker(item); }}
                              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <Folder className="w-4 h-4 text-white" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShareToAlbum({ isOpen: true, photo: item }); }}
                              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                              title="Zu geteiltem Album hinzufügen"
                            >
                              <Share2 className="w-4 h-4 text-white" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadMedia(item); }}
                              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4 text-white" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, item }); }}
                              className="p-1.5 hover:bg-red-500/30 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tag Selector Dropdown - positioned above if near bottom */}
                  {showTagSelector === item.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={(e) => { e.stopPropagation(); setShowTagSelector(null); }}
                      />
                      <div 
                        className="absolute left-0 w-48 bg-card border border-border shadow-xl rounded-xl p-2 z-50 max-h-64 overflow-y-auto"
                        style={{
                          // Position above if item is in lower half of viewport
                          bottom: index >= Math.floor(filteredMedia.length / 2) ? '100%' : 'auto',
                          top: index >= Math.floor(filteredMedia.length / 2) ? 'auto' : '100%',
                          marginBottom: index >= Math.floor(filteredMedia.length / 2) ? '8px' : '0',
                          marginTop: index >= Math.floor(filteredMedia.length / 2) ? '0' : '8px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {tags.length === 0 ? (
                          <p className="text-muted-foreground text-sm p-2 text-center">Keine Tags vorhanden</p>
                        ) : (
                          tags.map(tag => (
                            <button
                              key={tag.id}
                              onClick={() => {
                                const newTags = item.tags?.includes(tag.id)
                                  ? item.tags.filter(t => t !== tag.id)
                                  : [...(item.tags || []), tag.id];
                                updateMediaTags(item.id, newTags);
                              }}
                              className={cn(
                                "w-full px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-all text-sm",
                                item.tags?.includes(tag.id) ? "bg-primary/20" : "hover:bg-muted"
                              )}
                            >
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                              <span className="text-foreground">{tag.name}</span>
                            </button>
                          ))
                        )}
                        <button
                          onClick={() => setShowTagSelector(null)}
                          className="w-full mt-2 px-3 py-2 rounded-lg text-center text-sm text-muted-foreground hover:bg-muted border-t border-border"
                        >
                          Schließen
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {currentLightboxItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Lightbox Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
              <button
                onClick={() => {
                  setLightboxIndex(null);
                  stopSlideshow();
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
              
              <div className="flex items-center gap-3">
                {/* Slideshow controls */}
                <button
                  onClick={() => isSlideshow ? stopSlideshow() : startSlideshow()}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    isSlideshow ? "bg-primary text-primary-foreground" : "hover:bg-white/10"
                  )}
                  title={isSlideshow ? "Slideshow stoppen" : "Slideshow starten"}
                >
                  {isSlideshow ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 text-white" />
                  )}
                </button>
                
                {isSlideshow && (
                  <select
                    value={slideshowInterval}
                    onChange={(e) => setSlideshowInterval(Number(e.target.value))}
                    className="bg-white/10 text-white text-xs rounded-lg px-2 py-1 border-none"
                  >
                    <option value={2000}>2s</option>
                    <option value={3000}>3s</option>
                    <option value={5000}>5s</option>
                    <option value={8000}>8s</option>
                    <option value={10000}>10s</option>
                  </select>
                )}
                
                <span className="text-white/70 text-sm">
                  {lightboxIndex! + 1} / {filteredMedia.length}
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                {/* Zoom controls - only for photos */}
                {currentLightboxItem.type === 'photo' && (
                  <>
                    <button
                      onClick={zoomOut}
                      disabled={zoomLevel <= 1}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        zoomLevel <= 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"
                      )}
                      title="Verkleinern"
                    >
                      <ZoomOut className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-white text-xs min-w-[3rem] text-center">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      onClick={zoomIn}
                      disabled={zoomLevel >= 4}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        zoomLevel >= 4 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"
                      )}
                      title="Vergrößern"
                    >
                      <ZoomIn className="w-5 h-5 text-white" />
                    </button>
                    {zoomLevel > 1 && (
                      <button
                        onClick={resetZoom}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        title="Zoom zurücksetzen"
                      >
                        <RotateCcw className="w-5 h-5 text-white" />
                      </button>
                    )}
                    <div className="w-px h-6 bg-white/20 mx-1" />
                  </>
                )}
                
                <button
                  onClick={() => toggleFavorite(currentLightboxItem)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Heart className={cn(
                    "w-5 h-5",
                    currentLightboxItem.is_favorite ? "text-red-500 fill-red-500" : "text-white"
                  )} />
                </button>
                <button
                  onClick={() => downloadMedia(currentLightboxItem)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setRenameDialog({ isOpen: true, item: currentLightboxItem })}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:flex"
                >
                  <Pencil className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, item: currentLightboxItem })}
                  className="p-2 hover:bg-red-500/20 rounded-full transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
              </div>
            </div>

            {/* Navigation Arrows */}
            {lightboxIndex! > 0 && (
              <button
                onClick={() => navigateLightbox('prev')}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 hover:bg-white/10 rounded-full transition-colors z-10 hidden sm:flex"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
            )}
            {lightboxIndex! < filteredMedia.length - 1 && (
              <button
                onClick={() => navigateLightbox('next')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 hover:bg-white/10 rounded-full transition-colors z-10 hidden sm:flex"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
            )}

            {/* Media Content */}
            <div 
              className="flex-1 flex items-center justify-center p-4 overflow-hidden"
              onWheel={handleWheel}
              onMouseMove={handleImageMouseMove}
              onMouseUp={handleImageMouseUp}
              onMouseLeave={handleImageMouseUp}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentLightboxItem.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="max-w-full max-h-full"
                >
                  {currentLightboxItem.type === 'video' ? (
                    <div className="relative flex items-center justify-center">
                      <video
                        ref={videoRef}
                        src={currentLightboxItem.url}
                        className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
                        controls
                        controlsList="nodownload"
                        autoPlay
                        playsInline
                        muted={isMuted}
                        onClick={(e) => e.stopPropagation()}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onEnded={() => setIsVideoPlaying(false)}
                      >
                        <source src={currentLightboxItem.url} type={currentLightboxItem.mime_type || 'video/mp4'} />
                        Dein Browser unterstützt dieses Videoformat nicht.
                      </video>
                    </div>
                  ) : (
                    <img
                      src={currentLightboxItem.url}
                      alt={currentLightboxItem.caption || currentLightboxItem.filename}
                      className={cn(
                        "max-w-full max-h-[80vh] object-contain rounded-lg transition-transform duration-200",
                        zoomLevel > 1 && "cursor-grab",
                        isDragging && "cursor-grabbing"
                      )}
                      style={{
                        transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={handleImageDoubleClick}
                      onMouseDown={handleImageMouseDown}
                      draggable={false}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Caption */}
            {currentLightboxItem.caption && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 rounded-xl">
                <p className="text-white text-sm">{currentLightboxItem.caption}</p>
              </div>
            )}

            {/* Swipe hint on mobile */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-xs sm:hidden">
              ← Wischen zum Navigieren →
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Album Modal */}
      <AnimatePresence>
        {showNewAlbumModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowNewAlbumModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-foreground mb-4">Neues Album</h2>
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Album Name..."
                className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground mb-4"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && createAlbum()}
              />
              
              {/* Color Selection */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Farbe</p>
                <div className="flex gap-2 flex-wrap">
                  {['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewAlbumColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        newAlbumColor === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon Selection */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Icon</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'folder', icon: Folder },
                    { id: 'star', icon: Star },
                    { id: 'heart', icon: Heart },
                    { id: 'image', icon: ImageIcon },
                    { id: 'video', icon: Video },
                    { id: 'music', icon: Music },
                  ].map(({ id, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setNewAlbumIcon(id)}
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                        newAlbumIcon === id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewAlbumModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-all"
                >
                  Abbrechen
                </button>
                <button
                  onClick={createAlbum}
                  disabled={!newAlbumName.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-all disabled:opacity-50"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowEditAlbumModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-foreground mb-4">Album bearbeiten</h2>
              <input
                type="text"
                value={editingAlbum.name}
                onChange={(e) => setEditingAlbum({ ...editingAlbum, name: e.target.value })}
                placeholder="Album Name..."
                className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground mb-4"
                autoFocus
              />
              
              {/* Color Selection */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Farbe</p>
                <div className="flex gap-2 flex-wrap">
                  {['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'].map(color => (
                    <button
                      key={color}
                      onClick={() => setEditingAlbum({ ...editingAlbum, color })}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        editingAlbum.color === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon Selection */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Icon</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'folder', icon: Folder },
                    { id: 'star', icon: Star },
                    { id: 'heart', icon: Heart },
                    { id: 'image', icon: ImageIcon },
                    { id: 'video', icon: Video },
                    { id: 'music', icon: Music },
                  ].map(({ id, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setEditingAlbum({ ...editingAlbum, icon: id })}
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                        editingAlbum.icon === id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditAlbumModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-all"
                >
                  Abbrechen
                </button>
                <button
                  onClick={updateAlbum}
                  disabled={!editingAlbum.name.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-all disabled:opacity-50"
                >
                  Speichern
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, item: null })}
        onConfirm={deleteConfirm.isMulti ? handleMultiDelete : handleDelete}
        itemName={deleteConfirm.isMulti ? `${selectedItems.size} Elemente` : (deleteConfirm.item?.caption || deleteConfirm.item?.filename.replace(/^\d+-/, ''))}
      />

      {/* Rename Dialog */}
      <RenameDialog
        isOpen={renameDialog.isOpen}
        onClose={() => setRenameDialog({ isOpen: false, item: null })}
        onRename={handleRename}
        currentName={renameDialog.item?.caption || ''}
        title="Beschreibung bearbeiten"
      />

      {/* Multi-select action bar */}
      <MultiSelectBar
        selectedCount={selectedItems.size}
        onClear={() => {
          setSelectedItems(new Set());
          setIsMultiSelectMode(false);
        }}
        onDelete={() => setDeleteConfirm({ isOpen: true, item: null, isMulti: true })}
        onTag={() => setShowBulkTagManager(true)}
        onFavorite={handleBulkFavorite}
        onMove={() => setShowAlbumPicker(true)}
      />

      {/* Shared Album Button for Multi-Select */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
          <SharedAlbumButton
            selectedItemIds={Array.from(selectedItems)}
            itemType="photo"
            contentType="photos"
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
                Tags für {selectedItems.size} Elemente
              </h2>
              <TagManager
                selectedTags={[]}
                onTagsChange={handleBulkTagUpdate}
              />
              <button
                onClick={() => setShowBulkTagManager(false)}
                className="w-full mt-4 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-all"
              >
                Abbrechen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Album Picker Modal */}
      <AnimatePresence>
        {showAlbumPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowAlbumPicker(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-foreground mb-4">
                {selectedItems.size} Elemente zu Album hinzufügen
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                <button
                  onClick={() => handleBulkMoveToAlbum(null)}
                  className="w-full px-4 py-3 rounded-xl text-left hover:bg-muted transition-colors flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">Kein Album</span>
                </button>
                {albums.map(album => (
                  <button
                    key={album.id}
                    onClick={() => handleBulkMoveToAlbum(album.id)}
                    className="w-full px-4 py-3 rounded-xl text-left hover:bg-muted transition-colors flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden">
                      {album.cover_url ? (
                        <img src={album.cover_url} alt={album.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FolderPlus className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-foreground font-medium">{album.name}</p>
                      <p className="text-muted-foreground text-sm">{album.count} Elemente</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAlbumPicker(false)}
                className="w-full mt-4 px-4 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition-all"
              >
                Abbrechen
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Single Photo Album Picker */}
        {singlePhotoAlbumPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSinglePhotoAlbumPicker(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm max-h-[60vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground mb-2">In Album verschieben</h3>
              <p className="text-sm text-muted-foreground mb-4 truncate">
                {singlePhotoAlbumPicker.caption || singlePhotoAlbumPicker.filename.replace(/^\d+-/, '')}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleSinglePhotoMoveToAlbum(singlePhotoAlbumPicker, null)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors",
                    !singlePhotoAlbumPicker.album_id && "bg-muted"
                  )}
                >
                  <Folder className="w-5 h-5 text-muted-foreground" />
                  <span className="text-foreground">Kein Album</span>
                  {!singlePhotoAlbumPicker.album_id && (
                    <span className="ml-auto text-xs text-primary">Aktuell</span>
                  )}
                </button>
                {albums.map((album) => (
                  <button
                    key={album.id}
                    onClick={() => handleSinglePhotoMoveToAlbum(singlePhotoAlbumPicker, album.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors",
                      singlePhotoAlbumPicker.album_id === album.id && "bg-muted"
                    )}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${album.color || '#6366f1'}20` }}
                    >
                      <Folder className="w-4 h-4" style={{ color: album.color || '#6366f1' }} />
                    </div>
                    <span className="text-foreground">{album.name}</span>
                    {singlePhotoAlbumPicker.album_id === album.id && (
                      <span className="ml-auto text-xs text-primary">Aktuell</span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share to Album Dialog */}
      <ShareToAlbumDialog
        isOpen={shareToAlbum.isOpen}
        onClose={() => setShareToAlbum({ isOpen: false, photo: null })}
        itemId={shareToAlbum.photo?.id || ''}
        itemType="photo"
        contentType="photos"
      />
    </div>
  );
}
