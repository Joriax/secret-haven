import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Reminder {
  id: string;
  user_id: string;
  note_id: string | null;
  title: string;
  remind_at: string;
  is_recurring: boolean;
  recurrence_type: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateReminderData {
  noteId?: string;
  title: string;
  remindAt: Date;
  isRecurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, supabaseClient: supabase } = useAuth();

  const fetchReminders = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('note_reminders')
        .select('*')
        .eq('user_id', userId)
        .order('remind_at', { ascending: true });

      if (error) throw error;
      setReminders((data || []) as Reminder[]);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Check for due reminders
  useEffect(() => {
    if (!reminders.length) return;

    const checkReminders = () => {
      const now = new Date();
      const dueReminders = reminders.filter(r => 
        !r.is_completed && new Date(r.remind_at) <= now
      );

      dueReminders.forEach(reminder => {
        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Erinnerung', {
            body: reminder.title,
            icon: '/pwa-192x192.png',
          });
        }
        toast.info(`Erinnerung: ${reminder.title}`);
      });
    };

    const interval = setInterval(checkReminders, 60000); // Check every minute
    checkReminders(); // Check immediately

    return () => clearInterval(interval);
  }, [reminders]);

  const createReminder = useCallback(async (data: CreateReminderData) => {
    if (!userId) return null;

    try {
      const { data: reminder, error } = await supabase
        .from('note_reminders')
        .insert({
          user_id: userId,
          note_id: data.noteId || null,
          title: data.title,
          remind_at: data.remindAt.toISOString(),
          is_recurring: data.isRecurring || false,
          recurrence_type: data.recurrenceType || null,
        })
        .select()
        .single();

      if (error) throw error;

      setReminders(prev => [...prev, reminder as Reminder]);
      toast.success('Erinnerung erstellt');
      return reminder as Reminder;
    } catch (error) {
      console.error('Error creating reminder:', error);
      toast.error('Fehler beim Erstellen der Erinnerung');
      return null;
    }
  }, [userId, supabase]);

  const updateReminder = useCallback(async (id: string, updates: Partial<Reminder>) => {
    try {
      const { error } = await supabase
        .from('note_reminders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      toast.success('Erinnerung aktualisiert');
    } catch (error) {
      console.error('Error updating reminder:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  }, [supabase]);

  const completeReminder = useCallback(async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    try {
      if (reminder.is_recurring && reminder.recurrence_type) {
        // Calculate next reminder date
        const currentDate = new Date(reminder.remind_at);
        let nextDate = new Date(currentDate);

        switch (reminder.recurrence_type) {
          case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }

        await supabase
          .from('note_reminders')
          .update({ remind_at: nextDate.toISOString() })
          .eq('id', id);

        setReminders(prev => prev.map(r => 
          r.id === id ? { ...r, remind_at: nextDate.toISOString() } : r
        ));
        toast.success('Nächste Erinnerung geplant');
      } else {
        await supabase
          .from('note_reminders')
          .update({ is_completed: true, completed_at: new Date().toISOString() })
          .eq('id', id);

        setReminders(prev => prev.map(r => 
          r.id === id ? { ...r, is_completed: true, completed_at: new Date().toISOString() } : r
        ));
        toast.success('Erinnerung abgeschlossen');
      }
    } catch (error) {
      console.error('Error completing reminder:', error);
      toast.error('Fehler beim Abschließen');
    }
  }, [reminders, supabase]);

  const deleteReminder = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('note_reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReminders(prev => prev.filter(r => r.id !== id));
      toast.success('Erinnerung gelöscht');
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast.error('Fehler beim Löschen');
    }
  }, [supabase]);

  const upcomingReminders = reminders.filter(r => 
    !r.is_completed && new Date(r.remind_at) > new Date()
  );

  const overdueReminders = reminders.filter(r => 
    !r.is_completed && new Date(r.remind_at) <= new Date()
  );

  return {
    reminders,
    upcomingReminders,
    overdueReminders,
    isLoading,
    createReminder,
    updateReminder,
    completeReminder,
    deleteReminder,
    refetch: fetchReminders,
  };
}

export default useReminders;
