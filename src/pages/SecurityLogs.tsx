import React, { useState, useEffect } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { useSecurityLogs, SecurityLog } from '@/hooks/useSecurityLogs';
import { cn } from '@/lib/utils';

const eventTypeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  'login_success': { icon: LogIn, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Login erfolgreich' },
  'login_failed': { icon: AlertTriangle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Login fehlgeschlagen' },
  'login_decoy': { icon: Shield, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Tarnmodus aktiviert' },
  'login_recovery': { icon: Key, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', label: 'Recovery-Login' },
  'logout': { icon: LogOut, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Abgemeldet' },
  'pin_changed': { icon: Key, color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: 'PIN geändert' },
  'decoy_pin_set': { icon: Shield, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: 'Tarn-PIN gesetzt' },
  'new_device': { icon: Smartphone, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', label: 'Neues Gerät' },
  'recovery_key_generated': { icon: Key, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Recovery-Key erstellt' },
  'backup_created': { icon: Monitor, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Backup erstellt' },
  'note_encrypted': { icon: Shield, color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: 'Notiz verschlüsselt' },
  'note_decrypted': { icon: Shield, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Notiz entschlüsselt' },
  'item_deleted': { icon: Trash2, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Element gelöscht' },
  'item_restored': { icon: RefreshCw, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Element wiederhergestellt' },
};

type FilterType = 'all' | 'login' | 'security' | 'data';

const filterOptions: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'login', label: 'Login-Aktivität' },
  { value: 'security', label: 'Sicherheit' },
  { value: 'data', label: 'Daten' },
];

const filterEventTypes: Record<FilterType, string[]> = {
  all: [],
  login: ['login_success', 'login_failed', 'login_decoy', 'login_recovery', 'logout', 'new_device'],
  security: ['pin_changed', 'decoy_pin_set', 'recovery_key_generated', 'note_encrypted', 'note_decrypted'],
  data: ['backup_created', 'item_deleted', 'item_restored'],
};

export default function SecurityLogs() {
  const { logs, loading, fetchLogs, clearLogs } = useSecurityLogs();
  const [clearing, setClearing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const handleClearLogs = async () => {
    if (!confirm('Alle Sicherheitsprotokolle löschen?')) return;
    
    setClearing(true);
    await clearLogs();
    setClearing(false);
  };

  const formatDate = (dateString: string) => {
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

  const getEventConfig = (eventType: string) => {
    return eventTypeConfig[eventType] || { 
      icon: Shield, 
      color: 'text-muted-foreground', 
      bgColor: 'bg-muted/50',
      label: eventType 
    };
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return null;
    
    let browser = 'Unbekannt';
    let os = 'Unbekannt';
    
    // Detect browser
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    
    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('iPhone')) os = 'iPhone';
    else if (ua.includes('iPad')) os = 'iPad';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';
    
    return { browser, os };
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
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Sicherheitsprotokoll</h1>
            <p className="text-muted-foreground text-sm">{logs.length} Einträge</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Button */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">{filterOptions.find(f => f.value === filter)?.label}</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", showFilterMenu && "rotate-180")} />
            </button>
            
            <AnimatePresence>
              {showFilterMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-48 glass-card p-2 z-50"
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
          
          <button
            onClick={() => fetchLogs()}
            className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleClearLogs}
            disabled={clearing || logs.length === 0}
            className="p-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-foreground">{stats.total}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Gesamt</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-green-400">{stats.successLogins}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Erfolgreiche Logins</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-red-400">{stats.failedLogins}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Fehlgeschlagen</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-purple-400">{stats.securityEvents}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Sicherheit</div>
        </div>
      </div>

      {/* Logs */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Lädt...</div>
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
                <div className="px-4 py-2 bg-muted/30 sticky top-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{date}</span>
                    <span className="text-xs">({dateLogs.length})</span>
                  </div>
                </div>
                
                {/* Logs for this date */}
                <div className="divide-y divide-border/30">
                  {dateLogs.map((log, index) => {
                    const config = getEventConfig(log.event_type);
                    const Icon = config.icon;
                    const deviceInfo = parseUserAgent(log.user_agent);
                    
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="p-4 hover:bg-muted/20 transition-colors"
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
                              <h3 className="font-medium text-foreground">{config.label}</h3>
                              <span className="text-muted-foreground text-sm flex-shrink-0">
                                {formatDate(log.created_at)}
                              </span>
                            </div>
                            
                            {/* Details */}
                            {log.details && Object.keys(log.details).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-2">
                                {Object.entries(log.details).map(([key, value]) => (
                                  <span 
                                    key={key} 
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 text-xs text-muted-foreground"
                                  >
                                    <span className="font-medium">{key}:</span>
                                    <span>{String(value)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {/* Device info */}
                            {deviceInfo && (
                              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Monitor className="w-3 h-3" />
                                  {deviceInfo.browser}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Smartphone className="w-3 h-3" />
                                  {deviceInfo.os}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}