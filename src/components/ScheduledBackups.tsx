import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Cloud, 
  Download,
  Settings,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Loader2,
  History,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, addDays, addWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

interface BackupVersion {
  id: string;
  filename: string;
  created_at: string;
  size_bytes: number;
  is_auto_backup: boolean;
  includes_media: boolean;
  item_counts: {
    notes?: number;
    photos?: number;
    files?: number;
    links?: number;
  };
}

interface BackupSettings {
  auto_backup_enabled: boolean;
  backup_frequency: 'daily' | 'weekly' | 'monthly';
  include_media: boolean;
  max_versions: number;
  last_auto_backup: string | null;
}

export function ScheduledBackups() {
  const [settings, setSettings] = useState<BackupSettings>({
    auto_backup_enabled: false,
    backup_frequency: 'weekly',
    include_media: true,
    max_versions: 5,
    last_auto_backup: null,
  });
  const [versions, setVersions] = useState<BackupVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const { userId, supabaseClient: supabase } = useAuth();

  const fetchData = useCallback(async () => {
    if (!userId) return;
    
    try {
      const [settingsRes, versionsRes] = await Promise.all([
        supabase.from('backup_settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('backup_versions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      ]);

      if (settingsRes.data) {
        setSettings(settingsRes.data as unknown as BackupSettings);
      }

      setVersions((versionsRes.data || []) as BackupVersion[]);
    } catch (error) {
      console.error('Error fetching backup data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveSettings = async (newSettings: Partial<BackupSettings>) => {
    if (!userId) return;
    
    setSaving(true);
    const updated = { ...settings, ...newSettings };
    
    try {
      const { error } = await supabase
        .from('backup_settings')
        .upsert({
          user_id: userId,
          ...updated,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      
      setSettings(updated);
      toast.success('Einstellungen gespeichert');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const getNextBackupDate = () => {
    if (!settings.auto_backup_enabled || !settings.last_auto_backup) {
      return null;
    }
    
    const lastBackup = new Date(settings.last_auto_backup);
    
    switch (settings.backup_frequency) {
      case 'daily':
        return addDays(lastBackup, 1);
      case 'weekly':
        return addWeeks(lastBackup, 1);
      case 'monthly':
        return addDays(lastBackup, 30);
      default:
        return addWeeks(lastBackup, 1);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const nextBackup = getNextBackupDate();
  const totalBackupSize = versions.reduce((acc, v) => acc + v.size_bytes, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center",
                settings.auto_backup_enabled
                  ? "bg-green-500/20 text-green-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {settings.auto_backup_enabled ? (
                  <Cloud className="w-7 h-7" />
                ) : (
                  <Pause className="w-7 h-7" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {settings.auto_backup_enabled ? 'Auto-Backup aktiv' : 'Auto-Backup deaktiviert'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {settings.last_auto_backup
                    ? `Letztes Backup: ${formatDistanceToNow(new Date(settings.last_auto_backup), { addSuffix: true, locale: de })}`
                    : 'Noch kein automatisches Backup'}
                </p>
                {nextBackup && settings.auto_backup_enabled && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nächstes Backup: {format(nextBackup, 'dd.MM.yyyy HH:mm', { locale: de })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.auto_backup_enabled}
                onCheckedChange={(checked) => saveSettings({ auto_backup_enabled: checked })}
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4" />
            Backup-Einstellungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Häufigkeit</Label>
              <Select
                value={settings.backup_frequency}
                onValueChange={(value: 'daily' | 'weekly' | 'monthly') => saveSettings({ backup_frequency: value })}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Täglich</SelectItem>
                  <SelectItem value="weekly">Wöchentlich</SelectItem>
                  <SelectItem value="monthly">Monatlich</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Max. Versionen</Label>
              <Select
                value={String(settings.max_versions)}
                onValueChange={(value) => saveSettings({ max_versions: parseInt(value) })}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Versionen</SelectItem>
                  <SelectItem value="5">5 Versionen</SelectItem>
                  <SelectItem value="10">10 Versionen</SelectItem>
                  <SelectItem value="20">20 Versionen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-sm">Medien einschließen</Label>
              <p className="text-xs text-muted-foreground">Fotos und Videos im Backup</p>
            </div>
            <Switch
              checked={settings.include_media}
              onCheckedChange={(checked) => saveSettings({ include_media: checked })}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4" />
              Backup-Verlauf
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {versions.length} Versionen • {formatBytes(totalBackupSize)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cloud className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Noch keine Backups vorhanden</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {versions.map((version, index) => (
                  <motion.div
                    key={version.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        version.is_auto_backup
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-purple-500/20 text-purple-400"
                      )}>
                        {version.is_auto_backup ? (
                          <Clock className="w-4 h-4" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{version.filename}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(new Date(version.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                          <span>•</span>
                          <span>{formatBytes(version.size_bytes)}</span>
                          {version.includes_media && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-[10px] py-0">
                                Mit Medien
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ScheduledBackups;
