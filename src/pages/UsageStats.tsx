import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Clock, 
  FileText, 
  Image, 
  FolderOpen, 
  Link2, 
  Play, 
  Lock,
  Activity,
  Loader2,
  RefreshCw,
  PieChart,
  HardDrive,
  TrendingDown
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, subDays, eachDayOfInterval, startOfDay, addMonths, differenceInMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, LineChart, Line } from 'recharts';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { useStorageAnalysis, formatBytes } from '@/hooks/useStorageAnalysis';

interface UsageStat {
  feature: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  fill: string;
}

interface DailyActivity {
  date: string;
  count: number;
}

const chartConfig: ChartConfig = {
  notes: { label: 'Notizen', color: 'hsl(var(--primary))' },
  photos: { label: 'Fotos', color: 'hsl(330, 80%, 60%)' },
  files: { label: 'Dateien', color: 'hsl(210, 80%, 60%)' },
  links: { label: 'Links', color: 'hsl(30, 80%, 60%)' },
  tiktoks: { label: 'TikToks', color: 'hsl(280, 80%, 60%)' },
  secrets: { label: 'Geheimnisse', color: 'hsl(0, 80%, 60%)' },
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(330, 80%, 60%)',
  'hsl(210, 80%, 60%)',
  'hsl(30, 80%, 60%)',
  'hsl(280, 80%, 60%)',
  'hsl(0, 80%, 60%)',
];

