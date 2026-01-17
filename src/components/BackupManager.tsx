import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Upload, 
  Loader2, 
  FileJson, 
  Archive,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Cloud,
  CloudOff,
  Trash2,
  RefreshCw,
  Clock,
  HardDrive,
  Settings2,
  Play,
  AlertTriangle,
  XCircle,
  Calendar,
  Database,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Video,
  Tag,
  Folder,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  encryptBackup, 
  decryptBackup, 
  isNewEncryptionFormat, 
  isOldEncryptionFormat,
  decryptOldBackup,
  EncryptedBackup 
} from '@/lib/encryption';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

type ExportFormat = 'json' | 'encrypted';
type ConflictResolution = 'skip' | 'overwrite' | 'duplicate';

interface ExportData {
  version: string;
  exported_at: string;
  user_id: string;
  notes: any[];
  photos: any[];
  files: any[];
  links: any[];
  tiktok_videos: any[];
  secret_texts: any[];
  tags: any[];
  albums: any[];
  file_albums: any[];
  note_folders: any[];
  link_folders: any[];
  tiktok_folders: any[];
  media_files?: { bucket: string; path: string; data: string }[];
}

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

interface ImportStats {
  notes: { total: number; imported: number; skipped: number };
  links: { total: number; imported: number; skipped: number };
  tags: { total: number; imported: number; skipped: number };
  albums: { total: number; imported: number; skipped: number };
  folders: { total: number; imported: number; skipped: number };
  secrets: { total: number; imported: number; skipped: number };
}

