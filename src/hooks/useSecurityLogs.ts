import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SecurityLog {
  id: string;
  event_type: string;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const useSecurityLogs = () => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useAuth();

  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('security_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching security logs:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const logEvent = async (eventType: string, details: Record<string, any> = {}) => {
    if (!userId) return;

    try {
      await supabase.from('security_logs').insert({
        user_id: userId,
        event_type: eventType,
        details,
        user_agent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  };

  const clearLogs = async () => {
    if (!userId) return false;

    try {
      // We can't delete from client since RLS doesn't allow it
      // Instead we'll use an edge function or just clear local state
      // For now, just inform user
      console.log('Note: Logs can only be cleared by admin');
      return false;
    } catch (error) {
      console.error('Error clearing logs:', error);
      return false;
    }
  };

  return { logs, loading, fetchLogs, logEvent, clearLogs };
};
