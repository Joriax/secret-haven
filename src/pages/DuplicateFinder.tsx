import React from 'react';
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
  AlertCircle
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

export default function DuplicateFinder() {
  const {
    isScanning,
    progress,
    duplicates,
    totalDuplicateSize,
    totalDuplicateCount,
    scanForDuplicates,
    deleteDuplicate,
    deleteAllDuplicates,
  } = useDuplicateFinder();

  const handleDeleteDuplicate = async (item: any) => {
    const success = await deleteDuplicate(item);
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
    for (const group of duplicates) {
      await deleteAllDuplicates(group);
    }
    toast.success('Alle Duplikate bereinigt');
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
                  : 'Keine Duplikate gefunden'
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
            <Button
              onClick={scanForDuplicates}
              disabled={isScanning}
              className="flex-1 sm:flex-none"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              {isScanning ? 'Scanne...' : 'Scannen'}
            </Button>
            
            {duplicates.length > 0 && (
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
                <span>Durchsuche Dateien...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* No Duplicates Message */}
      {!isScanning && duplicates.length === 0 && progress === 100 && (
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
        <AnimatePresence>
          {duplicates.map((group, groupIndex) => (
            <motion.div
              key={group.hash}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: groupIndex * 0.05 }}
              className="glass-card p-4"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    group.type === 'photo' ? "bg-pink-500/20" : "bg-blue-500/20"
                  )}>
                    {group.type === 'photo' ? (
                      <Image className="w-5 h-5 text-pink-400" />
                    ) : (
                      <File className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">
                      {group.items[0].filename.replace(/^\d+-/, '')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {group.items.length} Kopien · {formatSize(group.size)} pro Datei
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteAllDuplicates(group)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Duplikate löschen
                </Button>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {group.items.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      "relative rounded-xl overflow-hidden border transition-all",
                      index === 0 
                        ? "border-green-500/50 ring-2 ring-green-500/20" 
                        : "border-border hover:border-destructive/50"
                    )}
                  >
                    {/* Preview */}
                    {item.url && group.type === 'photo' ? (
                      <img
                        src={item.url}
                        alt={item.filename}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-muted flex items-center justify-center">
                        <File className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}

                    {/* Badge */}
                    {index === 0 ? (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-green-500 text-white text-xs font-medium">
                        Original
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeleteDuplicate(item)}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-destructive/90 text-white hover:bg-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Date */}
                    <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-xs text-white/80 truncate">
                        {new Date(item.uploaded_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Savings Info */}
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
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
