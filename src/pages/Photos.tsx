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
  QrCode,
  Clock,
  Link2,
  Zap,
  Sparkles,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTags } from '@/hooks/useTags';
import { useViewHistory } from '@/hooks/useViewHistory';
import { useVideoThumbnail, formatDuration } from '@/hooks/useVideoThumbnail';
import { LazyMediaItem } from '@/components/LazyMediaItem';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { AlbumDeleteConfirmDialog } from '@/components/AlbumDeleteConfirmDialog';
import { RenameDialog } from '@/components/RenameDialog';
import { MultiSelectBar } from '@/components/MultiSelect';
import { TagManager } from '@/components/TagManager';
import { SharedAlbumButton } from '@/components/SharedAlbumButton';
import { ShareToAlbumDialog } from '@/components/ShareToAlbumDialog';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
import { TemporaryShareLink } from '@/components/TemporaryShareLink';
import { HierarchicalAlbumPicker } from '@/components/HierarchicalAlbumPicker';
import { useDuplicatePrevention } from '@/hooks/useDuplicatePrevention';
import { toast } from 'sonner';
import { useSecurityLogs } from '@/hooks/useSecurityLogs';
import { useHierarchicalAlbums, HierarchicalAlbum } from '@/hooks/useHierarchicalAlbums';
import { resumableStorageUpload } from '@/lib/resumableStorageUpload';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSmartAlbums, SmartAlbumItem } from '@/hooks/useSmartAlbums';
import { SmartAlbumCard, SmartAlbumList } from '@/components/SmartAlbumCard';
import { useHiddenAlbums } from '@/hooks/useHiddenAlbums';
import { ImageEditor } from '@/components/photos/ImageEditor';
import { VideoEditor } from '@/components/photos/VideoEditor';
import { CollageCreator } from '@/components/photos/CollageCreator';
import { PhotoTimeline } from '@/components/photos/PhotoTimeline';

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
  thumbnail_url?: string;
  is_favorite?: boolean;
  type: 'photo' | 'video';
  mime_type?: string;
  tags?: string[];
  duration?: number;
}

interface Album {
  id: string;
  name: string;
  created_at: string;
  parent_id?: string | null;
  cover_url?: string;
  count?: number;
  is_pinned?: boolean;
  color?: string;
  icon?: string;
  children?: Album[];
  depth?: number;
}

type ViewMode = 'all' | 'photos' | 'videos' | 'albums' | 'smart';
type SortMode = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'favorites';

// Helper functions for hierarchical albums
const getChildAlbums = (albums: Album[], parentId: string | null): Album[] => {
  return albums
    .filter(a => (a.parent_id || null) === parentId)
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
};

