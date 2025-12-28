import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Share2,
  Image,
  FileText,
  FolderOpen,
  Link,
  Play,
  Lock,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface SharedAlbumData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  content_type: string;
  owner_id: string;
}

interface AlbumItem {
  id: string;
  type: 'photo' | 'note' | 'file' | 'link' | 'tiktok';
  data: any;
}

export default function SharedAlbum() {
  const { token } = useParams<{ token: string }>();
  const { userId, isAuthenticated } = useAuth();
  const [album, setAlbum] = useState<SharedAlbumData | null>(null);
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (token) {
      fetchAlbum();
    }
  }, [token]);

  const fetchAlbum = async () => {
    try {
      // Fetch album by public token
      const { data: albumData, error: albumError } = await supabase
        .from('shared_albums')
        .select('*')
        .eq('public_link_token', token)
        .eq('public_link_enabled', true)
        .single();

      if (albumError || !albumData) {
        setError('Album nicht gefunden oder nicht öffentlich');
        setIsLoading(false);
        return;
      }

      setAlbum(albumData as SharedAlbumData);

      // Fetch album items
      const { data: itemsData, error: itemsError } = await supabase
        .from('shared_album_items')
        .select('*')
        .eq('shared_album_id', albumData.id);

      if (itemsError) throw itemsError;

      // Fetch actual item data based on type
      const enrichedItems: AlbumItem[] = [];

      for (const item of itemsData || []) {
        if (item.photo_id) {
          const { data } = await supabase.from('photos').select('*').eq('id', item.photo_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'photo', data });
        }
        if (item.note_id) {
          const { data } = await supabase.from('notes').select('id, title, content, created_at').eq('id', item.note_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'note', data });
        }
        if (item.file_id) {
          const { data } = await supabase.from('files').select('*').eq('id', item.file_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'file', data });
        }
        if (item.link_id) {
          const { data } = await supabase.from('links').select('*').eq('id', item.link_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'link', data });
        }
        if (item.tiktok_id) {
          const { data } = await supabase.from('tiktok_videos').select('*').eq('id', item.tiktok_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'tiktok', data });
        }
      }

      setItems(enrichedItems);
    } catch (err) {
      console.error('Error fetching shared album:', err);
      setError('Fehler beim Laden des Albums');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground mb-2">{error}</h1>
          <p className="text-muted-foreground">
            Dieses Album ist nicht verfügbar oder wurde gelöscht.
          </p>
        </div>
      </div>
    );
  }

  if (!album) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: `${album.color}20` }}
          >
            <Share2 className="w-6 h-6" style={{ color: album.color }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{album.name}</h1>
            {album.description && (
              <p className="text-sm text-muted-foreground">{album.description}</p>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <Share2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Dieses Album ist leer</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card overflow-hidden hover:border-primary/30 transition-colors"
              >
                {item.type === 'photo' && (
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    <Image className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                {item.type === 'note' && (
                  <div className="p-4">
                    <FileText className="w-6 h-6 text-yellow-500 mb-2" />
                    <h3 className="font-medium text-foreground truncate">
                      {item.data.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.data.content}
                    </p>
                  </div>
                )}
                {item.type === 'file' && (
                  <div className="p-4">
                    <FolderOpen className="w-6 h-6 text-purple-500 mb-2" />
                    <h3 className="font-medium text-foreground truncate">
                      {item.data.filename}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {(item.data.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
                {item.type === 'link' && (
                  <a
                    href={item.data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 hover:bg-muted/50 transition-colors"
                  >
                    <Link className="w-6 h-6 text-cyan-500 mb-2" />
                    <h3 className="font-medium text-foreground truncate">
                      {item.data.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.data.url}
                    </p>
                  </a>
                )}
                {item.type === 'tiktok' && (
                  <div className="p-4">
                    <Play className="w-6 h-6 text-pink-500 mb-2" />
                    <h3 className="font-medium text-foreground truncate">
                      {item.data.title || 'TikTok Video'}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.data.author_name}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
