import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Image, 
  FolderOpen, 
  Plus, 
  TrendingUp, 
  Clock, 
  Star, 
  Lock, 
  Calendar,
  HardDrive,
  Eye,
  Trash2,
  Shield,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useViewHistory } from '@/hooks/useViewHistory';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  notes: number;
  photos: number;
  files: number;
  favorites: number;
  secureNotes: number;
  secretTexts: number;
  totalSize: number;
  trashedItems: number;
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

const dashboardCards = [
  {
    title: 'Notizen',
    icon: FileText,
    path: '/notes',
    gradient: 'from-purple-600 to-purple-800',
    bgClass: 'bg-purple-500/20',
    textClass: 'text-purple-400',
    statKey: 'notes' as keyof Stats,
  },
  {
    title: 'Fotos',
    icon: Image,
    path: '/photos',
    gradient: 'from-pink-600 to-rose-800',
    bgClass: 'bg-pink-500/20',
    textClass: 'text-pink-400',
    statKey: 'photos' as keyof Stats,
  },
  {
    title: 'Dateien',
    icon: FolderOpen,
    path: '/files',
    gradient: 'from-blue-600 to-indigo-800',
    bgClass: 'bg-blue-500/20',
    textClass: 'text-blue-400',
    statKey: 'files' as keyof Stats,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  },
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ 
    notes: 0, photos: 0, files: 0, favorites: 0, 
    secureNotes: 0, secretTexts: 0, totalSize: 0, trashedItems: 0 
  });
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [viewedItems, setViewedItems] = useState<ViewedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;

      try {
        if (isDecoyMode) {
          setStats({ 
            notes: 0, photos: 0, files: 0, favorites: 0, 
            secureNotes: 0, secretTexts: 0, totalSize: 0, trashedItems: 0 
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
          supabase.from('notes').select('id, title, updated_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(5),
          supabase.from('photos').select('id, filename, uploaded_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('uploaded_at', { ascending: false }).limit(5),
          supabase.from('files').select('id, filename, uploaded_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('uploaded_at', { ascending: false }).limit(5),
        ]);

        const totalSize = filesRes.data?.reduce((acc, f) => acc + (f.size || 0), 0) || 0;
        const totalFavorites = (favNotesRes.count || 0) + (favPhotosRes.count || 0) + (favFilesRes.count || 0);
        const totalTrashed = (trashedNotesRes.count || 0) + (trashedPhotosRes.count || 0) + (trashedFilesRes.count || 0);

        setStats({
          notes: notesRes.count || 0,
          photos: photosRes.count || 0,
          files: filesRes.count || 0,
          favorites: totalFavorites,
          secureNotes: secureNotesRes.count || 0,
          secretTexts: secretTextsRes.count || 0,
          totalSize,
          trashedItems: totalTrashed,
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
        setRecentItems(allRecent.slice(0, 6));
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId, isDecoyMode]);

  const totalItems = stats.notes + stats.photos + stats.files;

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

  const getColorForType = (type: string) => {
    switch (type) {
      case 'note': return { bg: 'bg-purple-500/20', text: 'text-purple-400' };
      case 'photo': return { bg: 'bg-pink-500/20', text: 'text-pink-400' };
      case 'file': return { bg: 'bg-blue-500/20', text: 'text-blue-400' };
      case 'secret_text': return { bg: 'bg-amber-500/20', text: 'text-amber-400' };
      default: return { bg: 'bg-purple-500/20', text: 'text-purple-400' };
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

    if (minutes < 1) return 'Gerade eben';
    if (minutes < 60) return `Vor ${minutes} Min.`;
    if (hours < 24) return `Vor ${hours} Std.`;
    if (days < 7) return `Vor ${days} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const quickFolders = [
    { 
      title: 'Zuletzt hinzugefügt', 
      icon: Calendar, 
      path: '/notes',
      count: recentItems.length,
      onClick: () => navigate('/notes')
    },
    { 
      title: 'Zuletzt angesehen', 
      icon: Eye, 
      path: '/notes',
      count: viewedItems.length,
      onClick: () => navigate('/notes')
    },
    { 
      title: 'Favoriten', 
      icon: Star, 
      path: '/notes?filter=favorites',
      count: stats.favorites,
      onClick: () => navigate('/notes?filter=favorites')
    },
    { 
      title: 'Sichere Notizen', 
      icon: Lock, 
      path: '/notes?filter=secure',
      count: stats.secureNotes,
      onClick: () => navigate('/notes?filter=secure')
    },
    { 
      title: 'Geheimer Safe', 
      icon: Shield, 
      path: '/secret-texts',
      count: stats.secretTexts,
      onClick: () => navigate('/secret-texts')
    },
    { 
      title: 'Papierkorb', 
      icon: Trash2, 
      path: '/trash',
      count: stats.trashedItems,
      onClick: () => navigate('/trash')
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-6 md:space-y-8 pb-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
            {isDecoyMode ? 'Willkommen' : 'Willkommen zurück'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isDecoyMode ? 'Dein Vault' : 'Dein sicherer privater Tresor'}
          </p>
        </div>
        {!isDecoyMode && (
          <div className="flex gap-2">
            <Link to="/notes">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-gradient px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium text-primary-foreground"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Neu erstellen</span>
                <span className="sm:hidden">Neu</span>
              </motion.button>
            </Link>
          </div>
        )}
      </motion.div>

      {/* Stats Overview */}
      <motion.div variants={itemVariants} className="glass-card p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground">Übersicht</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {isLoading ? 'Laden...' : `Gesamt: ${totalItems} Elemente`}
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {dashboardCards.map((card) => (
            <Link key={card.statKey} to={card.path} className="group">
              <div className="text-center p-3 rounded-xl hover:bg-muted/30 transition-colors">
                {isLoading ? (
                  <Skeleton className="h-8 w-12 mx-auto mb-1" />
                ) : (
                  <div className="stats-number text-2xl sm:text-3xl lg:text-4xl mb-1">
                    {stats[card.statKey]}
                  </div>
                )}
                <div className="text-muted-foreground text-xs sm:text-sm group-hover:text-foreground transition-colors">
                  {card.title}
                </div>
              </div>
            </Link>
          ))}
          <div className="text-center p-3 rounded-xl">
            {isLoading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <div className="stats-number text-2xl sm:text-3xl lg:text-4xl mb-1">{stats.favorites}</div>
            )}
            <div className="text-muted-foreground text-xs sm:text-sm">Favoriten</div>
          </div>
          <div className="text-center p-3 rounded-xl">
            {isLoading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <div className="stats-number text-2xl sm:text-3xl lg:text-4xl mb-1">{stats.secureNotes}</div>
            )}
            <div className="text-muted-foreground text-xs sm:text-sm">Sicher</div>
          </div>
          <div className="text-center p-3 rounded-xl">
            {isLoading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <div className="stats-number text-2xl sm:text-3xl lg:text-4xl mb-1">{formatSize(stats.totalSize)}</div>
            )}
            <div className="text-muted-foreground text-xs sm:text-sm">Speicher</div>
          </div>
        </div>
      </motion.div>

      {/* Quick Folders */}
      <motion.div variants={itemVariants}>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Schnellzugriff</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {quickFolders.map((folder) => (
            <motion.button
              key={folder.title}
              onClick={folder.onClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="glass-card-hover p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-left w-full"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <folder.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <span className="text-foreground text-xs sm:text-sm font-medium block truncate">
                  {folder.title}
                </span>
                {!isLoading && (
                  <span className="text-muted-foreground text-xs hidden sm:block">
                    {folder.count} Einträge
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Quick Access Cards */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
      >
        {dashboardCards.map((card) => (
          <Link key={card.path} to={card.path}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "glass-card-hover p-6 sm:p-8 cursor-pointer group",
                "relative overflow-hidden"
              )}
            >
              {/* Gradient background */}
              <div className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300",
                `bg-gradient-to-br ${card.gradient}`
              )} />
              
              {/* Icon */}
              <div className={cn(
                "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl mb-4 sm:mb-6 flex items-center justify-center",
                "bg-gradient-to-br transition-all duration-300",
                card.gradient,
                "group-hover:shadow-glow"
              )}>
                <card.icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
              </div>

              {/* Content */}
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 group-hover:text-gradient transition-all">
                {card.title}
              </h3>
              <p className="text-muted-foreground text-sm mb-3 sm:mb-4">
                {isLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  `${stats[card.statKey]} Einträge`
                )}
              </p>

              {/* Add button */}
              <div className={cn(
                "inline-flex items-center gap-2 text-sm",
                "text-primary group-hover:text-primary/80 transition-colors"
              )}>
                <Plus className="w-4 h-4" />
                <span>Hinzufügen</span>
                <ChevronRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
              </div>
            </motion.div>
          </Link>
        ))}
      </motion.div>

      {/* Two Column Layout for Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Activity */}
        <motion.div variants={itemVariants} className="glass-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Zuletzt hinzugefügt</h2>
            </div>
            <Link to="/notes" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Alle anzeigen
            </Link>
          </div>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keine kürzlichen Aktivitäten</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentItems.slice(0, 5).map((item, index) => {
                const Icon = getIconForType(item.type);
                const colors = getColorForType(item.type);
                return (
                  <Link key={`${item.type}-${item.id}`} to={getPathForType(item.type)}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-muted/30 transition-colors group"
                    >
                      <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0", colors.bg)}>
                        <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", colors.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.isFavorite && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 shrink-0" />}
                          <p className="text-foreground text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {item.title}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recently Viewed */}
        <motion.div variants={itemVariants} className="glass-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Zuletzt angesehen</h2>
            </div>
          </div>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : viewedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Eye className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Noch nichts angesehen</p>
            </div>
          ) : (
            <div className="space-y-2">
              {viewedItems.map((item, index) => {
                const Icon = getIconForType(item.type);
                const colors = getColorForType(item.type);
                return (
                  <Link key={`viewed-${item.id}`} to={getPathForType(item.type)}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-muted/30 transition-colors group"
                    >
                      <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0", colors.bg)}>
                        <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", colors.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.viewedAt)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
