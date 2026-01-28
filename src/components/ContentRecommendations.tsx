import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Clock, 
  Star, 
  FileText, 
  Image, 
  Link2, 
  File,
  ChevronRight,
  RefreshCw,
  Loader2,
  Eye,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, differenceInDays, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface RecommendedItem {
  id: string;
  type: 'note' | 'photo' | 'file' | 'link';
  title: string;
  reason: 'forgotten_favorite' | 'not_viewed' | 'related' | 'trending' | 'anniversary';
  reasonText: string;
  createdAt: string;
  lastViewed?: string;
}

interface ContentRecommendationsProps {
  limit?: number;
  showHeader?: boolean;
  className?: string;
}

export function ContentRecommendations({ 
  limit = 10, 
  showHeader = true,
  className 
}: ContentRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userId, supabaseClient: supabase } = useAuth();
  const navigate = useNavigate();

  const fetchRecommendations = useCallback(async () => {
    if (!userId) return;
    
    setRefreshing(true);
    const items: RecommendedItem[] = [];
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);

    try {
      // Fetch view history for reference
      const { data: viewHistory } = await supabase
        .from('view_history')
        .select('item_id, viewed_at')
        .eq('user_id', userId);
      
      const viewMap = new Map((viewHistory || []).map(v => [v.item_id, new Date(v.viewed_at)]));

      // 1. Forgotten Favorites - favorites not viewed in 30+ days
      const [favNotes, favPhotos, favFiles, favLinks] = await Promise.all([
        supabase.from('notes').select('id, title, created_at').eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
        supabase.from('photos').select('id, caption, filename, uploaded_at').eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
        supabase.from('files').select('id, filename, uploaded_at').eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
        supabase.from('links').select('id, title, created_at').eq('user_id', userId).eq('is_favorite', true).is('deleted_at', null),
      ]);

      // Process forgotten favorites
      for (const note of (favNotes.data || [])) {
        const lastViewed = viewMap.get(note.id);
        if (!lastViewed || differenceInDays(now, lastViewed) > 30) {
          items.push({
            id: note.id,
            type: 'note',
            title: note.title || 'Unbenannte Notiz',
            reason: 'forgotten_favorite',
            reasonText: 'Favorit, lange nicht angesehen',
            createdAt: note.created_at,
            lastViewed: lastViewed?.toISOString(),
          });
        }
      }

      for (const photo of (favPhotos.data || [])) {
        const lastViewed = viewMap.get(photo.id);
        if (!lastViewed || differenceInDays(now, lastViewed) > 30) {
          items.push({
            id: photo.id,
            type: 'photo',
            title: photo.caption || photo.filename,
            reason: 'forgotten_favorite',
            reasonText: 'Favorit, lange nicht angesehen',
            createdAt: photo.uploaded_at,
            lastViewed: lastViewed?.toISOString(),
          });
        }
      }

      // 2. Anniversary items - "This day X years ago"
      const todayMonth = now.getMonth() + 1;
      const todayDay = now.getDate();

      const { data: anniversaryPhotos } = await supabase
        .from('photos')
        .select('id, caption, filename, uploaded_at, taken_at')
        .eq('user_id', userId)
        .is('deleted_at', null);

      for (const photo of (anniversaryPhotos || [])) {
        const photoDate = new Date(photo.taken_at || photo.uploaded_at);
        if (photoDate.getMonth() + 1 === todayMonth && 
            photoDate.getDate() === todayDay && 
            photoDate.getFullYear() < now.getFullYear()) {
          const yearsAgo = now.getFullYear() - photoDate.getFullYear();
          items.push({
            id: photo.id,
            type: 'photo',
            title: photo.caption || photo.filename,
            reason: 'anniversary',
            reasonText: `Vor ${yearsAgo} Jahr${yearsAgo > 1 ? 'en' : ''} aufgenommen`,
            createdAt: photo.uploaded_at,
          });
        }
      }

      // 3. Not viewed in 90+ days (not favorites, just regular content)
      const { data: oldNotes } = await supabase
        .from('notes')
        .select('id, title, created_at, updated_at')
        .eq('user_id', userId)
        .eq('is_favorite', false)
        .is('deleted_at', null)
        .lt('updated_at', ninetyDaysAgo.toISOString())
        .limit(20);

      for (const note of (oldNotes || [])) {
        const lastViewed = viewMap.get(note.id);
        if (!lastViewed || differenceInDays(now, lastViewed) > 90) {
          items.push({
            id: note.id,
            type: 'note',
            title: note.title || 'Unbenannte Notiz',
            reason: 'not_viewed',
            reasonText: 'Schon lange nicht mehr angesehen',
            createdAt: note.created_at,
            lastViewed: lastViewed?.toISOString(),
          });
        }
      }

      // 4. Trending - recently created/edited items (last 7 days)
      const sevenDaysAgo = subDays(now, 7);
      const { data: recentNotes } = await supabase
        .from('notes')
        .select('id, title, created_at, updated_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('updated_at', sevenDaysAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(5);

      for (const note of (recentNotes || [])) {
        // Check if already in recommendations
        if (!items.some(i => i.id === note.id)) {
          items.push({
            id: note.id,
            type: 'note',
            title: note.title || 'Unbenannte Notiz',
            reason: 'trending',
            reasonText: 'Kürzlich bearbeitet',
            createdAt: note.created_at,
          });
        }
      }

      // Sort by reason priority and limit
      const priorityOrder = { anniversary: 0, forgotten_favorite: 1, trending: 2, not_viewed: 3, related: 4 };
      items.sort((a, b) => priorityOrder[a.reason] - priorityOrder[b.reason]);
      
      setRecommendations(items.slice(0, limit));
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, supabase, limit]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'note': return <FileText className="w-4 h-4" />;
      case 'photo': return <Image className="w-4 h-4" />;
      case 'file': return <File className="w-4 h-4" />;
      case 'link': return <Link2 className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'forgotten_favorite': return <Star className="w-3 h-3 text-yellow-500" />;
      case 'not_viewed': return <Clock className="w-3 h-3 text-muted-foreground" />;
      case 'anniversary': return <Calendar className="w-3 h-3 text-primary" />;
      case 'trending': return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'related': return <Sparkles className="w-3 h-3 text-purple-500" />;
      default: return <Eye className="w-3 h-3" />;
    }
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'forgotten_favorite': return 'bg-yellow-500/20 text-yellow-400';
      case 'anniversary': return 'bg-primary/20 text-primary';
      case 'trending': return 'bg-green-500/20 text-green-400';
      case 'not_viewed': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleItemClick = (item: RecommendedItem) => {
    switch (item.type) {
      case 'note':
        navigate('/notes', { state: { selectedNoteId: item.id } });
        break;
      case 'photo':
        navigate('/photos', { state: { selectedPhotoId: item.id } });
        break;
      case 'file':
        navigate('/files', { state: { selectedFileId: item.id } });
        break;
      case 'link':
        navigate('/links', { state: { selectedLinkId: item.id } });
        break;
    }
  };

  if (loading) {
    return (
      <Card className={cn("glass-card", className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <Card className={cn("glass-card", className)}>
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-5 h-5 text-primary" />
            Empfehlungen für dich
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchRecommendations}
            disabled={refreshing}
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </Button>
        </CardHeader>
      )}
      <CardContent className={!showHeader ? "pt-4" : ""}>
        <ScrollArea className="h-[280px]">
          <div className="space-y-2">
            {recommendations.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleItemClick(item)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  getReasonColor(item.reason)
                )}>
                  {getTypeIcon(item.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getReasonIcon(item.reason)}
                    <span className="text-xs text-muted-foreground">
                      {item.reasonText}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default ContentRecommendations;
