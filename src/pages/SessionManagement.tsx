import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Monitor, 
  Smartphone, 
  Tablet,
  Globe,
  LogOut,
  Shield,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface Session {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  is_active: boolean;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
}

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType?.toLowerCase()) {
    case 'mobile':
      return Smartphone;
    case 'tablet':
      return Tablet;
    default:
      return Monitor;
  }
}

function parseUserAgent(userAgent: string | null): { browser: string; os: string; device: string } {
  if (!userAgent) return { browser: 'Unbekannt', os: 'Unbekannt', device: 'desktop' };

  let browser = 'Unbekannt';
  let os = 'Unbekannt';
  let device = 'desktop';

  // Browser detection
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  }

  // OS detection
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
    device = userAgent.includes('iPad') ? 'tablet' : 'mobile';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    device = 'mobile';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  }

  return { browser, os, device };
}

export default function SessionManagement() {
  const { userId, sessionToken } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!userId) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('session_history')
      .select('*')
      .eq('user_id', userId)
      .order('login_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setSessions(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [userId]);

  const terminateSession = async (sessionId: string) => {
    setTerminatingId(sessionId);

    try {
      // Mark session as inactive
      const { error } = await supabase
        .from('session_history')
        .update({ 
          is_active: false, 
          logout_at: new Date().toISOString() 
        })
        .eq('id', sessionId);

      if (!error) {
        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, is_active: false, logout_at: new Date().toISOString() } : s
        ));
        toast.success('Session beendet');
      } else {
        toast.error('Fehler beim Beenden der Session');
      }
    } catch {
      toast.error('Fehler beim Beenden der Session');
    } finally {
      setTerminatingId(null);
    }
  };

  const terminateAllOtherSessions = async () => {
    const activeSessions = sessions.filter(s => s.is_active);
    
    if (activeSessions.length <= 1) {
      toast.info('Keine anderen aktiven Sessions vorhanden');
      return;
    }

    const confirmed = window.confirm(
      `Möchtest du ${activeSessions.length - 1} andere Session(s) beenden?`
    );

    if (!confirmed) return;

    try {
      // Get current session to exclude it
      const otherSessionIds = activeSessions
        .slice(1) // Skip the first (current) session
        .map(s => s.id);

      await supabase
        .from('session_history')
        .update({ 
          is_active: false, 
          logout_at: new Date().toISOString() 
        })
        .in('id', otherSessionIds);

      setSessions(prev => prev.map(s => 
        otherSessionIds.includes(s.id) 
          ? { ...s, is_active: false, logout_at: new Date().toISOString() } 
          : s
      ));

      toast.success('Alle anderen Sessions beendet');
    } catch {
      toast.error('Fehler beim Beenden der Sessions');
    }
  };

  const activeSessions = sessions.filter(s => s.is_active);
  const pastSessions = sessions.filter(s => !s.is_active);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      <PageHeader
        title="Session-Verwaltung"
        subtitle="Verwalte alle angemeldeten Geräte"
        icon={<Shield className="w-5 h-5 text-cyan-500" />}
        backTo="/settings"
        actions={
          <button
            onClick={fetchSessions}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
          </button>
        }
      />

      {/* Active Sessions */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Aktive Sessions</h2>
              <p className="text-sm text-muted-foreground">{activeSessions.length} Gerät(e) angemeldet</p>
            </div>
          </div>

          {activeSessions.length > 1 && (
            <button
              onClick={terminateAllOtherSessions}
              className="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              Alle anderen beenden
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : activeSessions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Keine aktiven Sessions gefunden
          </p>
        ) : (
          <div className="space-y-3">
            {activeSessions.map((session, index) => {
              const parsed = parseUserAgent(session.user_agent);
              const DeviceIcon = getDeviceIcon(session.device_type || parsed.device);
              const isCurrentSession = index === 0;

              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "p-4 rounded-xl border transition-colors",
                    isCurrentSession 
                      ? "bg-primary/5 border-primary/20" 
                      : "bg-muted/30 border-border hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      isCurrentSession ? "bg-primary/20" : "bg-muted"
                    )}>
                      <DeviceIcon className={cn(
                        "w-6 h-6",
                        isCurrentSession ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">
                          {session.browser || parsed.browser} auf {session.os || parsed.os}
                        </h3>
                        {isCurrentSession && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                            Diese Session
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDistanceToNow(new Date(session.login_at), { locale: de, addSuffix: true })}
                        </div>
                        
                        {(session.city || session.country) && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {[session.city, session.country].filter(Boolean).join(', ')}
                          </div>
                        )}

                        {session.ip_address && (
                          <div className="flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5" />
                            {session.ip_address}
                          </div>
                        )}
                      </div>
                    </div>

                    {!isCurrentSession && (
                      <button
                        onClick={() => terminateSession(session.id)}
                        disabled={terminatingId === session.id}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Session beenden"
                      >
                        {terminatingId === session.id ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <LogOut className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Sessions */}
      {pastSessions.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Frühere Sessions</h2>
              <p className="text-sm text-muted-foreground">Letzte {pastSessions.length} Sessions</p>
            </div>
          </div>

          <div className="space-y-2">
            {pastSessions.slice(0, 10).map((session, index) => {
              const parsed = parseUserAgent(session.user_agent);
              const DeviceIcon = getDeviceIcon(session.device_type || parsed.device);

              return (
                <div
                  key={session.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/20"
                >
                  <DeviceIcon className="w-5 h-5 text-muted-foreground" />
                  
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-foreground">
                      {session.browser || parsed.browser} auf {session.os || parsed.os}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {format(new Date(session.login_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </div>

                  {session.logout_at && (
                    <span className="text-xs text-muted-foreground">
                      — {format(new Date(session.logout_at), 'HH:mm', { locale: de })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Security Tip */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-foreground mb-1">Sicherheitshinweis</h4>
          <p className="text-sm text-muted-foreground">
            Wenn du eine Session nicht erkennst, beende sie sofort und ändere deinen PIN.
            Unbekannte Geräte könnten auf unbefugten Zugriff hindeuten.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
