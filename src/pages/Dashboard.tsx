import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
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
  HardDrive
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Stats {
  notes: number;
  photos: number;
  files: number;
  favorites: number;
  secureNotes: number;
  totalSize: number;
}

interface RecentItem {
  id: string;
  type: 'note' | 'photo' | 'file';
  title: string;
  date: string;
  isFavorite?: boolean;
}

const dashboardCards = [
  {
    title: 'Notizen',
    icon: FileText,
    path: '/notes',
    gradient: 'from-purple-600 to-purple-800',
    statKey: 'notes' as keyof Stats,
  },
  {
    title: 'Fotos',
    icon: Image,
    path: '/photos',
    gradient: 'from-pink-600 to-rose-800',
    statKey: 'photos' as keyof Stats,
  },
  {
    title: 'Dateien',
    icon: FolderOpen,
    path: '/files',
    gradient: 'from-blue-600 to-indigo-800',
    statKey: 'files' as keyof Stats,
  },
];

const quickFolders = [
  { title: 'Zuletzt hinzugefügt', icon: Calendar, path: '/notes' },
  { title: 'Zuletzt angesehen', icon: Clock, path: '/notes' },
  { title: 'Favoriten', icon: Star, path: '/notes' },
  { title: 'Sichere Notizen', icon: Lock, path: '/secret-texts' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const },
  },
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ notes: 0, photos: 0, files: 0, favorites: 0, secureNotes: 0, totalSize: 0 });
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, isDecoyMode } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) return;

      try {
        // In decoy mode, show minimal/empty stats
        if (isDecoyMode) {
          setStats({ notes: 0, photos: 0, files: 0, favorites: 0, secureNotes: 0, totalSize: 0 });
          setRecentItems([]);
          setIsLoading(false);
          return;
        }

        const [
          notesRes, 
          photosRes, 
          filesRes, 
          favoritesRes,
          secureNotesRes,
          recentNotesRes, 
          recentPhotosRes, 
          recentFilesRes,
          viewHistoryRes
        ] = await Promise.all([
          supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
          supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
          supabase.from('files').select('id, size', { count: 'exact' }).eq('user_id', userId).is('deleted_at', null),
          supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
          supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_secure', true).is('deleted_at', null),
          supabase.from('notes').select('id, title, updated_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(3),
          supabase.from('photos').select('id, filename, uploaded_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('uploaded_at', { ascending: false }).limit(3),
          supabase.from('files').select('id, filename, uploaded_at, is_favorite').eq('user_id', userId).is('deleted_at', null).order('uploaded_at', { ascending: false }).limit(3),
          supabase.from('view_history').select('*').eq('user_id', userId).order('viewed_at', { ascending: false }).limit(5),
        ]);

        const totalSize = filesRes.data?.reduce((acc, f) => acc + (f.size || 0), 0) || 0;

        setStats({
          notes: notesRes.count || 0,
          photos: photosRes.count || 0,
          files: filesRes.count || 0,
          favorites: favoritesRes.count || 0,
          secureNotes: secureNotesRes.count || 0,
          totalSize,
        });

        // Combine and sort recent items
        const allRecent: RecentItem[] = [
          ...(recentNotesRes.data || []).map(n => ({
            id: n.id,
            type: 'note' as const,
            title: n.title,
            date: n.updated_at,
            isFavorite: n.is_favorite,
          })),
          ...(recentPhotosRes.data || []).map(p => ({
            id: p.id,
            type: 'photo' as const,
            title: p.filename.replace(/^\d+-/, ''),
            date: p.uploaded_at,
            isFavorite: p.is_favorite,
          })),
          ...(recentFilesRes.data || []).map(f => ({
            id: f.id,
            type: 'file' as const,
            title: f.filename.replace(/^\d+-/, ''),
            date: f.uploaded_at,
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
    };

    fetchData();
  }, [userId, isDecoyMode]);

  const totalItems = stats.notes + stats.photos + stats.files;

  const getIconForType = (type: RecentItem['type']) => {
    switch (type) {
      case 'note': return FileText;
      case 'photo': return Image;
      case 'file': return FolderOpen;
    }
  };

  const getPathForType = (type: RecentItem['type']) => {
    switch (type) {
      case 'note': return '/notes';
      case 'photo': return '/photos';
      case 'file': return '/files';
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

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          {isDecoyMode ? 'Willkommen' : 'Willkommen zurück'}
        </h1>
        <p className="text-white/60">
          {isDecoyMode ? 'Dein Vault' : 'Dein sicherer privater Tresor'}
        </p>
      </motion.div>

      {/* Stats Overview */}
      <motion.div variants={itemVariants} className="glass-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Übersicht</h2>
            <p className="text-white/50 text-sm">Gesamt: {totalItems} Elemente</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {dashboardCards.map((card) => (
            <div key={card.statKey} className="text-center">
              <div className="stats-number mb-1">
                {isLoading ? '-' : stats[card.statKey]}
              </div>
              <div className="text-white/50 text-sm">{card.title}</div>
            </div>
          ))}
          <div className="text-center">
            <div className="stats-number mb-1">{isLoading ? '-' : stats.favorites}</div>
            <div className="text-white/50 text-sm">Favoriten</div>
          </div>
          <div className="text-center">
            <div className="stats-number mb-1">{isLoading ? '-' : stats.secureNotes}</div>
            <div className="text-white/50 text-sm">Sicher</div>
          </div>
          <div className="text-center">
            <div className="stats-number mb-1">{isLoading ? '-' : formatSize(stats.totalSize)}</div>
            <div className="text-white/50 text-sm">Speicher</div>
          </div>
        </div>
      </motion.div>

      {/* Quick Folders */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-semibold text-white mb-4">Schnellzugriff</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickFolders.map((folder) => (
            <Link key={folder.title} to={folder.path}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="glass-card-hover p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <folder.icon className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-white text-sm font-medium">{folder.title}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Quick Access Cards */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {dashboardCards.map((card) => (
          <Link key={card.path} to={card.path}>
            <motion.div
              whileHover={{ 
                scale: 1.02, 
                rotateY: 5,
                z: 50,
              }}
              whileTap={{ scale: 0.98 }}
              style={{ transformStyle: 'preserve-3d' }}
              className={cn(
                "glass-card-hover p-8 cursor-pointer group",
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
                "w-14 h-14 rounded-2xl mb-6 flex items-center justify-center",
                "bg-gradient-to-br transition-all duration-300",
                card.gradient,
                "group-hover:shadow-glow"
              )}>
                <card.icon className="w-7 h-7 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-gradient transition-all">
                {card.title}
              </h3>
              <p className="text-white/50 text-sm mb-4">
                {isLoading ? 'Laden...' : `${stats[card.statKey]} Einträge`}
              </p>

              {/* Add button */}
              <div className={cn(
                "inline-flex items-center gap-2 text-sm",
                "text-purple-400 group-hover:text-purple-300 transition-colors"
              )}>
                <Plus className="w-4 h-4" />
                <span>Hinzufügen</span>
              </div>
            </motion.div>
          </Link>
        ))}
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants} className="glass-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Letzte Aktivität</h2>
        </div>
        
        {recentItems.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            <p>Keine kürzlichen Aktivitäten</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentItems.map((item, index) => {
              const Icon = getIconForType(item.type);
              return (
                <Link key={`${item.type}-${item.id}`} to={getPathForType(item.type)}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      item.type === 'note' && "bg-purple-500/20",
                      item.type === 'photo' && "bg-pink-500/20",
                      item.type === 'file' && "bg-blue-500/20"
                    )}>
                      <Icon className={cn(
                        "w-5 h-5",
                        item.type === 'note' && "text-purple-400",
                        item.type === 'photo' && "text-pink-400",
                        item.type === 'file' && "text-blue-400"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.isFavorite && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                        <p className="text-white font-medium truncate group-hover:text-purple-300 transition-colors">
                          {item.title}
                        </p>
                      </div>
                      <p className="text-xs text-white/40">{formatDate(item.date)}</p>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
