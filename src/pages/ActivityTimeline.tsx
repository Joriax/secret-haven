import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Upload, 
  Trash2, 
  LogIn, 
  LogOut, 
  Edit2, 
  Star, 
  Share2, 
  Lock, 
  Eye, 
  Plus,
  Filter,
  Calendar,
  Clock,
  Image,
  FileText,
  FolderOpen,
  Link2,
  Play,
  Settings,
  RefreshCw,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { de } from 'date-fns/locale';

interface ActivityEvent {
  id: string;
  event_type: string;
  item_type?: string;
  item_name?: string;
  details?: any;
  created_at: string;
}

type ActivityFilter = 'all' | 'uploads' | 'deletes' | 'logins' | 'edits' | 'shares';

const eventIcons: Record<string, React.ReactNode> = {
  upload: <Upload className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  login: <LogIn className="w-4 h-4" />,
  logout: <LogOut className="w-4 h-4" />,
  edit: <Edit2 className="w-4 h-4" />,
  favorite: <Star className="w-4 h-4" />,
  share: <Share2 className="w-4 h-4" />,
  auto_lock: <Lock className="w-4 h-4" />,
  view: <Eye className="w-4 h-4" />,
  create: <Plus className="w-4 h-4" />,
  photo: <Image className="w-4 h-4" />,
  note: <FileText className="w-4 h-4" />,
  file: <FolderOpen className="w-4 h-4" />,
  link: <Link2 className="w-4 h-4" />,
  tiktok: <Play className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
};

const eventColors: Record<string, string> = {
  upload: 'bg-green-500/20 text-green-400',
  delete: 'bg-red-500/20 text-red-400',
  login: 'bg-blue-500/20 text-blue-400',
  logout: 'bg-gray-500/20 text-gray-400',
  edit: 'bg-yellow-500/20 text-yellow-400',
  favorite: 'bg-amber-500/20 text-amber-400',
  share: 'bg-purple-500/20 text-purple-400',
  auto_lock: 'bg-cyan-500/20 text-cyan-400',
  view: 'bg-indigo-500/20 text-indigo-400',
  create: 'bg-emerald-500/20 text-emerald-400',
};

const filterLabels: Record<ActivityFilter, { label: string; icon: React.ReactNode }> = {
  all: { label: 'Alle', icon: <Activity className="w-4 h-4" /> },
  uploads: { label: 'Uploads', icon: <Upload className="w-4 h-4" /> },
  deletes: { label: 'Löschungen', icon: <Trash2 className="w-4 h-4" /> },
  logins: { label: 'Logins', icon: <LogIn className="w-4 h-4" /> },
  edits: { label: 'Bearbeitungen', icon: <Edit2 className="w-4 h-4" /> },
  shares: { label: 'Geteilt', icon: <Share2 className="w-4 h-4" /> },
};

function getEventDescription(event: ActivityEvent): string {
  const type = event.event_type;
  const itemName = event.item_name || event.details?.title || event.details?.filename || '';
  
  switch (type) {
    case 'login': return 'Anmeldung erfolgreich';
    case 'logout': return 'Abmeldung';
    case 'auto_lock': return 'Automatisch gesperrt (Inaktivität)';
    case 'upload': return itemName ? `"${itemName}" hochgeladen` : 'Datei hochgeladen';
    case 'delete': return itemName ? `"${itemName}" gelöscht` : 'Element gelöscht';
    case 'edit': return itemName ? `"${itemName}" bearbeitet` : 'Element bearbeitet';
    case 'create': return itemName ? `"${itemName}" erstellt` : 'Element erstellt';
    case 'favorite': return itemName ? `"${itemName}" favorisiert` : 'Favorit hinzugefügt';
    case 'share': return itemName ? `"${itemName}" geteilt` : 'Element geteilt';
    case 'view': return itemName ? `"${itemName}" angesehen` : 'Element angesehen';
    default: return type;
  }
}

