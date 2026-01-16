import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  HardDrive, 
  RefreshCw, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Calendar, 
  Layers,
  Image,
  FileText,
  Video,
  Music,
  File,
  TrendingUp
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  AreaChart,
  Area,
  Treemap
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useStorageAnalysis, formatBytes } from '@/hooks/useStorageAnalysis';
import { cn } from '@/lib/utils';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1, 220 70% 50%))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  'Bilder': Image,
  'Videos': Video,
  'Audio': Music,
  'PDF': FileText,
  'Dokumente': FileText,
  'Text': FileText,
  'Archive': File,
  'Andere': File,
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm text-muted-foreground">
          {entry.name}: {typeof entry.value === 'number' && entry.dataKey?.includes('Size') 
            ? formatBytes(entry.value) 
            : entry.value}
        </p>
      ))}
    </div>
  );
};

const TreemapContent = ({ x, y, width, height, name, value }: any) => {
  if (width < 50 || height < 30) return null;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        className="fill-primary/20 stroke-primary/40"
        strokeWidth={1}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 8}
        textAnchor="middle"
        className="fill-foreground text-xs font-medium"
      >
        {name}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 10}
        textAnchor="middle"
        className="fill-muted-foreground text-[10px]"
      >
        {formatBytes(value)}
      </text>
    </g>
  );
};

