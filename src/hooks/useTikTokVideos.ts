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
  folder_id: string | null;
}

// Extract video ID from TikTok URL
const extractVideoId = (url: string): string | null => {
  try {
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
  const { userId, isDecoyMode, sessionToken } = useAuth();

  const fetchVideos = useCallback(async () => {
    if (!userId || isDecoyMode || !sessionToken) {
      setVideos([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: { 
          action: 'get-tiktoks',
          sessionToken,
          data: {}
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setVideos((data.data as TikTokVideo[]) || []);
    } catch (error) {
      console.error('Error fetching TikTok videos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode, sessionToken]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const fetchMetadata = async (url: string) => {
    if (!sessionToken) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-tiktok-metadata', {
        body: { url, sessionToken },
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

  const addVideo = async (url: string, folderId?: string | null) => {
    if (!userId || !sessionToken) return null;

    try {
      const metadata = await fetchMetadata(url);
      const videoId = metadata?.video_id || extractVideoId(url);
      
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'create-tiktok',
          sessionToken,
          data: {
            url,
            video_id: videoId,
            title: metadata?.title || '',
            author_name: metadata?.author_name || null,
            thumbnail_url: metadata?.thumbnail_url || null,
            folder_id: folderId || null,
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setVideos(prev => [data.data as TikTokVideo, ...prev]);
      toast.success('TikTok Video gespeichert');
      return data.data;
    } catch (error) {
      console.error('Error adding TikTok video:', error);
      toast.error('Fehler beim Speichern');
      return null;
    }
  };

  const moveToFolder = async (videoId: string, folderId: string | null) => {
    if (!sessionToken) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'update-tiktok',
          sessionToken,
          data: { id: videoId, updates: { folder_id: folderId } }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, folder_id: folderId } : v
      ));
      toast.success('Video verschoben');
    } catch (error) {
      console.error('Error moving video:', error);
      toast.error('Fehler beim Verschieben');
    }
  };

  const deleteVideo = async (id: string) => {
    if (!sessionToken) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'delete-tiktok',
          sessionToken,
          data: { id }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      setVideos(prev => prev.filter(v => v.id !== id));
      toast.success('Video gelöscht');
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const toggleFavorite = async (id: string) => {
    const video = videos.find(v => v.id === id);
    if (!video || !sessionToken) return;

    try {
      const { data, error } = await supabase.functions.invoke('vault-data', {
        body: {
          action: 'update-tiktok',
          sessionToken,
          data: { id, updates: { is_favorite: !video.is_favorite } }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
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
    moveToFolder,
    refetch: fetchVideos,
  };
}
