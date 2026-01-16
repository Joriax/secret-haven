import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  LogIn, 
  LogOut, 
  AlertTriangle, 
  Smartphone, 
  Key,
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
  ChevronRight,
  TrendingUp,
  BarChart3,
  Map,
  Download,
  FileText,
  Calendar as CalendarIcon,
  Search,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { SecurityLogsSettings } from '@/components/SecurityLogsSettings';
import { useSecurityLogs } from '@/hooks/useSecurityLogs';

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

const CHART_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function SecurityLogs() {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [quickRange, setQuickRange] = useState('30d');
  const { userId, sessionToken, supabaseClient } = useAuth();
  
  // Use the security logs hook for configurable fetching and deletion
  const {
    logs,
    totalCount,
    loading: logsLoading,
    settings,
    updateSettings,
    fetchLogs,
    clearAllLogs,
    deleteOldLogs
  } = useSecurityLogs();
  
  const loading = logsLoading || sessionsLoading;

  const handleQuickRange = (value: string) => {
    setQuickRange(value);
    const now = new Date();
    switch (value) {
      case '24h':
        setDateRange({ from: subDays(now, 1), to: now });
        break;
      case '7d':
        setDateRange({ from: subDays(now, 7), to: now });
        break;
      case '30d':
        setDateRange({ from: subDays(now, 30), to: now });
        break;
      case '90d':
        setDateRange({ from: subDays(now, 90), to: now });
        break;
      case 'all':
        setDateRange({ from: undefined, to: undefined });
        break;
    }
  };

  // Filter logs by date range
  const dateFilteredLogs = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return logs;
    return logs.filter(log => {
      const logDate = new Date(log.created_at);
      if (dateRange.from && dateRange.to) {
        return isWithinInterval(logDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to)
        });
      }
      return true;
    });
  }, [logs, dateRange]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Datum', 'Uhrzeit', 'Event', 'IP-Adresse', 'Land', 'Stadt', 'Region', 'Gerät', 'Browser', 'OS'];
    const exportLogs = filter === 'all' ? dateFilteredLogs : dateFilteredLogs.filter(log => filterEventTypes[filter].includes(log.event_type));
    
    const rows = exportLogs.map(log => [
      format(new Date(log.created_at), 'dd.MM.yyyy'),
      format(new Date(log.created_at), 'HH:mm:ss'),
      eventTypeConfig[log.event_type]?.label || log.event_type,
      log.ip_address || '',
      log.country || '',
      log.city || '',
      log.region || '',
      log.device_type || '',
      log.browser || '',
      log.os || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `security-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to PDF (opens print dialog)
  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateRangeText = dateRange.from && dateRange.to 
      ? `${format(dateRange.from, 'dd.MM.yyyy', { locale: de })} - ${format(dateRange.to, 'dd.MM.yyyy', { locale: de })}`
      : 'Alle Zeiträume';

    const exportLogs = filter === 'all' ? dateFilteredLogs : dateFilteredLogs.filter(log => filterEventTypes[filter].includes(log.event_type));

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Security Logs Export</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #333; }
          h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
          h2 { color: #374151; margin-top: 30px; }
          .meta { color: #6b7280; margin-bottom: 30px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .stat-card { background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; }
          .stat-value.success { color: #22c55e; }
          .stat-value.failed { color: #ef4444; }
          .stat-value.sessions { color: #3b82f6; }
          .stat-value.security { color: #8b5cf6; }
          .stat-label { color: #6b7280; font-size: 12px; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
          th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f9fafb; font-weight: 600; color: #374151; }
          tr:nth-child(even) { background: #fafafa; }
          .badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; display: inline-block; }
          .badge.success { background: #dcfce7; color: #166534; }
          .badge.failed { background: #fee2e2; color: #991b1b; }
          .badge.warning { background: #fef3c7; color: #92400e; }
          .badge.info { background: #dbeafe; color: #1e40af; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>🔐 Security Logs Report</h1>
        <div class="meta">
          <p><strong>Zeitraum:</strong> ${dateRangeText}</p>
          <p><strong>Filter:</strong> ${filterOptions.find(f => f.value === filter)?.label || 'Alle'}</p>
          <p><strong>Erstellt am:</strong> ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
          <p><strong>Anzahl Events:</strong> ${exportLogs.length}</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value success">${exportLogs.filter(l => l.event_type === 'login_success').length}</div>
            <div class="stat-label">Erfolgreiche Logins</div>
          </div>
          <div class="stat-card">
            <div class="stat-value failed">${exportLogs.filter(l => l.event_type === 'login_failed').length}</div>
            <div class="stat-label">Fehlgeschlagene Logins</div>
          </div>
          <div class="stat-card">
            <div class="stat-value sessions">${sessions.filter(s => s.is_active).length}</div>
            <div class="stat-label">Aktive Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-value security">${exportLogs.filter(l => ['pin_changed', 'decoy_pin_set', 'recovery_key_generated'].includes(l.event_type)).length}</div>
            <div class="stat-label">Sicherheits-Events</div>
          </div>
        </div>

        <h2>📋 Event Log</h2>
        <table>
          <tr>
            <th>Datum</th>
            <th>Uhrzeit</th>
            <th>Event</th>
            <th>IP-Adresse</th>
            <th>Standort</th>
            <th>Gerät</th>
            <th>Browser</th>
          </tr>
          ${exportLogs.slice(0, 200).map(log => {
            const badgeClass = log.event_type === 'login_success' ? 'success' : 
                              log.event_type === 'login_failed' ? 'failed' : 
                              log.event_type === 'decoy_login' ? 'warning' : 'info';
            return `
              <tr>
                <td>${format(new Date(log.created_at), 'dd.MM.yyyy')}</td>
                <td>${format(new Date(log.created_at), 'HH:mm:ss')}</td>
                <td><span class="badge ${badgeClass}">${eventTypeConfig[log.event_type]?.label || log.event_type}</span></td>
                <td>${log.ip_address || '-'}</td>
                <td>${log.city ? `${log.city}, ${log.country}` : (log.country || '-')}</td>
                <td>${log.device_type || '-'}</td>
                <td>${log.browser || '-'}</td>
              </tr>
            `;
          }).join('')}
        </table>
        ${exportLogs.length > 200 ? `<p style="color: #6b7280; margin-top: 10px; text-align: center;">... und ${exportLogs.length - 200} weitere Einträge</p>` : ''}

        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Fetch sessions separately (logs are handled by useSecurityLogs hook)
  const fetchSessions = useCallback(async () => {
    if (!userId || !sessionToken) return;
    setSessionsLoading(true);
    
    try {
      const { data: sessionsData, error: sessionsError } = await supabaseClient
        .from('session_history')
        .select('*')
        .eq('user_id', userId)
        .order('login_at', { ascending: false })
        .limit(50);

      if (sessionsError) throw sessionsError;
      setSessions(sessionsData || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Fehler beim Laden der Sessions');
    } finally {
      setSessionsLoading(false);
    }
  }, [userId, sessionToken, supabaseClient]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);
  
  // Refresh all data
  const refreshData = useCallback(() => {
    fetchLogs();
    fetchSessions();
  }, [fetchLogs, fetchSessions]);
  
  // Handle limit change
  const handleLimitChange = useCallback((limit: number) => {
    updateSettings({ displayLimit: limit });
    fetchLogs(limit);
  }, [updateSettings, fetchLogs]);

  // Calculate statistics
  const statistics = useMemo(() => {
    // Login trends - last 14 days
    const now = new Date();
    const loginTrend = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (13 - i));
      const dateStr = date.toISOString().split('T')[0];
      const dayLogs = logs.filter(l => l.created_at.startsWith(dateStr));
      
      return {
        date: date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' }),
        success: dayLogs.filter(l => l.event_type === 'login_success').length,
        failed: dayLogs.filter(l => l.event_type === 'login_failed').length,
        total: dayLogs.length
      };
    });

    // Country stats
    const countryMap: Record<string, number> = {};
    logs.forEach(log => {
      if (log.country) {
        countryMap[log.country] = (countryMap[log.country] || 0) + 1;
      }
    });
    const countryStats = Object.entries(countryMap)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // City stats
    const cityMap: Record<string, { count: number; country: string }> = {};
    logs.forEach(log => {
      if (log.city) {
        const key = log.city;
        if (cityMap[key]) {
          cityMap[key].count++;
        } else {
          cityMap[key] = { count: 1, country: log.country || '' };
        }
      }
    });
    const cityStats = Object.entries(cityMap)
      .map(([city, data]) => ({ city, count: data.count, country: data.country }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Event type distribution
    const eventMap: Record<string, number> = {};
    logs.forEach(log => {
      eventMap[log.event_type] = (eventMap[log.event_type] || 0) + 1;
    });
    const eventStats = Object.entries(eventMap)
      .map(([type, count]) => ({
        type,
        label: eventTypeConfig[type]?.label || type,
        count,
        color: eventTypeConfig[type]?.color || 'text-muted-foreground'
      }))
      .sort((a, b) => b.count - a.count);

    // Browser stats
    const browserMap: Record<string, number> = {};
    logs.forEach(log => {
      if (log.browser) {
        browserMap[log.browser] = (browserMap[log.browser] || 0) + 1;
      }
    });
    const browserStats = Object.entries(browserMap)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Device type stats
    const deviceMap: Record<string, number> = {};
    logs.forEach(log => {
      const device = log.device_type || 'Desktop';
      deviceMap[device] = (deviceMap[device] || 0) + 1;
    });
    const deviceStats = Object.entries(deviceMap)
      .map(([device, count]) => ({ device, count }))
      .sort((a, b) => b.count - a.count);

    // Hourly activity (last 7 days)
    const hourlyMap: Record<number, number> = {};
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    logs.filter(l => new Date(l.created_at) >= sevenDaysAgo).forEach(log => {
      const hour = new Date(log.created_at).getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
    });
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      count: hourlyMap[hour] || 0
    }));

    return {
      loginTrend,
      countryStats,
      cityStats,
      eventStats,
      browserStats,
      deviceStats,
      hourlyStats
    };
  }, [logs]);

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

  // Apply search filter
  const searchFilteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return dateFilteredLogs;
    
    const query = searchQuery.toLowerCase().trim();
    return dateFilteredLogs.filter(log => {
      // Search in event type label
      const eventLabel = eventTypeConfig[log.event_type]?.label?.toLowerCase() || log.event_type.toLowerCase();
      if (eventLabel.includes(query)) return true;
      
      // Search in IP address
      if (log.ip_address?.toLowerCase().includes(query)) return true;
      
      // Search in location
      if (log.city?.toLowerCase().includes(query)) return true;
      if (log.country?.toLowerCase().includes(query)) return true;
      if (log.region?.toLowerCase().includes(query)) return true;
      
      // Search in browser/OS/device
      if (log.browser?.toLowerCase().includes(query)) return true;
      if (log.os?.toLowerCase().includes(query)) return true;
      if (log.device_type?.toLowerCase().includes(query)) return true;
      
      return false;
    });
  }, [dateFilteredLogs, searchQuery]);

  const filteredLogs = filter === 'all' 
    ? searchFilteredLogs 
    : searchFilteredLogs.filter(log => filterEventTypes[filter].includes(log.event_type));

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

  const chartConfig = {
    success: { label: 'Erfolgreich', color: '#22c55e' },
    failed: { label: 'Fehlgeschlagen', color: '#ef4444' },
    total: { label: 'Gesamt', color: '#3b82f6' },
    count: { label: 'Anzahl', color: 'hsl(var(--primary))' }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Sicherheit</h1>
              <p className="text-muted-foreground text-sm">
                {filteredLogs.length} Events 
                {dateRange.from && dateRange.to && ` (${format(dateRange.from, 'dd.MM', { locale: de })} - ${format(dateRange.to, 'dd.MM.yy', { locale: de })})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SecurityLogsSettings
              displayLimit={settings.displayLimit}
              totalCount={totalCount}
              onLimitChange={handleLimitChange}
              onDeleteAll={clearAllLogs}
              onDeleteOld={deleteOldLogs}
              onRefresh={refreshData}
            />
            <button
              onClick={refreshData}
              disabled={loading}
              className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Export & Date Range Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Range Select */}
          <Select value={quickRange} onValueChange={handleQuickRange}>
            <SelectTrigger className="w-28 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 Stunden</SelectItem>
              <SelectItem value="7d">7 Tage</SelectItem>
              <SelectItem value="30d">30 Tage</SelectItem>
              <SelectItem value="90d">90 Tage</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd.MM.yy", { locale: de })} - {format(dateRange.to, "dd.MM.yy", { locale: de })}
                    </>
                  ) : (
                    format(dateRange.from, "dd.MM.yyyy", { locale: de })
                  )
                ) : (
                  "Zeitraum"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  setDateRange({ from: range?.from, to: range?.to });
                  setQuickRange('custom');
                }}
                numberOfMonths={2}
                locale={de}
              />
            </PopoverContent>
          </Popover>

          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Suchen: Event, IP, Standort..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Export Buttons */}
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-2">
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
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
      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Statistiken
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Protokolle ({filteredLogs.length})
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Sessions ({sessions.length})
          </TabsTrigger>
        </TabsList>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-6">
          {/* Login Trend Chart */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Login-Trend</h3>
                <p className="text-xs text-muted-foreground">Letzte 14 Tage</p>
              </div>
            </div>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <AreaChart data={statistics.loginTrend}>
                <defs>
                  <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area 
                  type="monotone" 
                  dataKey="success" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  fill="url(#successGradient)" 
                  name="Erfolgreich"
                />
                <Area 
                  type="monotone" 
                  dataKey="failed" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fill="url(#failedGradient)" 
                  name="Fehlgeschlagen"
                />
              </AreaChart>
            </ChartContainer>
          </div>

          {/* Location Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Country Heatmap */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Logins nach Land</h3>
                  <p className="text-xs text-muted-foreground">Geografische Verteilung</p>
                </div>
              </div>
              {statistics.countryStats.length > 0 ? (
                <div className="space-y-3">
                  {statistics.countryStats.map((stat, index) => {
                    const maxCount = Math.max(...statistics.countryStats.map(s => s.count));
                    const percentage = (stat.count / maxCount) * 100;
                    return (
                      <div key={stat.country} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground flex items-center gap-2">
                            <span className="text-lg">{getCountryFlag(stat.country)}</span>
                            {stat.country}
                          </span>
                          <span className="text-muted-foreground font-medium">{stat.count}</span>
                        </div>
                        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Keine Standortdaten verfügbar</p>
                </div>
              )}
            </div>

            {/* City Heatmap */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Map className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Logins nach Stadt</h3>
                  <p className="text-xs text-muted-foreground">Top 10 Standorte</p>
                </div>
              </div>
              {statistics.cityStats.length > 0 ? (
                <div className="space-y-3">
                  {statistics.cityStats.map((stat, index) => {
                    const maxCount = Math.max(...statistics.cityStats.map(s => s.count));
                    const percentage = (stat.count / maxCount) * 100;
                    return (
                      <div key={stat.city} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {stat.city}
                            {stat.country && (
                              <span className="text-xs text-muted-foreground">({stat.country})</span>
                            )}
                          </span>
                          <span className="text-muted-foreground font-medium">{stat.count}</span>
                        </div>
                        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: CHART_COLORS[(index + 2) % CHART_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Keine Stadtdaten verfügbar</p>
                </div>
              )}
            </div>
          </div>

          {/* Hourly Activity & Device Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Activity */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Aktivität nach Uhrzeit</h3>
                  <p className="text-xs text-muted-foreground">Letzte 7 Tage</p>
                </div>
              </div>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={statistics.hourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="hour" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval={3}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Aktivitäten"
                  />
                </BarChart>
              </ChartContainer>
            </div>

            {/* Device & Browser Stats */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Geräte & Browser</h3>
                  <p className="text-xs text-muted-foreground">Verteilung</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Devices */}
                <div>
                  <h4 className="text-xs text-muted-foreground mb-3">Gerätetypen</h4>
                  <div className="space-y-2">
                    {statistics.deviceStats.map((stat, index) => {
                      const DeviceIcon = getDeviceIcon(stat.device);
                      return (
                        <div key={stat.device} className="flex items-center gap-2 text-sm">
                          <DeviceIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground flex-1">{stat.device}</span>
                          <span 
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ 
                              backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}20`,
                              color: CHART_COLORS[index % CHART_COLORS.length]
                            }}
                          >
                            {stat.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Browsers */}
                <div>
                  <h4 className="text-xs text-muted-foreground mb-3">Browser</h4>
                  <div className="space-y-2">
                    {statistics.browserStats.map((stat, index) => (
                      <div key={stat.browser} className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground flex-1 truncate">{stat.browser}</span>
                        <span 
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: `${CHART_COLORS[(index + 3) % CHART_COLORS.length]}20`,
                            color: CHART_COLORS[(index + 3) % CHART_COLORS.length]
                          }}
                        >
                          {stat.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Event Type Distribution */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Ereignistypen</h3>
                <p className="text-xs text-muted-foreground">Verteilung aller Protokolleinträge</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {statistics.eventStats.map((stat, index) => {
                const config = eventTypeConfig[stat.type];
                const Icon = config?.icon || Shield;
                return (
                  <motion.div
                    key={stat.type}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "p-3 rounded-xl border border-border/30",
                      config?.bgColor || "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={cn("w-4 h-4", config?.color || "text-muted-foreground")} />
                      <span className="text-2xl font-bold text-foreground">{stat.count}</span>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1">{stat.label}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </TabsContent>

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

// Helper function to get country flag emoji
function getCountryFlag(countryName: string): string {
  const countryToCode: Record<string, string> = {
    'Germany': 'DE',
    'Deutschland': 'DE',
    'United States': 'US',
    'USA': 'US',
    'United Kingdom': 'GB',
    'France': 'FR',
    'Italy': 'IT',
    'Spain': 'ES',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Austria': 'AT',
    'Switzerland': 'CH',
    'Poland': 'PL',
    'Czech Republic': 'CZ',
    'Sweden': 'SE',
    'Norway': 'NO',
    'Denmark': 'DK',
    'Finland': 'FI',
    'Portugal': 'PT',
    'Ireland': 'IE',
    'Canada': 'CA',
    'Australia': 'AU',
    'Japan': 'JP',
    'China': 'CN',
    'India': 'IN',
    'Brazil': 'BR',
    'Russia': 'RU',
    'South Korea': 'KR',
    'Mexico': 'MX',
    'Argentina': 'AR',
  };
  
  const code = countryToCode[countryName] || countryName.slice(0, 2).toUpperCase();
  
  // Convert country code to flag emoji
  const codePoints = [...code.toUpperCase()].map(
    char => 127397 + char.charCodeAt(0)
  );
  
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌍';
  }
}
