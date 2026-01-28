import React, { useState, useRef, useMemo, useCallback } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface MediaItem {
  id: string;
  filename: string;
  caption: string;
  album_id: string | null;
  taken_at: string;
  uploaded_at: string;
  url?: string;
  thumbnail_url?: string;
  is_favorite?: boolean;
  type: 'photo' | 'video';
  mime_type?: string;
  tags?: string[];
}

interface PhotoTimelineProps {
  media: MediaItem[];
  onSelectItem: (item: MediaItem, index: number) => void;
  renderItem: (item: MediaItem, index: number) => React.ReactNode;
  className?: string;
}

interface MonthGroup {
  key: string;
  label: string;
  items: MediaItem[];
  startIndex: number;
}

export function PhotoTimeline({ 
  media, 
  onSelectItem, 
  renderItem,
  className 
}: PhotoTimelineProps) {
  const [showJumpMenu, setShowJumpMenu] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Group media by month
  const monthGroups = useMemo(() => {
    const groups: MonthGroup[] = [];
    const monthMap = new Map<string, MediaItem[]>();

    media.forEach((item) => {
      const dateStr = item.taken_at || item.uploaded_at;
      const date = parseISO(dateStr);
      if (!isValid(date)) return;
      
      const key = format(date, 'yyyy-MM');
      if (!monthMap.has(key)) {
        monthMap.set(key, []);
      }
      monthMap.get(key)!.push(item);
    });

    let startIndex = 0;
    Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([key, items]) => {
        const date = parseISO(`${key}-01`);
        groups.push({
          key,
          label: format(date, 'MMMM yyyy', { locale: de }),
          items,
          startIndex,
        });
        startIndex += items.length;
      });

    return groups;
  }, [media]);

  // Get unique years for quick navigation
  const years = useMemo(() => {
    const yearSet = new Set<string>();
    monthGroups.forEach(g => yearSet.add(g.key.substring(0, 4)));
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [monthGroups]);

  // Track scroll position to update current month indicator
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    let found = false;

    monthRefs.current.forEach((el, key) => {
      if (found) return;
      const rect = el.getBoundingClientRect();
      if (rect.top <= containerRect.top + 100 && rect.bottom > containerRect.top) {
        setCurrentMonth(key);
        found = true;
      }
    });
  }, []);

  // Jump to specific month
  const jumpToMonth = useCallback((key: string) => {
    const el = monthRefs.current.get(key);
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowJumpMenu(false);
    }
  }, []);

  // Calculate position for timeline scrubber
  const getTimelinePosition = useCallback((key: string) => {
    const index = monthGroups.findIndex(g => g.key === key);
    if (index === -1 || monthGroups.length <= 1) return 0;
    return (index / (monthGroups.length - 1)) * 100;
  }, [monthGroups]);

  return (
    <div className={cn("relative flex", className)}>
      {/* Main content area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        {monthGroups.map((group) => (
          <div
            key={group.key}
            ref={(el) => {
              if (el) monthRefs.current.set(group.key, el);
              else monthRefs.current.delete(group.key);
            }}
          >
            {/* Sticky month header */}
            <div className="sticky top-0 z-10 px-4 py-2 bg-background/80 backdrop-blur-sm border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {group.label}
                <span className="text-muted-foreground font-normal">
                  ({group.items.length})
                </span>
              </h3>
            </div>

            {/* Media grid for this month */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 p-1">
              {group.items.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item, group.startIndex + idx)}
                >
                  {renderItem(item, group.startIndex + idx)}
                </div>
              ))}
            </div>
          </div>
        ))}

        {monthGroups.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Keine Medien vorhanden
          </div>
        )}
      </div>

      {/* Timeline scrubber (right side) */}
      {monthGroups.length > 1 && (
        <div className="w-12 md:w-16 flex-shrink-0 relative bg-muted/30 border-l border-border">
          {/* Current position indicator */}
          {currentMonth && (
            <motion.div
              className="absolute left-0 right-0 h-1 bg-primary rounded-full mx-1"
              style={{ top: `${getTimelinePosition(currentMonth)}%` }}
              layoutId="timeline-indicator"
            />
          )}

          {/* Year markers */}
          <div className="absolute inset-0 flex flex-col justify-between py-4">
            {years.map((year) => (
              <button
                key={year}
                onClick={() => {
                  const firstMonth = monthGroups.find(g => g.key.startsWith(year));
                  if (firstMonth) jumpToMonth(firstMonth.key);
                }}
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded transition-colors",
                  currentMonth?.startsWith(year)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {year}
              </button>
            ))}
          </div>

          {/* Jump to date button */}
          <button
            onClick={() => setShowJumpMenu(!showJumpMenu)}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Jump to date menu */}
      <AnimatePresence>
        {showJumpMenu && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-16 bottom-4 w-48 max-h-64 overflow-auto bg-card border border-border rounded-xl shadow-xl z-50"
          >
            <div className="p-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground">Springe zu...</span>
            </div>
            <div className="p-1 max-h-52 overflow-auto">
              {monthGroups.map((group) => (
                <button
                  key={group.key}
                  onClick={() => jumpToMonth(group.key)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                    currentMonth === group.key
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {group.label}
                  <span className="float-right text-muted-foreground">{group.items.length}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
