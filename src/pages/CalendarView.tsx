import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, FileText, Image, FolderOpen, Link2, Play, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CalendarItem {
  id: string;
  type: 'note' | 'photo' | 'file' | 'link' | 'tiktok';
  title: string;
  date: string;
}

interface DayData {
  notes: number;
  photos: number;
  files: number;
  links: number;
  tiktoks: number;
  items: CalendarItem[];
}

const TYPE_CONFIG = {
  note: { icon: FileText, color: 'bg-primary', label: 'Notizen' },
  photo: { icon: Image, color: 'bg-pink-500', label: 'Fotos' },
  file: { icon: FolderOpen, color: 'bg-blue-500', label: 'Dateien' },
  link: { icon: Link2, color: 'bg-orange-500', label: 'Links' },
  tiktok: { icon: Play, color: 'bg-cyan-500', label: 'TikToks' },
};

export default function CalendarView() {
  const { userId, supabaseClient: supabase } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Map<string, DayData>>(new Map());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleTypes, setVisibleTypes] = useState({
    note: true,
    photo: true,
    file: true,
    link: true,
    tiktok: true,
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad days to start from Monday
  const startDay = monthStart.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1;
  const prevMonthEnd = new Date(monthStart);
  prevMonthEnd.setDate(0);
  const prevMonthDays = Array.from({ length: paddingDays }, (_, i) => {
    const d = new Date(prevMonthEnd);
    d.setDate(prevMonthEnd.getDate() - paddingDays + i + 1);
    return d;
  });

  const fetchCalendarData = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    const startDate = format(monthStart, 'yyyy-MM-dd');
    const endDate = format(monthEnd, 'yyyy-MM-dd');
    
    try {
      const [notesRes, photosRes, filesRes, linksRes, tiktoksRes] = await Promise.all([
        supabase
          .from('notes')
          .select('id, title, created_at')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59'),
        supabase
          .from('photos')
          .select('id, filename, uploaded_at')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('uploaded_at', startDate)
          .lte('uploaded_at', endDate + 'T23:59:59'),
        supabase
          .from('files')
          .select('id, filename, uploaded_at')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('uploaded_at', startDate)
          .lte('uploaded_at', endDate + 'T23:59:59'),
        supabase
          .from('links')
          .select('id, title, created_at')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59'),
        supabase
          .from('tiktok_videos')
          .select('id, title, created_at')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('created_at', startDate)
          .lte('created_at', endDate + 'T23:59:59'),
      ]);

      const dataMap = new Map<string, DayData>();

      const addItem = (dateStr: string, item: CalendarItem) => {
        const dayKey = dateStr.split('T')[0];
        if (!dataMap.has(dayKey)) {
          dataMap.set(dayKey, { notes: 0, photos: 0, files: 0, links: 0, tiktoks: 0, items: [] });
        }
        const data = dataMap.get(dayKey)!;
        data.items.push(item);
        data[`${item.type}s` as keyof Omit<DayData, 'items'>]++;
      };

      (notesRes.data || []).forEach(n => addItem(n.created_at, { id: n.id, type: 'note', title: n.title || 'Notiz', date: n.created_at }));
      (photosRes.data || []).forEach(p => addItem(p.uploaded_at, { id: p.id, type: 'photo', title: p.filename?.replace(/^\d+-/, '') || 'Foto', date: p.uploaded_at }));
      (filesRes.data || []).forEach(f => addItem(f.uploaded_at, { id: f.id, type: 'file', title: f.filename?.replace(/^\d+-/, '') || 'Datei', date: f.uploaded_at }));
      (linksRes.data || []).forEach(l => addItem(l.created_at, { id: l.id, type: 'link', title: l.title || 'Link', date: l.created_at }));
      (tiktoksRes.data || []).forEach(t => addItem(t.created_at, { id: t.id, type: 'tiktok', title: t.title || 'TikTok', date: t.created_at }));

      setCalendarData(dataMap);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, monthStart, monthEnd]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const navigateToItem = (item: CalendarItem) => {
    const paths: Record<string, string> = {
      note: '/notes',
      photo: '/photos',
      file: '/files',
      link: '/links',
      tiktok: '/tiktok',
    };
    navigate(paths[item.type]);
  };

  const selectedDayData = useMemo(() => {
    if (!selectedDay) return null;
    const key = format(selectedDay, 'yyyy-MM-dd');
    return calendarData.get(key);
  }, [selectedDay, calendarData]);

  const filteredItems = useMemo(() => {
    if (!selectedDayData) return [];
    return selectedDayData.items.filter(item => visibleTypes[item.type as keyof typeof visibleTypes]);
  }, [selectedDayData, visibleTypes]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader 
        title="Kalender" 
        icon={<Calendar className="w-6 h-6" />}
        actions={
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Inhaltstypen</h4>
                {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={visibleTypes[key as keyof typeof visibleTypes]}
                      onCheckedChange={(checked) => 
                        setVisibleTypes(prev => ({ ...prev, [key]: checked }))
                      }
                    />
                    <config.icon className="w-4 h-4" />
                    <span className="text-sm">{config.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 glass-card p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-semibold">
              {format(currentMonth, 'MMMM yyyy', { locale: de })}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
              <div key={day} className="text-center text-xs text-muted-foreground font-medium py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Previous month padding */}
            {prevMonthDays.map((day, i) => (
              <div key={`prev-${i}`} className="aspect-square p-1 text-muted-foreground/30 text-sm">
                {format(day, 'd')}
              </div>
            ))}

            {/* Current month days */}
            {days.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayData = calendarData.get(dayKey);
              const hasContent = dayData && dayData.items.length > 0;
              const isSelected = selectedDay && isSameDay(day, selectedDay);

              return (
                <motion.button
                  key={dayKey}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "aspect-square p-1 rounded-lg transition-all relative",
                    isToday(day) && "ring-2 ring-primary",
                    isSelected && "bg-primary/20",
                    hasContent && "hover:bg-muted/80",
                    !hasContent && "hover:bg-muted/30"
                  )}
                >
                  <span className={cn(
                    "text-sm",
                    isToday(day) && "font-bold text-primary"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {/* Activity dots */}
                  {hasContent && (
                    <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
                      {dayData.notes > 0 && visibleTypes.note && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                      {dayData.photos > 0 && visibleTypes.photo && (
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                      )}
                      {dayData.files > 0 && visibleTypes.file && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                      {dayData.links > 0 && visibleTypes.link && (
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      )}
                      {dayData.tiktoks > 0 && visibleTypes.tiktok && (
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Day Details */}
        <div className="glass-card p-4">
          {selectedDay ? (
            <>
              <h3 className="text-lg font-semibold mb-4">
                {format(selectedDay, 'EEEE, d. MMMM', { locale: de })}
              </h3>
              
              {filteredItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Keine Inhalte an diesem Tag
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredItems.map(item => {
                    const config = TYPE_CONFIG[item.type];
                    const Icon = config.icon;
                    
                    return (
                      <motion.button
                        key={`${item.type}-${item.id}`}
                        whileHover={{ x: 4 }}
                        onClick={() => navigateToItem(item)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted text-left transition-colors"
                      >
                        <div className={cn("p-2 rounded-lg", config.color)}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(item.date), 'HH:mm')}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Wähle einen Tag aus</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm text-muted-foreground">
        {Object.entries(TYPE_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", config.color)} />
            <span>{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