function groupEventsByDate(events: ActivityEvent[]): Record<string, ActivityEvent[]> {
  const groups: Record<string, ActivityEvent[]> = {};
  
  events.forEach(event => {
    const date = new Date(event.created_at);
    let key: string;
    
    if (isToday(date)) {
      key = 'Heute';
    } else if (isYesterday(date)) {
      key = 'Gestern';
    } else if (isThisWeek(date)) {
      key = 'Diese Woche';
    } else if (isThisMonth(date)) {
      key = 'Dieser Monat';
    } else {
      key = format(date, 'MMMM yyyy', { locale: de });
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(event);
  });
  
  return groups;
}

export default function ActivityTimeline() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const { userId, supabaseClient: supabase } = useAuth();

  const fetchActivities = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    
    try {
      // Fetch from security_logs and view_history
      const [logsRes, viewsRes] = await Promise.all([
        supabase
          .from('security_logs')
          .select('id, event_type, details, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('view_history')
          .select('id, item_type, item_id, viewed_at')
          .eq('user_id', userId)
          .order('viewed_at', { ascending: false })
          .limit(200),
      ]);

      const securityEvents: ActivityEvent[] = (logsRes.data || []).map(log => ({
        id: log.id,
        event_type: log.event_type,
        details: log.details,
        created_at: log.created_at,
      }));

      const viewEvents: ActivityEvent[] = (viewsRes.data || []).map(view => ({
        id: view.id,
        event_type: 'view',
        item_type: view.item_type,
        created_at: view.viewed_at,
      }));

      // Combine and sort
      const allEvents = [...securityEvents, ...viewEvents]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivities(allEvents);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'uploads') return activity.event_type === 'upload';
    if (filter === 'deletes') return activity.event_type === 'delete';
    if (filter === 'logins') return ['login', 'logout', 'auto_lock'].includes(activity.event_type);
    if (filter === 'edits') return ['edit', 'create'].includes(activity.event_type);
    if (filter === 'shares') return activity.event_type === 'share';
    return true;
  });

  const groupedActivities = groupEventsByDate(filteredActivities);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title="Aktivitäts-Timeline"
        subtitle="Alle deine Aktionen chronologisch"
        icon={<Activity className="w-5 h-5 text-primary" />}
        backTo="/dashboard"
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              {filterLabels[filter].label}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.entries(filterLabels).map(([key, { label, icon }]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setFilter(key as ActivityFilter)}
                className={cn(filter === key && "bg-primary/10")}
              >
                {icon}
                <span className="ml-2">{label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={fetchActivities}
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>

        <Badge variant="secondary" className="ml-auto">
          {filteredActivities.length} Aktivitäten
        </Badge>
      </div>

      {/* Timeline */}
      <div className="glass-card p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Keine Aktivitäten gefunden</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-8">
              {Object.entries(groupedActivities).map(([dateGroup, events]) => (
                <div key={dateGroup}>
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      {dateGroup}
                    </h3>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {events.length} Ereignisse
                    </span>
                  </div>

                  <div className="relative pl-6 border-l-2 border-border space-y-4">
                    <AnimatePresence>
                      {events.map((event, index) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ delay: index * 0.02 }}
                          className="relative"
                        >
                          {/* Timeline dot */}
                          <div className={cn(
                            "absolute -left-[29px] w-4 h-4 rounded-full border-2 border-background flex items-center justify-center",
                            eventColors[event.event_type] || 'bg-muted text-muted-foreground'
                          )}>
                            <div className="w-2 h-2 rounded-full bg-current" />
                          </div>

                          {/* Event card */}
                          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              eventColors[event.event_type] || 'bg-muted text-muted-foreground'
                            )}>
                              {eventIcons[event.event_type] || eventIcons[event.item_type || ''] || <Activity className="w-4 h-4" />}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">
                                {getEventDescription(event)}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(event.created_at), 'HH:mm', { locale: de })}
                                </span>
                                {event.item_type && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                    {event.item_type}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </motion.div>
  );
}