export function BackupManager() {
  const { userId, supabaseClient } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [format, setFormat] = useState<ExportFormat>('json');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(false);
  const [saveToCloud, setSaveToCloud] = useState(true);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
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

  // Check if auto-backup is needed
  useEffect(() => {
    const checkAutoBackup = async () => {
      if (!userId || !backupSettings.auto_backup_enabled) return;
      
      const lastBackup = backupSettings.last_auto_backup 
        ? new Date(backupSettings.last_auto_backup) 
        : null;
      const now = new Date();
      
      let shouldBackup = false;
      
      if (!lastBackup) {
        shouldBackup = true;
      } else {
        const diffMs = now.getTime() - lastBackup.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        switch (backupSettings.backup_frequency) {
          case 'daily':
            shouldBackup = diffDays >= 1;
            break;
          case 'weekly':
            shouldBackup = diffDays >= 7;
            break;
          case 'monthly':
            shouldBackup = diffDays >= 30;
            break;
        }
      }
      
      if (shouldBackup && !isExporting) {
        console.log('Auto-backup triggered');
        await handleExport(true);
      }
    };
    
    // Check on mount and every 5 minutes
    checkAutoBackup();
    const interval = setInterval(checkAutoBackup, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId, backupSettings.auto_backup_enabled, backupSettings.backup_frequency, backupSettings.last_auto_backup]);

  // Update backup settings
  const updateBackupSettings = async (updates: Partial<BackupSettings>) => {
    if (!userId) return;
    
    const newSettings = { ...backupSettings, ...updates };
    setBackupSettings(newSettings);
    
    try {
      const { error } = await supabaseClient
        .from('backup_settings')
        .upsert({
          user_id: userId,
          auto_backup_enabled: newSettings.auto_backup_enabled,
          backup_frequency: newSettings.backup_frequency,
          include_media: newSettings.include_media,
          max_versions: newSettings.max_versions,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      toast.success('Einstellungen gespeichert');
    } catch (error) {
      console.error('Error updating backup settings:', error);
      toast.error('Fehler beim Speichern');
    }
  };

  // Export handler
  const handleExport = async (isAutoBackup = false) => {
    if (!userId) return;
    if (format === 'encrypted' && !password && !isAutoBackup) {
      toast.error('Bitte gib ein Passwort ein');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Lade Daten...');

    try {
      // Fetch all metadata
      setExportStatus('Lade Metadaten...');
      const [
        notesRes, photosRes, filesRes, linksRes,
        tiktoksRes, secretsRes, tagsRes,
        albumsRes, fileAlbumsRes, noteFoldersRes,
        linkFoldersRes, tiktokFoldersRes
      ] = await Promise.all([
        supabaseClient.from('notes').select('*').eq('user_id', userId),
        supabaseClient.from('photos').select('*').eq('user_id', userId),
        supabaseClient.from('files').select('*').eq('user_id', userId),
        supabaseClient.from('links').select('*').eq('user_id', userId),
        supabaseClient.from('tiktok_videos').select('*').eq('user_id', userId),
        supabaseClient.from('secret_texts').select('*').eq('user_id', userId),
        supabaseClient.from('tags').select('*').eq('user_id', userId),
        supabaseClient.from('albums').select('*').eq('user_id', userId),
        supabaseClient.from('file_albums').select('*').eq('user_id', userId),
        supabaseClient.from('note_folders').select('*').eq('user_id', userId),
        supabaseClient.from('link_folders').select('*').eq('user_id', userId),
        supabaseClient.from('tiktok_folders').select('*').eq('user_id', userId),
      ]);

      setExportProgress(15);

      const exportData: ExportData = {
        version: '3.0',
        exported_at: new Date().toISOString(),
        user_id: userId,
        notes: notesRes.data || [],
        photos: photosRes.data || [],
        files: filesRes.data || [],
        links: linksRes.data || [],
        tiktok_videos: tiktoksRes.data || [],
        secret_texts: secretsRes.data || [],
        tags: tagsRes.data || [],
        albums: albumsRes.data || [],
        file_albums: fileAlbumsRes.data || [],
        note_folders: noteFoldersRes.data || [],
        link_folders: linkFoldersRes.data || [],
        tiktok_folders: tiktokFoldersRes.data || [],
        media_files: [],
      };

      // Include media if requested
      const shouldIncludeMedia = isAutoBackup ? backupSettings.include_media : includeMedia;
      
      if (shouldIncludeMedia) {
        const photos = photosRes.data || [];
        const files = filesRes.data || [];
        const totalMedia = photos.length + files.length;
        
        if (totalMedia > 0) {
          let downloaded = 0;
          let failed = 0;
          const BATCH_SIZE = 5;
          const TIMEOUT_MS = 20000;
          
          const downloadWithTimeout = async (bucket: string, path: string): Promise<string | null> => {
            try {
              const { data, error } = await supabaseClient.storage
                .from(bucket)
                .download(path);
              
              if (error || !data) return null;
              
              return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(data);
              });
            } catch {
              return null;
            }
          };

          // Download photos
          for (let i = 0; i < photos.length; i += BATCH_SIZE) {
            const batch = photos.slice(i, i + BATCH_SIZE);
            setExportStatus(`Lade Fotos: ${Math.min(i + BATCH_SIZE, photos.length)}/${photos.length}`);
            
            const results = await Promise.allSettled(
              batch.map(async (photo: any) => {
                const data = await downloadWithTimeout('photos', `${userId}/${photo.filename}`);
                if (data) return { bucket: 'photos', path: `${userId}/${photo.filename}`, data };
                return null;
              })
            );
            
            results.forEach(r => {
              if (r.status === 'fulfilled' && r.value) {
                exportData.media_files!.push(r.value);
                downloaded++;
              } else {
                failed++;
              }
            });
            
            setExportProgress(15 + Math.round((downloaded / totalMedia) * 40));
          }

          // Download files
          for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            setExportStatus(`Lade Dateien: ${Math.min(i + BATCH_SIZE, files.length)}/${files.length}`);
            
            const results = await Promise.allSettled(
              batch.map(async (file: any) => {
                const data = await downloadWithTimeout('files', `${userId}/${file.filename}`);
                if (data) return { bucket: 'files', path: `${userId}/${file.filename}`, data };
                return null;
              })
            );
            
            results.forEach(r => {
              if (r.status === 'fulfilled' && r.value) {
                exportData.media_files!.push(r.value);
                downloaded++;
              } else {
                failed++;
              }
            });
            
            setExportProgress(15 + Math.round((downloaded / totalMedia) * 40));
          }
          
          if (failed > 0) {
            toast.warning(`${failed} Medien konnten nicht heruntergeladen werden`);
          }
        }
      }

      setExportProgress(60);
      setExportStatus('Erstelle Backup-Datei...');

      // Create export file
      let fileContent: string;
      let filename: string;
      let mimeType: string;

      const usePassword = !isAutoBackup && format === 'encrypted' && password;
      
      if (usePassword) {
        const jsonStr = JSON.stringify(exportData);
        const encryptedData = await encryptBackup(jsonStr, password);
        fileContent = JSON.stringify(encryptedData);
        filename = `vault-backup-${new Date().toISOString().split('T')[0]}.vault`;
        mimeType = 'application/octet-stream';
      } else {
        fileContent = JSON.stringify(exportData, null, 2);
        filename = `vault-backup-${new Date().toISOString().split('T')[0]}${isAutoBackup ? '-auto' : ''}.json`;
        mimeType = 'application/json';
      }

      setExportProgress(75);

      // Save to cloud if enabled
      const shouldSaveToCloud = isAutoBackup || saveToCloud;
      
      if (shouldSaveToCloud) {
        setExportStatus('Speichere in Cloud...');
        const storagePath = `${userId}/${filename}`;
        const blob = new Blob([fileContent], { type: mimeType });
        
        const { error: uploadError } = await supabaseClient.storage
          .from('backups')
          .upload(storagePath, blob, { upsert: true });
        
        if (uploadError) {
          console.error('Cloud upload error:', uploadError);
          if (!isAutoBackup) {
            toast.error('Cloud-Upload fehlgeschlagen');
          }
        } else {
          // Save version record
          const itemCounts = {
            notes: exportData.notes.length,
            photos: exportData.photos.length,
            files: exportData.files.length,
            links: exportData.links.length,
            tiktoks: exportData.tiktok_videos.length,
            secrets: exportData.secret_texts.length,
            tags: exportData.tags.length,
          };
          
          await supabaseClient.from('backup_versions').insert({
            user_id: userId,
            filename,
            storage_path: storagePath,
            size_bytes: blob.size,
            item_counts: itemCounts,
            includes_media: shouldIncludeMedia,
            is_auto_backup: isAutoBackup,
          });
          
          // Update last auto backup time
          if (isAutoBackup) {
            await supabaseClient
              .from('backup_settings')
              .upsert({
                user_id: userId,
                last_auto_backup: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });
          }
          
          // Clean up old versions
          await cleanupOldVersions();
          
          await fetchBackupData();
          
          if (!isAutoBackup) {
            toast.success('Backup in Cloud gespeichert');
          }
        }
      }

      setExportProgress(90);

      // Trigger download for manual backups
      if (!isAutoBackup) {
        setExportStatus('Starte Download...');
        const blob = new Blob([fileContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setExportProgress(100);
      setExportStatus('Fertig!');

      const totalItems = exportData.notes.length + exportData.photos.length + 
                        exportData.files.length + exportData.links.length;
      
      if (!isAutoBackup) {
        toast.success(`Backup erstellt: ${totalItems} Elemente`);
      } else {
        console.log(`Auto-backup completed: ${totalItems} items`);
      }

      setPassword('');
    } catch (error) {
      console.error('Export error:', error);
      if (!isAutoBackup) {
        toast.error('Fehler beim Exportieren');
      }
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus('');
    }
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

    if (file.name.endsWith('.vault')) {
      setPendingFile(file);
      setShowPasswordDialog(true);
    } else if (file.name.endsWith('.json')) {
      await processImport(file);
    } else {
      toast.error('Ungültiges Format. Nur .json oder .vault');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Process import
  const processImport = async (file: File, encryptionPassword?: string) => {
    if (!userId) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Lese Datei...');

    try {
      const text = await file.text();
      let importData: ExportData;

      if (encryptionPassword) {
        try {
          const encrypted = JSON.parse(text);
          
          // Try new encryption format first
          if (isNewEncryptionFormat(encrypted)) {
            const decrypted = await decryptBackup(encrypted, encryptionPassword);
            if (!decrypted) {
              throw new Error('Falsches Passwort');
            }
            importData = JSON.parse(decrypted);
          } 
          // Fall back to old format for backwards compatibility
          else if (isOldEncryptionFormat(encrypted)) {
            const decrypted = decryptOldBackup(encrypted, encryptionPassword);
            if (!decrypted) {
              throw new Error('Falsches Passwort');
            }
            importData = JSON.parse(decrypted);
            toast.warning('Dieses Backup verwendet ein veraltetes Verschlüsselungsformat. Bitte erstelle ein neues verschlüsseltes Backup.');
          } else {
            throw new Error('Ungültiges verschlüsseltes Format');
          }
        } catch (err: any) {
          throw new Error(err.message || 'Entschlüsselung fehlgeschlagen');
        }
      } else {
        importData = JSON.parse(text);
      }

      if (!importData.version || !importData.exported_at) {
        throw new Error('Ungültiges Backup-Format');
      }

      setImportProgress(10);

      const stats: ImportStats = {
        notes: { total: 0, imported: 0, skipped: 0 },
        links: { total: 0, imported: 0, skipped: 0 },
        tags: { total: 0, imported: 0, skipped: 0 },
        albums: { total: 0, imported: 0, skipped: 0 },
        folders: { total: 0, imported: 0, skipped: 0 },
        secrets: { total: 0, imported: 0, skipped: 0 },
      };

      // Import tags
      setImportStatus('Importiere Tags...');
      if (importData.tags?.length > 0) {
        stats.tags.total = importData.tags.length;
        const { data: existingTags } = await supabaseClient
          .from('tags')
          .select('name')
          .eq('user_id', userId);
        
        const existingNames = new Set((existingTags || []).map(t => t.name.toLowerCase()));
        
        for (const tag of importData.tags) {
          if (existingNames.has(tag.name.toLowerCase()) && conflictResolution === 'skip') {
            stats.tags.skipped++;
            continue;
          }
          
          const { error } = await supabaseClient.from('tags').insert({
            user_id: userId,
            name: conflictResolution === 'duplicate' && existingNames.has(tag.name.toLowerCase()) 
              ? `${tag.name} (Import)` 
              : tag.name,
            color: tag.color,
          });
          
          if (!error) stats.tags.imported++;
          else stats.tags.skipped++;
        }
      }
      setImportProgress(20);

      // Import folders
      setImportStatus('Importiere Ordner...');
      const folderTypes = ['note_folders', 'link_folders', 'tiktok_folders'] as const;
      for (const folderType of folderTypes) {
        const folders = (importData as any)[folderType] as any[];
        if (folders?.length > 0) {
          stats.folders.total += folders.length;
          
          for (const folder of folders) {
            const { error } = await supabaseClient.from(folderType).insert({
              user_id: userId,
              name: folder.name,
              color: folder.color,
              icon: folder.icon,
            });
            
            if (!error) stats.folders.imported++;
            else stats.folders.skipped++;
          }
        }
      }
      setImportProgress(35);

      // Import albums
      setImportStatus('Importiere Alben...');
      const albumTypes = ['albums', 'file_albums'] as const;
      for (const albumType of albumTypes) {
        const albums = (importData as any)[albumType] as any[];
        if (albums?.length > 0) {
          stats.albums.total += albums.length;
          
          for (const album of albums) {
            const { error } = await supabaseClient.from(albumType).insert({
              user_id: userId,
              name: album.name,
              color: album.color,
              icon: album.icon,
              is_pinned: album.is_pinned,
            });
            
            if (!error) stats.albums.imported++;
            else stats.albums.skipped++;
          }
        }
      }
      setImportProgress(50);

      // Import notes
      setImportStatus('Importiere Notizen...');
      if (importData.notes?.length > 0) {
        stats.notes.total = importData.notes.length;
        
        for (const note of importData.notes) {
          if (note.deleted_at) {
            stats.notes.skipped++;
            continue;
          }
          
          const { error } = await supabaseClient.from('notes').insert({
            user_id: userId,
            title: note.title || 'Importierte Notiz',
            content: note.content,
            is_favorite: note.is_favorite,
            is_secure: note.is_secure,
            secure_content: note.secure_content,
            tags: note.tags,
          });
          
          if (!error) stats.notes.imported++;
          else stats.notes.skipped++;
        }
      }
      setImportProgress(65);

      // Import links
      setImportStatus('Importiere Links...');
      if (importData.links?.length > 0) {
        stats.links.total = importData.links.length;
        
        for (const link of importData.links) {
          if (link.deleted_at) {
            stats.links.skipped++;
            continue;
          }
          
          const { error } = await supabaseClient.from('links').insert({
            user_id: userId,
            url: link.url,
            title: link.title || 'Importierter Link',
            description: link.description,
            favicon_url: link.favicon_url,
            image_url: link.image_url,
            is_favorite: link.is_favorite,
            tags: link.tags,
          });
          
          if (!error) stats.links.imported++;
          else stats.links.skipped++;
        }
      }
      setImportProgress(80);

      // Import secret texts
      setImportStatus('Importiere geheime Texte...');
      if (importData.secret_texts?.length > 0) {
        stats.secrets.total = importData.secret_texts.length;
        
        for (const secret of importData.secret_texts) {
          const { error } = await supabaseClient.from('secret_texts').insert({
            user_id: userId,
            title: secret.title || 'Importierter Text',
            encrypted_content: secret.encrypted_content,
          });
          
          if (!error) stats.secrets.imported++;
          else stats.secrets.skipped++;
        }
      }
      setImportProgress(90);

      // Upload media files if present
      if (importData.media_files?.length > 0) {
        setImportStatus('Lade Medien hoch...');
        let uploaded = 0;
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < importData.media_files.length; i += BATCH_SIZE) {
          const batch = importData.media_files.slice(i, i + BATCH_SIZE);
          
          await Promise.allSettled(
            batch.map(async (media) => {
              try {
                const response = await fetch(media.data);
                const blob = await response.blob();
                
                await supabaseClient.storage
                  .from(media.bucket)
                  .upload(media.path, blob, { upsert: true });
                
                uploaded++;
              } catch (err) {
                console.error('Media upload error:', err);
              }
            })
          );
          
          setImportProgress(90 + Math.round((uploaded / importData.media_files.length) * 10));
        }
      }

      setImportProgress(100);
      setImportStats(stats);
      setShowStatsDialog(true);

      const totalImported = stats.notes.imported + stats.links.imported + 
                           stats.tags.imported + stats.albums.imported + 
                           stats.folders.imported + stats.secrets.imported;
      
      toast.success(`Import abgeschlossen: ${totalImported} Elemente`);

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Fehler beim Importieren');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportStatus('');
      setShowPasswordDialog(false);
      setPendingFile(null);
      setImportPassword('');
    }
  };

  // Restore from cloud version
  const handleRestore = async (version: BackupVersion) => {
    if (!userId) return;
    
    setIsImporting(true);
    setImportStatus('Lade Backup aus Cloud...');
    
    try {
      const { data, error } = await supabaseClient.storage
        .from('backups')
        .download(version.storage_path);
      
      if (error || !data) {
        throw new Error('Backup konnte nicht geladen werden');
      }
      
      const file = new File([data], version.filename, { type: 'application/json' });
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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Backup & Wiederherstellung</h2>
        </div>
        
        {/* Quick Backup Button */}
        <Button
          onClick={() => handleExport(false)}
          disabled={isExporting || isImporting}
          className="gap-2"
          size="sm"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Backup jetzt erstellen
        </Button>
      </div>

      <Tabs defaultValue="backup" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50">
          <TabsTrigger value="backup" className="gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </TabsTrigger>
          <TabsTrigger value="restore" className="gap-2">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import</span>
          </TabsTrigger>
          <TabsTrigger value="cloud" className="gap-2">
            <Cloud className="w-4 h-4" />
            <span className="hidden sm:inline">Cloud</span>
          </TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="backup" className="space-y-4">
          {/* Format Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFormat('json')}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl transition-all border-2",
                format === 'json'
                  ? "border-primary bg-primary/10"
                  : "border-transparent bg-muted/50 hover:bg-muted"
              )}
            >
              <FileJson className={cn("w-5 h-5", format === 'json' ? "text-primary" : "text-muted-foreground")} />
              <div className="text-left">
                <p className="font-medium text-foreground text-sm">JSON</p>
                <p className="text-xs text-muted-foreground">Lesbar</p>
              </div>
            </button>

            <button
              onClick={() => setFormat('encrypted')}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl transition-all border-2",
                format === 'encrypted'
                  ? "border-primary bg-primary/10"
                  : "border-transparent bg-muted/50 hover:bg-muted"
              )}
            >
              <Archive className={cn("w-5 h-5", format === 'encrypted' ? "text-primary" : "text-muted-foreground")} />
              <div className="text-left">
                <p className="font-medium text-foreground text-sm">Verschlüsselt</p>
                <p className="text-xs text-muted-foreground">Mit Passwort</p>
              </div>
            </button>
          </div>

          {/* Password Input */}
          <AnimatePresence>
            {format === 'encrypted' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Backup-Passwort..."
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Medien einschließen</span>
              </div>
              <Switch checked={includeMedia} onCheckedChange={setIncludeMedia} />
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">In Cloud speichern</span>
              </div>
              <Switch checked={saveToCloud} onCheckedChange={setSaveToCloud} />
            </div>
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
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{exportStatus}</span>
                  <span>{Math.round(exportProgress)}%</span>
                </div>
                <Progress value={exportProgress} className="h-2" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Export Button */}
          <Button
            onClick={() => handleExport(false)}
            disabled={isExporting || (format === 'encrypted' && !password)}
            className="w-full gap-2"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? exportStatus || 'Exportiere...' : 'Backup erstellen & herunterladen'}
          </Button>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="restore" className="space-y-4">
          {/* Conflict Resolution */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Bei Konflikten:</label>
            <Select value={conflictResolution} onValueChange={(v) => setConflictResolution(v as ConflictResolution)}>
              <SelectTrigger>
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
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{importStatus}</span>
                  <span>{Math.round(importProgress)}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Import Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.vault"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            variant="outline"
            className="w-full gap-2"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {isImporting ? importStatus || 'Importiere...' : 'Backup-Datei auswählen'}
          </Button>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground">
              Unterstützt .json und .vault Dateien
            </p>
          </div>
        </TabsContent>

        {/* Cloud Tab */}
        <TabsContent value="cloud" className="space-y-4">
          {/* Auto-Backup Settings */}
          <div className="space-y-4 p-4 rounded-xl bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Automatische Backups</span>
              </div>
              <Switch
                checked={backupSettings.auto_backup_enabled}
                onCheckedChange={(v) => updateBackupSettings({ auto_backup_enabled: v })}
              />
            </div>

            <AnimatePresence>
              {backupSettings.auto_backup_enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Häufigkeit:</label>
                    <Select
                      value={backupSettings.backup_frequency}
                      onValueChange={(v: 'daily' | 'weekly' | 'monthly') => updateBackupSettings({ backup_frequency: v })}
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
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Medien einschließen</span>
                    <Switch
                      checked={backupSettings.include_media}
                      onCheckedChange={(v) => updateBackupSettings({ include_media: v })}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Max. Versionen: {backupSettings.max_versions}</label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={backupSettings.max_versions}
                      onChange={(e) => updateBackupSettings({ max_versions: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  {backupSettings.last_auto_backup && (
                    <p className="text-xs text-muted-foreground">
                      Letztes Backup: {formatDate(backupSettings.last_auto_backup)}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Backup Versions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Cloud-Backups</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchBackupData}
                disabled={isLoadingVersions}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isLoadingVersions && "animate-spin")} />
              </Button>
            </div>

            {isLoadingVersions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : backupVersions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CloudOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Cloud-Backups vorhanden</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {backupVersions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        version.is_auto_backup ? "bg-blue-500/20" : "bg-green-500/20"
                      )}>
                        {version.is_auto_backup ? (
                          <Clock className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Download className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{version.filename}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(version.created_at)}</span>
                          <span>•</span>
                          <span>{formatSize(version.size_bytes)}</span>
                          {version.includes_media && (
                            <>
                              <span>•</span>
                              <ImageIcon className="w-3 h-3" />
                            </>
                          )}
                        </div>
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
                        <Upload className="w-4 h-4" />
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

      {/* Password Dialog for encrypted import */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort eingeben</DialogTitle>
            <DialogDescription>
              Diese Backup-Datei ist verschlüsselt.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="relative">
              <input
                type={showImportPassword ? 'text' : 'password'}
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="Backup-Passwort..."
                className="w-full px-4 py-3 pr-10 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && pendingFile && processImport(pendingFile, importPassword)}
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
                onClick={() => pendingFile && processImport(pendingFile, importPassword)}
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
              <StatRow label="Tags" stats={importStats.tags} />
              <StatRow label="Alben" stats={importStats.albums} />
              <StatRow label="Ordner" stats={importStats.folders} />
              <StatRow label="Geheime Texte" stats={importStats.secrets} />
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
              Dieses Backup vom {selectedVersion && formatDate(selectedVersion.created_at)} wird importiert. 
              Bestehende Daten können überschrieben werden.
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
              Das Backup "{versionToDelete?.filename}" wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVersion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
