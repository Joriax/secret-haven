import React, { useMemo, useState } from 'react';
import { format, startOfYear, endOfYear, eachDayOfInterval, getDay, addDays, subYears, isFuture, parseISO, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActivityData {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  data: ActivityData[];
  title?: string;
  description?: string;
  emptyText?: string;
  activeText?: string;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ 
  data, 
  title = "Jahresübersicht",
  description,
  emptyText = "Keine Aktivität",
  activeText = "Aktivitäten"
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Create a map of date -> count
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(d => {
      const existing = map.get(d.date) || 0;
      map.set(d.date, existing + d.count);
    });
    return map;
  }, [data]);

  // Find max activity for color scaling
  const maxActivity = useMemo(() => {
    return Math.max(...Array.from(activityMap.values()), 1);
  }, [activityMap]);

  const getActivityLevel = (count: number): number => {
    if (count === 0) return 0;
    const percentage = count / maxActivity;
    if (percentage <= 0.25) return 1;
    if (percentage <= 0.5) return 2;
    if (percentage <= 0.75) return 3;
    return 4;
  };

  const yearData = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
    const today = new Date();
    
    const days = eachDayOfInterval({ start: yearStart, end: yearEnd });
    
    // Group by week (GitHub style - weeks are columns)
    const weeks: { date: Date; count: number; isFuture: boolean }[][] = [];
    let currentWeek: { date: Date; count: number; isFuture: boolean }[] = [];
    
    // Pad the first week if it doesn't start on Sunday
    const firstDayOfWeek = getDay(yearStart);
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ 
        date: addDays(yearStart, -(firstDayOfWeek - i)), 
        count: 0, 
        isFuture: false 
      });
    }
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const count = activityMap.get(dateStr) || 0;
      const dayIsFuture = isFuture(day);
      
      currentWeek.push({ date: day, count, isFuture: dayIsFuture });
      
      if (getDay(day) === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    // Push the last incomplete week
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  }, [selectedYear, activityMap]);

  const yearStats = useMemo(() => {
    let total = 0;
    let activeDays = 0;
    
    data.forEach(d => {
      const date = parseISO(d.date);
      if (date.getFullYear() === selectedYear) {
        total += d.count;
        activeDays++;
      }
    });
    
    return { total, activeDays };
  }, [data, selectedYear]);

  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  const currentYear = new Date().getFullYear();
  const canGoForward = selectedYear < currentYear;
  const canGoBack = selectedYear > currentYear - 5;

  const getColorClass = (level: number, isFuture: boolean) => {
    if (isFuture) return "bg-muted/30";
    switch (level) {
      case 0: return "bg-muted/50 hover:bg-muted";
      case 1: return "bg-primary/30 hover:bg-primary/40";
      case 2: return "bg-primary/50 hover:bg-primary/60";
      case 3: return "bg-primary/70 hover:bg-primary/80";
      case 4: return "bg-primary hover:bg-primary/90";
      default: return "bg-muted/50";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedYear(y => y - 1)}
              disabled={!canGoBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold min-w-[60px] text-center">{selectedYear}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedYear(y => y + 1)}
              disabled={!canGoForward}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          {description || `${yearStats.total} ${activeText} an ${yearStats.activeDays} Tagen in ${selectedYear}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[800px]">
            {/* Month labels */}
            <div className="flex mb-1">
              <div className="w-8" />
              <div className="flex flex-1">
                {months.map((month) => (
                  <div 
                    key={month} 
                    className="flex-1 text-xs text-muted-foreground text-center"
                  >
                    {month}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex">
              {/* Weekday labels */}
              <div className="flex flex-col gap-[3px] mr-1">
                {weekdays.map((day, i) => (
                  <div 
                    key={day} 
                    className="h-[12px] w-8 text-[10px] text-muted-foreground flex items-center"
                  >
                    {i % 2 === 1 ? day : ''}
                  </div>
                ))}
              </div>

              {/* Heatmap grid */}
              <TooltipProvider delayDuration={100}>
                <div className="flex gap-[3px]">
                  {yearData.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-[3px]">
                      {week.map((day, dayIndex) => {
                        const isCurrentYear = day.date.getFullYear() === selectedYear;
                        
                        if (!isCurrentYear) {
                          return <div key={dayIndex} className="w-[12px] h-[12px]" />;
                        }

                        const level = getActivityLevel(day.count);

                        return (
                          <Tooltip key={dayIndex}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "w-[12px] h-[12px] rounded-sm transition-colors cursor-default",
                                  getColorClass(level, day.isFuture)
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-medium">
                                {format(day.date, 'EEEE, d. MMMM yyyy', { locale: de })}
                              </p>
                              <p className={day.count > 0 ? "text-primary" : "text-muted-foreground"}>
                                {day.isFuture ? 'Zukünftig' : day.count > 0 ? `${day.count} ${activeText}` : emptyText}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
              <span>Weniger</span>
              <div className="flex gap-1">
                <div className="w-[12px] h-[12px] rounded-sm bg-muted/50" />
                <div className="w-[12px] h-[12px] rounded-sm bg-primary/30" />
                <div className="w-[12px] h-[12px] rounded-sm bg-primary/50" />
                <div className="w-[12px] h-[12px] rounded-sm bg-primary/70" />
                <div className="w-[12px] h-[12px] rounded-sm bg-primary" />
              </div>
              <span>Mehr</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
