import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  LogIn, 
  LogOut, 
  AlertTriangle, 
  Smartphone, 
  Key,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useSecurityLogs, SecurityLog } from '@/hooks/useSecurityLogs';
import { cn } from '@/lib/utils';

const eventTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  'login_success': { icon: LogIn, color: 'text-green-400', label: 'Login erfolgreich' },
  'login_failed': { icon: AlertTriangle, color: 'text-red-400', label: 'Login fehlgeschlagen' },
  'login_decoy': { icon: Shield, color: 'text-yellow-400', label: 'Tarnmodus aktiviert' },
  'logout': { icon: LogOut, color: 'text-blue-400', label: 'Abgemeldet' },
  'pin_changed': { icon: Key, color: 'text-purple-400', label: 'PIN geändert' },
  'decoy_pin_set': { icon: Shield, color: 'text-orange-400', label: 'Tarn-PIN gesetzt' },
  'new_device': { icon: Smartphone, color: 'text-cyan-400', label: 'Neues Gerät' },
  'recovery_key_generated': { icon: Key, color: 'text-green-400', label: 'Recovery-Key erstellt' },
};

export default function SecurityLogs() {
  const { logs, loading, fetchLogs, clearLogs } = useSecurityLogs();
  const [clearing, setClearing] = useState(false);

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
      color: 'text-white/60', 
      label: eventType 
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Sicherheitsprotokoll</h1>
            <p className="text-white/60 text-sm">{logs.length} Einträge</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleClearLogs}
            disabled={clearing || logs.length === 0}
            className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/50">Lädt...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/50">Keine Protokolleinträge</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((log, index) => {
              const config = getEventConfig(log.event_type);
              const Icon = config.icon;
              
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      config.color.replace('text-', 'bg-').replace('-400', '-500/20')
                    )}>
                      <Icon className={cn("w-5 h-5", config.color)} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-medium text-white">{config.label}</h3>
                        <span className="text-white/40 text-sm flex-shrink-0">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-1 text-sm text-white/50">
                          {Object.entries(log.details).map(([key, value]) => (
                            <span key={key} className="mr-3">
                              {key}: <span className="text-white/70">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {log.user_agent && (
                        <p className="mt-1 text-xs text-white/30 truncate">
                          {log.user_agent}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
