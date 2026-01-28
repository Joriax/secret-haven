import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useViewHistory } from '@/hooks/useViewHistory';
import { useDashboardWidgets, DashboardWidget } from '@/hooks/useDashboardWidgets';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { cn, formatFileSize } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateNewDialog } from '@/components/CreateNewDialog';
import { Button } from '@/components/ui/button';
import { DraggableWidget } from '@/components/dashboard/DraggableWidget';
import { WidgetCustomizer } from '@/components/dashboard/WidgetCustomizer';
import { QuickCaptureWidget } from '@/components/dashboard/QuickCaptureWidget';

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
  const [viewedItems, setViewedItems] = useState<ViewedItem[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();
  const { history } = useViewHistory();
  const navigate = useNavigate();
  
  // Use optimized stats hook
  const { stats, recentItems, isLoading } = useDashboardStats();
  
  const {
    widgets,
    allWidgets,
    isEditing,
    setIsEditing,
    moveWidget,
    toggleWidgetVisibility,
    resetToDefaults,
  } = useDashboardWidgets();

  const fetchViewedItemDetails = useCallback(async () => {
    if (!userId || isDecoyMode || history.length === 0) {
      setViewedItems([]);
      return;
    }

    try {
      const historySlice = history.slice(0, 5);
      
      // Group items by type for batch queries
      const noteIds = historySlice.filter(h => h.item_type === 'note').map(h => h.item_id);
      const photoIds = historySlice.filter(h => h.item_type === 'photo').map(h => h.item_id);
      const fileIds = historySlice.filter(h => h.item_type === 'file').map(h => h.item_id);
      const secretIds = historySlice.filter(h => h.item_type === 'secret_text').map(h => h.item_id);

      // Batch fetch all items in parallel
      const [notesRes, photosRes, filesRes, secretsRes] = await Promise.all([
        noteIds.length > 0 
          ? supabase.from('notes').select('id, title').in('id', noteIds)
          : Promise.resolve({ data: [] }),
        photoIds.length > 0 
          ? supabase.from('photos').select('id, filename').in('id', photoIds)
          : Promise.resolve({ data: [] }),
        fileIds.length > 0 
          ? supabase.from('files').select('id, filename').in('id', fileIds)
          : Promise.resolve({ data: [] }),
        secretIds.length > 0 
          ? supabase.from('secret_texts').select('id, title').in('id', secretIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Create lookup maps
      const notesMap = new Map((notesRes.data || []).map(n => [n.id, n.title || 'Notiz']));
      const photosMap = new Map((photosRes.data || []).map(p => [p.id, p.filename?.replace(/^\d+-/, '') || 'Foto']));
      const filesMap = new Map((filesRes.data || []).map(f => [f.id, f.filename?.replace(/^\d+-/, '') || 'Datei']));
      const secretsMap = new Map((secretsRes.data || []).map(s => [s.id, s.title || 'Geheimer Text']));

      // Map history items to ViewedItem with titles from lookup
      const items: ViewedItem[] = historySlice.map(h => {
        let title = 'Unbekannt';
        switch (h.item_type) {
          case 'note': title = notesMap.get(h.item_id) || 'Notiz'; break;
          case 'photo': title = photosMap.get(h.item_id) || 'Foto'; break;
          case 'file': title = filesMap.get(h.item_id) || 'Datei'; break;
          case 'secret_text': title = secretsMap.get(h.item_id) || 'Geheimer Text'; break;
        }
        return {
          id: h.item_id,
          type: h.item_type,
          title,
          viewedAt: h.viewed_at,
        };
      });
      
      setViewedItems(items);
    } catch (error) {
      console.error('Error fetching viewed items:', error);
    }
  }, [userId, isDecoyMode, history]);

  useEffect(() => {
    fetchViewedItemDetails();
  }, [fetchViewedItemDetails]);

  // Stats and realtime handled by useDashboardStats hook

  const getIconForType = useCallback((type: string) => {
    switch (type) {
      case 'note': return FileText;
      case 'photo': return Image;
      case 'file': return FolderOpen;
      case 'secret_text': return Lock;
      default: return FileText;
    }
  }, []);

  const getPathForType = useCallback((type: string) => {
    switch (type) {
      case 'note': return '/notes';
      case 'photo': return '/photos';
      case 'file': return '/files';
      case 'secret_text': return '/secret-texts';
      default: return '/notes';
    }
  }, []);

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

  // Use centralized formatFileSize with 1 decimal
  const formatSize = (bytes: number) => formatFileSize(bytes, 1);

  const totalItems = stats.notes + stats.photos + stats.files + stats.tiktokVideos + stats.links;

  const quickStats = [
    { label: 'Notizen', value: stats.notes, icon: FileText, path: '/notes', color: 'text-primary' },
    { label: 'Fotos', value: stats.photos, icon: Image, path: '/photos', color: 'text-pink-400' },
    { label: 'Dateien', value: stats.files, icon: FolderOpen, path: '/files', color: 'text-blue-400' },
    { label: 'TikToks', value: stats.tiktokVideos, icon: Video, path: '/tiktok', color: 'text-cyan-400' },
    { label: 'Links', value: stats.links, icon: Link2, path: '/links', color: 'text-orange-400' },
  ];

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    moveWidget(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const renderWidget = (widget: DashboardWidget, index: number) => {
    const widgetContent = () => {
      switch (widget.type) {
        case 'quick-stats':
          return (
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
          );

        case 'recent-activity':
          return (
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
          );

        case 'quick-actions':
          return (
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
          );

        case 'storage':
          return (
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
          );

        case 'recently-viewed':
          if (viewedItems.length === 0) return null;
          return (
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
          );

        case 'quick-capture':
          return <QuickCaptureWidget />;

        default:
          return null;
      }
    };

    const content = widgetContent();
    if (!content && !isEditing) return null;

    return (
      <DraggableWidget
        key={widget.id}
        widget={widget}
        index={index}
        isEditing={isEditing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onToggleVisibility={toggleWidgetVisibility}
        className={cn(
          widget.type === 'quick-stats' && 'col-span-full',
          widget.type === 'recent-activity' && 'lg:col-span-2',
        )}
      >
        {content || (
          <div className="bento-card opacity-50 p-8 text-center text-muted-foreground">
            Widget ausgeblendet
          </div>
        )}
      </DraggableWidget>
    );
  };

  // Separate widgets into full-width and grid widgets
  const fullWidthWidgets = widgets.filter(w => w.type === 'quick-stats');
  const gridWidgets = widgets.filter(w => w.type !== 'quick-stats');
  const mainWidgets = gridWidgets.filter(w => w.type === 'recent-activity');
  const sideWidgets = gridWidgets.filter(w => w.type !== 'recent-activity');

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
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
        <div className="flex items-center gap-2">
          {!isDecoyMode && (
            <>
              <WidgetCustomizer
                isEditing={isEditing}
                onStartEditing={() => setIsEditing(true)}
                onStopEditing={() => setIsEditing(false)}
                onReset={resetToDefaults}
                widgets={allWidgets}
              />
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Neu
              </Button>
            </>
          )}
        </div>
      </motion.div>

      {/* Full-width widgets */}
      {fullWidthWidgets.map((widget, idx) => renderWidget(widget, idx))}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {mainWidgets.map((widget, idx) => renderWidget(widget, fullWidthWidgets.length + idx))}
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {sideWidgets.map((widget, idx) => renderWidget(widget, fullWidthWidgets.length + mainWidgets.length + idx))}
        </div>
      </div>
    </div>
  );
}
