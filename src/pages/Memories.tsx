import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause,
  Heart,
  Share2,
  Clock,
  Sparkles,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format, subYears, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Memory {
  id: string;
  filename: string;
  url: string;
  uploaded_at: string;
  taken_at: string | null;
  caption: string | null;
  is_favorite: boolean;
  yearsAgo: number;
}

interface MemoryGroup {
  yearsAgo: number;
  date: Date;
  memories: Memory[];
}

export default function Memories() {
  const { userId, supabaseClient: supabase } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);

  // Fetch memories from "this day" in previous years
  useEffect(() => {
    const fetchMemories = async () => {
      if (!userId) return;

      try {
        setIsLoading(true);
        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayDay = today.getDate();

        // Fetch all photos
        const { data: photos, error } = await supabase
          .from('photos')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (error) throw error;

        // Filter photos from "this day" in previous years
        const memoriesFromThisDay: Memory[] = [];

        for (const photo of photos || []) {
          const photoDate = photo.taken_at 
            ? parseISO(photo.taken_at) 
            : parseISO(photo.uploaded_at);
          
          const photoMonth = photoDate.getMonth() + 1;
          const photoDay = photoDate.getDate();
          const photoYear = photoDate.getFullYear();
          const currentYear = today.getFullYear();

          // Check if same month/day but different year
          if (photoMonth === todayMonth && photoDay === todayDay && photoYear < currentYear) {
            // Get signed URL
            const { data: urlData } = await supabase.storage
              .from('photos')
              .createSignedUrl(`${userId}/${photo.filename}`, 3600);

            memoriesFromThisDay.push({
              id: photo.id,
              filename: photo.filename,
              url: urlData?.signedUrl || '',
              uploaded_at: photo.uploaded_at,
              taken_at: photo.taken_at,
              caption: photo.caption,
              is_favorite: photo.is_favorite || false,
              yearsAgo: currentYear - photoYear
            });
          }
        }

        // Sort by years ago (most recent first)
        memoriesFromThisDay.sort((a, b) => a.yearsAgo - b.yearsAgo);
        setMemories(memoriesFromThisDay);
      } catch (error) {
        console.error('Error fetching memories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMemories();
  }, [userId, supabase]);

  // Group memories by year
  const memoryGroups = useMemo((): MemoryGroup[] => {
    const groups: Map<number, Memory[]> = new Map();
    
    memories.forEach(memory => {
      const existing = groups.get(memory.yearsAgo) || [];
      existing.push(memory);
      groups.set(memory.yearsAgo, existing);
    });

    return Array.from(groups.entries())
      .map(([yearsAgo, mems]) => ({
        yearsAgo,
        date: subYears(new Date(), yearsAgo),
        memories: mems
      }))
      .sort((a, b) => a.yearsAgo - b.yearsAgo);
  }, [memories]);

  // Slideshow controls
  useEffect(() => {
    if (!isSlideshow || memories.length === 0) return;

    const timer = setInterval(() => {
      setSlideshowIndex(prev => (prev + 1) % memories.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [isSlideshow, memories.length]);

  const startSlideshow = () => {
    setSlideshowIndex(0);
    setIsSlideshow(true);
  };

  const toggleFavorite = async (memory: Memory) => {
    const newValue = !memory.is_favorite;
    
    await supabase
      .from('photos')
      .update({ is_favorite: newValue })
      .eq('id', memory.id);

    setMemories(prev => prev.map(m => 
      m.id === memory.id ? { ...m, is_favorite: newValue } : m
    ));
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Erinnerungen
          </h1>
          <p className="text-muted-foreground mt-1">
            An diesem Tag in vergangenen Jahren
          </p>
        </div>

        {memories.length > 0 && (
          <button
            onClick={startSlideshow}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Diashow starten
          </button>
        )}
      </div>

      {/* Today's Date */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calendar className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {format(new Date(), 'd. MMMM', { locale: de })}
          </p>
          <p className="text-sm text-muted-foreground">
            {memories.length} Erinnerung{memories.length !== 1 ? 'en' : ''} gefunden
          </p>
        </div>
      </div>

      {/* Memories */}
      {memories.length === 0 ? (
        <div className="text-center py-16">
          <ImageIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Keine Erinnerungen</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Für diesen Tag wurden keine Fotos aus vergangenen Jahren gefunden.
            Schau morgen wieder vorbei!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {memoryGroups.map(group => (
            <motion.div
              key={group.yearsAgo}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Year Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Vor {group.yearsAgo} Jahr{group.yearsAgo !== 1 ? 'en' : ''}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {format(group.date, 'd. MMMM yyyy', { locale: de })}
                  </p>
                </div>
              </div>

              {/* Photos Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {group.memories.map((memory, index) => (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                    onClick={() => setSelectedMemory(memory)}
                  >
                    <img
                      src={memory.url}
                      alt={memory.caption || ''}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    {memory.is_favorite && (
                      <div className="absolute top-2 right-2">
                        <Heart className="w-5 h-5 text-red-500" fill="currentColor" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Memory Lightbox */}
      <AnimatePresence>
        {selectedMemory && !isSlideshow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedMemory(null)}
          >
            <button
              onClick={() => setSelectedMemory(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl max-h-[80vh]"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={selectedMemory.url}
                alt={selectedMemory.caption || ''}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
                <button
                  onClick={() => toggleFavorite(selectedMemory)}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors"
                >
                  <Heart 
                    className={cn("w-5 h-5", selectedMemory.is_favorite ? "text-red-500" : "text-white")} 
                    fill={selectedMemory.is_favorite ? "currentColor" : "none"}
                  />
                </button>
                <span className="text-white text-sm">
                  Vor {selectedMemory.yearsAgo} Jahr{selectedMemory.yearsAgo !== 1 ? 'en' : ''}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slideshow */}
      <AnimatePresence>
        {isSlideshow && memories.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          >
            {/* Close button */}
            <button
              onClick={() => setIsSlideshow(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation */}
            <button
              onClick={() => setSlideshowIndex(prev => Math.max(0, prev - 1))}
              disabled={slideshowIndex === 0}
              className="absolute left-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => setSlideshowIndex(prev => Math.min(memories.length - 1, prev + 1))}
              disabled={slideshowIndex === memories.length - 1}
              className="absolute right-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-50"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Image */}
            <AnimatePresence mode="wait">
              <motion.img
                key={memories[slideshowIndex].id}
                src={memories[slideshowIndex].url}
                alt=""
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
                className="max-w-full max-h-full object-contain"
              />
            </AnimatePresence>

            {/* Info overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
              <motion.div
                key={slideshowIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/50 backdrop-blur-sm rounded-xl px-6 py-3"
              >
                <p className="text-white text-lg font-semibold">
                  Vor {memories[slideshowIndex].yearsAgo} Jahr{memories[slideshowIndex].yearsAgo !== 1 ? 'en' : ''}
                </p>
                <p className="text-white/70 text-sm">
                  {slideshowIndex + 1} / {memories.length}
                </p>
              </motion.div>
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 4, ease: 'linear' }}
                key={slideshowIndex}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
