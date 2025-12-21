import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Camera, X, FolderPlus, Image as ImageIcon, Loader2, Trash2, ZoomIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Photo {
  id: string;
  filename: string;
  caption: string;
  album_id: string | null;
  taken_at: string;
  uploaded_at: string;
  url?: string;
}

interface Album {
  id: string;
  name: string;
  created_at: string;
}

export default function Photos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { userId } = useAuth();

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    if (!userId) return;

    try {
      const [photosRes, albumsRes] = await Promise.all([
        supabase.from('photos').select('*').eq('user_id', userId).order('uploaded_at', { ascending: false }),
        supabase.from('albums').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

      if (photosRes.error) throw photosRes.error;
      if (albumsRes.error) throw albumsRes.error;

      // Get signed URLs for photos
      const photosWithUrls = await Promise.all(
        (photosRes.data || []).map(async (photo) => {
          const { data } = await supabase.storage
            .from('photos')
            .createSignedUrl(`${userId}/${photo.filename}`, 3600);
          return { ...photo, url: data?.signedUrl };
        })
      );

      setPhotos(photosWithUrls);
      setAlbums(albumsRes.data || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !userId) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;

        const filename = `${Date.now()}-${file.name}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(`${userId}/${filename}`, file);

        if (uploadError) throw uploadError;

        // Create database record
        const { data: photoData, error: dbError } = await supabase
          .from('photos')
          .insert({
            user_id: userId,
            filename,
            caption: '',
            album_id: selectedAlbum,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Get signed URL
        const { data: urlData } = await supabase.storage
          .from('photos')
          .createSignedUrl(`${userId}/${filename}`, 3600);

        setPhotos(prev => [{ ...photoData, url: urlData?.signedUrl }, ...prev]);
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCameraCapture = async () => {
    cameraInputRef.current?.click();
  };

  const createAlbum = async () => {
    if (!newAlbumName.trim() || !userId) return;

    try {
      const { data, error } = await supabase
        .from('albums')
        .insert({
          user_id: userId,
          name: newAlbumName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setAlbums([data, ...albums]);
      setNewAlbumName('');
      setShowNewAlbumModal(false);
    } catch (error) {
      console.error('Error creating album:', error);
    }
  };

  const deletePhoto = async (photo: Photo) => {
    if (!userId) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('photos')
        .remove([`${userId}/${photo.filename}`]);

      // Delete from database
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      setPhotos(photos.filter(p => p.id !== photo.id));
      setLightboxPhoto(null);
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  const filteredPhotos = selectedAlbum
    ? photos.filter(p => p.album_id === selectedAlbum)
    : photos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Fotos</h1>
          <p className="text-white/60 text-sm">
            {photos.length} Fotos • {albums.length} Alben
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewAlbumModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
          >
            <FolderPlus className="w-4 h-4 text-white" />
            <span className="text-white text-sm">Album</span>
          </button>
          
          <button
            onClick={handleCameraCapture}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-all"
          >
            <Camera className="w-4 h-4 text-white" />
            <span className="text-white text-sm hidden md:inline">Kamera</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="text-white text-sm">Upload</span>
          </button>
        </div>
      </motion.div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Albums Filter */}
      {albums.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-2 overflow-x-auto pb-2"
        >
          <button
            onClick={() => setSelectedAlbum(null)}
            className={cn(
              "px-4 py-2 rounded-xl whitespace-nowrap transition-all",
              !selectedAlbum
                ? "bg-gradient-primary text-white"
                : "bg-white/5 text-white/70 hover:text-white"
            )}
          >
            Alle Fotos
          </button>
          {albums.map(album => (
            <button
              key={album.id}
              onClick={() => setSelectedAlbum(album.id)}
              className={cn(
                "px-4 py-2 rounded-xl whitespace-nowrap transition-all",
                selectedAlbum === album.id
                  ? "bg-gradient-primary text-white"
                  : "bg-white/5 text-white/70 hover:text-white"
              )}
            >
              {album.name}
            </button>
          ))}
        </motion.div>
      )}

      {/* Upload indicator */}
      {isUploading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 flex items-center gap-3"
        >
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          <span className="text-white">Fotos werden hochgeladen...</span>
        </motion.div>
      )}

      {/* Photos Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : filteredPhotos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 text-center"
        >
          <ImageIcon className="w-16 h-16 mx-auto mb-4 text-white/30" />
          <h3 className="text-lg font-medium text-white mb-2">Keine Fotos</h3>
          <p className="text-white/50 mb-6">
            Lade deine ersten Fotos hoch
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary hover:shadow-glow transition-all"
          >
            <Plus className="w-5 h-5 text-white" />
            <span className="text-white">Fotos hochladen</span>
          </button>
        </motion.div>
      ) : (
        <div className="masonry-grid">
          {filteredPhotos.map((photo, index) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="masonry-item"
            >
              <div
                onClick={() => setLightboxPhoto(photo)}
                className="glass-card-hover overflow-hidden cursor-pointer group"
              >
                {photo.url ? (
                  <img
                    src={photo.url}
                    alt={photo.caption || photo.filename}
                    className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-square flex items-center justify-center bg-white/5">
                    <ImageIcon className="w-12 h-12 text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center justify-center">
                      <ZoomIn className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
            onClick={() => setLightboxPhoto(null)}
          >
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                deletePhoto(lightboxPhoto);
              }}
              className="absolute top-4 left-4 p-2 hover:bg-red-500/20 rounded-full transition-colors"
            >
              <Trash2 className="w-6 h-6 text-red-400" />
            </button>

            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || lightboxPhoto.filename}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
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
              <h2 className="text-xl font-bold text-white mb-4">Neues Album</h2>
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Album Name..."
                className="w-full px-4 py-3 rounded-xl vault-input text-white placeholder:text-white/40 mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewAlbumModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-all"
                >
                  Abbrechen
                </button>
                <button
                  onClick={createAlbum}
                  disabled={!newAlbumName.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-primary text-white hover:shadow-glow transition-all disabled:opacity-50"
                >
                  Erstellen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
