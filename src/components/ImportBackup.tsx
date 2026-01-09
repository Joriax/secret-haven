import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Loader2, 
  FileJson, 
  Archive,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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

type ConflictResolution = 'skip' | 'overwrite' | 'duplicate';

interface ImportData {
  version: string;
  exported_at: string;
  user_id: string;
  notes?: any[];
  photos?: any[];
  files?: any[];
  links?: any[];
  tiktok_videos?: any[];
  secret_texts?: any[];
  tags?: any[];
  albums?: any[];
  file_albums?: any[];
  note_folders?: any[];
  link_folders?: any[];
  tiktok_folders?: any[];
}

interface ImportStats {
  notes: { total: number; imported: number; skipped: number };
  links: { total: number; imported: number; skipped: number };
  tags: { total: number; imported: number; skipped: number };
  albums: { total: number; imported: number; skipped: number };
  folders: { total: number; imported: number; skipped: number };
}

export function ImportBackup() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip');
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userId, supabaseClient: supabase } = useAuth();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.vault')) {
      // Encrypted file - need password
      setPendingFile(file);
      setShowPasswordDialog(true);
    } else if (file.name.endsWith('.json')) {
      // Plain JSON
      await processImport(file);
    } else {
      toast.error('Ungültiges Dateiformat. Nur .json oder .vault Dateien werden unterstützt.');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImport = async (file: File, encryptionPassword?: string) => {
    if (!userId) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const text = await file.text();
      let importData: ImportData;

      if (encryptionPassword) {
        // Decrypt
        try {
          const encrypted = JSON.parse(text);
          if (!encrypted.encrypted || !encrypted.data) {
            throw new Error('Ungültiges verschlüsseltes Format');
          }
          
          // Verify password hash
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

      // Validate structure
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
      };

      // Import tags first (needed for references)
      if (importData.tags && importData.tags.length > 0) {
        stats.tags.total = importData.tags.length;
        const { data: existingTags } = await supabase
          .from('tags')
          .select('name')
          .eq('user_id', userId);
        
        const existingTagNames = new Set((existingTags || []).map(t => t.name.toLowerCase()));
        
        for (const tag of importData.tags) {
          if (existingTagNames.has(tag.name.toLowerCase())) {
            if (conflictResolution === 'skip') {
              stats.tags.skipped++;
              continue;
            } else if (conflictResolution === 'duplicate') {
              tag.name = `${tag.name} (Import)`;
            }
          }
          
          const { error } = await supabase.from('tags').insert({
            user_id: userId,
            name: tag.name,
            color: tag.color,
          });
          
          if (!error) stats.tags.imported++;
          else stats.tags.skipped++;
        }
      }
      setImportProgress(20);

      // Import folders
      const folderTypes = ['note_folders', 'link_folders', 'tiktok_folders'];
      for (const folderType of folderTypes) {
        const folders = (importData as any)[folderType] as any[];
        if (folders && folders.length > 0) {
          stats.folders.total += folders.length;
          
          for (const folder of folders) {
            const { error } = await supabase.from(folderType as any).insert({
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
      const albumTypes = ['albums', 'file_albums'];
      for (const albumType of albumTypes) {
        const albums = (importData as any)[albumType] as any[];
        if (albums && albums.length > 0) {
          stats.albums.total += albums.length;
          
          for (const album of albums) {
            const { error } = await supabase.from(albumType as any).insert({
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
      if (importData.notes && importData.notes.length > 0) {
        stats.notes.total = importData.notes.length;
        
        for (const note of importData.notes) {
          // Skip deleted items
          if (note.deleted_at) {
            stats.notes.skipped++;
            continue;
          }
          
          const { error } = await supabase.from('notes').insert({
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
      setImportProgress(70);

      // Import links
      if (importData.links && importData.links.length > 0) {
        stats.links.total = importData.links.length;
        
        for (const link of importData.links) {
          if (link.deleted_at) {
            stats.links.skipped++;
            continue;
          }
          
          const { error } = await supabase.from('links').insert({
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
      setImportProgress(85);

      // Import secret texts
      if (importData.secret_texts && importData.secret_texts.length > 0) {
        for (const secret of importData.secret_texts) {
          await supabase.from('secret_texts').insert({
            user_id: userId,
            title: secret.title || 'Importierter Text',
            encrypted_content: secret.encrypted_content,
          });
        }
      }
      setImportProgress(100);

      setImportStats(stats);
      setShowStatsDialog(true);
      
      const totalImported = stats.notes.imported + stats.links.imported + 
                           stats.tags.imported + stats.albums.imported + 
                           stats.folders.imported;
      
      toast.success(`Import abgeschlossen: ${totalImported} Elemente importiert`);

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Fehler beim Importieren');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setShowPasswordDialog(false);
      setPendingFile(null);
      setPassword('');
    }
  };

  const handlePasswordSubmit = async () => {
    if (!pendingFile || !password) return;
    await processImport(pendingFile, password);
  };

  return (
    <>
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Upload className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-foreground">Daten importieren</h2>
        </div>

        <div className="space-y-4">
          {/* Conflict Resolution */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Bei Konflikten:
            </label>
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
                  <span>Importiere Daten...</span>
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
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground">
              Unterstützt .json und .vault Dateien. Fotos und Dateien müssen separat hochgeladen werden.
            </p>
          </div>
        </div>
      </div>

      {/* Password Dialog for encrypted files */}
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
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Backup-Passwort..."
                className={cn(
                  "w-full px-4 py-3 pr-10 rounded-xl",
                  "bg-muted border border-border",
                  "text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                )}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPendingFile(null);
                  setPassword('');
                }}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handlePasswordSubmit}
                disabled={!password}
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
            <div className="space-y-3 py-4">
              <StatRow label="Notizen" stats={importStats.notes} />
              <StatRow label="Links" stats={importStats.links} />
              <StatRow label="Tags" stats={importStats.tags} />
              <StatRow label="Alben" stats={importStats.albums} />
              <StatRow label="Ordner" stats={importStats.folders} />
            </div>
          )}
          
          <Button onClick={() => setShowStatsDialog(false)} className="w-full">
            Schließen
          </Button>
        </DialogContent>
      </Dialog>
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
