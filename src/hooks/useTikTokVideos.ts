import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TikTokVideo {
  id: string;
  user_id: string;
  url: string;
  video_id: string | null;
  title: string | null;
  thumbnail_url: string | null;
  author_name: string | null;
  is_favorite: boolean;
  created_at: string;
  deleted_at: string | null;
}

// Extract video ID from TikTok URL
const extractVideoId = (url: string): string | null => {
  try {
    // Handle various TikTok URL formats
    // https://www.tiktok.com/@username/video/1234567890
    // https://vm.tiktok.com/ABC123/
    // https://www.tiktok.com/t/ABC123/
    
    const patterns = [
      /tiktok\.com\/@[\w.]+\/video\/(\d+)/,
      /tiktok\.com\/.*\/video\/(\d+)/,
      /video\/(\d+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  } catch {
    return null;
  }
};

export function useTikTokVideos() {
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode } = useAuth();

  const fetchVideos = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setVideos([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tiktok_videos')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos((data as TikTokVideo[]) || []);
    } catch (error) {
      console.error('Error fetching TikTok videos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const fetchMetadata = async (url: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-tiktok-metadata', {
        body: { url },
      });
      
      if (error) {
        console.error('Error fetching metadata:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching metadata:', error);
      return null;
    }
  };

  const addVideo = async (url: string) => {
    if (!userId) return null;

    try {
      // Fetch metadata from TikTok (includes video_id for shortened URLs)
      const metadata = await fetchMetadata(url);
      
      // Use video_id from metadata if available, otherwise try to extract from URL
      const videoId = metadata?.video_id || extractVideoId(url);
      
      const { data, error } = await supabase
        .from('tiktok_videos')
        .insert({
          user_id: userId,
          url,
          video_id: videoId,
          title: metadata?.title || '',
          author_name: metadata?.author_name || null,
          thumbnail_url: metadata?.thumbnail_url || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      setVideos(prev => [data as TikTokVideo, ...prev]);
      toast.success('TikTok Video gespeichert');
      return data;
    } catch (error) {
      console.error('Error adding TikTok video:', error);
      toast.error('Fehler beim Speichern');
      return null;
    }
  };

  const deleteVideo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tiktok_videos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setVideos(prev => prev.filter(v => v.id !== id));
      toast.success('Video gelöscht');
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const toggleFavorite = async (id: string) => {
    const video = videos.find(v => v.id === id);
    if (!video) return;

    try {
      const { error } = await supabase
        .from('tiktok_videos')
        .update({ is_favorite: !video.is_favorite })
        .eq('id', id);

      if (error) throw error;
      
      setVideos(prev => prev.map(v => 
        v.id === id ? { ...v, is_favorite: !v.is_favorite } : v
      ));
      toast.success(video.is_favorite ? 'Aus Favoriten entfernt' : 'Zu Favoriten hinzugefügt');
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  return {
    videos,
    isLoading,
    addVideo,
    deleteVideo,
    toggleFavorite,
    refetch: fetchVideos,
  };
}
