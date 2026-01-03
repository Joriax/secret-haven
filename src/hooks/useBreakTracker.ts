import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useVaultData } from './useVaultData';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, differenceInDays, parseISO, isToday, subDays } from 'date-fns';

export interface BreakEntry {
  id: string;
  user_id: string;
  break_date: string;
  notes: string | null;
  created_at: string;
}

export interface BreakSettings {
  id: string;
  user_id: string;
  reminder_enabled: boolean;
  reminder_time: string;
  created_at: string;
  updated_at: string;
}

export interface BreakStats {
  currentStreak: number;
  longestStreak: number;
  totalBreaks: number;
  thisWeek: number;
  thisMonth: number;
  completionRate: number;
}

export const useBreakTracker = () => {
  const [entries, setEntries] = useState<BreakEntry[]>([]);
  const [settings, setSettings] = useState<BreakSettings | null>(null);
  const [stats, setStats] = useState<BreakStats>({
    currentStreak: 0,
    longestStreak: 0,
    totalBreaks: 0,
    thisWeek: 0,
    thisMonth: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const { sessionToken } = useAuth();
  const { callVaultData } = useVaultData();
  const { toast } = useToast();

  const calculateStats = useCallback((breakEntries: BreakEntry[]): BreakStats => {
    if (breakEntries.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalBreaks: 0,
        thisWeek: 0,
        thisMonth: 0,
        completionRate: 0
      };
    }

    const sortedDates = breakEntries
      .map(e => parseISO(e.break_date))
      .sort((a, b) => b.getTime() - a.getTime());

    // Calculate current streak
    let currentStreak = 0;
    const today = startOfDay(new Date());
    
    // Check if today or yesterday has an entry to start the streak
    const hasToday = sortedDates.some(d => differenceInDays(today, startOfDay(d)) === 0);
    const hasYesterday = sortedDates.some(d => differenceInDays(today, startOfDay(d)) === 1);
    
    if (hasToday || hasYesterday) {
      const startDate = hasToday ? today : subDays(today, 1);
      let checkDate = startDate;
      
      for (const date of sortedDates) {
        const daysDiff = differenceInDays(checkDate, startOfDay(date));
        if (daysDiff === 0) {
          currentStreak++;
          checkDate = subDays(checkDate, 1);
        } else if (daysDiff > 0) {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 1;
    const uniqueDates = [...new Set(sortedDates.map(d => format(d, 'yyyy-MM-dd')))];
    const sortedUniqueDates = uniqueDates.sort().reverse();
    
    for (let i = 1; i < sortedUniqueDates.length; i++) {
      const current = parseISO(sortedUniqueDates[i - 1]);
      const prev = parseISO(sortedUniqueDates[i]);
      
      if (differenceInDays(current, prev) === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // This week & month
    const now = new Date();
    const weekStart = subDays(now, 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisWeek = sortedDates.filter(d => d >= weekStart).length;
    const thisMonth = sortedDates.filter(d => d >= monthStart).length;

    // Completion rate (last 30 days)
    const last30Days = subDays(now, 30);
    const entriesLast30 = sortedDates.filter(d => d >= last30Days).length;
    const completionRate = Math.round((entriesLast30 / 30) * 100);

    return {
      currentStreak,
      longestStreak,
      totalBreaks: breakEntries.length,
      thisWeek,
      thisMonth,
      completionRate
    };
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!sessionToken) return;
    
    try {
      const result = await callVaultData('get-break-entries');
      if (result?.data) {
        setEntries(result.data);
        setStats(calculateStats(result.data));
      }
    } catch (error) {
      console.error('Error fetching break entries:', error);
    }
  }, [sessionToken, callVaultData, calculateStats]);

  const fetchSettings = useCallback(async () => {
    if (!sessionToken) return;
    
    try {
      const result = await callVaultData('get-break-settings');
      if (result?.data) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('Error fetching break settings:', error);
    }
  }, [sessionToken, callVaultData]);

  const addEntry = useCallback(async (date: Date, notes?: string) => {
    if (!sessionToken) return;
    
    try {
      const result = await callVaultData('add-break-entry', {
        break_date: format(date, 'yyyy-MM-dd'),
        notes
      });
      
      if (result?.data) {
        setEntries(prev => {
          const newEntries = [...prev, result.data];
          setStats(calculateStats(newEntries));
          return newEntries;
        });
        
        toast({
          title: "Pause eingetragen! 🎉",
          description: isToday(date) 
            ? "Super, du hast heute Pause gemacht!" 
            : `Pause für ${format(date, 'dd.MM.yyyy')} eingetragen.`
        });
        
        return result.data;
      }
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        toast({
          title: "Bereits eingetragen",
          description: "Für diesen Tag gibt es bereits einen Eintrag.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Fehler",
          description: "Konnte Eintrag nicht speichern.",
          variant: "destructive"
        });
      }
    }
  }, [sessionToken, callVaultData, calculateStats, toast]);

  const removeEntry = useCallback(async (id: string) => {
    if (!sessionToken) return;
    
    try {
      await callVaultData('delete-break-entry', { id });
      setEntries(prev => {
        const newEntries = prev.filter(e => e.id !== id);
        setStats(calculateStats(newEntries));
        return newEntries;
      });
      
      toast({
        title: "Eintrag gelöscht",
        description: "Der Pauseneintrag wurde entfernt."
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Konnte Eintrag nicht löschen.",
        variant: "destructive"
      });
    }
  }, [sessionToken, callVaultData, calculateStats, toast]);

  const updateSettings = useCallback(async (newSettings: Partial<BreakSettings>) => {
    if (!sessionToken) return;
    
    try {
      const result = await callVaultData('update-break-settings', newSettings);
      if (result?.data) {
        setSettings(result.data);
        toast({
          title: "Einstellungen gespeichert",
          description: "Deine Erinnerungseinstellungen wurden aktualisiert."
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Konnte Einstellungen nicht speichern.",
        variant: "destructive"
      });
    }
  }, [sessionToken, callVaultData, toast]);

  const hasEntryForDate = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return entries.some(e => e.break_date === dateStr);
  }, [entries]);

  const getEntryForDate = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return entries.find(e => e.break_date === dateStr);
  }, [entries]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchEntries(), fetchSettings()]);
      setLoading(false);
    };
    
    if (sessionToken) {
      load();
    }
  }, [sessionToken, fetchEntries, fetchSettings]);

  return {
    entries,
    settings,
    stats,
    loading,
    addEntry,
    removeEntry,
    updateSettings,
    hasEntryForDate,
    getEntryForDate,
    refresh: fetchEntries
  };
};