export default function UsageStats() {
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loginCount, setLoginCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { userId, sessionToken, supabaseClient: supabase } = useAuth();
  const { data: storageData, analyze: analyzeStorage, isLoading: storageLoading } = useStorageAnalysis();

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const [
        notesRes, photosRes, filesRes, linksRes, tiktoksRes, secretsRes,
        logsRes, viewsRes
      ] = await Promise.all([
        supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('files').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('links').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('tiktok_videos').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('secret_texts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        // Security logs are fetched via backend function (no direct DB SELECT on sensitive table)
        sessionToken
          ? supabase.functions.invoke('verify-pin', {
              body: { action: 'get-security-logs', sessionToken, limit: 1000, offset: 0 },
            })
          : Promise.resolve({ data: { success: true, logs: [] } } as any),
        supabase.from('view_history').select('id, viewed_at').eq('user_id', userId),
      ]);

      const notesCount = notesRes.count || 0;
      const photosCount = photosRes.count || 0;
      const filesCount = filesRes.count || 0;
      const linksCount = linksRes.count || 0;
      const tiktoksCount = tiktoksRes.count || 0;
      const secretsCount = secretsRes.count || 0;

      const total = notesCount + photosCount + filesCount + linksCount + tiktoksCount + secretsCount;
      setTotalItems(total);

      const logs = (logsRes as any)?.data?.logs || [];
      const logins = logs.filter((l: any) => l.event_type === 'login').length;
      setLoginCount(logins);

      const featureStats: UsageStat[] = [
        { feature: 'Notizen', count: notesCount, icon: <FileText className="w-5 h-5" />, color: 'text-primary bg-primary/20', fill: PIE_COLORS[0] },
        { feature: 'Fotos', count: photosCount, icon: <Image className="w-5 h-5" />, color: 'text-pink-400 bg-pink-500/20', fill: PIE_COLORS[1] },
        { feature: 'Dateien', count: filesCount, icon: <FolderOpen className="w-5 h-5" />, color: 'text-blue-400 bg-blue-500/20', fill: PIE_COLORS[2] },
        { feature: 'Links', count: linksCount, icon: <Link2 className="w-5 h-5" />, color: 'text-orange-400 bg-orange-500/20', fill: PIE_COLORS[3] },
        { feature: 'TikToks', count: tiktoksCount, icon: <Play className="w-5 h-5" />, color: 'text-purple-400 bg-purple-500/20', fill: PIE_COLORS[4] },
        { feature: 'Geheimnisse', count: secretsCount, icon: <Lock className="w-5 h-5" />, color: 'text-red-400 bg-red-500/20', fill: PIE_COLORS[5] },
      ].sort((a, b) => b.count - a.count);

      setStats(featureStats);

      const last30Days = eachDayOfInterval({
        start: subDays(new Date(), 29),
        end: new Date()
      });

      const views = viewsRes.data || [];

      // Create heatmap data for the whole year
      const heatmap: { date: string; count: number }[] = [];
      const allDates = new Map<string, number>();
      
      logs.forEach((l: any) => {
        const dateStr = format(new Date(l.created_at), 'yyyy-MM-dd');
        allDates.set(dateStr, (allDates.get(dateStr) || 0) + 1);
      });
      
      views.forEach(v => {
        const dateStr = format(new Date(v.viewed_at), 'yyyy-MM-dd');
        allDates.set(dateStr, (allDates.get(dateStr) || 0) + 1);
      });
      
      allDates.forEach((count, date) => {
        heatmap.push({ date, count });
      });
      
      setHeatmapData(heatmap);

      const dailyData = last30Days.map(date => {
        const dayStart = startOfDay(date);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const logCount = logs.filter((l: any) => {
          const logDate = new Date(l.created_at);
          return logDate >= dayStart && logDate < dayEnd;
        }).length;

        const viewCount = views.filter(v => {
          const viewDate = new Date(v.viewed_at);
          return viewDate >= dayStart && viewDate < dayEnd;
        }).length;

        return {
          date: format(date, 'dd.MM', { locale: de }),
          count: logCount + viewCount
        };
      });

      setDailyActivity(dailyData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, sessionToken, supabase]);

  useEffect(() => {
    fetchStats();
    analyzeStorage();
  }, [fetchStats, analyzeStorage]);

  // Storage prediction
  const storagePrediction = useMemo(() => {
    if (!storageData || storageData.byMonth.length < 2) return null;
    
    const months = storageData.byMonth;
    if (months.length < 2) return null;
    
    // Calculate average monthly growth
    let totalGrowth = 0;
    for (let i = 1; i < months.length; i++) {
      totalGrowth += months[i].totalSize;
    }
    const avgMonthlyGrowth = totalGrowth / months.length;
    
    // Estimate when storage might become concerning (assuming 1GB soft limit)
    const softLimit = 1024 * 1024 * 1024; // 1GB
    const currentUsage = storageData.totalSize;
    const remainingSpace = softLimit - currentUsage;
    
    if (avgMonthlyGrowth <= 0) return { months: null, usage: currentUsage, limit: softLimit };
    
    const monthsUntilFull = Math.floor(remainingSpace / avgMonthlyGrowth);
    
    return {
      months: monthsUntilFull > 0 ? monthsUntilFull : 0,
      usage: currentUsage,
      limit: softLimit,
      avgGrowth: avgMonthlyGrowth
    };
  }, [storageData]);

  const maxFeature = Math.max(...stats.map(s => s.count), 1);
  const pieData = stats.filter(s => s.count > 0).map(s => ({ name: s.feature, value: s.count, fill: s.fill }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title="Nutzungsstatistiken"
        subtitle="Übersicht deiner Vault-Nutzung"
        icon={<BarChart3 className="w-5 h-5 text-primary" />}
        backTo="/dashboard"
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalItems}</p>
              <p className="text-sm text-muted-foreground">Gesamt Elemente</p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{loginCount}</p>
              <p className="text-sm text-muted-foreground">Anmeldungen</p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {dailyActivity.reduce((sum, d) => sum + d.count, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Aktionen (30 Tage)</p>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {Math.round(dailyActivity.reduce((sum, d) => sum + d.count, 0) / 30)}
              </p>
              <p className="text-sm text-muted-foreground">Ø Aktionen/Tag</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Feature Usage Bar Chart */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Feature-Nutzung</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchStats}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-4"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      stat.color
                    )}>
                      {stat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{stat.feature}</span>
                        <span className="text-sm text-muted-foreground">{stat.count}</span>
                      </div>
                      <Progress 
                        value={(stat.count / maxFeature) * 100} 
                        className="h-2"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Pie Chart */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <PieChart className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Verteilung</h2>
              </div>

              {pieData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-64">
                  <RechartsPie>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </RechartsPie>
                </ChartContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Keine Daten vorhanden
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GitHub-style Heatmap */}
          <ActivityHeatmap 
            data={heatmapData}
            title="Aktivitäts-Heatmap"
            activeText="Aktionen"
            emptyText="Keine Aktivität"
          />

          {/* Storage Prediction */}
          {storagePrediction && (
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <HardDrive className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Speicher-Vorhersage</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Aktueller Verbrauch</span>
                  <span className="font-medium">{formatBytes(storagePrediction.usage)}</span>
                </div>
                
                <Progress 
                  value={(storagePrediction.usage / storagePrediction.limit) * 100} 
                  className="h-3"
                />
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>0 MB</span>
                  <span>{formatBytes(storagePrediction.limit)}</span>
                </div>

                {storagePrediction.avgGrowth && storagePrediction.avgGrowth > 0 && (
                  <div className="mt-4 p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      {storagePrediction.months && storagePrediction.months > 12 ? (
                        <TrendingDown className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-yellow-500" />
                      )}
                      <span className="font-medium text-sm">Prognose</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Bei durchschnittlich {formatBytes(storagePrediction.avgGrowth)} pro Monat 
                      {storagePrediction.months !== null && storagePrediction.months > 0 ? (
                        <> erreichst du das Limit in ca. <strong>{storagePrediction.months} Monaten</strong>.</>
                      ) : (
                        <> ist dein Speicher sehr sparsam genutzt.</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity Chart */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Tägliche Aktivität (30 Tage)</h2>
            </div>

            <ChartContainer config={chartConfig} className="h-48">
              <BarChart data={dailyActivity}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }} 
                  interval={4}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  width={30}
                  stroke="hsl(var(--muted-foreground))"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="Aktionen"
                />
              </BarChart>
            </ChartContainer>
          </div>
        </>
      )}
    </motion.div>
  );
}
