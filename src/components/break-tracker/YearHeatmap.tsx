import React, { useMemo, useState } from 'react';
import { format, startOfYear, endOfYear, eachDayOfInterval, getDay, addDays, subYears, isFuture, parseISO, getWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BreakEntry } from '@/hooks/useBreakTracker';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface YearHeatmapProps {
  entries: BreakEntry[];
}

export const YearHeatmap: React.FC<YearHeatmapProps> = ({ entries }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const entryDates = useMemo(() => {
    return new Set(entries.map(e => e.break_date));
  }, [entries]);

  const yearData = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
    const today = new Date();
    
    const days = eachDayOfInterval({ start: yearStart, end: yearEnd });
    
    // Group by week (GitHub style - weeks are columns)
    const weeks: { date: Date; hasEntry: boolean; isFuture: boolean }[][] = [];
    let currentWeek: { date: Date; hasEntry: boolean; isFuture: boolean }[] = [];
    
    // Pad the first week if it doesn't start on Sunday
    const firstDayOfWeek = getDay(yearStart);
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ 
        date: addDays(yearStart, -(firstDayOfWeek - i)), 
        hasEntry: false, 
        isFuture: false 
      });
    }
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const hasEntry = entryDates.has(dateStr);
      const dayIsFuture = isFuture(day);
      
      currentWeek.push({ date: day, hasEntry, isFuture: dayIsFuture });
      
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
  }, [selectedYear, entryDates]);

  const yearStats = useMemo(() => {
    const yearEntries = entries.filter(e => {
      const date = parseISO(e.break_date);
      return date.getFullYear() === selectedYear;
    });
    return yearEntries.length;
  }, [entries, selectedYear]);

  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  const currentYear = new Date().getFullYear();
  const canGoForward = selectedYear < currentYear;
  const canGoBack = selectedYear > currentYear - 5;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>Jahresübersicht</CardTitle>
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
          {yearStats} Pausen in {selectedYear} — Ähnlich wie GitHub Contribution Graph
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[800px]">
            {/* Month labels */}
            <div className="flex mb-1">
              <div className="w-8" /> {/* Spacer for weekday labels */}
              <div className="flex flex-1">
                {months.map((month, i) => (
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

                        return (
                          <Tooltip key={dayIndex}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "w-[12px] h-[12px] rounded-sm transition-colors cursor-default",
                                  day.isFuture && "bg-muted/30",
                                  !day.isFuture && !day.hasEntry && "bg-muted/50 hover:bg-muted",
                                  !day.isFuture && day.hasEntry && "bg-green-500 hover:bg-green-400"
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-medium">
                                {format(day.date, 'EEEE, d. MMMM yyyy', { locale: de })}
                              </p>
                              <p className={day.hasEntry ? "text-green-500" : "text-muted-foreground"}>
                                {day.isFuture ? 'Zukünftig' : day.hasEntry ? '✓ Pause gemacht' : 'Keine Pause'}
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
                <div className="w-[12px] h-[12px] rounded-sm bg-green-200" />
                <div className="w-[12px] h-[12px] rounded-sm bg-green-400" />
                <div className="w-[12px] h-[12px] rounded-sm bg-green-500" />
                <div className="w-[12px] h-[12px] rounded-sm bg-green-600" />
              </div>
              <span>Mehr</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
