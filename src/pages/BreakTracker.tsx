import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { format, isToday, isFuture, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  Flame, 
  Trophy, 
  Target, 
  ChevronLeft, 
  ChevronRight,
  Check,
  Bell,
  BellOff,
  Clock,
  Trash2,
  Coffee,
  TrendingUp,
  Award,
  Sparkles
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { useBreakTracker } from '@/hooks/useBreakTracker';
import { cn } from '@/lib/utils';

const BreakTracker: React.FC = () => {
  const { 
    entries, 
    settings, 
    stats, 
    loading, 
    addEntry, 
    removeEntry, 
    updateSettings, 
    hasEntryForDate,
    getEntryForDate 
  } = useBreakTracker();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [noteText, setNoteText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reminderTime, setReminderTime] = useState(settings?.reminder_time || '12:00');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate padding days for the start of the month
  const startDay = monthStart.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1; // Adjust for Monday start

  const handleMarkToday = async () => {
    await addEntry(new Date());
  };

  const handleDateClick = (date: Date) => {
    if (isFuture(date)) return;
    
    if (hasEntryForDate(date)) {
      setSelectedDate(date);
    } else {
      setSelectedDate(date);
      setNoteText('');
    }
  };

  const handleAddEntry = async () => {
    if (selectedDate) {
      await addEntry(selectedDate, noteText || undefined);
      setSelectedDate(null);
      setNoteText('');
    }
  };

  const handleRemoveEntry = async () => {
    if (selectedDate) {
      const entry = getEntryForDate(selectedDate);
      if (entry) {
        await removeEntry(entry.id);
        setSelectedDate(null);
      }
    }
  };

  const handleSaveSettings = async () => {
    await updateSettings({
      reminder_enabled: settings?.reminder_enabled ?? true,
      reminder_time: reminderTime
    });
    setSettingsOpen(false);
  };

  const todayHasEntry = hasEntryForDate(new Date());

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Pausen-Tracker" 
          subtitle="Verfolge deine täglichen Pausen"
          icon={<Coffee className="w-5 h-5 text-primary" />}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Pausen-Tracker" 
        subtitle="Verfolge deine täglichen Pausen und baue Streaks auf"
        icon={<Coffee className="w-5 h-5 text-primary" />}
      />
      {/* Quick Action Bar */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap gap-3 items-center justify-between"
      >
        <div className="flex gap-3">
          <Button 
            size="lg"
            onClick={handleMarkToday}
            disabled={todayHasEntry}
            className={cn(
              "gap-2",
              todayHasEntry && "bg-green-600 hover:bg-green-600"
            )}
          >
            {todayHasEntry ? (
              <>
                <Check className="h-5 w-5" />
                Heute erledigt!
              </>
            ) : (
              <>
                <Coffee className="h-5 w-5" />
                Pause gemacht!
              </>
            )}
          </Button>
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              {settings?.reminder_enabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              Erinnerung
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Erinnerungseinstellungen</DialogTitle>
              <DialogDescription>
                Lass dich täglich an deine Pause erinnern
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Tägliche Erinnerung</Label>
                  <p className="text-sm text-muted-foreground">
                    Erhalte eine Benachrichtigung zur Pausenzeit
                  </p>
                </div>
                <Switch
                  checked={settings?.reminder_enabled ?? true}
                  onCheckedChange={(checked) => 
                    updateSettings({ reminder_enabled: checked })
                  }
                />
              </div>
              
              {settings?.reminder_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="reminder-time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Uhrzeit
                  </Label>
                  <Input
                    id="reminder-time"
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-32"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveSettings}>
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <motion.div variants={item}>
          <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/20">
                  <Flame className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.currentStreak}</p>
                  <p className="text-xs text-muted-foreground">Aktuelle Streak</p>
                </div>
              </div>
              {stats.currentStreak >= 7 && (
                <Badge className="mt-2 bg-orange-500/20 text-orange-600 border-orange-500/30">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Feuer! 🔥
                </Badge>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-yellow-500/20">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.longestStreak}</p>
                  <p className="text-xs text-muted-foreground">Längste Streak</p>
                </div>
              </div>
              {stats.longestStreak >= 30 && (
                <Badge className="mt-2 bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                  <Award className="h-3 w-3 mr-1" />
                  Legende!
                </Badge>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20">
                  <Target className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.thisWeek}/7</p>
                  <p className="text-xs text-muted-foreground">Diese Woche</p>
                </div>
              </div>
              <Progress value={(stats.thisWeek / 7) * 100} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-500/20">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completionRate}%</p>
                  <p className="text-xs text-muted-foreground">Letzte 30 Tage</p>
                </div>
              </div>
              <Progress value={stats.completionRate} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Calendar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                <CardTitle>
                  {format(currentMonth, 'MMMM yyyy', { locale: de })}
                </CardTitle>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Heute
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>
              Klicke auf einen Tag um eine Pause einzutragen oder zu entfernen
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Padding for start of month */}
              {[...Array(paddingDays)].map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}

              {/* Days */}
              {daysInMonth.map(day => {
                const hasEntry = hasEntryForDate(day);
                const isCurrentDay = isToday(day);
                const isFutureDay = isFuture(day);
                const entry = getEntryForDate(day);

                return (
                  <Popover key={day.toISOString()}>
                    <PopoverTrigger asChild>
                      <button
                        onClick={() => handleDateClick(day)}
                        disabled={isFutureDay}
                        className={cn(
                          "aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all relative",
                          "hover:bg-accent hover:text-accent-foreground",
                          isFutureDay && "opacity-30 cursor-not-allowed",
                          isCurrentDay && !hasEntry && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                          hasEntry && "bg-green-500 text-white hover:bg-green-600",
                          !hasEntry && !isFutureDay && "bg-muted/50"
                        )}
                      >
                        <span className="font-medium">{format(day, 'd')}</span>
                        {hasEntry && (
                          <Check className="h-3 w-3 mt-0.5" />
                        )}
                      </button>
                    </PopoverTrigger>
                    {!isFutureDay && (
                      <PopoverContent className="w-64 p-3" align="center">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {format(day, 'EEEE, d. MMMM', { locale: de })}
                            </span>
                            {hasEntry && (
                              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                                <Check className="h-3 w-3 mr-1" />
                                Erledigt
                              </Badge>
                            )}
                          </div>
                          
                          {hasEntry ? (
                            <>
                              {entry?.notes && (
                                <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                                  {entry.notes}
                                </p>
                              )}
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                className="w-full"
                                onClick={() => {
                                  if (entry) removeEntry(entry.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eintrag löschen
                              </Button>
                            </>
                          ) : (
                            <>
                              <Textarea
                                placeholder="Optionale Notiz..."
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                className="text-sm min-h-[60px]"
                              />
                              <Button 
                                size="sm" 
                                className="w-full"
                                onClick={async () => {
                                  await addEntry(day, noteText || undefined);
                                  setNoteText('');
                                }}
                              >
                                <Coffee className="h-4 w-4 mr-2" />
                                Pause eintragen
                              </Button>
                            </>
                          )}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Monthly Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Monatsübersicht
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">{stats.thisMonth}</p>
                <p className="text-sm text-muted-foreground">Pausen diesen Monat</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">{stats.totalBreaks}</p>
                <p className="text-sm text-muted-foreground">Pausen insgesamt</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">{stats.thisWeek}</p>
                <p className="text-sm text-muted-foreground">Diese Woche</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">
                  {Math.round((stats.thisMonth / daysInMonth.filter(d => !isFuture(d)).length) * 100)}%
                </p>
                <p className="text-sm text-muted-foreground">Erfolgsrate Monat</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default BreakTracker;