export default function StorageAnalysis() {
  const { data, isLoading, error, analyze } = useStorageAnalysis();

  useEffect(() => {
    analyze();
  }, [analyze]);

  const handleRefresh = () => {
    analyze();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <HardDrive className="w-6 h-6 text-primary" />
            </div>
            Speicheranalyse
          </h1>
          <p className="text-muted-foreground mt-1">
            Detaillierte Statistiken über deinen Speicherverbrauch
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Aktualisieren
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Data Display */}
      {data && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <HardDrive className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gesamt</p>
                      <p className="text-2xl font-bold text-foreground">
                        {formatBytes(data.totalSize)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-chart-1/10">
                      <Layers className="w-5 h-5 text-chart-1" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Dateien</p>
                      <p className="text-2xl font-bold text-foreground">
                        {data.totalItems.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-chart-2/10">
                      <PieChartIcon className="w-5 h-5 text-chart-2" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Kategorien</p>
                      <p className="text-2xl font-bold text-foreground">
                        {data.byFileType.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-chart-3/10">
                      <TrendingUp className="w-5 h-5 text-chart-3" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ø pro Datei</p>
                      <p className="text-2xl font-bold text-foreground">
                        {data.totalItems > 0 
                          ? formatBytes(data.totalSize / data.totalItems)
                          : '0 Bytes'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Charts Tabs */}
          <Tabs defaultValue="types" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
              <TabsTrigger value="types" className="gap-2">
                <PieChartIcon className="w-4 h-4 hidden sm:block" />
                Dateitypen
              </TabsTrigger>
              <TabsTrigger value="albums" className="gap-2">
                <BarChart3 className="w-4 h-4 hidden sm:block" />
                Alben
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-2">
                <Calendar className="w-4 h-4 hidden sm:block" />
                Zeitverlauf
              </TabsTrigger>
              <TabsTrigger value="distribution" className="gap-2">
                <Layers className="w-4 h-4 hidden sm:block" />
                Größen
              </TabsTrigger>
            </TabsList>

            {/* File Types Chart */}
            <TabsContent value="types" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Speicher nach Dateityp</CardTitle>
                    <CardDescription>
                      Verteilung des Speicherplatzes nach Kategorien
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.byFileType}
                            dataKey="totalSize"
                            nameKey="type"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={60}
                            strokeWidth={2}
                            stroke="hsl(var(--background))"
                          >
                            {data.byFileType.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dateityp-Details</CardTitle>
                    <CardDescription>
                      Übersicht aller Kategorien mit Anzahl
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data.byFileType.map((item, index) => {
                        const Icon = TYPE_ICONS[item.type] || File;
                        return (
                          <div key={item.type} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                />
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{item.type}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-medium">
                                  {formatBytes(item.totalSize)}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({item.itemCount} Dateien)
                                </span>
                              </div>
                            </div>
                            <Progress 
                              value={item.percentage} 
                              className="h-2"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Albums Chart */}
            <TabsContent value="albums" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Speicher nach Album</CardTitle>
                    <CardDescription>
                      Top-Alben nach Speicherverbrauch
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.byAlbum.slice(0, 10)}
                          layout="vertical"
                          margin={{ left: 20, right: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            type="number"
                            tickFormatter={(value) => formatBytes(value)}
                            className="text-muted-foreground"
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={120}
                            className="text-muted-foreground"
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey="totalSize"
                            name="Größe"
                            fill="hsl(var(--primary))"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Album-Übersicht</CardTitle>
                    <CardDescription>
                      Alle Alben mit Dateianzahl
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                          data={data.byAlbum.slice(0, 15).map(a => ({
                            name: a.name,
                            value: a.totalSize,
                            count: a.itemCount,
                          }))}
                          dataKey="value"
                          aspectRatio={4 / 3}
                          stroke="hsl(var(--border))"
                          content={<TreemapContent />}
                        />
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Timeline Chart */}
            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Speichernutzung über Zeit</CardTitle>
                  <CardDescription>
                    Monatliche Entwicklung der letzten 12 Monate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.byMonth}>
                        <defs>
                          <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="monthLabel"
                          className="text-muted-foreground"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          tickFormatter={(value) => formatBytes(value)}
                          className="text-muted-foreground"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="totalSize"
                          name="Gesamt"
                          stroke="hsl(var(--primary))"
                          fill="url(#colorSize)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Fotos vs. Dateien</CardTitle>
                    <CardDescription>
                      Monatliche Verteilung nach Typ
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.byMonth}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="monthLabel"
                            className="text-muted-foreground"
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis className="text-muted-foreground" />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar
                            dataKey="photos"
                            name="Fotos"
                            fill="hsl(var(--chart-1, 220 70% 50%))"
                            stackId="a"
                            radius={[0, 0, 0, 0]}
                          />
                          <Bar
                            dataKey="files"
                            name="Dateien"
                            fill="hsl(var(--chart-2, 160 60% 45%))"
                            stackId="a"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Monats-Statistik</CardTitle>
                    <CardDescription>
                      Details zu den letzten Monaten
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {data.byMonth.slice().reverse().map((month) => (
                        <div
                          key={month.month}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{month.monthLabel}</p>
                            <p className="text-sm text-muted-foreground">
                              {month.itemCount} Dateien
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatBytes(month.totalSize)}</p>
                            <p className="text-xs text-muted-foreground">
                              {month.photos} Fotos, {month.files} Dateien
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Size Distribution */}
            <TabsContent value="distribution" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Größenverteilung</CardTitle>
                    <CardDescription>
                      Anzahl der Dateien nach Größenbereich
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.sizeDistribution}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="range"
                            className="text-muted-foreground"
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis className="text-muted-foreground" />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey="count"
                            name="Anzahl"
                            fill="hsl(var(--primary))"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Größenbereiche</CardTitle>
                    <CardDescription>
                      Detaillierte Aufschlüsselung
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {data.sizeDistribution.map((item, index) => (
                        <div key={item.range} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.range}</span>
                            <div className="text-right">
                              <span className="text-sm font-medium">
                                {item.count} Dateien
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({formatBytes(item.totalSize)})
                              </span>
                            </div>
                          </div>
                          <Progress
                            value={item.percentage}
                            className="h-2"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Largest Files */}
              <Card>
                <CardHeader>
                  <CardTitle>Größte Dateien</CardTitle>
                  <CardDescription>
                    Die 10 größten Dateien in deinem Vault
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.largestFiles.map((file, index) => {
                      const Icon = file.type === 'photo' ? Image : FileText;
                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                              {index + 1}
                            </div>
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium capitalize">
                                {file.type === 'photo' ? 'Foto' : file.type === 'file' ? 'Datei' : 'Anhang'}
                              </p>
                              {file.albumName && (
                                <p className="text-xs text-muted-foreground">
                                  Album: {file.albumName}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="font-medium">{formatBytes(file.size)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
