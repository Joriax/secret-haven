import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  LogIn, 
  LogOut, 
  AlertTriangle, 
  Smartphone, 
  Key,
  Trash2,
  RefreshCw,
  Clock,
  MapPin,
  Monitor,
  Filter,
  ChevronDown,
  Globe,
  Laptop,
  Tablet,
  Activity,
  Users,
  XCircle,
  CheckCircle,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface SecurityLog {
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

interface SessionHistoryItem {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  login_at: string | null;
  logout_at: string | null;
  is_active: boolean | null;
}

const eventTypeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  'login_success': { icon: LogIn, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Login erfolgreich' },
  'login_failed': { icon: AlertTriangle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Login fehlgeschlagen' },
  'decoy_login': { icon: Shield, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Tarnmodus aktiviert' },
  'logout': { icon: LogOut, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Abgemeldet' },
  'pin_changed': { icon: Key, color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: 'PIN geändert' },
  'decoy_pin_set': { icon: Shield, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: 'Tarn-PIN gesetzt' },
  'new_device': { icon: Smartphone, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', label: 'Neues Gerät' },
  'recovery_key_generated': { icon: Key, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Recovery-Key erstellt' },
  'user_created': { icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Benutzer erstellt' },
  'user_deleted': { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Benutzer gelöscht' },
  'role_assigned': { icon: Shield, color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: 'Rolle zugewiesen' },
  'role_removed': { icon: Shield, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: 'Rolle entfernt' },
  'admin_reset_pin': { icon: Key, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Admin PIN Reset' },
  'sessions_terminated': { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Sessions beendet' },
};

type FilterType = 'all' | 'login' | 'security' | 'admin';

const filterOptions: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'login', label: 'Login-Aktivität' },
  { value: 'security', label: 'Sicherheit' },
  { value: 'admin', label: 'Admin' },
];

const filterEventTypes: Record<FilterType, string[]> = {
  all: [],
  login: ['login_success', 'login_failed', 'decoy_login', 'logout', 'new_device'],
  security: ['pin_changed', 'decoy_pin_set', 'recovery_key_generated'],
  admin: ['user_created', 'user_deleted', 'role_assigned', 'role_removed', 'admin_reset_pin', 'sessions_terminated'],
};

export default function SecurityLogs() {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const { userId, sessionToken } = useAuth();

  const fetchData = useCallback(async () => {
    if (!userId || !sessionToken) return;
    setLoading(true);
    
    try {
      // Fetch security logs
      const { data: logsData, error: logsError } = await supabase
        .from('security_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (logsError) throw logsError;
      setLogs(logsData || []);

      // Fetch session history
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('session_history')
        .select('*')
        .eq('user_id', userId)
        .order('login_at', { ascending: false })
        .limit(50);

      if (sessionsError) throw sessionsError;
      setSessions(sessionsData || []);
    } catch (error) {
      console.error('Error fetching security data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }, [userId, sessionToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`;
    
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (loginAt: string | null, logoutAt: string | null, isActive: boolean | null) => {
    if (!loginAt) return '-';
    const start = new Date(loginAt);
    const end = logoutAt ? new Date(logoutAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    
    if (isActive) return `${hours}h ${minutes}m (aktiv)`;
    return `${hours}h ${minutes}m`;
  };

  const getEventConfig = (eventType: string) => {
    return eventTypeConfig[eventType] || { 
      icon: Shield, 
      color: 'text-muted-foreground', 
      bgColor: 'bg-muted/50',
      label: eventType 
    };
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      default: return Laptop;
    }
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => filterEventTypes[filter].includes(log.event_type));

  // Group logs by date
  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const date = new Date(log.created_at).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, SecurityLog[]>);

  const stats = {
    total: logs.length,
    successLogins: logs.filter(l => l.event_type === 'login_success').length,
    failedLogins: logs.filter(l => l.event_type === 'login_failed').length,
    activeSessions: sessions.filter(s => s.is_active).length,
    securityEvents: logs.filter(l => ['pin_changed', 'decoy_pin_set', 'recovery_key_generated'].includes(l.event_type)).length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Sicherheit</h1>
            <p className="text-muted-foreground text-sm">Protokolle & Sessions</p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Protokolle</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{stats.successLogins}</div>
          <div className="text-xs text-muted-foreground">Erfolgreiche Logins</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{stats.failedLogins}</div>
          <div className="text-xs text-muted-foreground">Fehlgeschlagen</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.activeSessions}</div>
          <div className="text-xs text-muted-foreground">Aktive Sessions</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.securityEvents}</div>
          <div className="text-xs text-muted-foreground">Sicherheit</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Protokolle ({filteredLogs.length})
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Sessions ({sessions.length})
          </TabsTrigger>
        </TabsList>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filter */}
          <div className="flex items-center justify-between">
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="px-4 py-2 rounded-xl bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">{filterOptions.find(f => f.value === filter)?.label}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showFilterMenu && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {showFilterMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 top-full mt-2 w-48 glass-card p-2 z-50"
                  >
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilter(option.value);
                          setShowFilterMenu(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                          filter === option.value 
                            ? "bg-primary/20 text-primary" 
                            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Logs List */}
          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Lädt...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center">
                <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Keine Protokolleinträge</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                  <div key={date}>
                    {/* Date Header */}
                    <div className="px-4 py-2 bg-muted/30 sticky top-0 z-10">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{date}</span>
                        <span className="text-xs opacity-60">({dateLogs.length})</span>
                      </div>
                    </div>
                    
                    {/* Logs for this date */}
                    <div className="divide-y divide-border/30">
                      {dateLogs.map((log, index) => {
                        const config = getEventConfig(log.event_type);
                        const Icon = config.icon;
                        const DeviceIcon = getDeviceIcon(log.device_type);
                        const isExpanded = expandedLog === log.id;
                        
                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="hover:bg-muted/10 transition-colors"
                          >
                            <div 
                              className="p-4 cursor-pointer"
                              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                            >
                              <div className="flex items-start gap-4">
                                <div className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                  config.bgColor
                                )}>
                                  <Icon className={cn("w-5 h-5", config.color)} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-medium text-foreground">{config.label}</h3>
                                      <ChevronRight className={cn(
                                        "w-4 h-4 text-muted-foreground transition-transform",
                                        isExpanded && "rotate-90"
                                      )} />
                                    </div>
                                    <span className="text-muted-foreground text-sm flex-shrink-0">
                                      {formatDate(log.created_at)}
                                    </span>
                                  </div>
                                  
                                  {/* Quick info */}
                                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    {log.browser && (
                                      <span className="flex items-center gap-1">
                                        <Monitor className="w-3 h-3" />
                                        {log.browser}
                                      </span>
                                    )}
                                    {log.os && (
                                      <span className="flex items-center gap-1">
                                        <DeviceIcon className="w-3 h-3" />
                                        {log.os}
                                      </span>
                                    )}
                                    {log.ip_address && (
                                      <span className="flex items-center gap-1">
                                        <Globe className="w-3 h-3" />
                                        {log.ip_address}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-border/30 bg-muted/20 overflow-hidden"
                                >
                                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground text-xs block mb-1">Browser</span>
                                      <span className="text-foreground">{log.browser || 'Unbekannt'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground text-xs block mb-1">Betriebssystem</span>
                                      <span className="text-foreground">{log.os || 'Unbekannt'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground text-xs block mb-1">Gerätetyp</span>
                                      <span className="text-foreground">{log.device_type || 'Unbekannt'}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground text-xs block mb-1">IP-Adresse</span>
                                      <span className="text-foreground font-mono">{log.ip_address || 'Unbekannt'}</span>
                                    </div>
                                    {log.country && (
                                      <div>
                                        <span className="text-muted-foreground text-xs block mb-1">Standort</span>
                                        <span className="text-foreground">
                                          {[log.city, log.region, log.country].filter(Boolean).join(', ')}
                                        </span>
                                      </div>
                                    )}
                                    {log.details && Object.keys(log.details).length > 0 && (
                                      <div className="col-span-full">
                                        <span className="text-muted-foreground text-xs block mb-1">Details</span>
                                        <div className="flex flex-wrap gap-2">
                                          {Object.entries(log.details).map(([key, value]) => (
                                            <span 
                                              key={key} 
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-xs"
                                            >
                                              <span className="text-muted-foreground">{key}:</span>
                                              <span className="text-foreground">{String(value)}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Lädt...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Keine Sessions gefunden</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {sessions.map((session, index) => {
                  const DeviceIcon = getDeviceIcon(session.device_type);
                  
                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="p-4 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        {/* Status & Device Icon */}
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative",
                          session.is_active ? "bg-green-500/20" : "bg-muted/50"
                        )}>
                          <DeviceIcon className={cn(
                            "w-6 h-6",
                            session.is_active ? "text-green-400" : "text-muted-foreground"
                          )} />
                          {session.is_active && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-foreground">
                                {session.browser || 'Unbekannt'} • {session.os || 'Unbekannt'}
                              </h3>
                              {session.is_active && (
                                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                                  Aktiv
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground text-xs flex-shrink-0">
                              {formatDuration(session.login_at, session.logout_at, session.is_active)}
                            </span>
                          </div>
                          
                          {/* Details */}
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground block">Anmeldung</span>
                              <span className="text-foreground">{formatDate(session.login_at)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Abmeldung</span>
                              <span className="text-foreground">
                                {session.is_active ? (
                                  <span className="text-green-400">Noch aktiv</span>
                                ) : (
                                  formatDate(session.logout_at)
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">IP-Adresse</span>
                              <span className="text-foreground font-mono">{session.ip_address || '-'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Gerätetyp</span>
                              <span className="text-foreground">{session.device_type || 'Desktop'}</span>
                            </div>
                          </div>

                          {/* Location if available */}
                          {session.country && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {[session.city, session.region, session.country].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
