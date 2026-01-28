import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  MapPin,
  Monitor,
  Smartphone,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  Download,
  RefreshCw,
  Calendar,
  FileText,
  Printer
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { downloadPDF, generatePrivacyReportPDF } from '@/lib/pdfExport';
import { toast } from 'sonner';

interface SecurityLog {
  id: string;
  user_id: string;
  event_type: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
  device_type: string | null;
  details: Record<string, any> | null;
}

interface Stats {
  totalLogins: number;
  failedAttempts: number;
  uniqueLocations: number;
  uniqueDevices: number;
  lastLogin: string | null;
  suspiciousEvents: number;
}

type TimeRange = '7d' | '30d' | '90d';

export default function PrivacyReport() {
  const { userId } = useAuth();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const fetchLogs = async () => {
    if (!userId) return;
    setIsLoading(true);

    const daysMap: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const sinceDate = subDays(new Date(), daysMap[timeRange]);

    const { data, error } = await supabase
      .from('security_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLogs(data as SecurityLog[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [userId, timeRange]);

  // Calculate statistics
  const stats = useMemo((): Stats => {
    const logins = logs.filter(l => l.event_type.includes('login'));
    const failed = logs.filter(l => l.event_type === 'login_failed');
    const locations = new Set(logs.filter(l => l.country).map(l => `${l.city || ''}-${l.country}`));
    const devices = new Set(logs.filter(l => l.device_type).map(l => l.device_type));
    const suspicious = logs.filter(l => 
      l.event_type === 'login_failed' || 
      l.event_type === 'suspicious_activity' ||
      l.event_type === 'login_decoy'
    );

    return {
      totalLogins: logins.length,
      failedAttempts: failed.length,
      uniqueLocations: locations.size,
      uniqueDevices: devices.size,
      lastLogin: logins[0]?.created_at || null,
      suspiciousEvents: suspicious.length
    };
  }, [logs]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups: Record<string, SecurityLog[]> = {};
    
    logs.forEach(log => {
      const date = format(new Date(log.created_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });

    return Object.entries(groups).slice(0, 7); // Last 7 days with activity
  }, [logs]);

  // Security score
  const securityScore = useMemo(() => {
    let score = 100;
    
    // Deduct for failed attempts
    score -= Math.min(stats.failedAttempts * 5, 30);
    
    // Deduct for suspicious events
    score -= Math.min(stats.suspiciousEvents * 10, 40);
    
    // Deduct for many unique locations (could indicate compromise)
    if (stats.uniqueLocations > 5) score -= 10;
    
    return Math.max(score, 0);
  }, [stats]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'login_success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'login_failed':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'login_decoy':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'logout':
        return <Unlock className="w-4 h-4 text-muted-foreground" />;
      case 'pin_changed':
        return <Lock className="w-4 h-4 text-primary" />;
      default:
        return <Eye className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      'login_success': 'Erfolgreiche Anmeldung',
      'login_failed': 'Fehlgeschlagene Anmeldung',
      'login_decoy': 'Tarn-PIN verwendet',
      'logout': 'Abmeldung',
      'pin_changed': 'PIN geändert',
      'recovery_used': 'Recovery-Key verwendet',
      'biometric_enabled': 'Biometrie aktiviert',
      'biometric_disabled': 'Biometrie deaktiviert',
    };
    return labels[eventType] || eventType;
  };

  const exportJSON = () => {
    const report = {
      generated_at: new Date().toISOString(),
      time_range: timeRange,
      stats,
      security_score: securityScore,
      events: logs.map(l => ({
        timestamp: l.created_at,
        event: l.event_type,
        location: [l.city, l.country].filter(Boolean).join(', '),
        device: l.device_type,
        ip: l.ip_address
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privacy-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('JSON-Bericht exportiert');
  };

  const exportPDF = () => {
    const recentEvents = logs.slice(0, 20).map(l => ({
      type: getEventLabel(l.event_type),
      date: format(new Date(l.created_at), 'dd.MM.yyyy HH:mm', { locale: de }),
      location: [l.city, l.country].filter(Boolean).join(', ')
    }));

    const pdfDoc = generatePrivacyReportPDF(stats, securityScore, recentEvents);
    downloadPDF(pdfDoc, `datenschutz-bericht-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF-Bericht wird generiert...');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      <PageHeader
        title="Datenschutz-Bericht"
        subtitle="Übersicht deiner Sicherheitsaktivitäten"
        icon={<Shield className="w-5 h-5 text-primary" />}
        backTo="/dashboard"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
              title="Als PDF exportieren"
            >
              <Printer className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={exportJSON}
              className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-xl hover:bg-muted/80 transition-colors"
              title="Als JSON exportieren"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Time Range Selector */}
      <div className="flex items-center gap-2 p-1 bg-muted rounded-xl w-fit">
        {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              timeRange === range
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {range === '7d' && 'Letzte 7 Tage'}
            {range === '30d' && 'Letzte 30 Tage'}
            {range === '90d' && 'Letzte 90 Tage'}
          </button>
        ))}
      </div>

      {/* Security Score */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <svg className="w-32 h-32 -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(securityScore / 100) * 352} 352`}
                className={cn(
                  securityScore >= 80 ? "text-green-500" :
                  securityScore >= 50 ? "text-yellow-500" : "text-destructive"
                )}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn(
                "text-3xl font-bold",
                securityScore >= 80 ? "text-green-500" :
                securityScore >= 50 ? "text-yellow-500" : "text-destructive"
              )}>
                {securityScore}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground mb-2">Sicherheitsbewertung</h2>
            <p className="text-muted-foreground mb-4">
              {securityScore >= 80 
                ? "Dein Konto ist gut geschützt. Keine verdächtigen Aktivitäten erkannt."
                : securityScore >= 50
                  ? "Es wurden einige auffällige Aktivitäten erkannt. Überprüfe die Details unten."
                  : "Achtung! Es wurden mehrere verdächtige Aktivitäten festgestellt."
              }
            </p>
            {stats.suspiciousEvents > 0 && (
              <div className="flex items-center gap-2 text-sm text-yellow-500">
                <AlertTriangle className="w-4 h-4" />
                {stats.suspiciousEvents} verdächtige Ereignis{stats.suspiciousEvents !== 1 ? 'se' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalLogins}</p>
          <p className="text-sm text-muted-foreground">Anmeldungen</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.failedAttempts}</p>
          <p className="text-sm text-muted-foreground">Fehlversuche</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.uniqueLocations}</p>
          <p className="text-sm text-muted-foreground">Standorte</p>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-cyan-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.uniqueDevices}</p>
          <p className="text-sm text-muted-foreground">Geräte</p>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Aktivitäts-Zeitleiste
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : groupedLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Keine Aktivitäten im gewählten Zeitraum
          </p>
        ) : (
          <div className="space-y-6">
            {groupedLogs.map(([date, dayLogs]) => (
              <div key={date}>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  {format(new Date(date), 'EEEE, d. MMMM yyyy', { locale: de })}
                </h4>
                <div className="space-y-2">
                  {dayLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
                    >
                      {getEventIcon(log.event_type)}
                      
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground">
                          {getEventLabel(log.event_type)}
                        </span>
                        {(log.city || log.country) && (
                          <span className="text-xs text-muted-foreground ml-2">
                            • {[log.city, log.country].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'HH:mm', { locale: de })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Tips */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Sicherheitstipps</h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            Ändere deinen PIN regelmäßig und verwende keine einfachen Kombinationen
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            Aktiviere biometrische Authentifizierung für zusätzliche Sicherheit
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            Überprüfe regelmäßig deine aktiven Sessions und beende unbekannte Geräte
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            Speichere deinen Recovery-Key sicher an einem externen Ort
          </li>
        </ul>
      </div>
    </motion.div>
  );
}
