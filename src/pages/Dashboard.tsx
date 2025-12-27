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
  ChevronRight,
  Sparkles,
  Video,
  Link2,
  ArrowUpRight
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
  totalSize: number;
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ 
    notes: 0, photos: 0, files: 0, favorites: 0, 
    secureNotes: 0, secretTexts: 0, totalSize: 0, trashedItems: 0, tiktokVideos: 0, links: 0
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
          secureNotes: 0, secretTexts: 0, totalSize: 0, trashedItems: 0, tiktokVideos: 0, links: 0
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
        supabase.from('files').select('id, size', { count: 'exact' }).eq('user_id', userId).is('deleted_at', null),
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

      const totalSize = filesRes.data?.reduce((acc, f) => acc + (f.size || 0), 0) || 0;
      const totalFavorites = (favNotesRes.count || 0) + (favPhotosRes.count || 0) + (favFilesRes.count || 0);
      const totalTrashed = (trashedNotesRes.count || 0) + (trashedPhotosRes.count || 0) + (trashedFilesRes.count || 0) + (trashedTiktokRes.count || 0);

      setStats({
        notes: notesRes.count || 0,
        photos: photosRes.count || 0,
        files: filesRes.count || 0,
        favorites: totalFavorites,
        secureNotes: secureNotesRes.count || 0,
        secretTexts: secretTextsRes.count || 0,
        totalSize,
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
      setRecentItems(allRecent.slice(0, 4));
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
    if (!dateString) return 'Unbekannt';
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

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <CreateNewDialog isOpen={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              {isDecoyMode ? 'Vault' : 'Dein Vault'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isLoading ? 'Laden...' : `${totalItems} Elemente gespeichert`}
            </p>
          </div>
          {!isDecoyMode && (
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Neu
            </Button>
          )}
        </div>
      </motion.div>

      {/* Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 auto-rows-[120px] md:auto-rows-[140px]">
        
        {/* Notes - Large Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="col-span-2 row-span-2"
        >
          <Link to="/notes" className="block h-full">
            <div className="h-full rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/20 p-6 hover:border-violet-500/40 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl" />
              <div className="relative z-10 h-full flex flex-col">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-violet-400" />
                </div>
                <div className="mt-auto">
                  <div className="text-4xl md:text-5xl font-bold text-foreground mb-1">
                    {isLoading ? <Skeleton className="h-12 w-16" /> : stats.notes}
                  </div>
                  <div className="text-muted-foreground">Notizen</div>
                </div>
                <ArrowUpRight className="absolute top-6 right-6 w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Photos */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="col-span-1 row-span-1"
        >
          <Link to="/photos" className="block h-full">
            <div className="h-full rounded-3xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 border border-pink-500/20 p-4 hover:border-pink-500/40 transition-all group relative overflow-hidden">
              <Image className="w-5 h-5 text-pink-400 mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-7 w-10" /> : stats.photos}
              </div>
              <div className="text-xs text-muted-foreground">Fotos</div>
            </div>
          </Link>
        </motion.div>

        {/* Files */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="col-span-1 row-span-1"
        >
          <Link to="/files" className="block h-full">
            <div className="h-full rounded-3xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/20 p-4 hover:border-blue-500/40 transition-all group relative overflow-hidden">
              <FolderOpen className="w-5 h-5 text-blue-400 mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-7 w-10" /> : stats.files}
              </div>
              <div className="text-xs text-muted-foreground">Dateien</div>
            </div>
          </Link>
        </motion.div>

        {/* TikTok Videos */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="col-span-1 row-span-1"
        >
          <Link to="/tiktok" className="block h-full">
            <div className="h-full rounded-3xl bg-gradient-to-br from-cyan-500/20 to-teal-600/20 border border-cyan-500/20 p-4 hover:border-cyan-500/40 transition-all group relative overflow-hidden">
              <Video className="w-5 h-5 text-cyan-400 mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-7 w-10" /> : stats.tiktokVideos}
              </div>
              <div className="text-xs text-muted-foreground">TikToks</div>
            </div>
          </Link>
        </motion.div>

        {/* Links */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="col-span-1 row-span-1"
        >
          <Link to="/links" className="block h-full">
            <div className="h-full rounded-3xl bg-gradient-to-br from-orange-500/20 to-amber-600/20 border border-orange-500/20 p-4 hover:border-orange-500/40 transition-all group relative overflow-hidden">
              <Link2 className="w-5 h-5 text-orange-400 mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-7 w-10" /> : stats.links}
              </div>
              <div className="text-xs text-muted-foreground">Links</div>
            </div>
          </Link>
        </motion.div>

        {/* Favorites - Tall Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="col-span-1 row-span-2"
        >
          <Link to="/favorites" className="block h-full">
            <div className="h-full rounded-3xl bg-gradient-to-b from-yellow-500/20 to-amber-600/10 border border-yellow-500/20 p-4 hover:border-yellow-500/40 transition-all relative overflow-hidden">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400/50 mb-3" />
              <div className="text-3xl font-bold text-foreground mb-1">
                {isLoading ? <Skeleton className="h-9 w-12" /> : stats.favorites}
              </div>
              <div className="text-sm text-muted-foreground">Favoriten</div>
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex gap-1">
                  {[...Array(Math.min(stats.favorites, 5))].map((_, i) => (
                    <Star key={i} className="w-3 h-3 text-yellow-400/60 fill-yellow-400/40" />
                  ))}
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Secret Safe */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="col-span-1 row-span-1"
        >
          <Link to="/secret-texts" className="block h-full">
            <div className="h-full rounded-3xl bg-gradient-to-br from-emerald-500/20 to-green-600/20 border border-emerald-500/20 p-4 hover:border-emerald-500/40 transition-all relative overflow-hidden">
              <Shield className="w-5 h-5 text-emerald-400 mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-7 w-10" /> : stats.secretTexts}
              </div>
              <div className="text-xs text-muted-foreground">Geheim</div>
            </div>
          </Link>
        </motion.div>

        {/* Secure Notes */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45 }}
          className="col-span-1 row-span-1"
        >
          <Link to="/notes?filter=secure" className="block h-full">
            <div className="h-full rounded-3xl bg-gradient-to-br from-red-500/20 to-rose-600/20 border border-red-500/20 p-4 hover:border-red-500/40 transition-all relative overflow-hidden">
              <Lock className="w-5 h-5 text-red-400 mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-7 w-10" /> : stats.secureNotes}
              </div>
              <div className="text-xs text-muted-foreground">Sicher</div>
            </div>
          </Link>
        </motion.div>

        {/* Recent Activity - Wide Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="col-span-2 row-span-2"
        >
          <div className="h-full rounded-3xl bg-card/50 border border-border p-5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Kürzlich</span>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : recentItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[calc(100%-40px)] text-muted-foreground">
                <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Noch keine Aktivität</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentItems.map((item) => {
                  const Icon = getIconForType(item.type);
                  return (
                    <Link key={`${item.type}-${item.id}`} to={getPathForType(item.type)}>
                      <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{item.title}</p>
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

        {/* Storage */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55 }}
          className="col-span-2 row-span-1"
        >
          <div className="h-full rounded-3xl bg-gradient-to-r from-slate-500/10 to-slate-600/10 border border-slate-500/20 p-4 relative overflow-hidden">
            <div className="flex items-center justify-between h-full">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Speicher</div>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-7 w-20" /> : formatSize(stats.totalSize)}
                </div>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-primary/30 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-primary/20" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recently Viewed */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="col-span-1 row-span-1"
        >
          <Link to="/recently-viewed" className="block h-full">
            <div className="h-full rounded-3xl bg-muted/30 border border-border p-4 hover:border-primary/30 transition-all relative overflow-hidden">
              <Eye className="w-5 h-5 text-muted-foreground mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-7 w-10" /> : viewedItems.length}
              </div>
              <div className="text-xs text-muted-foreground">Angesehen</div>
            </div>
          </Link>
        </motion.div>

        {/* Trash */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.65 }}
          className="col-span-1 row-span-1"
        >
          <Link to="/trash" className="block h-full">
            <div className="h-full rounded-3xl bg-muted/30 border border-border p-4 hover:border-destructive/30 transition-all relative overflow-hidden">
              <Trash2 className="w-5 h-5 text-muted-foreground mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Skeleton className="h-7 w-10" /> : stats.trashedItems}
              </div>
              <div className="text-xs text-muted-foreground">Papierkorb</div>
            </div>
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
