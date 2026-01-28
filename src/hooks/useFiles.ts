import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { MAX_FILE_SIZE_BYTES } from '@/config';
import { isOfficeDocument, isOfficeDocumentByExtension, isTextFile } from '@/components/DocumentPreview';

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

// Cache for signed URLs with TTL
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function useFiles() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const fetchedRef = useRef(false);

  const getSignedUrl = useCallback(async (filename: string): Promise<string | null> => {
    if (!userId) return null;
    
    const cacheKey = `${userId}/${filename}`;
    const cached = urlCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }
    
    const { data, error } = await supabase.storage
      .from('files')
      .createSignedUrl(cacheKey, 3600);
    
    if (error || !data?.signedUrl) return null;
    
    urlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + URL_CACHE_TTL
    });
    
    return data.signedUrl;
  }, [userId, supabase]);

  const fetchFiles = useCallback(async () => {
    if (!userId) return;

    if (isDecoyMode) {
      setFiles([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch files without URLs first - fast initial load
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      // Set files immediately without URLs
      setFiles(data || []);
      setIsLoading(false);

      // Then fetch URLs in background for previewable files only
      if (data && data.length > 0) {
        const previewableFiles = data.filter(file => {
          const isPreviewable = file.mime_type.startsWith('image/') || 
                               file.mime_type.startsWith('video/') || 
                               file.mime_type === 'application/pdf' ||
                               isOfficeDocument(file.mime_type) ||
                               isOfficeDocumentByExtension(file.filename) ||
                               isTextFile(file.mime_type, file.filename);
          return isPreviewable;
        });

        // Batch URL fetching - 5 at a time
        const batchSize = 5;
        for (let i = 0; i < previewableFiles.length; i += batchSize) {
          const batch = previewableFiles.slice(i, i + batchSize);
          const urls = await Promise.all(
            batch.map(file => getSignedUrl(file.filename))
          );
          
          setFiles(prev => prev.map(f => {
            const idx = batch.findIndex(b => b.id === f.id);
            if (idx !== -1 && urls[idx]) {
              return { ...f, url: urls[idx]! };
            }
            return f;
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setIsLoading(false);
    }
  }, [userId, isDecoyMode, supabase, getSignedUrl]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchFiles();
    }
  }, [fetchFiles]);

  const uploadFiles = useCallback(async (fileList: FileList | null, albumId?: string | null) => {
    if (!fileList || !userId) return;

    const filesToUpload = Array.from(fileList).filter(f => f.size <= MAX_FILE_SIZE_BYTES);
    if (filesToUpload.length === 0) {
      toast.error('Dateien sind zu groß (max. 50MB)');
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
            album_id: albumId || null,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Get URL for the new file if previewable - in background
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          getSignedUrl(filename).then(url => {
            if (url) {
              setFiles(prev => prev.map(f => 
                f.id === data.id ? { ...f, url } : f
              ));
            }
          });
        }

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
  }, [userId, supabase, getSignedUrl]);

  const deleteFile = useCallback(async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fileId);

      if (error) throw error;

      setFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success('In Papierkorb verschoben');
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Fehler beim Löschen');
    }
  }, [supabase]);

  const toggleFavorite = useCallback(async (fileId: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      const { error } = await supabase
        .from('files')
        .update({ is_favorite: newValue })
        .eq('id', fileId);

      if (error) throw error;

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, is_favorite: newValue } : f
      ));
      toast.success(newValue ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt');
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }, [supabase]);

  const updateFileTags = useCallback(async (fileId: string, newTags: string[]) => {
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
  }, [supabase]);

  const moveToAlbum = useCallback(async (fileId: string, albumId: string | null) => {
    try {
      const { error } = await supabase
        .from('files')
        .update({ album_id: albumId })
        .eq('id', fileId);

      if (error) throw error;

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, album_id: albumId } : f
      ));
      toast.success(albumId ? 'Zu Album hinzugefügt' : 'Aus Album entfernt');
    } catch (error) {
      console.error('Error moving file to album:', error);
      toast.error('Fehler beim Verschieben');
    }
  }, [supabase]);

  return {
    files,
    setFiles,
    isLoading,
    isUploading,
    uploadProgress,
    fetchFiles,
    uploadFiles,
    deleteFile,
    toggleFavorite,
    updateFileTags,
    moveToAlbum,
    getSignedUrl,
  };
}
