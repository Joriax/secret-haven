import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface SecurityLog {
  id: string;
  event_type: string;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  created_at: string;
}

export interface SecurityLogSettings {
  displayLimit: number;
}

const DEFAULT_SETTINGS: SecurityLogSettings = {
  displayLimit: 100,
};

export const useSecurityLogs = () => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SecurityLogSettings>(() => {
    const saved = localStorage.getItem('security-log-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  const { userId, sessionToken, supabaseClient: supabase } = useAuth();

  const updateSettings = useCallback((newSettings: Partial<SecurityLogSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('security-log-settings', JSON.stringify(updated));
  }, [settings]);

  const fetchLogs = useCallback(async (limit?: number) => {
    if (!userId || !sessionToken) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'get-security-logs', 
          sessionToken,
          limit: limit || settings.displayLimit,
          offset: 0
        }
      });

      if (error) throw error;
      if (data?.success) {
        setLogs(data.logs || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (error) {
      console.error('Error fetching security logs:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, sessionToken, settings.displayLimit, supabase]);

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

  const deleteLogs = async (options: { logIds?: string[]; deleteAll?: boolean; olderThan?: string }) => {
    if (!userId || !sessionToken) return false;

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'delete-security-logs', 
          sessionToken,
          ...options
        }
      });

      if (error) throw error;
      if (data?.success) {
        await fetchLogs();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting logs:', error);
      return false;
    }
  };

  const clearAllLogs = async () => {
    return deleteLogs({ deleteAll: true });
  };

  const deleteOldLogs = async (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return deleteLogs({ olderThan: date.toISOString() });
  };

  const deleteSelectedLogs = async (logIds: string[]) => {
    return deleteLogs({ logIds });
  };

  return { 
    logs, 
    totalCount,
    loading, 
    settings,
    updateSettings,
    fetchLogs, 
    logEvent, 
    clearAllLogs,
    deleteOldLogs,
    deleteSelectedLogs
  };
};
