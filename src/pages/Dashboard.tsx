import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FileText, Image, FolderOpen, Plus, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Stats {
  notes: number;
  photos: number;
  files: number;
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
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
  const [stats, setStats] = useState<Stats>({ notes: 0, photos: 0, files: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { userId } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return;

      try {
        const [notesRes, photosRes, filesRes] = await Promise.all([
          supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('files').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        ]);

        setStats({
          notes: notesRes.count || 0,
          photos: photosRes.count || 0,
          files: filesRes.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  const totalItems = stats.notes + stats.photos + stats.files;

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
          Willkommen zurück
        </h1>
        <p className="text-white/60">
          Dein sicherer privater Tresor
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
        
        <div className="grid grid-cols-3 gap-4">
          {dashboardCards.map((card) => (
            <div key={card.statKey} className="text-center">
              <div className="stats-number mb-1">
                {isLoading ? '-' : stats[card.statKey]}
              </div>
              <div className="text-white/50 text-sm">{card.title}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Access Cards */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {dashboardCards.map((card, index) => (
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

      {/* Recent Activity placeholder */}
      <motion.div variants={itemVariants} className="glass-card p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white mb-4">Letzte Aktivität</h2>
        <div className="text-center py-8 text-white/40">
          <p>Keine kürzlichen Aktivitäten</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
