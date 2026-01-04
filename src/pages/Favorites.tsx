import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Star, 
  FileText, 
  Image, 
  FolderOpen,
  Loader2,
  Heart
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface FavoriteItem {
  id: string;
  type: 'note' | 'photo' | 'file';
  title: string;
  date: string;
  url?: string;
}

export default function Favorites() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'note' | 'photo' | 'file'>('all');
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const navigate = useNavigate();

  const fetchFavorites = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const favorites: FavoriteItem[] = [];

      // Fetch favorite notes
      const { data: notes } = await supabase
        .from('notes')
        .select('id, title, updated_at')
        .eq('user_id', userId)
        .eq('is_favorite', true)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      notes?.forEach(note => {
        favorites.push({
          id: note.id,
          type: 'note',
          title: note.title || 'Unbenannte Notiz',
          date: note.updated_at || new Date().toISOString()
        });
      });

      // Fetch favorite photos
      const { data: photos } = await supabase
        .from('photos')
        .select('id, filename, caption, uploaded_at')
        .eq('user_id', userId)
        .eq('is_favorite', true)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });

      for (const photo of photos || []) {
        const { data } = await supabase.storage
          .from('photos')
          .createSignedUrl(`${userId}/${photo.filename}`, 3600);
        
        favorites.push({
          id: photo.id,
          type: 'photo',
          title: photo.caption || photo.filename?.replace(/^\d+-/, '') || 'Foto',
          date: photo.uploaded_at || new Date().toISOString(),
          url: data?.signedUrl
        });
      }

      // Fetch favorite files
      const { data: files } = await supabase
        .from('files')
        .select('id, filename, uploaded_at')
        .eq('user_id', userId)
        .eq('is_favorite', true)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });

      files?.forEach(file => {
        favorites.push({
          id: file.id,
          type: 'file',
          title: file.filename?.replace(/^\d+-/, '') || 'Datei',
          date: file.uploaded_at || new Date().toISOString()
        });
      });

      // Sort by date
      favorites.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Real-time updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('favorites-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, fetchFavorites)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, fetchFavorites)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, fetchFavorites)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchFavorites]);

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

  const handleItemClick = (item: FavoriteItem) => {
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
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const filteredItems = filter === 'all' ? items : items.filter(i => i.type === filter);

  const counts = {
    all: items.length,
    note: items.filter(i => i.type === 'note').length,
    photo: items.filter(i => i.type === 'photo').length,
    file: items.filter(i => i.type === 'file').length
  };

  if (isDecoyMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-[60vh] text-center"
      >
        <Star className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Favoriten</h2>
        <p className="text-muted-foreground">Keine Favoriten vorhanden</p>
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
        <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
          <Star className="w-6 h-6 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Favoriten</h1>
          <p className="text-muted-foreground text-sm">{items.length} Elemente</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'Alle' },
          { id: 'note', label: 'Notizen' },
          { id: 'photo', label: 'Fotos' },
          { id: 'file', label: 'Dateien' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as typeof filter)}
            className={cn(
              "px-4 py-2 rounded-xl whitespace-nowrap transition-all text-sm",
              filter === tab.id
                ? "bg-gradient-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label} ({counts[tab.id as keyof typeof counts]})
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Star className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
          <h3 className="text-lg font-medium text-foreground mb-2">Keine Favoriten</h3>
          <p className="text-muted-foreground">Markiere Elemente als Favorit um sie hier zu sehen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item, index) => {
            const Icon = getIcon(item.type);
            const color = getColor(item.type);
            
            return (
              <motion.div
                key={`${item.type}-${item.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => handleItemClick(item)}
                className="glass-card-hover p-4 cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  {item.type === 'photo' && item.url ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center shrink-0", color.bg)}>
                      <Icon className={cn("w-6 h-6", color.text)} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500 fill-red-500 shrink-0" />
                      <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{formatDate(item.date)}</p>
                    <span className={cn("inline-block text-xs px-2 py-0.5 rounded mt-2", color.bg, color.text)}>
                      {item.type === 'note' ? 'Notiz' : item.type === 'photo' ? 'Foto' : 'Datei'}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
