import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Upload, 
  Loader2, 
  Archive,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Cloud,
  Trash2,
  RefreshCw,
  Clock,
  Settings2,
  AlertTriangle,
  Calendar,
  Shield,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  exportPhantomVault,
  importPhantomVault,
  type ExportProgress,
  type ImportProgress,
  type ImportStats,
  PHANTOMVAULT_EXTENSION,
} from '@/lib/phantomvault';

type ConflictResolution = 'skip' | 'overwrite' | 'duplicate';

interface BackupVersion {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number;
  item_counts: any;
  includes_media: boolean;
  is_auto_backup: boolean;
  created_at: string;
}

interface BackupSettings {
  auto_backup_enabled: boolean;
  backup_frequency: string;
  include_media: boolean;
  max_versions: number;
  last_auto_backup: string | null;
}

export function BackupManager() {
  const { userId, supabaseClient } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({ phase: 'init', percent: 0, message: '' });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(false);
  const [saveToCloud, setSaveToCloud] = useState(true);
  const [useEncryption, setUseEncryption] = useState(false);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({ phase: 'init', percent: 0, message: '' });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip');
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  
  // Cloud backup state
  const [backupVersions, setBackupVersions] = useState<BackupVersion[]>([]);
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    auto_backup_enabled: false,
    backup_frequency: 'weekly',
    include_media: false,
    max_versions: 5,
    last_auto_backup: null,
  });
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<BackupVersion | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [versionToDelete, setVersionToDelete] = useState<BackupVersion | null>(null);

  // Fetch backup data
  const fetchBackupData = useCallback(async () => {
    if (!userId) return;
    
    setIsLoadingVersions(true);
    try {
      const [versionsRes, settingsRes] = await Promise.all([
        supabaseClient
          .from('backup_versions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabaseClient
          .from('backup_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);
      
      if (versionsRes.data) {
        setBackupVersions(versionsRes.data);
      }
      
      if (settingsRes.data) {
        setBackupSettings({
          auto_backup_enabled: settingsRes.data.auto_backup_enabled,
          backup_frequency: settingsRes.data.backup_frequency,
          include_media: settingsRes.data.include_media,
          max_versions: settingsRes.data.max_versions,
          last_auto_backup: settingsRes.data.last_auto_backup,
        });
      }
    } catch (error) {
      console.error('Error fetching backup data:', error);
    } finally {
      setIsLoadingVersions(false);
    }
  }, [userId, supabaseClient]);

  useEffect(() => {
    fetchBackupData();
  }, [fetchBackupData]);

  // Auto-backup is now only triggered manually via the button, not automatically on page load
  // Users must explicitly click "Backup erstellen" to start an export

  // Update backup settings
  const updateBackupSettings = async (updates: Partial<BackupSettings>) => {
    if (!userId) return;
    
    const newSettings = { ...backupSettings, ...updates };
    setBackupSettings(newSettings);
    
    try {
      await supabaseClient
        .from('backup_settings')
        .upsert({
          user_id: userId,
          auto_backup_enabled: newSettings.auto_backup_enabled,
          backup_frequency: newSettings.backup_frequency,
          include_media: newSettings.include_media,
          max_versions: newSettings.max_versions,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      
      toast.success('Einstellungen gespeichert');
    } catch (error) {
      console.error('Error updating backup settings:', error);
      toast.error('Fehler beim Speichern');
    }
  };

  // Export handler
  const handleExport = async (isAutoBackup = false) => {
    if (!userId) return;
    if (useEncryption && !password && !isAutoBackup) {
      toast.error('Bitte gib ein Passwort ein');
      return;
    }

    setIsExporting(true);

    const result = await exportPhantomVault(
      supabaseClient,
      userId,
      {
        includeMedia: isAutoBackup ? backupSettings.include_media : includeMedia,
        password: useEncryption && !isAutoBackup ? password : undefined,
        saveToCloud: isAutoBackup || saveToCloud,
        isAutoBackup,
      },
      (progress) => setExportProgress(progress)
    );

    if (result.success) {
      if (!isAutoBackup) {
        toast.success('Backup erstellt!');
      }
      await fetchBackupData();
      await cleanupOldVersions();
    } else {
      if (!isAutoBackup) {
        toast.error(result.error || 'Export fehlgeschlagen');
      }
    }

    setIsExporting(false);
    setPassword('');
    setExportProgress({ phase: 'init', percent: 0, message: '' });
  };

  // Cleanup old backup versions
  const cleanupOldVersions = async () => {
    if (!userId) return;
    
    const { data: versions } = await supabaseClient
      .from('backup_versions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (versions && versions.length > backupSettings.max_versions) {
      const toDelete = versions.slice(backupSettings.max_versions);
      
      for (const version of toDelete) {
        await supabaseClient.storage.from('backups').remove([version.storage_path]);
        await supabaseClient.from('backup_versions').delete().eq('id', version.id);
      }
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPhantomVault = file.name.endsWith(PHANTOMVAULT_EXTENSION);
    const isEncryptedVault = file.name.endsWith('.vault');
    const isJson = file.name.endsWith('.json');

    if (isPhantomVault || isEncryptedVault) {
      // Check if file might be encrypted by trying to read first bytes
      const firstBytes = await file.slice(0, 10).text();
      const looksLikeJson = firstBytes.startsWith('{');
      
      if (looksLikeJson || isEncryptedVault) {
        setPendingFile(file);
        setShowPasswordDialog(true);
      } else {
        await processImport(file);
      }
    } else if (isJson) {
      await processImport(file);
    } else {
      toast.error(`Ungültiges Format. Unterstützt: ${PHANTOMVAULT_EXTENSION}, .vault, .json`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Process import
  const processImport = async (file: File, encryptionPassword?: string) => {
    if (!userId) return;

    setIsImporting(true);
    setShowPasswordDialog(false);

    const result = await importPhantomVault(
      supabaseClient,
      userId,
      file,
      {
        conflictResolution,
        password: encryptionPassword,
      },
      (progress) => setImportProgress(progress)
    );

    if (result.success && result.stats) {
      setImportStats(result.stats);
      setShowStatsDialog(true);
      
      const totalImported = 
        result.stats.notes.imported + 
        result.stats.links.imported + 
        result.stats.tags.imported + 
        result.stats.albums.imported + 
        result.stats.folders.imported;
      
      toast.success(`Import abgeschlossen: ${totalImported} Elemente`);
    } else {
      toast.error(result.error || 'Import fehlgeschlagen');
    }

    setIsImporting(false);
    setPendingFile(null);
    setImportPassword('');
    setImportProgress({ phase: 'init', percent: 0, message: '' });
  };

  // Restore from cloud version
  const handleRestore = async (version: BackupVersion) => {
    if (!userId) return;
    
    setIsImporting(true);
    setImportProgress({ phase: 'reading', percent: 5, message: 'Lade Backup aus Cloud...' });
    
    try {
      const { data, error } = await supabaseClient.storage
        .from('backups')
        .download(version.storage_path);
      
      if (error || !data) {
        throw new Error('Backup konnte nicht geladen werden');
      }
      
      const file = new File([data], version.filename, { type: 'application/octet-stream' });
      await processImport(file);
    } catch (error: any) {
      console.error('Restore error:', error);
      toast.error(error.message || 'Fehler beim Wiederherstellen');
      setIsImporting(false);
    }
    
    setShowRestoreDialog(false);
    setSelectedVersion(null);
  };

  // Delete backup version
  const handleDeleteVersion = async () => {
    if (!versionToDelete || !userId) return;
    
    try {
      await supabaseClient.storage.from('backups').remove([versionToDelete.storage_path]);
      await supabaseClient.from('backup_versions').delete().eq('id', versionToDelete.id);
      
      toast.success('Backup gelöscht');
      await fetchBackupData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Fehler beim Löschen');
    }
    
    setShowDeleteDialog(false);
    setVersionToDelete(null);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Backup & Restore</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
            .phantomvault
          </span>
        </div>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="cloud">Cloud</TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Medien einschließen</span>
                </div>
                <Switch checked={includeMedia} onCheckedChange={setIncludeMedia} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">In Cloud speichern</span>
                </div>
                <Switch checked={saveToCloud} onCheckedChange={setSaveToCloud} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Verschlüsseln</span>
                </div>
                <Switch checked={useEncryption} onCheckedChange={setUseEncryption} />
              </div>

              {useEncryption && (
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Backup-Passwort..."
                    className={cn(
                      "w-full px-4 py-2.5 pr-10 rounded-lg",
                      "bg-muted border border-border",
                      "text-foreground placeholder:text-muted-foreground text-sm",
                      "focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>

            {/* Progress */}
            <AnimatePresence>
              {isExporting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{exportProgress.message}</span>
                    <span className="text-foreground font-medium">{exportProgress.percent}%</span>
                  </div>
                  <Progress value={exportProgress.percent} className="h-2" />
                  {exportProgress.current !== undefined && exportProgress.total !== undefined && (
                    <p className="text-xs text-muted-foreground text-center">
                      {exportProgress.current} / {exportProgress.total}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Export Button */}
            <Button
              onClick={() => handleExport(false)}
              disabled={isExporting || (useEncryption && !password)}
              className="w-full"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isExporting ? 'Exportiere...' : 'Backup erstellen'}
            </Button>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                Erstellt eine {PHANTOMVAULT_EXTENSION}-Datei mit allen Daten. Medien werden als separate Dateien im Archiv gespeichert.
              </p>
            </div>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4">
            {/* Conflict Resolution */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Bei Konflikten:</label>
              <Select value={conflictResolution} onValueChange={(v) => setConflictResolution(v as ConflictResolution)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Überspringen</SelectItem>
                  <SelectItem value="overwrite">Überschreiben</SelectItem>
                  <SelectItem value="duplicate">Duplizieren</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Progress */}
            <AnimatePresence>
              {isImporting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{importProgress.message}</span>
                    <span className="text-foreground font-medium">{importProgress.percent}%</span>
                  </div>
                  <Progress value={importProgress.percent} className="h-2" />
                  {importProgress.current !== undefined && importProgress.total !== undefined && (
                    <p className="text-xs text-muted-foreground text-center">
                      {importProgress.current} / {importProgress.total}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Import Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".phantomvault,.vault,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              variant="outline"
              className="w-full"
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {isImporting ? 'Importiere...' : 'Backup wiederherstellen'}
            </Button>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                Unterstützt {PHANTOMVAULT_EXTENSION}, .vault und .json Dateien. Legacy-Backups werden automatisch konvertiert.
              </p>
            </div>
          </TabsContent>

          {/* Cloud Tab */}
          <TabsContent value="cloud" className="space-y-4">
            {/* Auto-Backup Settings */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Auto-Backup</span>
                </div>
                <Switch 
                  checked={backupSettings.auto_backup_enabled} 
                  onCheckedChange={(v) => updateBackupSettings({ auto_backup_enabled: v })} 
                />
              </div>

              {backupSettings.auto_backup_enabled && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Häufigkeit</span>
                    <Select 
                      value={backupSettings.backup_frequency} 
                      onValueChange={(v) => updateBackupSettings({ backup_frequency: v })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Täglich</SelectItem>
                        <SelectItem value="weekly">Wöchentlich</SelectItem>
                        <SelectItem value="monthly">Monatlich</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Max. Versionen</span>
                    <Select 
                      value={String(backupSettings.max_versions)} 
                      onValueChange={(v) => updateBackupSettings({ max_versions: parseInt(v) })}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 5, 10, 15, 20].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {backupSettings.last_auto_backup && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Letztes Backup: {formatDate(backupSettings.last_auto_backup)}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Cloud Versions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Cloud-Backups</h3>
                <Button variant="ghost" size="sm" onClick={fetchBackupData} disabled={isLoadingVersions}>
                  <RefreshCw className={cn("w-4 h-4", isLoadingVersions && "animate-spin")} />
                </Button>
              </div>

              {isLoadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : backupVersions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Keine Cloud-Backups vorhanden</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {backupVersions.map((version) => (
                    <div 
                      key={version.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{version.filename}</p>
                          {version.is_auto_backup && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                              Auto
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDate(version.created_at)}</span>
                          <span>{formatBytes(version.size_bytes)}</span>
                          {version.includes_media && <span>+ Medien</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedVersion(version);
                            setShowRestoreDialog(true);
                          }}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setVersionToDelete(version);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Password Dialog for encrypted imports */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort eingeben</DialogTitle>
            <DialogDescription>
              Diese Backup-Datei ist verschlüsselt. Bitte gib das Passwort ein.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="relative">
              <input
                type={showImportPassword ? 'text' : 'password'}
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="Backup-Passwort..."
                className={cn(
                  "w-full px-4 py-3 pr-10 rounded-xl",
                  "bg-muted border border-border",
                  "text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pendingFile && importPassword) {
                    processImport(pendingFile, importPassword);
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowImportPassword(!showImportPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showImportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPendingFile(null);
                  setImportPassword('');
                }}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  if (pendingFile) {
                    processImport(pendingFile, importPassword);
                  }
                }}
                disabled={!importPassword}
                className="flex-1"
              >
                Importieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Stats Dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Import abgeschlossen
            </DialogTitle>
          </DialogHeader>
          
          {importStats && (
            <div className="space-y-2 py-4">
              <StatRow label="Notizen" stats={importStats.notes} />
              <StatRow label="Links" stats={importStats.links} />
              <StatRow label="Fotos" stats={importStats.photos} />
              <StatRow label="Dateien" stats={importStats.files} />
              <StatRow label="TikToks" stats={importStats.tiktoks} />
              <StatRow label="Secrets" stats={importStats.secrets} />
              <StatRow label="Tags" stats={importStats.tags} />
              <StatRow label="Alben" stats={importStats.albums} />
              <StatRow label="Ordner" stats={importStats.folders} />
              {importStats.media.total > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-foreground font-medium">Medien</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {importStats.media.uploaded}
                    </span>
                    {importStats.media.failed > 0 && (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {importStats.media.failed}
                      </span>
                    )}
                    <span className="text-muted-foreground">/ {importStats.media.total}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <Button onClick={() => setShowStatsDialog(false)} className="w-full">
            Schließen
          </Button>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Backup wiederherstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedVersion && (
                <>
                  Möchtest du das Backup "{selectedVersion.filename}" wiederherstellen?
                  <br /><br />
                  <strong>Hinweis:</strong> Vorhandene Daten werden je nach Konflikt-Einstellung übersprungen oder überschrieben.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedVersion && handleRestore(selectedVersion)}>
              Wiederherstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Backup löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {versionToDelete && (
                <>
                  Möchtest du das Backup "{versionToDelete.filename}" unwiderruflich löschen?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteVersion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatRow({ label, stats }: { label: string; stats: { total: number; imported: number; skipped: number } }) {
  if (stats.total === 0) return null;
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <span className="text-foreground font-medium">{label}</span>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-green-500 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {stats.imported}
        </span>
        {stats.skipped > 0 && (
          <span className="text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {stats.skipped}
          </span>
        )}
        <span className="text-muted-foreground">/ {stats.total}</span>
      </div>
    </div>
  );
}
