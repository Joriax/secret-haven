import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Clock,
  Trash2,
  RefreshCw,
  Settings,
  Image,
  File,
  Calendar,
  HardDrive,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BackupVersion {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number;
  item_counts: Record<string, number> | any;
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

interface ExportData {
  version: string;
  exported_at: string;
  user_id: string;
  includes_media: boolean;
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

type ExportFormat = 'json' | 'encrypted';
type ConflictResolution = 'skip' | 'overwrite' | 'duplicate';

export function BackupManager() {
  const { userId, supabaseClient } = useAuth();
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [format, setFormat] = useState<ExportFormat>('json');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [saveToCloud, setSaveToCloud] = useState(false);
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip');
  
  // Cloud backup state
  const [backupVersions, setBackupVersions] = useState<BackupVersion[]>([]);
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    auto_backup_enabled: false,
    backup_frequency: 'weekly',
    include_media: true,
    max_versions: 5,
    last_auto_backup: null,
  });
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<BackupVersion | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch backup versions and settings
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
          .single(),
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
          ...newSettings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating backup settings:', error);
      toast.error('Fehler beim Speichern der Einstellungen');
    }
  };

  // Download file from storage as base64
  const downloadStorageFile = async (bucket: string, path: string): Promise<string | null> => {
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

  // Export handler
  const handleExport = async () => {
    if (!userId) return;
    if (format === 'encrypted' && !password) {
      toast.error('Bitte gib ein Passwort ein');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportStatus('Lade Daten...');

    try {
      // Fetch all data
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

      setExportProgress(20);

      const exportData: ExportData = {
        version: '3.0',
        exported_at: new Date().toISOString(),
        user_id: userId,
        includes_media: includeMedia,
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

      // Download media files if requested
      if (includeMedia) {
        setExportStatus('Lade Fotos...');
        const photos = photosRes.data || [];
        const files = filesRes.data || [];
        const totalMedia = photos.length + files.length;
        let downloaded = 0;

        // Download photos (in batches of 5 for performance)
        for (let i = 0; i < photos.length; i += 5) {
          const batch = photos.slice(i, i + 5);
          const results = await Promise.all(
            batch.map(async (photo) => {
              const data = await downloadStorageFile('photos', `${userId}/${photo.filename}`);
              if (data) {
                return { bucket: 'photos', path: `${userId}/${photo.filename}`, data };
              }
              return null;
            })
          );
          
          results.filter(Boolean).forEach(r => exportData.media_files!.push(r!));
          downloaded += batch.length;
          setExportProgress(20 + Math.round((downloaded / totalMedia) * 50));
          setExportStatus(`Lade Medien: ${downloaded}/${totalMedia}`);
        }

        // Download files (in batches of 5)
        setExportStatus('Lade Dateien...');
        for (let i = 0; i < files.length; i += 5) {
          const batch = files.slice(i, i + 5);
          const results = await Promise.all(
            batch.map(async (file) => {
              const data = await downloadStorageFile('files', `${userId}/${file.filename}`);
              if (data) {
                return { bucket: 'files', path: `${userId}/${file.filename}`, data };
              }
              return null;
            })
          );
          
          results.filter(Boolean).forEach(r => exportData.media_files!.push(r!));
          downloaded += batch.length;
          setExportProgress(20 + Math.round((downloaded / totalMedia) * 50));
          setExportStatus(`Lade Medien: ${downloaded}/${totalMedia}`);
        }
      }

      setExportProgress(75);
      setExportStatus('Erstelle Backup-Datei...');

      let fileContent: string;
      let filename: string;
      let mimeType: string;

      if (format === 'encrypted' && password) {
        const jsonStr = JSON.stringify(exportData);
        const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
        const pwHash = btoa(password);
        fileContent = JSON.stringify({
          encrypted: true,
          hash: pwHash.substring(0, 8),
          data: encoded,
        });
        filename = `vault-backup-${new Date().toISOString().split('T')[0]}.vault`;
        mimeType = 'application/octet-stream';
      } else {
        fileContent = JSON.stringify(exportData, null, 2);
        filename = `vault-backup-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      // Save to cloud if requested
      if (saveToCloud) {
        setExportStatus('Speichere in Cloud...');
        const storagePath = `${userId}/${filename}`;
        const blob = new Blob([fileContent], { type: mimeType });
        
        const { error: uploadError } = await supabaseClient.storage
          .from('backups')
          .upload(storagePath, blob, { upsert: true });
        
        if (uploadError) {
          console.error('Cloud upload error:', uploadError);
          toast.error('Cloud-Upload fehlgeschlagen, lokaler Download wird durchgeführt');
        } else {
          // Save version record
          const itemCounts = {
            notes: exportData.notes.length,
            photos: exportData.photos.length,
            files: exportData.files.length,
            links: exportData.links.length,
            tiktoks: exportData.tiktok_videos.length,
            tags: exportData.tags.length,
          };
          
          await supabaseClient.from('backup_versions').insert({
            user_id: userId,
            filename,
            storage_path: storagePath,
            size_bytes: blob.size,
            item_counts: itemCounts,
            includes_media: includeMedia,
            is_auto_backup: false,
          });
          
          await fetchBackupData();
          toast.success('Backup in Cloud gespeichert');
        }
      }

      setExportProgress(100);
      setExportStatus('Fertig!');

      // Download file locally
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalItems =
        (exportData.notes.length) +
        (exportData.photos.length) +
        (exportData.files.length) +
        (exportData.links.length) +
        (exportData.tiktok_videos.length);

      const mediaInfo = includeMedia && exportData.media_files!.length > 0
        ? ` inkl. ${exportData.media_files!.length} Medien`
        : '';

      toast.success('Backup erstellt', {
        description: `${totalItems} Elemente exportiert${mediaInfo}`,
      });

      setPassword('');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Fehler beim Exportieren');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus('');
    }
  };

  // Import handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.vault')) {
      setPendingFile(file);
      setShowPasswordDialog(true);
    } else if (file.name.endsWith('.json')) {
      await processImport(file);
    } else {
      toast.error('Ungültiges Dateiformat');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImport = async (file: File, encryptionPassword?: string) => {
    if (!userId) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Lese Backup...');

    try {
      const text = await file.text();
      let importData: ExportData;

      if (encryptionPassword) {
        try {
          const encrypted = JSON.parse(text);
          if (!encrypted.encrypted || !encrypted.data) {
            throw new Error('Ungültiges Format');
          }
          const pwHash = btoa(encryptionPassword);
          if (encrypted.hash !== pwHash.substring(0, 8)) {
            throw new Error('Falsches Passwort');
          }
          const decoded = decodeURIComponent(escape(atob(encrypted.data)));
          importData = JSON.parse(decoded);
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
      setImportStatus('Importiere Tags...');

      // Import tags
      if (importData.tags?.length) {
        for (const tag of importData.tags) {
          await supabaseClient.from('tags').insert({
            user_id: userId,
            name: tag.name,
            color: tag.color,
          }).select().maybeSingle();
        }
      }
      setImportProgress(15);

      // Import folders
      setImportStatus('Importiere Ordner...');
      const folderTypes = ['note_folders', 'link_folders', 'tiktok_folders'] as const;
      for (const folderType of folderTypes) {
        const folders = (importData as any)[folderType] as any[];
        if (folders?.length) {
          for (const folder of folders) {
            await supabaseClient.from(folderType).insert({
              user_id: userId,
              name: folder.name,
              color: folder.color,
              icon: folder.icon,
            }).select().maybeSingle();
          }
        }
      }
      setImportProgress(25);

      // Import albums
      setImportStatus('Importiere Alben...');
      const albumTypes = ['albums', 'file_albums'] as const;
      for (const albumType of albumTypes) {
        const albums = (importData as any)[albumType] as any[];
        if (albums?.length) {
          for (const album of albums) {
            await supabaseClient.from(albumType).insert({
              user_id: userId,
              name: album.name,
              color: album.color,
              icon: album.icon,
              is_pinned: album.is_pinned,
            }).select().maybeSingle();
          }
        }
      }
      setImportProgress(35);

      // Import notes
      setImportStatus('Importiere Notizen...');
      if (importData.notes?.length) {
        for (const note of importData.notes) {
          if (note.deleted_at) continue;
          await supabaseClient.from('notes').insert({
            user_id: userId,
            title: note.title || 'Importierte Notiz',
            content: note.content,
            is_favorite: note.is_favorite,
            is_secure: note.is_secure,
            secure_content: note.secure_content,
            tags: note.tags,
          }).select().maybeSingle();
        }
      }
      setImportProgress(45);

      // Import links
      setImportStatus('Importiere Links...');
      if (importData.links?.length) {
        for (const link of importData.links) {
          if (link.deleted_at) continue;
          await supabaseClient.from('links').insert({
            user_id: userId,
            url: link.url,
            title: link.title || 'Importierter Link',
            description: link.description,
            favicon_url: link.favicon_url,
            image_url: link.image_url,
            is_favorite: link.is_favorite,
            tags: link.tags,
          }).select().maybeSingle();
        }
      }
      setImportProgress(55);

      // Import TikToks
      setImportStatus('Importiere TikToks...');
      if (importData.tiktok_videos?.length) {
        for (const tiktok of importData.tiktok_videos) {
          if (tiktok.deleted_at) continue;
          await supabaseClient.from('tiktok_videos').insert({
            user_id: userId,
            url: tiktok.url,
            title: tiktok.title,
            author_name: tiktok.author_name,
            thumbnail_url: tiktok.thumbnail_url,
            video_id: tiktok.video_id,
            is_favorite: tiktok.is_favorite,
          }).select().maybeSingle();
        }
      }
      setImportProgress(65);

      // Import secret texts
      setImportStatus('Importiere geheime Texte...');
      if (importData.secret_texts?.length) {
        for (const secret of importData.secret_texts) {
          await supabaseClient.from('secret_texts').insert({
            user_id: userId,
            title: secret.title || 'Importierter Text',
            encrypted_content: secret.encrypted_content,
          }).select().maybeSingle();
        }
      }
      setImportProgress(75);

      // Import media files
      if (importData.media_files?.length) {
        setImportStatus('Importiere Medien...');
        let mediaImported = 0;
        const totalMedia = importData.media_files.length;

        for (const media of importData.media_files) {
          try {
            // Convert base64 data URL to blob
            const response = await fetch(media.data);
            const blob = await response.blob();
            
            // Upload to storage
            const newPath = `${userId}/${media.path.split('/').pop()}`;
            await supabaseClient.storage
              .from(media.bucket)
              .upload(newPath, blob, { upsert: true });
            
            mediaImported++;
            setImportProgress(75 + Math.round((mediaImported / totalMedia) * 20));
            setImportStatus(`Importiere Medien: ${mediaImported}/${totalMedia}`);
          } catch (err) {
            console.error('Media import error:', err);
          }
        }
      }

      // Import photos metadata
      setImportStatus('Importiere Foto-Metadaten...');
      if (importData.photos?.length) {
        for (const photo of importData.photos) {
          if (photo.deleted_at) continue;
          await supabaseClient.from('photos').insert({
            user_id: userId,
            filename: photo.filename,
            caption: photo.caption,
            is_favorite: photo.is_favorite,
            taken_at: photo.taken_at,
            tags: photo.tags,
          }).select().maybeSingle();
        }
      }

      // Import files metadata
      setImportStatus('Importiere Datei-Metadaten...');
      if (importData.files?.length) {
        for (const file of importData.files) {
          if (file.deleted_at) continue;
          await supabaseClient.from('files').insert({
            user_id: userId,
            filename: file.filename,
            mime_type: file.mime_type,
            size: file.size,
            is_favorite: file.is_favorite,
            tags: file.tags,
          }).select().maybeSingle();
        }
      }

      setImportProgress(100);
      setImportStatus('Fertig!');

      const totalImported =
        (importData.notes?.length || 0) +
        (importData.links?.length || 0) +
        (importData.photos?.length || 0) +
        (importData.files?.length || 0);

      toast.success(`Import abgeschlossen: ${totalImported} Elemente importiert`);
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

  // Restore from cloud backup
  const handleRestore = async (version: BackupVersion) => {
    if (!userId) return;

    setSelectedVersion(version);
    setShowRestoreDialog(true);
  };

  const confirmRestore = async () => {
    if (!selectedVersion || !userId) return;

    setShowRestoreDialog(false);
    setIsImporting(true);
    setImportProgress(0);
    setImportStatus('Lade Backup aus Cloud...');

    try {
      const { data, error } = await supabaseClient.storage
        .from('backups')
        .download(selectedVersion.storage_path);

      if (error || !data) {
        throw new Error('Backup konnte nicht geladen werden');
      }

      const text = await data.text();
      
      // Check if encrypted
      if (selectedVersion.filename.endsWith('.vault')) {
        const fileBlob = new Blob([data], { type: 'application/octet-stream' });
        const file = new globalThis.File([fileBlob], selectedVersion.filename);
        setPendingFile(file);
        setShowPasswordDialog(true);
        setIsImporting(false);
      } else {
        const fileBlob = new Blob([text], { type: 'application/json' });
        const file = new globalThis.File([fileBlob], selectedVersion.filename);
        await processImport(file);
      }
    } catch (error: any) {
      console.error('Restore error:', error);
      toast.error(error.message || 'Wiederherstellung fehlgeschlagen');
      setIsImporting(false);
    }
  };

  // Delete backup version
  const handleDeleteVersion = async (version: BackupVersion) => {
    if (!userId) return;

    try {
      // Delete from storage
      await supabaseClient.storage
        .from('backups')
        .remove([version.storage_path]);

      // Delete record
      await supabaseClient
        .from('backup_versions')
        .delete()
        .eq('id', version.id);

      await fetchBackupData();
      toast.success('Backup gelöscht');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Löschen fehlgeschlagen');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="export" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="w-4 h-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="cloud" className="gap-2">
            <Cloud className="w-4 h-4" />
            Cloud
          </TabsTrigger>
        </TabsList>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Download className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-foreground">Vollständiges Backup</h2>
            </div>

            <div className="space-y-4">
              {/* Include Media Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <Image className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="font-medium text-foreground">Medien einschließen</p>
                    <p className="text-xs text-muted-foreground">Fotos, Videos und Dateien</p>
                  </div>
                </div>
                <Switch checked={includeMedia} onCheckedChange={setIncludeMedia} />
              </div>

              {/* Save to Cloud Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <Cloud className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="font-medium text-foreground">In Cloud speichern</p>
                    <p className="text-xs text-muted-foreground">Zusätzlich zur lokalen Datei</p>
                  </div>
                </div>
                <Switch checked={saveToCloud} onCheckedChange={setSaveToCloud} />
              </div>

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
                  <FileJson className={cn("w-6 h-6", format === 'json' ? "text-primary" : "text-muted-foreground")} />
                  <div className="text-left">
                    <p className="font-medium text-foreground">JSON</p>
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
                  <Archive className={cn("w-6 h-6", format === 'encrypted' ? "text-primary" : "text-muted-foreground")} />
                  <div className="text-left">
                    <p className="font-medium text-foreground">Verschlüsselt</p>
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
                  >
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Backup-Passwort..."
                        className={cn(
                          "w-full px-4 py-3 pr-10 rounded-xl",
                          "bg-muted border border-border",
                          "text-foreground placeholder:text-muted-foreground",
                          "focus:outline-none focus:border-primary/50"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Progress */}
              <AnimatePresence>
                {isExporting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span>{exportStatus}</span>
                      <span>{Math.round(exportProgress)}%</span>
                    </div>
                    <Progress value={exportProgress} className="h-2" />
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                onClick={handleExport}
                disabled={isExporting || (format === 'encrypted' && !password)}
                className="w-full"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {isExporting ? 'Exportiere...' : 'Backup erstellen'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Upload className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-foreground">Backup wiederherstellen</h2>
            </div>

            <div className="space-y-4">
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
                  >
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span>{importStatus}</span>
                      <span>{Math.round(importProgress)}%</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                  </motion.div>
                )}
              </AnimatePresence>

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
                className="w-full"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {isImporting ? 'Importiere...' : 'Datei auswählen'}
              </Button>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  Unterstützt .json und .vault Dateien inkl. Medien aus Version 3.0+
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Cloud Backups Tab */}
        <TabsContent value="cloud" className="space-y-4">
          {/* Auto-Backup Settings */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-foreground">Automatische Backups</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="font-medium text-foreground">Auto-Backup</p>
                    <p className="text-xs text-muted-foreground">Regelmäßige Cloud-Backups</p>
                  </div>
                </div>
                <Switch
                  checked={backupSettings.auto_backup_enabled}
                  onCheckedChange={(checked) => updateBackupSettings({ auto_backup_enabled: checked })}
                />
              </div>

              <AnimatePresence>
                {backupSettings.auto_backup_enabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Häufigkeit:</label>
                      <Select
                        value={backupSettings.backup_frequency}
                        onValueChange={(v) => updateBackupSettings({ backup_frequency: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Täglich</SelectItem>
                          <SelectItem value="weekly">Wöchentlich</SelectItem>
                          <SelectItem value="monthly">Monatlich</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Image className="w-5 h-5 text-purple-400" />
                        <p className="font-medium text-foreground">Medien einschließen</p>
                      </div>
                      <Switch
                        checked={backupSettings.include_media}
                        onCheckedChange={(checked) => updateBackupSettings({ include_media: checked })}
                      />
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Max. Versionen: {backupSettings.max_versions}</label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={backupSettings.max_versions}
                        onChange={(e) => updateBackupSettings({ max_versions: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>

                    {backupSettings.last_auto_backup && (
                      <p className="text-sm text-muted-foreground">
                        Letztes Auto-Backup: {formatDate(backupSettings.last_auto_backup)}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Backup Versions List */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold text-foreground">Gespeicherte Backups</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchBackupData}
                disabled={isLoadingVersions}
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
                <Cloud className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Keine Cloud-Backups vorhanden</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {backupVersions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          version.is_auto_backup ? "bg-green-500/20" : "bg-blue-500/20"
                        )}>
                          {version.is_auto_backup ? (
                            <RefreshCw className="w-5 h-5 text-green-400" />
                          ) : (
                            <Archive className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{version.filename}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(version.created_at)}</span>
                            <span>•</span>
                            <span>{formatSize(version.size_bytes)}</span>
                            {version.includes_media && (
                              <>
                                <span>•</span>
                                <Image className="w-3 h-3" />
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(version)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteVersion(version)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Password Dialog */}
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
                className={cn(
                  "w-full px-4 py-3 pr-10 rounded-xl",
                  "bg-muted border border-border",
                  "text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:border-primary/50"
                )}
                onKeyDown={(e) => e.key === 'Enter' && pendingFile && processImport(pendingFile, importPassword)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowImportPassword(!showImportPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Backup wiederherstellen?
            </DialogTitle>
            <DialogDescription>
              Dies wird alle Daten aus dem Backup importieren. Bestehende Daten bleiben erhalten.
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="py-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Backup vom {formatDate(selectedVersion.created_at)}
              </p>
              <p className="text-sm text-muted-foreground">
                Größe: {formatSize(selectedVersion.size_bytes)}
                {selectedVersion.includes_media && ' (inkl. Medien)'}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRestoreDialog(false)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button onClick={confirmRestore} className="flex-1">
              Wiederherstellen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