const getBreadcrumb = (albums: Album[], albumId: string): Album[] => {
  const path: Album[] = [];
  let current = albums.find(a => a.id === albumId);
  
  while (current) {
    path.unshift(current);
    current = current.parent_id ? albums.find(a => a.id === current!.parent_id) : undefined;
  }
  
  return path;
};

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
  const [newAlbumParentId, setNewAlbumParentId] = useState<string | null>(null);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [showEditAlbumModal, setShowEditAlbumModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; item: MediaItem | null; isMulti?: boolean }>({ isOpen: false, item: null });
  const [albumDeleteConfirm, setAlbumDeleteConfirm] = useState<{ isOpen: boolean; album: Album | null }>({ isOpen: false, album: null });
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; item: MediaItem | null }>({ isOpen: false, item: null });
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('photos-video-muted');
    return saved ? JSON.parse(saved) : false;
  });
  const [videoVolume, setVideoVolume] = useState(() => {
    const saved = localStorage.getItem('photos-video-volume');
    return saved ? parseFloat(saved) : 1;
  });
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
  const [isRandomSlideshow, setIsRandomSlideshow] = useState(false);
  const [shuffledMediaOrder, setShuffledMediaOrder] = useState<number[]>([]);
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
  const createAlbumLockRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const { userId, isDecoyMode, sessionToken, supabaseClient: supabase } = useAuth();
  const location = useLocation();
  const { tags } = useTags();
  const validTagIds = useMemo(() => new Set(tags.map((t) => t.id)), [tags]);
  const { logEvent } = useSecurityLogs();
  const { recordView } = useViewHistory();
  const { generateThumbnail } = useVideoThumbnail();
  const isMobile = useIsMobile();
  const { checkForDuplicate, showDuplicateWarning, registerUpload, loadExistingHashes } = useDuplicatePrevention();
  const [shareItem, setShareItem] = useState<MediaItem | null>(null);
  const [selectedSmartAlbum, setSelectedSmartAlbum] = useState<string | null>(null);
  const { allHiddenAlbumIds, isContentHidden, setHidden } = useHiddenAlbums();
  
  // Editor states
  const [imageEditorItem, setImageEditorItem] = useState<MediaItem | null>(null);
  const [videoEditorItem, setVideoEditorItem] = useState<MediaItem | null>(null);
  const [showCollageCreator, setShowCollageCreator] = useState(false);
  const [showPhotoTimeline, setShowPhotoTimeline] = useState(false);

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
        supabase.from('albums').select('*').eq('user_id', userId).order('is_pinned', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
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

      // Get album cover and count - prefer images for cover, or use video thumbnail
      const albumsWithCovers = await Promise.all(
        (albumsRes.data || []).map(async (album) => {
          const albumPhotos = photosWithUrls.filter(p => p.album_id === album.id);
          // Find a suitable cover: prefer first image, otherwise use video thumbnail
          let cover_url: string | undefined;
          const firstImage = albumPhotos.find(p => p.type === 'photo');
          const firstVideoItem = albumPhotos.find(p => p.type === 'video');
          
          if (firstImage) {
            cover_url = firstImage.url;
          } else if (firstVideoItem) {
            // Try to get video thumbnail from DB record
            const photo = photosRes.data?.find(p => p.id === firstVideoItem.id);
            if (photo?.thumbnail_filename) {
              const { data: thumbData } = await supabase.storage
                .from('photos')
                .createSignedUrl(`${userId}/thumbnails/${photo.thumbnail_filename}`, 3600);
              cover_url = thumbData?.signedUrl;
            }
          }
          
          return {
            ...album,
            cover_url,
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
    loadExistingHashes();
  }, [fetchData, loadExistingHashes]);

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

  // Save volume settings to localStorage
  useEffect(() => {
    localStorage.setItem('photos-video-volume', videoVolume.toString());
  }, [videoVolume]);

  useEffect(() => {
    localStorage.setItem('photos-video-muted', JSON.stringify(isMuted));
  }, [isMuted]);

  // Handle navigation state (upload action or open specific photo)
  useEffect(() => {
    if (location.state?.action === 'upload-photo') {
      fileInputRef.current?.click();
    }
    // Handle direct navigation to a specific photo (e.g., from Trash, RecentlyViewed)
    if (location.state?.openPhotoId && media.length > 0) {
      const photoIndex = media.findIndex(m => m.id === location.state.openPhotoId);
      if (photoIndex !== -1) {
        setLightboxIndex(photoIndex);
        // Clear the state to prevent re-opening on subsequent renders
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, media]);

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

        // Check for duplicates
        const duplicateCheck = await checkForDuplicate(file);
        if (duplicateCheck.isDuplicate && duplicateCheck.existingItem) {
          showDuplicateWarning(
            file, 
            duplicateCheck.existingItem.filename,
            () => {}, // User can still proceed manually
            () => { skipped++; }
          );
          // Continue anyway - just show warning
        }

        const timestamp = Date.now();
        const filename = `${timestamp}-${file.name}`;
        const mimeType = file.type || getMimeType(file.name);
        
        const objectPath = `${userId}/${filename}`;

        // Upload with proper content type
        // NOTE: Large videos often fail with non-resumable uploads; use resumable uploads instead.
        const RESUMABLE_THRESHOLD_BYTES = 45 * 1024 * 1024; // 45MB

        let uploadError: { message: string } | null = null;
        try {
          if (isVideo && file.size >= RESUMABLE_THRESHOLD_BYTES && sessionToken) {
            await resumableStorageUpload({
              bucket: 'photos',
              objectPath,
              file,
              contentType: mimeType,
              sessionToken,
              onProgress: (p01) => {
                // Smooth overall progress: completed files + current file
                setUploadProgress(((uploaded + p01) / validFiles.length) * 100);
              },
            });
          } else {
            const { error } = await supabase.storage
              .from('photos')
              .upload(objectPath, file, {
                contentType: mimeType,
                cacheControl: '3600',
              });
            if (error) uploadError = error;
          }
        } catch (e: any) {
          uploadError = { message: e?.message || 'Upload fehlgeschlagen' };
        }

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Fehler bei ${file.name}: ${uploadError.message}`);
          skipped++;
          continue;
        }

        // Generate and upload thumbnail for videos, also extract duration
        let thumbnailFilename: string | null = null;
        let videoDuration: number | undefined;
        if (isVideo) {
          try {
            const { thumbnail: thumbnailBlob, duration } = await generateThumbnail(file, 1, 640, 480);
            videoDuration = duration > 0 ? duration : undefined;
            
            if (thumbnailBlob) {
              thumbnailFilename = `${timestamp}-thumb-${file.name.replace(/\.[^.]+$/, '.jpg')}`;
              const { error: thumbError } = await supabase.storage
                .from('photos')
                .upload(`${userId}/thumbnails/${thumbnailFilename}`, thumbnailBlob, {
                  contentType: 'image/jpeg',
                  cacheControl: '31536000', // Cache for 1 year
                });
              
              if (thumbError) {
                console.warn('Thumbnail upload failed:', thumbError);
                thumbnailFilename = null;
              }
            }
          } catch (thumbErr) {
            console.warn('Thumbnail generation failed:', thumbErr);
          }
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

        // Get thumbnail URL if available
        let thumbnailUrl: string | undefined;
        if (thumbnailFilename) {
          const { data: thumbUrlData } = await supabase.storage
            .from('photos')
            .createSignedUrl(`${userId}/thumbnails/${thumbnailFilename}`, 3600);
          thumbnailUrl = thumbUrlData?.signedUrl;
        }

        const mediaType = isVideo ? 'video' as const : 'photo' as const;

        // Register upload for future duplicate detection
        registerUpload(filename, photoData.id, 'photo');

        setMedia(prev => [{
          ...photoData, 
          url: urlData?.signedUrl,
          thumbnail_url: thumbnailUrl,
          type: mediaType,
          mime_type: mimeType,
          duration: videoDuration
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

  const createAlbum = async (parentId?: string | null) => {
    const name = newAlbumName.trim();
    if (!name || !userId) return;

    // Prevent duplicate inserts when multiple events fire in the same tick (Enter + click / double tap)
    if (createAlbumLockRef.current) return;
    createAlbumLockRef.current = true;
    setIsCreatingAlbum(true);

    try {
      const { data, error } = await supabase
        .from('albums')
        .insert({
          user_id: userId,
          name,
          color: newAlbumColor,
          icon: newAlbumIcon,
          parent_id: parentId ?? newAlbumParentId ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      setAlbums((prev) => {
        const next = [{ ...data, count: 0 }, ...prev];
        const seen = new Set<string>();
        return next.filter((a) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });
      });

      setNewAlbumName('');
      setNewAlbumColor('#6366f1');
      setNewAlbumIcon('folder');
      setNewAlbumParentId(null);
      setShowNewAlbumModal(false);
      toast.success(parentId || newAlbumParentId ? 'Unteralbum erstellt' : 'Album erstellt');
    } catch (error) {
      console.error('Error creating album:', error);
      toast.error('Fehler beim Erstellen');
    } finally {
      createAlbumLockRef.current = false;
      setIsCreatingAlbum(false);
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

  const handleDeleteAlbumWithItems = async () => {
    const album = albumDeleteConfirm.album;
    if (!userId || !album) return;

    try {
      // Get all photos in this album
      const albumPhotos = media.filter(m => m.album_id === album.id);
      
      // Delete the photos (move to trash)
      if (albumPhotos.length > 0) {
        await supabase
          .from('photos')
          .update({ deleted_at: new Date().toISOString() })
          .eq('album_id', album.id);
      }

      // Delete sub-albums first (move their items to no album)
      const childAlbums = albums.filter(a => a.parent_id === album.id);
      for (const child of childAlbums) {
        await supabase.from('photos').update({ album_id: null }).eq('album_id', child.id);
        await supabase.from('albums').delete().eq('id', child.id);
      }

      // Then delete the album
      const { error } = await supabase
        .from('albums')
        .delete()
        .eq('id', album.id);

      if (error) throw error;

      if (selectedAlbum?.id === album.id) {
        setSelectedAlbum(null);
      }
      setAlbumDeleteConfirm({ isOpen: false, album: null });
      fetchData();
      toast.success('Album und Inhalte gelöscht');
    } catch (error) {
      console.error('Error deleting album:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleDeleteAlbumKeepItems = async () => {
    const album = albumDeleteConfirm.album;
    if (!userId || !album) return;

    try {
      // Move all photos in this album to "no album"
      await supabase
        .from('photos')
        .update({ album_id: null })
        .eq('album_id', album.id);

      // Move child albums to parent of deleted album
      const childAlbums = albums.filter(a => a.parent_id === album.id);
      if (childAlbums.length > 0) {
        await supabase
          .from('albums')
          .update({ parent_id: album.parent_id || null })
          .eq('parent_id', album.id);
      }

      // Then delete the album
      const { error } = await supabase
        .from('albums')
        .delete()
        .eq('id', album.id);

      if (error) throw error;

      if (selectedAlbum?.id === album.id) {
        setSelectedAlbum(null);
      }
      setAlbumDeleteConfirm({ isOpen: false, album: null });
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

  // Filter out hidden albums from display
  const visibleAlbums = useMemo(() => {
    return albums.filter(a => !allHiddenAlbumIds.has(a.id));
  }, [albums, allHiddenAlbumIds]);

  // Filter out media from hidden albums
  const visibleMedia = useMemo(() => {
    return media.filter(m => !m.album_id || !allHiddenAlbumIds.has(m.album_id));
  }, [media, allHiddenAlbumIds]);

  // Filter and sort media based on view mode, tags, search, and sort
  const filteredMedia = useMemo(() => {
    let result = visibleMedia;
    
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
  }, [visibleMedia, selectedAlbum, viewMode, selectedTagFilter, searchQuery, sortMode]);

  // Get child albums for current view (only visible ones)
  const currentChildAlbums = useMemo(() => {
    return getChildAlbums(visibleAlbums, selectedAlbum?.id || null);
  }, [visibleAlbums, selectedAlbum]);

  // Smart Albums - convert media to SmartAlbumItem format (using visible media only)
  const smartAlbumItems: SmartAlbumItem[] = useMemo(() => {
    return visibleMedia.map(m => ({
      id: m.id,
      filename: m.filename,
      name: m.caption || m.filename,
      created_at: m.taken_at,
      uploaded_at: m.uploaded_at,
      is_favorite: m.is_favorite,
      // Only count tags that still exist. This avoids "Mit Tags" showing items with stale/orphan tag IDs.
      tags: (m.tags || []).filter((tagId) => validTagIds.has(tagId)),
      type: m.type,
      mime_type: m.mime_type,
    }));
  }, [visibleMedia, validTagIds]);

  const { smartAlbums, getItemsForSmartAlbum } = useSmartAlbums(smartAlbumItems);

  // Filtered media including smart album filter
  const displayMedia = useMemo(() => {
    if (selectedSmartAlbum) {
      const smartItems = getItemsForSmartAlbum(selectedSmartAlbum);
      const smartItemIds = new Set(smartItems.map(i => i.id));
      return filteredMedia.filter(m => smartItemIds.has(m.id));
    }
    return filteredMedia;
  }, [filteredMedia, selectedSmartAlbum, getItemsForSmartAlbum]);

  // Breadcrumb for navigation
  const breadcrumb = useMemo(() => {
    if (!selectedAlbum) return [];
    return getBreadcrumb(albums, selectedAlbum.id);
  }, [albums, selectedAlbum]);

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

  // Track if current video is playing in slideshow
  const [slideshowVideoPlaying, setSlideshowVideoPlaying] = useState(false);

  // Slideshow functions
  const startSlideshow = async (random: boolean = false) => {
    if (filteredMedia.length === 0) return;
    
    setIsRandomSlideshow(random);
    
    if (random) {
      // Create shuffled order using Fisher-Yates algorithm
      const indices = Array.from({ length: filteredMedia.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setShuffledMediaOrder(indices);
      setLightboxIndex(indices[0]);
    } else {
      setShuffledMediaOrder([]);
      if (lightboxIndex === null) {
        setLightboxIndex(0);
      }
    }
    
    // Request wake lock to prevent screen from sleeping
    await requestWakeLock();
    
    setIsSlideshow(true);
    toast.success(random ? 'Zufällige Slideshow gestartet' : 'Slideshow gestartet');
  };

  const stopSlideshow = async () => {
    setIsSlideshow(false);
    setIsRandomSlideshow(false);
    setShuffledMediaOrder([]);
    setSlideshowVideoPlaying(false);
    if (slideshowTimerRef.current) {
      clearTimeout(slideshowTimerRef.current);
      slideshowTimerRef.current = null;
    }
    // Release wake lock
    await releaseWakeLock();
  };

  // Get next slideshow index based on mode
  const getNextSlideshowIndex = useCallback((currentIndex: number) => {
    if (isRandomSlideshow && shuffledMediaOrder.length > 0) {
      const currentShuffledPosition = shuffledMediaOrder.indexOf(currentIndex);
      const nextPosition = (currentShuffledPosition + 1) % shuffledMediaOrder.length;
      return shuffledMediaOrder[nextPosition];
    }
    return (currentIndex + 1) % filteredMedia.length;
  }, [isRandomSlideshow, shuffledMediaOrder, filteredMedia.length]);

  // Handle video ended in slideshow - move to next
  const handleSlideshowVideoEnded = useCallback(() => {
    if (isSlideshow && lightboxIndex !== null) {
      setSlideshowVideoPlaying(false);
      // Move to next item using the appropriate order
      const nextIndex = getNextSlideshowIndex(lightboxIndex);
      setLightboxIndex(nextIndex);
    }
  }, [isSlideshow, lightboxIndex, getNextSlideshowIndex]);

  // Slideshow timer - now handles both photos and videos
  useEffect(() => {
    if (!isSlideshow || lightboxIndex === null) return;
    
    const currentItem = filteredMedia[lightboxIndex];
    
    // For videos, don't use timer - wait for video to end
    if (currentItem?.type === 'video') {
      setSlideshowVideoPlaying(true);
      // Explicitly try to play the video after a short delay to ensure DOM is ready
      const playTimer = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.muted = isMuted;
          videoRef.current.volume = videoVolume;
          videoRef.current.play().catch((err) => {
            console.warn('Slideshow video autoplay blocked:', err);
            // If autoplay is blocked, move to next after a delay
            setTimeout(() => {
              if (isSlideshow) {
                const nextIndex = getNextSlideshowIndex(lightboxIndex);
                setLightboxIndex(nextIndex);
              }
            }, 3000);
          });
        }
      }, 100);
      return () => clearTimeout(playTimer);
    }
    
    // For photos, use the interval timer
    setSlideshowVideoPlaying(false);
    slideshowTimerRef.current = setTimeout(() => {
      const nextIndex = getNextSlideshowIndex(lightboxIndex);
      setLightboxIndex(nextIndex);
    }, slideshowInterval);

    return () => {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
      }
    };
  }, [isSlideshow, lightboxIndex, slideshowInterval, filteredMedia, getNextSlideshowIndex, isMuted, videoVolume]);

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
            {/* Breadcrumb Navigation */}
            {selectedAlbum ? (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <button
                  onClick={() => setSelectedAlbum(null)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Fotos & Videos
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
              {selectedAlbum ? selectedAlbum.name : 'Fotos & Videos'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {selectedAlbum ? (
                <>
                  {filteredMedia.length} Elemente
                  {currentChildAlbums.length > 0 && ` • ${currentChildAlbums.length} Unteralben`}
                </>
              ) : (
                <>{visibleMedia.filter(m => m.type === 'photo').length} Fotos • {visibleMedia.filter(m => m.type === 'video').length} Videos • {visibleAlbums.length} Alben</>
              )}
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

            {/* Slideshow dropdown */}
            {viewMode !== 'albums' && filteredMedia.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-border hover:bg-muted transition-all text-sm font-medium">
                    <PlayCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Slideshow</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" className="w-48 z-50">
                  <DropdownMenuItem onClick={() => startSlideshow(false)}>
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Normal starten
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => startSlideshow(true)}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Zufällig starten
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Sort dropdown - show when viewing media (not album-only view at root) */}
            {(viewMode !== 'albums' || selectedAlbum) && (
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
            )}

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

            <button
              onClick={() => {
                setNewAlbumParentId(selectedAlbum?.id || null);
                setShowNewAlbumModal(true);
              }}
              className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-border hover:bg-muted transition-all text-sm font-medium"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden sm:inline">{selectedAlbum ? 'Unteralbum' : 'Album'}</span>
            </button>
            
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-border hover:bg-muted transition-all text-sm font-medium"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Kamera</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-sm font-medium"
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
              { id: 'smart', label: 'Smart', icon: Zap },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setViewMode(tab.id as ViewMode);
                  if (tab.id !== 'smart') {
                    setSelectedSmartAlbum(null);
                  }
                }}
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

      {/* Albums View - Show only root-level albums when not in an album, or child albums when in an album */}
      {viewMode === 'albums' && (
        <div>
          {currentChildAlbums.length > 0 && (
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Folder className="w-4 h-4" />
              {selectedAlbum ? 'Unteralben' : 'Alben'} ({currentChildAlbums.length})
            </h3>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {currentChildAlbums.map((album) => {
              const iconName = album.icon || 'folder';
              const icons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
                folder: Folder,
                star: Star,
                heart: Heart,
                image: ImageIcon,
                video: Video,
                music: Music,
              };
              const IconComponent = icons[iconName] || Folder;
              
              return (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedAlbum(album)}
                  onDragOver={(e) => handleAlbumDragOver(e, album.id)}
                  onDragLeave={handleAlbumDragLeave}
                  onDrop={(e) => handleAlbumDrop(e, album.id)}
                  className={cn(
                    "relative cursor-pointer rounded-2xl p-4 transition-all duration-200 group",
                    "bg-card/50 hover:bg-card border border-border/50 hover:border-border",
                    "hover:shadow-lg hover:shadow-black/5",
                    dragOverAlbum === album.id && "ring-2 ring-primary scale-105 bg-primary/5"
                  )}
                >
                  <div className="flex flex-col items-center text-center">
                    {album.cover_url ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden mb-3 shadow-sm">
                        <img
                          src={album.cover_url}
                          alt={album.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div 
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center mb-3"
                        style={{ backgroundColor: `${album.color || '#6366f1'}15` }}
                      >
                        <IconComponent 
                          className="w-8 h-8 sm:w-10 sm:h-10" 
                          style={{ color: album.color || '#6366f1' }} 
                        />
                      </div>
                    )}
                    <h4 className="text-sm font-medium text-foreground truncate w-full">{album.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{album.count} Elemente</p>
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
                          Unteralbum erstellen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditAlbumModal(album); }}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleAlbumPin(album.id); }}>
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
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setHidden(album.id, true); }}>
                          <EyeOff className="w-4 h-4 mr-2" />
                          Ausblenden
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); setAlbumDeleteConfirm({ isOpen: true, album }); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  {/* Drag Over Overlay */}
                  {dragOverAlbum === album.id && (
                    <div className="absolute inset-0 rounded-2xl bg-primary/10 flex items-center justify-center pointer-events-none">
                      <p className="text-sm font-medium text-primary">Hierher ziehen</p>
                    </div>
                  )}
                </motion.div>
              );
            })}

            {currentChildAlbums.length === 0 && !selectedAlbum && (
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
        </div>
      )}

      {/* Smart Albums View */}
      {viewMode === 'smart' && !selectedAlbum && (
        <div className="space-y-6">
          {/* Active Smart Album Header */}
          {selectedSmartAlbum && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedSmartAlbum(null)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Zurück
              </button>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="font-medium">
                  {smartAlbums.find(a => a.id === selectedSmartAlbum)?.name}
                </span>
                <span className="text-muted-foreground text-sm">
                  ({displayMedia.length} Elemente)
                </span>
              </div>
            </div>
          )}

          {/* Smart Album Cards */}
          {!selectedSmartAlbum && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Smart Alben</h3>
                <span className="text-muted-foreground text-sm">
                  Automatisch aktualisiert basierend auf Regeln
                </span>
              </div>
              
              {smartAlbums.length > 0 ? (
                <SmartAlbumList 
                  albums={smartAlbums}
                  selectedId={selectedSmartAlbum}
                  onSelect={(id) => setSelectedSmartAlbum(id)}
                />
              ) : (
                <div className="glass-card p-12 text-center">
                  <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Keine Smart Alben verfügbar
                  </h3>
                  <p className="text-muted-foreground">
                    Füge Medien hinzu um Smart Alben zu aktivieren
                  </p>
                </div>
              )}
            </>
          )}

          {/* Show media when smart album is selected */}
          {selectedSmartAlbum && displayMedia.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {displayMedia.map((item, index) => (
                <LazyMediaItem
                  key={item.id}
                  item={item}
                  index={index}
                  isMultiSelectMode={isMultiSelectMode}
                  isSelected={selectedItems.has(item.id)}
                  tags={tags}
                  onToggleSelect={toggleItemSelection}
                  onOpenLightbox={(idx) => {
                    setLightboxIndex(idx);
                    recordView('photo', item.id);
                  }}
                  onToggleFavorite={toggleFavorite}
                  onShowTagSelector={setShowTagSelector}
                  onShowAlbumPicker={setSinglePhotoAlbumPicker}
                  onShareToAlbum={(item) => setShareToAlbum({ isOpen: true, photo: item })}
                  onDownload={downloadMedia}
                  onDelete={(item) => setDeleteConfirm({ isOpen: true, item })}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}

          {selectedSmartAlbum && displayMedia.length === 0 && (
            <div className="glass-card p-12 text-center">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Keine Elemente
              </h3>
              <p className="text-muted-foreground">
                Dieses Smart Album enthält keine passenden Elemente
              </p>
            </div>
          )}
        </div>
      )}

      {/* Media Grid */}
      {(viewMode !== 'albums' && viewMode !== 'smart' || selectedAlbum) && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : filteredMedia.length === 0 && currentChildAlbums.length === 0 ? (
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
            <>
              {/* Child Albums Grid - shown when in an album - Apple Files style */}
              {selectedAlbum && viewMode !== 'albums' && currentChildAlbums.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    Unteralben ({currentChildAlbums.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {currentChildAlbums.map((album) => {
                      const iconName = album.icon || 'folder';
                      const icons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
                        folder: Folder,
                        star: Star,
                        heart: Heart,
                        image: ImageIcon,
                        video: Video,
                        music: Music,
                      };
                      const IconComponent = icons[iconName] || Folder;
                      
                      return (
                        <motion.div
                          key={album.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedAlbum(album)}
                          onDragOver={(e) => handleAlbumDragOver(e, album.id)}
                          onDragLeave={handleAlbumDragLeave}
                          onDrop={(e) => handleAlbumDrop(e, album.id)}
                          className={cn(
                            "relative cursor-pointer rounded-2xl p-4 transition-all duration-200 group",
                            "bg-card/50 hover:bg-card border border-border/50 hover:border-border",
                            "hover:shadow-lg hover:shadow-black/5",
                            dragOverAlbum === album.id && "ring-2 ring-primary scale-105 bg-primary/5"
                          )}
                        >
                          <div className="flex flex-col items-center text-center">
                            {album.cover_url ? (
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden mb-3 shadow-sm">
                                <img src={album.cover_url} alt={album.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div 
                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center mb-3"
                                style={{ backgroundColor: `${album.color || '#6366f1'}15` }}
                              >
                                <IconComponent className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: album.color || '#6366f1' }} />
                              </div>
                            )}
                            <h4 className="text-sm font-medium text-foreground truncate w-full">{album.name}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">{album.count} Elemente</p>
                          </div>
                          
                          {album.is_pinned && (
                            <div className="absolute top-2 left-2">
                              <div className="p-1 rounded-md bg-primary/10">
                                <Pin className="w-3 h-3 text-primary" />
                              </div>
                            </div>
                          )}
                          
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg bg-background/80 hover:bg-background border border-border/50 transition-colors">
                                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setNewAlbumParentId(album.id); setShowNewAlbumModal(true); }}>
                                  <FolderPlus className="w-4 h-4 mr-2" />Unteralbum erstellen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditAlbumModal(album); }}>
                                  <Pencil className="w-4 h-4 mr-2" />Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleAlbumPin(album.id); }}>
                                  {album.is_pinned ? <><PinOff className="w-4 h-4 mr-2" />Loslösen</> : <><Pin className="w-4 h-4 mr-2" />Anpinnen</>}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setAlbumDeleteConfirm({ isOpen: true, album }); }} className="text-destructive focus:text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          {dragOverAlbum === album.id && (
                            <div className="absolute inset-0 rounded-2xl bg-primary/10 flex items-center justify-center pointer-events-none">
                              <p className="text-sm font-medium text-primary">Hierher ziehen</p>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Media Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {filteredMedia.map((item, index) => (
                <div key={item.id} className="relative">
                  <LazyMediaItem
                    item={item}
                    index={index}
                    isSelected={selectedItems.has(item.id)}
                    isMultiSelectMode={isMultiSelectMode}
                    tags={tags}
                    onToggleSelect={toggleItemSelection}
                    onOpenLightbox={(idx) => {
                      setLightboxIndex(idx);
                      recordView('photo', item.id);
                    }}
                    onToggleFavorite={toggleFavorite}
                    onShowTagSelector={setShowTagSelector}
                    onShowAlbumPicker={setSinglePhotoAlbumPicker}
                    onShareToAlbum={(item) => setShareToAlbum({ isOpen: true, photo: item })}
                    onDownload={downloadMedia}
                    onDelete={(item) => setDeleteConfirm({ isOpen: true, item })}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />

                  {/* Tag Selector Dropdown - mobile-optimized positioning */}
                  {showTagSelector === item.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent" 
                        onClick={(e) => { e.stopPropagation(); setShowTagSelector(null); }}
                      />
                      <div 
                        className={cn(
                          "bg-card border border-border shadow-xl rounded-xl p-2 overflow-y-auto z-50",
                          // Mobile: fixed bottom sheet style
                          isMobile ? "fixed left-4 right-4 bottom-4 max-h-[60vh]" : "absolute left-0 w-48 max-h-64",
                          // Desktop: position above if near bottom
                          !isMobile && index >= Math.floor(filteredMedia.length / 2) && "bottom-full mb-2",
                          !isMobile && index < Math.floor(filteredMedia.length / 2) && "top-full mt-2"
                        )}
                        style={isMobile ? { marginBottom: 'env(safe-area-inset-bottom)' } : undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isMobile && (
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                            <h3 className="font-medium text-foreground">Tags auswählen</h3>
                            <button
                              onClick={() => setShowTagSelector(null)}
                              className="p-2 hover:bg-muted rounded-lg"
                            >
                              <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                          </div>
                        )}
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
                                "w-full min-h-[44px] px-3 py-2 rounded-lg text-left flex items-center gap-2 transition-all text-sm",
                                item.tags?.includes(tag.id) ? "bg-primary/20" : "hover:bg-muted"
                              )}
                            >
                              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                              <span className="text-foreground">{tag.name}</span>
                            </button>
                          ))
                        )}
                        {!isMobile && (
                          <button
                            onClick={() => setShowTagSelector(null)}
                            className="w-full mt-2 px-3 py-2 rounded-lg text-center text-sm text-muted-foreground hover:bg-muted border-t border-border"
                          >
                            Schließen
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            </>
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
                {isSlideshow ? (
                  <button
                    onClick={stopSlideshow}
                    className="p-2 rounded-full transition-colors bg-primary text-primary-foreground"
                    title="Slideshow stoppen"
                  >
                    <Pause className="w-5 h-5" />
                  </button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-2 rounded-full transition-colors hover:bg-white/10"
                        title="Slideshow starten"
                      >
                        <Play className="w-5 h-5 text-white" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" side="bottom" className="z-[60] bg-popover border-border">
                      <DropdownMenuItem onClick={() => startSlideshow(false)}>
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Normal starten
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => startSlideshow(true)}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Zufällig starten
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                {isSlideshow && (
                  <>
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
                    {isRandomSlideshow && (
                      <span className="text-xs text-primary flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Zufällig
                      </span>
                    )}
                  </>
                )}
                
                <span className="text-white/70 text-sm">
                  {lightboxIndex! + 1} / {filteredMedia.length}
                </span>
              </div>
              
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {/* Volume control for videos (desktop only) */}
                {currentLightboxItem.type === 'video' && (
                  <div className="hidden sm:flex items-center gap-2 mr-2">
                    <button
                      onClick={() => {
                        const newMuted = !isMuted;
                        setIsMuted(newMuted);
                        if (videoRef.current) {
                          videoRef.current.muted = newMuted;
                        }
                      }}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors"
                      title={isMuted ? "Ton an" : "Ton aus"}
                    >
                      {isMuted || videoVolume === 0 ? (
                        <VolumeX className="w-5 h-5 text-white" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : videoVolume}
                      onChange={(e) => {
                        const newVolume = parseFloat(e.target.value);
                        setVideoVolume(newVolume);
                        setIsMuted(newVolume === 0);
                        if (videoRef.current) {
                          videoRef.current.volume = newVolume;
                          videoRef.current.muted = newVolume === 0;
                        }
                      }}
                      className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                      title="Lautstärke"
                    />
                  </div>
                )}
                {/* Zoom controls - only for photos (desktop only) */}
                {currentLightboxItem.type === 'photo' && (
                  <>
                    <button
                      onClick={zoomOut}
                      disabled={zoomLevel <= 1}
                      className={cn(
                        "p-2 rounded-full transition-colors hidden sm:flex",
                        zoomLevel <= 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"
                      )}
                      title="Verkleinern"
                    >
                      <ZoomOut className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-white text-xs min-w-[3rem] text-center hidden sm:inline">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      onClick={zoomIn}
                      disabled={zoomLevel >= 4}
                      className={cn(
                        "p-2 rounded-full transition-colors hidden sm:flex",
                        zoomLevel >= 4 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"
                      )}
                      title="Vergrößern"
                    >
                      <ZoomIn className="w-5 h-5 text-white" />
                    </button>
                    {zoomLevel > 1 && (
                      <button
                        onClick={resetZoom}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:flex"
                        title="Zoom zurücksetzen"
                      >
                        <RotateCcw className="w-5 h-5 text-white" />
                      </button>
                    )}
                    <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block" />
                  </>
                )}
                
                {/* Favorite Button - always visible */}
                <button
                  onClick={() => toggleFavorite(currentLightboxItem)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Heart className={cn(
                    "w-5 h-5",
                    currentLightboxItem.is_favorite ? "text-red-500 fill-red-500" : "text-white"
                  )} />
                </button>
                
                {/* Delete Button - always visible */}
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, item: currentLightboxItem })}
                  className="p-2 hover:bg-red-500/20 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
                
                {/* More Actions Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <MoreVertical className="w-5 h-5 text-white" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 z-[60] bg-popover">
                    {/* Edit options */}
                    {currentLightboxItem.type === 'photo' && (
                      <DropdownMenuItem onClick={() => { setLightboxIndex(null); setImageEditorItem(currentLightboxItem); }}>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Bild bearbeiten
                      </DropdownMenuItem>
                    )}
                    {currentLightboxItem.type === 'video' && (
                      <DropdownMenuItem onClick={() => { setLightboxIndex(null); setVideoEditorItem(currentLightboxItem); }}>
                        <Film className="w-4 h-4 mr-2" />
                        Video bearbeiten
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => downloadMedia(currentLightboxItem)}>
                      <Download className="w-4 h-4 mr-2" />
                      Herunterladen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRenameDialog({ isOpen: true, item: currentLightboxItem })}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Umbenennen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSinglePhotoAlbumPicker(currentLightboxItem)}>
                      <Folder className="w-4 h-4 mr-2" />
                      Zu Album hinzufügen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowTagSelector(currentLightboxItem.id)}>
                      <Tag className="w-4 h-4 mr-2" />
                      Tags verwalten
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShareItem(currentLightboxItem)}>
                      <Clock className="w-4 h-4 mr-2" />
                      Temporär teilen
                    </DropdownMenuItem>
                    {currentLightboxItem.url && (
                      <DropdownMenuItem asChild>
                        <QRCodeGenerator
                          url={currentLightboxItem.url}
                          title={`QR für ${currentLightboxItem.filename.replace(/^\d+-/, '')}`}
                          trigger={
                            <button className="w-full flex items-center px-2 py-1.5 text-sm cursor-pointer">
                              <QrCode className="w-4 h-4 mr-2" />
                              QR-Code anzeigen
                            </button>
                          }
                        />
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setShareToAlbum({ isOpen: true, photo: currentLightboxItem })}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Zu geteiltem Album
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                        controls={!isSlideshow}
                        controlsList="nodownload"
                        autoPlay
                        playsInline
                        muted={isMuted}
                        onClick={(e) => e.stopPropagation()}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onLoadedMetadata={() => {
                          if (videoRef.current) {
                            videoRef.current.volume = videoVolume;
                            videoRef.current.muted = isMuted;
                          }
                        }}
                        onEnded={() => {
                          setIsVideoPlaying(false);
                          // In slideshow mode, move to next when video ends
                          if (isSlideshow) {
                            handleSlideshowVideoEnded();
                          }
                        }}
                      >
                        <source src={currentLightboxItem.url} type={currentLightboxItem.mime_type || 'video/mp4'} />
                        Dein Browser unterstützt dieses Videoformat nicht.
                      </video>
                      {/* Slideshow indicator for videos */}
                      {isSlideshow && slideshowVideoPlaying && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full text-white text-xs flex items-center gap-2">
                          <Film className="w-3 h-3" />
                          Video wird abgespielt...
                        </div>
                      )}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createAlbum();
                  }
                }}
              />

              {/* Parent Album Selection */}
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Übergeordnetes Album (optional)</p>
                <select
                  value={newAlbumParentId || ''}
                  onChange={(e) => setNewAlbumParentId(e.target.value || null)}
                  className="w-full px-4 py-3 rounded-xl vault-input text-foreground bg-muted border border-border"
                >
                  <option value="">Kein übergeordnetes Album</option>
                  {albums.filter(a => !a.parent_id).map(album => (
                    <option key={album.id} value={album.id}>{album.name}</option>
                  ))}
                </select>
              </div>
              
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
                  onClick={() => createAlbum()}
                  disabled={!newAlbumName.trim() || isCreatingAlbum}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-primary text-primary-foreground hover:shadow-glow transition-all disabled:opacity-50"
                >
                  {isCreatingAlbum ? 'Wird erstellt...' : 'Erstellen'}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
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

      {/* Album Delete Confirmation */}
      <AlbumDeleteConfirmDialog
        isOpen={albumDeleteConfirm.isOpen}
        albumName={albumDeleteConfirm.album?.name || ''}
        itemCount={albumDeleteConfirm.album ? media.filter(m => m.album_id === albumDeleteConfirm.album?.id).length : 0}
        onClose={() => setAlbumDeleteConfirm({ isOpen: false, album: null })}
        onDeleteWithItems={handleDeleteAlbumWithItems}
        onDeleteKeepItems={handleDeleteAlbumKeepItems}
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
        totalCount={filteredMedia.length}
        onClear={() => {
          setSelectedItems(new Set());
          setIsMultiSelectMode(false);
        }}
        onDelete={() => setDeleteConfirm({ isOpen: true, item: null, isMulti: true })}
        onTag={() => setShowBulkTagManager(true)}
        onFavorite={handleBulkFavorite}
        onMove={() => setShowAlbumPicker(true)}
        onSelectAll={() => {
          const allIds = new Set(filteredMedia.map(m => m.id));
          setSelectedItems(allIds);
        }}
        availableTags={tags}
        onSelectByTag={(tagId) => {
          const matchingIds = filteredMedia.filter(m => m.tags?.includes(tagId)).map(m => m.id);
          setSelectedItems(prev => {
            const newSet = new Set(prev);
            matchingIds.forEach(id => newSet.add(id));
            return newSet;
          });
        }}
        availableDates={(() => {
          const dateMap = new Map<string, number>();
          filteredMedia.forEach(m => {
            const date = new Date(m.uploaded_at).toISOString().split('T')[0];
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
          const matchingIds = filteredMedia
            .filter(m => new Date(m.uploaded_at).toISOString().split('T')[0] === date)
            .map(m => m.id);
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
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

      {/* Album Picker Modal - Hierarchical */}
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
            title={`${selectedItems.size} Elemente zu Album hinzufügen`}
          />
        )}
      </AnimatePresence>

      {/* Single Photo Album Picker - Hierarchical */}
      <AnimatePresence>
        {singlePhotoAlbumPicker && (
          <HierarchicalAlbumPicker
            key="single-photo-album-picker"
            albums={albums}
            selectedAlbumId={singlePhotoAlbumPicker.album_id}
            onSelect={(albumId) => {
              handleSinglePhotoMoveToAlbum(singlePhotoAlbumPicker, albumId);
            }}
            onClose={() => setSinglePhotoAlbumPicker(null)}
            title="In Album verschieben"
            itemName={singlePhotoAlbumPicker.caption || singlePhotoAlbumPicker.filename.replace(/^\d+-/, '')}
          />
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

      {/* Temporary Share Dialog */}
      {shareItem && (
        <TemporaryShareLink
          itemId={shareItem.id}
          itemType="photo"
          itemName={shareItem.filename.replace(/^\d+-/, '')}
          trigger={<span />}
          defaultOpen={true}
          onOpenChange={(open) => {
            if (!open) setShareItem(null);
          }}
        />
      )}

      {/* Image Editor */}
      <ImageEditor
        isOpen={!!imageEditorItem}
        imageUrl={imageEditorItem?.url || ''}
        filename={imageEditorItem?.filename || ''}
        onSave={async (blob, saveAsNew) => {
          if (!imageEditorItem || !userId) return;
          try {
            const timestamp = Date.now();
            const newFilename = saveAsNew 
              ? `${timestamp}-edited-${imageEditorItem.filename.replace(/^\d+-/, '')}`
              : imageEditorItem.filename;
            
            const objectPath = `${userId}/${newFilename}`;
            
            // Upload the edited image
            const { error: uploadError } = await supabase.storage
              .from('photos')
              .upload(objectPath, blob, {
                contentType: 'image/jpeg',
                upsert: !saveAsNew,
              });
            
            if (uploadError) throw uploadError;
            
            if (saveAsNew) {
              // Create new photo record
              const { data: newPhoto, error: dbError } = await supabase
                .from('photos')
                .insert({
                  user_id: userId,
                  filename: newFilename,
                  caption: `${imageEditorItem.caption || ''} (bearbeitet)`,
                  album_id: imageEditorItem.album_id,
                })
                .select()
                .single();
              
              if (dbError) throw dbError;
              fetchData();
              toast.success('Bearbeitetes Bild als Kopie gespeichert');
            } else {
              toast.success('Bild aktualisiert');
              fetchData();
            }
            
            setImageEditorItem(null);
          } catch (error) {
            console.error('Error saving edited image:', error);
            toast.error('Fehler beim Speichern');
          }
        }}
        onClose={() => setImageEditorItem(null)}
      />

      {/* Video Editor */}
      <VideoEditor
        isOpen={!!videoEditorItem}
        videoUrl={videoEditorItem?.url || ''}
        filename={videoEditorItem?.filename || ''}
        onSave={async (videoBlob, thumbnailBlob, startTime, endTime) => {
          if (!videoEditorItem || !userId) return;
          try {
            // Save new thumbnail if generated
            if (thumbnailBlob) {
              const thumbFilename = `${Date.now()}-thumb-${videoEditorItem.filename.replace(/\.[^.]+$/, '.jpg')}`;
              await supabase.storage
                .from('photos')
                .upload(`${userId}/thumbnails/${thumbFilename}`, thumbnailBlob, {
                  contentType: 'image/jpeg',
                });
              
              await supabase
                .from('photos')
                .update({ thumbnail_filename: thumbFilename })
                .eq('id', videoEditorItem.id);
            }
            
            toast.success('Video-Thumbnail aktualisiert');
            fetchData();
            setVideoEditorItem(null);
          } catch (error) {
            console.error('Error saving video edits:', error);
            toast.error('Fehler beim Speichern');
          }
        }}
        onClose={() => setVideoEditorItem(null)}
      />

      {/* Collage Creator */}
      <CollageCreator
        isOpen={showCollageCreator}
        availablePhotos={media.filter(m => m.type === 'photo' && m.url).map(m => ({
          id: m.id,
          url: m.url!,
          filename: m.filename,
        }))}
        onSave={async (blob) => {
          if (!userId) return;
          try {
            const timestamp = Date.now();
            const filename = `${timestamp}-collage.jpg`;
            const objectPath = `${userId}/${filename}`;
            
            const { error: uploadError } = await supabase.storage
              .from('photos')
              .upload(objectPath, blob, {
                contentType: 'image/jpeg',
              });
            
            if (uploadError) throw uploadError;
            
            await supabase
              .from('photos')
              .insert({
                user_id: userId,
                filename,
                caption: 'Collage',
                album_id: selectedAlbum?.id || null,
              });
            
            fetchData();
            toast.success('Collage erstellt');
            setShowCollageCreator(false);
          } catch (error) {
            console.error('Error creating collage:', error);
            toast.error('Fehler beim Erstellen der Collage');
          }
        }}
        onClose={() => setShowCollageCreator(false)}
      />
    </div>
  );
}
