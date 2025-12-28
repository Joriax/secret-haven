import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Image, 
  FolderOpen, 
  Plus, 
  Clock, 
  Star, 
  Lock, 
  Eye,
  Trash2,
  Shield,
  Video,
  Link2,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useViewHistory } from '@/hooks/useViewHistory';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateNewDialog } from '@/components/CreateNewDialog';
import { Button } from '@/components/ui/button';

interface Stats {
  notes: number;
  photos: number;
  files: number;
  favorites: number;
  secureNotes: number;
  secretTexts: number;
  totalFilesSize: number;
  totalPhotosSize: number;
  totalAttachmentsSize: number;
  totalStorageSize: number;
  trashedItems: number;
  tiktokVideos: number;
  links: number;
}

interface RecentItem {
  id: string;
  type: 'note' | 'photo' | 'file' | 'secret_text';
  title: string;
  date: string;
  isFavorite?: boolean;
}

interface ViewedItem {
  id: string;
  type: string;
  title: string;
  viewedAt: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ 
    notes: 0, photos: 0, files: 0, favorites: 0,
    secureNotes: 0, secretTexts: 0,
    totalFilesSize: 0, totalPhotosSize: 0, totalAttachmentsSize: 0, totalStorageSize: 0,
    trashedItems: 0, tiktokVideos: 0, links: 0
  });
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [viewedItems, setViewedItems] = useState<ViewedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { userId, isDecoyMode } = useAuth();
  const { history } = useViewHistory();
  const navigate = useNavigate();

  const fetchViewedItemDetails = useCallback(async () => {
    if (!userId || isDecoyMode || history.length === 0) {
      setViewedItems([]);
      return;
    }

    try {
      const items: ViewedItem[] = [];
      
      for (const h of history.slice(0, 5)) {
        let title = 'Unbekannt';
        
        if (h.item_type === 'note') {
          const { data } = await supabase
            .from('notes')
            .select('title')
            .eq('id', h.item_id)
            .single();
          title = data?.title || 'Notiz';
        } else if (h.item_type === 'photo') {
          const { data } = await supabase
            .from('photos')
            .select('filename')
            .eq('id', h.item_id)
            .single();
          title = data?.filename?.replace(/^\d+-/, '') || 'Foto';
        } else if (h.item_type === 'file') {
          const { data } = await supabase
            .from('files')
            .select('filename')
            .eq('id', h.item_id)
            .single();
          title = data?.filename?.replace(/^\d+-/, '') || 'Datei';
        } else if (h.item_type === 'secret_text') {
          const { data } = await supabase
            .from('secret_texts')
            .select('title')
            .eq('id', h.item_id)
            .single();
          title = data?.title || 'Geheimer Text';
        }
        
        items.push({
          id: h.item_id,
          type: h.item_type,
          title,
          viewedAt: h.viewed_at,
        });
      }
      
      setViewedItems(items);
    } catch (error) {
      console.error('Error fetching viewed items:', error);
    }
  }, [userId, isDecoyMode, history]);

  useEffect(() => {
    fetchViewedItemDetails();
  }, [fetchViewedItemDetails]);

  const fetchDashboardData = useCallback(async () => {
    if (!userId) return;

    try {
      if (isDecoyMode) {
        setStats({ 
          notes: 0, photos: 0, files: 0, favorites: 0,
          secureNotes: 0, secretTexts: 0,
          totalFilesSize: 0, totalPhotosSize: 0, totalAttachmentsSize: 0, totalStorageSize: 0,
          trashedItems: 0, tiktokVideos: 0, links: 0
        });
        setRecentItems([]);
        setIsLoading(false);
        return;
      }

      const [
        notesRes, 
        photosRes, 
        filesRes, 
        favNotesRes,
        favPhotosRes,
        favFilesRes,
        secureNotesRes,
        secretTextsRes,
        trashedNotesRes,
        trashedPhotosRes,
        trashedFilesRes,
        tiktokRes,
        trashedTiktokRes,
        linksRes,
        recentNotesRes, 
        recentPhotosRes, 
        recentFilesRes,
      ] = await Promise.all([
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('files').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
        supabase.from('files').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_secure', true).is('deleted_at', null),
        supabase.from('secret_texts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('files').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('tiktok_videos').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('tiktok_videos').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('deleted_at', 'is', null),
        supabase.from('links').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('notes').select('id, title, updated_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(5),
        supabase.from('photos').select('id, filename, uploaded_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('uploaded_at', { ascending: false }).limit(5),
        supabase.from('files').select('id, filename, uploaded_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('uploaded_at', { ascending: false }).limit(5),
      ]);

      const totalFavorites = (favNotesRes.count || 0) + (favPhotosRes.count || 0) + (favFilesRes.count || 0);
      const totalTrashed = (trashedNotesRes.count || 0) + (trashedPhotosRes.count || 0) + (trashedFilesRes.count || 0) + (trashedTiktokRes.count || 0);

      // Calculate storage sizes from buckets (includes also items still sitting in trash)
      const sumBucketSize = async (bucketId: 'photos' | 'files' | 'note-attachments') => {
        try {
          let total = 0;
          const limit = 1000;

          for (let offset = 0; ; offset += limit) {
            const { data, error } = await supabase.storage
              .from(bucketId)
              .list(userId, { limit, offset });

            if (error) throw error;

            const items = data || [];
            total += items.reduce((acc, f: any) => {
              const raw = f?.metadata?.size;
              const size = typeof raw === 'number' ? raw : (Number.parseInt(String(raw ?? 0), 10) || 0);
              return acc + size;
            }, 0);

            if (items.length < limit) break;
          }

          return total;
        } catch (e) {
          console.error(`Error calculating ${bucketId} size:`, e);
          return 0;
        }
      };

      const [storagePhotosSize, storageFilesSize, storageAttachmentsSize] = await Promise.all([
        sumBucketSize('photos'),
        sumBucketSize('files'),
        sumBucketSize('note-attachments'),
      ]);

      const storageTotalSize = storagePhotosSize + storageFilesSize + storageAttachmentsSize;

      setStats({
        notes: notesRes.count || 0,
        photos: photosRes.count || 0,
        files: filesRes.count || 0,
        favorites: totalFavorites,
        secureNotes: secureNotesRes.count || 0,
        secretTexts: secretTextsRes.count || 0,
        totalFilesSize: storageFilesSize,
        totalPhotosSize: storagePhotosSize,
        totalAttachmentsSize: storageAttachmentsSize,
        totalStorageSize: storageTotalSize,
        trashedItems: totalTrashed,
        tiktokVideos: tiktokRes.count || 0,
        links: linksRes.count || 0,
      });


      const allRecent: RecentItem[] = [
        ...(recentNotesRes.data || []).map(n => ({
          id: n.id,
          type: 'note' as const,
          title: n.title || 'Unbenannt',
          date: n.updated_at || new Date().toISOString(),
          isFavorite: n.is_favorite,
        })),
        ...(recentPhotosRes.data || []).map(p => ({
          id: p.id,
          type: 'photo' as const,
          title: p.filename?.replace(/^\d+-/, '') || 'Foto',
          date: p.uploaded_at || new Date().toISOString(),
          isFavorite: p.is_favorite,
        })),
        ...(recentFilesRes.data || []).map(f => ({
          id: f.id,
          type: 'file' as const,
          title: f.filename?.replace(/^\d+-/, '') || 'Datei',
          date: f.uploaded_at || new Date().toISOString(),
          isFavorite: f.is_favorite,
        })),
      ];

      allRecent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentItems(allRecent.slice(0, 5));
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'secret_texts' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiktok_videos' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' }, fetchDashboardData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchDashboardData]);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'note': return FileText;
      case 'photo': return Image;
      case 'file': return FolderOpen;
      case 'secret_text': return Lock;
      default: return FileText;
    }
  };

  const getPathForType = (type: string) => {
    switch (type) {
      case 'note': return '/notes';
      case 'photo': return '/photos';
      case 'file': return '/files';
      case 'secret_text': return '/secret-texts';
      default: return '/notes';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Jetzt';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const totalItems = stats.notes + stats.photos + stats.files + stats.tiktokVideos + stats.links;

  const quickStats = [
    { label: 'Notizen', value: stats.notes, icon: FileText, path: '/notes', color: 'text-primary' },
    { label: 'Fotos', value: stats.photos, icon: Image, path: '/photos', color: 'text-pink-400' },
    { label: 'Dateien', value: stats.files, icon: FolderOpen, path: '/files', color: 'text-blue-400' },
    { label: 'TikToks', value: stats.tiktokVideos, icon: Video, path: '/tiktok', color: 'text-cyan-400' },
    { label: 'Links', value: stats.links, icon: Link2, path: '/links', color: 'text-orange-400' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <CreateNewDialog isOpen={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            {isDecoyMode ? 'Vault' : 'Willkommen zurück'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isLoading ? 'Laden...' : `${totalItems} Elemente in deinem Vault`}
          </p>
        </div>
        {!isDecoyMode && (
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Neu
          </Button>
        )}
      </motion.div>

      {/* Quick Stats */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        {quickStats.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Link to={stat.path}>
              <div className="bento-card group">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="stat-value">
                  {isLoading ? <Skeleton className="h-9 w-12" /> : stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Recent Activity */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <div className="bento-card h-full">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h2 className="font-display font-semibold text-foreground">Kürzlich bearbeitet</h2>
              </div>
              <Link to="/recently-added" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Alle anzeigen
              </Link>
            </div>
            
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <Skeleton className="w-9 h-9 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-3 w-8" />
                  </div>
                ))}
              </div>
            ) : recentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">Noch keine Aktivität</p>
                <p className="text-muted-foreground text-xs mt-1">Erstelle deinen ersten Eintrag</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentItems.map((item) => {
                  const Icon = getIconForType(item.type);
                  return (
                    <Link key={`${item.type}-${item.id}`} to={getPathForType(item.type)}>
                      <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {item.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                            <p className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {item.title}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Side Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          {/* Quick Actions */}
          <div className="bento-card">
            <h3 className="font-display font-semibold text-foreground mb-4">Schnellzugriff</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/favorites">
                <div className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-center">
                  <Star className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">Favoriten</span>
                  <p className="text-lg font-semibold text-foreground">{stats.favorites}</p>
                </div>
              </Link>
              <Link to="/secret-texts">
                <div className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-center">
                  <Shield className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">Geheim</span>
                  <p className="text-lg font-semibold text-foreground">{stats.secretTexts}</p>
                </div>
              </Link>
              <Link to="/notes?filter=secure">
                <div className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-center">
                  <Lock className="w-5 h-5 text-primary mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">Sicher</span>
                  <p className="text-lg font-semibold text-foreground">{stats.secureNotes}</p>
                </div>
              </Link>
              <Link to="/trash">
                <div className="p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-center">
                  <Trash2 className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <span className="text-xs text-muted-foreground">Papierkorb</span>
                  <p className="text-lg font-semibold text-foreground">{stats.trashedItems}</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Storage */}
          <div className="bento-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Speichernutzung</p>
                <p className="text-2xl font-display font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-20" /> : formatSize(stats.totalStorageSize)}
                </p>
              </div>
              <FolderOpen className="w-8 h-8 text-primary/50" />
            </div>
            
            {/* Storage breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pink-400" />
                  <span className="text-xs text-muted-foreground">Fotos</span>
                </div>
                <span className="text-xs font-medium text-foreground">{formatSize(stats.totalPhotosSize)}</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-pink-400 rounded-full transition-all duration-500"
                  style={{ width: stats.totalStorageSize > 0 ? `${(stats.totalPhotosSize / stats.totalStorageSize) * 100}%` : '0%' }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-xs text-muted-foreground">Dateien</span>
                </div>
                <span className="text-xs font-medium text-foreground">{formatSize(stats.totalFilesSize)}</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-400 rounded-full transition-all duration-500"
                  style={{ width: stats.totalStorageSize > 0 ? `${(stats.totalFilesSize / stats.totalStorageSize) * 100}%` : '0%' }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">Anhänge</span>
                </div>
                <span className="text-xs font-medium text-foreground">{formatSize(stats.totalAttachmentsSize)}</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: stats.totalStorageSize > 0 ? `${(stats.totalAttachmentsSize / stats.totalStorageSize) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </div>

          {/* Recently Viewed */}
          {viewedItems.length > 0 && (
            <div className="bento-card">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">Zuletzt angesehen</h3>
              </div>
              <div className="space-y-1">
                {viewedItems.slice(0, 3).map((item) => {
                  const Icon = getIconForType(item.type);
                  return (
                    <Link key={`viewed-${item.id}`} to={getPathForType(item.type)}>
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-foreground truncate flex-1">{item.title}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(item.viewedAt)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}