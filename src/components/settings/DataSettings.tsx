import React, { useState } from 'react';
import { Upload, Download, FolderX, AlertCircle } from 'lucide-react';
import { BackupManager } from '@/components/BackupManager';
import { ScheduledBackups } from '@/components/ScheduledBackups';
import { ImportManager } from '@/components/ImportManager';
import { HiddenAlbumsManager } from '@/components/HiddenAlbumsManager';
import { DecoyVaultManager } from '@/components/DecoyVaultManager';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const sectionFallback = (title: string) => (
  <div className="p-4 rounded-xl bg-muted/30 border border-border">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-4 h-4 text-destructive" />
      <p className="text-sm text-foreground font-medium">{title} konnte nicht geladen werden</p>
    </div>
    <p className="text-sm text-muted-foreground mt-2">
      Bitte Seite neu laden oder später erneut versuchen.
    </p>
  </div>
);

export const DataSettings: React.FC = () => {
  const [showImportManager, setShowImportManager] = useState(false);
  const [showHiddenAlbums, setShowHiddenAlbums] = useState(false);
  const { userId } = useAuth();

  const handleImport = async (items: any[]) => {
    if (!userId) return { total: 0, imported: 0, skipped: 0, errors: [] };
    
    let imported = 0;
    const errors: string[] = [];
    
    for (const item of items) {
      try {
        if (item.type === 'note') {
          await supabase.from('notes').insert({
            user_id: userId,
            title: item.title,
            content: item.content,
            tags: item.tags || [],
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(err.message || 'Unknown error');
      }
    }
    
    return {
      total: items.length,
      imported,
      skipped: items.length - imported - errors.length,
      errors,
    };
  };

  return (
    <div className="space-y-4">
      {/* Backup Manager */}
      <ErrorBoundary fallback={sectionFallback('Backups')}>
        <BackupManager />
      </ErrorBoundary>

      {/* Scheduled Backups */}
      <ErrorBoundary fallback={sectionFallback('Geplante Backups')}>
        <ScheduledBackups />
      </ErrorBoundary>

      {/* Import Section */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="w-5 h-5 text-green-500" />
          <h3 className="text-base font-semibold text-foreground">Daten importieren</h3>
        </div>
        
        <button
          onClick={() => setShowImportManager(true)}
          className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            </div>
            <div className="text-left">
              <h4 className="font-medium text-foreground text-sm sm:text-base">Aus anderen Apps</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">Evernote, Notion, Google Keep</p>
            </div>
          </div>
        </button>
      </div>

      {/* Hidden Albums */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FolderX className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-semibold text-foreground">Ausgeblendete Alben</h3>
          </div>
          <button
            onClick={() => setShowHiddenAlbums(!showHiddenAlbums)}
            className="text-sm text-primary hover:underline"
          >
            {showHiddenAlbums ? 'Schließen' : 'Verwalten'}
          </button>
        </div>
        
        <p className="text-xs sm:text-sm text-muted-foreground mb-4">
          Blende Alben aus, um sie vollständig zu verstecken.
        </p>
        
        {showHiddenAlbums && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <ErrorBoundary fallback={sectionFallback('Ausgeblendete Alben')}>
              <HiddenAlbumsManager />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* Decoy Vault Manager */}
      <div className="glass-card p-4 sm:p-6">
        <ErrorBoundary fallback={sectionFallback('Tarn-Vault')}>
          <DecoyVaultManager />
        </ErrorBoundary>
      </div>

      {/* Import Manager Dialog */}
      <ErrorBoundary fallback={null}>
        <ImportManager 
          open={showImportManager}
          onClose={() => setShowImportManager(false)}
          onImport={handleImport}
        />
      </ErrorBoundary>
    </div>
  );
};
