import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Copy, 
  Trash2, 
  Search, 
  Image, 
  File, 
  CheckCircle,
  Loader2,
  HardDrive,
  AlertCircle,
  X,
  Play,
  Film
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDuplicateFinder } from '@/hooks/useDuplicateFinder';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|avi|mkv|m4v|3gp)$/i;

export default function DuplicateFinder() {
  const {
    isScanning,
    progress,
    progressPercent,
    duplicates,
    totalDuplicateSize,
    totalDuplicateCount,
    scanForDuplicates,
    cancelScan,
    deleteDuplicate,
    deleteAllDuplicates,
    deleteAllDuplicatesGlobally,
  } = useDuplicateFinder();

  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());

  const handleDeleteDuplicate = async (item: any) => {
    setDeletingItems(prev => new Set(prev).add(item.id));
    const success = await deleteDuplicate(item);
    setDeletingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(item.id);
      return newSet;
    });
    
    if (success) {
      toast.success('Duplikat in Papierkorb verschoben');
    } else {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleDeleteAllDuplicates = async (group: any) => {
    const success = await deleteAllDuplicates(group);
    if (success) {
      toast.success(`${group.items.length - 1} Duplikate in Papierkorb verschoben`);
    } else {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleCleanAll = async () => {
    const success = await deleteAllDuplicatesGlobally();
    if (success) {
      toast.success('Alle Duplikate bereinigt');
    } else {
      toast.error('Fehler beim Löschen');
    }
  };

  const isVideo = (filename: string) => VIDEO_EXTENSIONS.test(filename);

  const renderPreview = (item: any) => {
    if (isVideo(item.filename)) {
      return (
        <div className="w-full aspect-square bg-muted flex items-center justify-center relative">
          {item.url ? (
            <>
              <video 
                src={item.url} 
                className="w-full h-full object-cover"
                preload="metadata"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="w-8 h-8 text-white" fill="white" />
              </div>
            </>
          ) : (
            <Film className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
      );
    }
    
    if (item.url && item.type === 'photo') {
      return (
        <img
          src={item.url}
          alt={item.filename}
          className="w-full aspect-square object-cover"
          loading="lazy"
        />
      );
    }
    
    return (
      <div className="w-full aspect-square bg-muted flex items-center justify-center">
        <File className="w-8 h-8 text-muted-foreground" />
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title="Duplikat-Finder"
        subtitle="Finde und lösche doppelte Dateien"
        icon={<Copy className="w-5 h-5 text-primary" />}
        backTo="/dashboard"
      />

      {/* Stats Card */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
              <HardDrive className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {duplicates.length > 0 
                  ? `${totalDuplicateCount} Duplikate gefunden`
                  : progress.phase === 'done' && progress.current > 0
                    ? 'Keine Duplikate gefunden'
                    : 'Bereit zum Scannen'
                }
              </h2>
              <p className="text-muted-foreground text-sm">
                {duplicates.length > 0 
                  ? `${formatSize(totalDuplicateSize)} können freigegeben werden`
                  : 'Starte einen Scan um Duplikate zu finden'
                }
              </p>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {isScanning ? (
              <Button
                onClick={cancelScan}
                variant="destructive"
                className="flex-1 sm:flex-none"
              >
                <X className="w-4 h-4 mr-2" />
                Abbrechen
              </Button>
            ) : (
              <Button
                onClick={scanForDuplicates}
                className="flex-1 sm:flex-none"
              >
                <Search className="w-4 h-4 mr-2" />
                Scannen
              </Button>
            )}
            
            {duplicates.length > 0 && !isScanning && (
              <Button
                onClick={handleCleanAll}
                variant="destructive"
                className="flex-1 sm:flex-none"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Alle bereinigen
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progress.message}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>
                  {progress.phase === 'loading' && 'Laden...'}
                  {progress.phase === 'hashing' && 'Analysiere Dateien...'}
                  {progress.phase === 'analyzing' && 'Suche Duplikate...'}
                </span>
                {progress.total > 0 && (
                  <span>{progress.current} / {progress.total} Dateien</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* No Duplicates Message */}
      {!isScanning && duplicates.length === 0 && progress.phase === 'done' && progress.current > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center"
        >
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Keine Duplikate gefunden!
          </h3>
          <p className="text-muted-foreground">
            Deine Dateien sind alle einzigartig.
          </p>
        </motion.div>
      )}

      {/* Duplicate Groups */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {duplicates.map((group, groupIndex) => (
            <motion.div
              key={group.hash}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100, height: 0 }}
              transition={{ delay: groupIndex * 0.03 }}
              layout
              className="glass-card p-4"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    group.type === 'photo' ? "bg-pink-500/20" : "bg-blue-500/20"
                  )}>
                    {isVideo(group.originalName) ? (
                      <Film className="w-5 h-5 text-purple-400" />
                    ) : group.type === 'photo' ? (
                      <Image className="w-5 h-5 text-pink-400" />
                    ) : (
                      <File className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[400px]">
                      {group.originalName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {group.items.length} Kopien • {formatSize(group.size)} pro Datei
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteAllDuplicates(group)}
                  className="text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Duplikate löschen</span>
                  <span className="sm:hidden">Löschen</span>
                </Button>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {group.items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                      "relative rounded-xl overflow-hidden border transition-all",
                      index === 0 
                        ? "border-green-500/50 ring-2 ring-green-500/20" 
                        : "border-border hover:border-destructive/50",
                      deletingItems.has(item.id) && "opacity-50 pointer-events-none"
                    )}
                  >
                    {/* Preview */}
                    {renderPreview(item)}

                    {/* Badge */}
                    {index === 0 ? (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-green-500 text-white text-xs font-medium">
                        Original
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeleteDuplicate(item)}
                        disabled={deletingItems.has(item.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-destructive/90 text-white hover:bg-destructive transition-colors"
                      >
                        {deletingItems.has(item.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    {/* Date */}
                    <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-xs text-white/80 truncate">
                        {new Date(item.uploaded_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Savings Info */}
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Mögliche Einsparung: <span className="text-primary font-medium">{formatSize(group.size * (group.items.length - 1))}</span>
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
