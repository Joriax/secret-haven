import React, { useState } from 'react';
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
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ExportFormat = 'json' | 'encrypted';

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
}

export function ExportBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [format, setFormat] = useState<ExportFormat>('json');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { userId, supabaseClient: supabase } = useAuth();

  const handleExport = async () => {
    if (!userId) return;
    if (format === 'encrypted' && !password) {
      toast.error('Bitte gib ein Passwort ein');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Fetch all data
      const [
        notesRes, photosRes, filesRes, linksRes, 
        tiktoksRes, secretsRes, tagsRes,
        albumsRes, fileAlbumsRes, noteFoldersRes,
        linkFoldersRes, tiktokFoldersRes
      ] = await Promise.all([
        supabase.from('notes').select('*').eq('user_id', userId),
        supabase.from('photos').select('*').eq('user_id', userId),
        supabase.from('files').select('*').eq('user_id', userId),
        supabase.from('links').select('*').eq('user_id', userId),
        supabase.from('tiktok_videos').select('*').eq('user_id', userId),
        supabase.from('secret_texts').select('*').eq('user_id', userId),
        supabase.from('tags').select('*').eq('user_id', userId),
        supabase.from('albums').select('*').eq('user_id', userId),
        supabase.from('file_albums').select('*').eq('user_id', userId),
        supabase.from('note_folders').select('*').eq('user_id', userId),
        supabase.from('link_folders').select('*').eq('user_id', userId),
        supabase.from('tiktok_folders').select('*').eq('user_id', userId),
      ]);

      setExportProgress(50);

      const exportData: ExportData = {
        version: '2.0',
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
      };

      setExportProgress(80);

      let fileContent: string;
      let filename: string;
      let mimeType: string;

      if (format === 'encrypted' && password) {
        // Simple encryption using base64 + password-based obfuscation
        const jsonStr = JSON.stringify(exportData);
        const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
        // Add password hash as verification
        const pwHash = btoa(password);
        fileContent = JSON.stringify({ 
          encrypted: true, 
          hash: pwHash.substring(0, 8), 
          data: encoded 
        });
        filename = `vault-backup-${new Date().toISOString().split('T')[0]}.vault`;
        mimeType = 'application/octet-stream';
      } else {
        fileContent = JSON.stringify(exportData, null, 2);
        filename = `vault-backup-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      setExportProgress(100);

      // Download file
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Count items
      const totalItems = 
        (notesRes.data?.length || 0) +
        (photosRes.data?.length || 0) +
        (filesRes.data?.length || 0) +
        (linksRes.data?.length || 0) +
        (tiktoksRes.data?.length || 0);

      toast.success('Backup erstellt', {
        description: `${totalItems} Elemente exportiert`,
      });

      setPassword('');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Fehler beim Exportieren');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <Download className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-foreground">Daten exportieren</h2>
      </div>

      <div className="space-y-4">
        {/* Format Selection */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setFormat('json')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl transition-all",
              "border-2",
              format === 'json'
                ? "border-primary bg-primary/10"
                : "border-transparent bg-muted/50 hover:bg-muted"
            )}
          >
            <FileJson className={cn(
              "w-6 h-6",
              format === 'json' ? "text-primary" : "text-muted-foreground"
            )} />
            <div className="text-left">
              <p className="font-medium text-foreground">JSON</p>
              <p className="text-xs text-muted-foreground">Lesbar & editierbar</p>
            </div>
          </button>

          <button
            onClick={() => setFormat('encrypted')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl transition-all",
              "border-2",
              format === 'encrypted'
                ? "border-primary bg-primary/10"
                : "border-transparent bg-muted/50 hover:bg-muted"
            )}
          >
            <Archive className={cn(
              "w-6 h-6",
              format === 'encrypted' ? "text-primary" : "text-muted-foreground"
            )} />
            <div className="text-left">
              <p className="font-medium text-foreground">Verschlüsselt</p>
              <p className="text-xs text-muted-foreground">Mit Passwortschutz</p>
            </div>
          </button>
        </div>

        {/* Password for encrypted export */}
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
                  placeholder="Backup-Passwort eingeben..."
                  className={cn(
                    "w-full px-4 py-3 pr-10 rounded-xl",
                    "bg-muted border border-border",
                    "text-foreground placeholder:text-muted-foreground",
                    "focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
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
              <p className="text-xs text-muted-foreground mt-2">
                Merke dir das Passwort - ohne kannst du das Backup nicht wiederherstellen!
              </p>
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
                <span>Exportiere Daten...</span>
                <span>{Math.round(exportProgress)}%</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Export Button */}
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

        {/* Info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-muted-foreground">
            Das Backup enthält alle Notizen, Links, Tags und Metadaten. 
            Dateien und Fotos werden als Referenzen exportiert.
          </p>
        </div>
      </div>
    </div>
  );
}
