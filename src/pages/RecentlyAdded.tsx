import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  FileText, 
  Image, 
  FolderOpen,
  Loader2,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface RecentItem {
  id: string;
  type: 'note' | 'photo' | 'file';
  title: string;
  date: string;
  url?: string;
}

export default function RecentlyAdded() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId, isDecoyMode } = useAuth();
  const navigate = useNavigate();

  const fetchRecentItems = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const recent: RecentItem[] = [];

      // Fetch recent notes
      const { data: notes } = await supabase
        .from('notes')
        .select('id, title, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      notes?.forEach(note => {
        recent.push({
          id: note.id,
          type: 'note',
          title: note.title || 'Unbenannte Notiz',
          date: note.created_at || new Date().toISOString()
        });
      });

      // Fetch recent photos
      const { data: photos } = await supabase
        .from('photos')
        .select('id, filename, caption, uploaded_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false })
        .limit(20);

      for (const photo of photos || []) {
        const { data } = await supabase.storage
          .from('photos')
          .createSignedUrl(`${userId}/${photo.filename}`, 3600);
        
        recent.push({
          id: photo.id,
          type: 'photo',
          title: photo.caption || photo.filename?.replace(/^\d+-/, '') || 'Foto',
          date: photo.uploaded_at || new Date().toISOString(),
          url: data?.signedUrl
        });
      }

      // Fetch recent files
      const { data: files } = await supabase
        .from('files')
        .select('id, filename, uploaded_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false })
        .limit(20);

      files?.forEach(file => {
        recent.push({
          id: file.id,
          type: 'file',
          title: file.filename?.replace(/^\d+-/, '') || 'Datei',
          date: file.uploaded_at || new Date().toISOString()
        });
      });

      // Sort by date
      recent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(recent.slice(0, 50));
    } catch (error) {
      console.error('Error fetching recent items:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchRecentItems();
  }, [fetchRecentItems]);

  // Real-time updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('recent-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, fetchRecentItems)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos' }, fetchRecentItems)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'files' }, fetchRecentItems)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchRecentItems]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'note': return FileText;
      case 'photo': return Image;
      case 'file': return FolderOpen;
      default: return FileText;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'note': return { bg: 'bg-purple-500/20', text: 'text-purple-400' };
      case 'photo': return { bg: 'bg-pink-500/20', text: 'text-pink-400' };
      case 'file': return { bg: 'bg-blue-500/20', text: 'text-blue-400' };
      default: return { bg: 'bg-purple-500/20', text: 'text-purple-400' };
    }
  };

  const handleItemClick = (item: RecentItem) => {
    switch (item.type) {
      case 'note':
        navigate('/notes', { state: { openNote: item.id } });
        break;
      case 'photo':
        navigate('/photos');
        break;
      case 'file':
        navigate('/files');
        break;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Gerade eben';
    if (minutes < 60) return `Vor ${minutes} Min.`;
    if (hours < 24) return `Vor ${hours} Std.`;
    if (days < 7) return `Vor ${days} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };

  if (isDecoyMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-[60vh] text-center"
      >
        <Calendar className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Zuletzt hinzugefügt</h2>
        <p className="text-muted-foreground">Keine Einträge vorhanden</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
          <Calendar className="w-6 h-6 text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Zuletzt hinzugefügt</h1>
          <p className="text-muted-foreground text-sm">{items.length} Einträge</p>
        </div>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
          <h3 className="text-lg font-medium text-foreground mb-2">Keine Einträge</h3>
          <p className="text-muted-foreground">Füge Elemente hinzu um sie hier zu sehen</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden divide-y divide-border/10">
          {items.map((item, index) => {
            const Icon = getIcon(item.type);
            const color = getColor(item.type);

            return (
              <motion.div
                key={`${item.type}-${item.id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                onClick={() => handleItemClick(item)}
                className="p-4 hover:bg-muted/30 transition-colors cursor-pointer flex items-center gap-4"
              >
                {item.type === 'photo' && item.url ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                    <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center shrink-0", color.bg)}>
                    <Icon className={cn("w-6 h-6", color.text)} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-xs px-2 py-0.5 rounded", color.bg, color.text)}>
                      {item.type === 'note' ? 'Notiz' : item.type === 'photo' ? 'Foto' : 'Datei'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="w-4 h-4" />
                  {formatDate(item.date)}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
