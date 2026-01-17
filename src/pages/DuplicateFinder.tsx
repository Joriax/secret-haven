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
  Film,
  Fingerprint,
  FileText,
  Star,
  ChevronDown
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDuplicateFinder, ScanMode, DuplicateGroup, DuplicateItem } from '@/hooks/useDuplicateFinder';
import { cn, formatFileSize } from '@/lib/utils';
import { toast } from 'sonner';

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|avi|mkv|m4v|3gp)$/i;

const scanModeLabels: Record<ScanMode, { label: string; description: string; icon: React.ReactNode }> = {
  exact: {
    label: 'Exakte Duplikate',
    description: 'Identischer Inhalt (Hash-Vergleich)',
    icon: <Fingerprint className="w-4 h-4" />,
  },
  similar: {
    label: 'Ähnliche Dateien',
    description: 'Gleicher Name & ähnliche Größe',
    icon: <FileText className="w-4 h-4" />,
  },
  all: {
    label: 'Vollständiger Scan',
    description: 'Exakte + ähnliche Duplikate',
    icon: <Search className="w-4 h-4" />,
  },
};

export default function DuplicateFinder() {
  const {
    isScanning,
    scanMode,
    progress,
    progressPercent,
    duplicates,
    totalDuplicateSize,
    totalDuplicateCount,
    exactDuplicateCount,
    similarDuplicateCount,
    scanForDuplicates,
    cancelScan,
    deleteDuplicate,
    deleteAllDuplicates,
    deleteAllDuplicatesGlobally,
    keepAsOriginal,
  } = useDuplicateFinder();

  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [selectedMode, setSelectedMode] = useState<ScanMode>('all');
  const [filterType, setFilterType] = useState<'all' | 'exact' | 'similar'>('all');

  const handleDeleteDuplicate = async (item: DuplicateItem) => {
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

  const handleDeleteAllDuplicates = async (group: DuplicateGroup) => {
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

  const handleKeepAsOriginal = (groupHash: string, itemId: string) => {
    keepAsOriginal(groupHash, itemId);
    toast.success('Als Original markiert');
  };

  const isVideo = (filename: string) => VIDEO_EXTENSIONS.test(filename);

  const filteredDuplicates = duplicates.filter(group => {
    if (filterType === 'all') return true;
    return group.matchType === filterType;
  });

  const renderPreview = (item: DuplicateItem) => {
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

  const getMatchTypeBadge = (matchType: 'exact' | 'similar' | 'name-only') => {
    switch (matchType) {
      case 'exact':
        return (
          <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
            <Fingerprint className="w-3 h-3 mr-1" />
            Identisch
          </Badge>
        );
      case 'similar':
        return (
          <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <FileText className="w-3 h-3 mr-1" />
            Ähnlich
          </Badge>
        );
      default:
        return null;
    }
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
                  ? `${formatFileSize(totalDuplicateSize, 1)} können freigegeben werden`
                  : 'Starte einen Scan um Duplikate zu finden'
                }
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="flex-1 sm:flex-none gap-2">
                    <Search className="w-4 h-4" />
                    Scannen
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {Object.entries(scanModeLabels).map(([mode, { label, description, icon }]) => (
                    <DropdownMenuItem
                      key={mode}
                      onClick={() => {
                        setSelectedMode(mode as ScanMode);
                        scanForDuplicates(mode as ScanMode);
                      }}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        {icon}
                        {label}
                      </div>
                      <span className="text-xs text-muted-foreground pl-6">
                        {description}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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

        {/* Stats breakdown when duplicates found */}
        {duplicates.length > 0 && !isScanning && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{duplicates.length}</div>
              <div className="text-xs text-muted-foreground">Gruppen</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{exactDuplicateCount}</div>
              <div className="text-xs text-muted-foreground">Identische</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{similarDuplicateCount}</div>
              <div className="text-xs text-muted-foreground">Ähnliche</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{formatFileSize(totalDuplicateSize, 1)}</div>
              <div className="text-xs text-muted-foreground">Einsparung</div>
            </div>
          </div>
        )}

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
                  {progress.phase === 'loading' && 'Lade Dateien...'}
                  {progress.phase === 'fetching-sizes' && 'Ermittle Größen...'}
                  {progress.phase === 'hashing' && 'Berechne Hashes...'}
                  {progress.phase === 'analyzing' && 'Analysiere Duplikate...'}
                </span>
                {progress.total > 0 && (
                  <span>{progress.current} / {progress.total}</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Filter Tabs */}
      {duplicates.length > 0 && !isScanning && (
        <div className="flex gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
          >
            Alle ({duplicates.length})
          </Button>
          <Button
            variant={filterType === 'exact' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('exact')}
            className="gap-1"
          >
            <Fingerprint className="w-3 h-3" />
            Identisch ({duplicates.filter(g => g.matchType === 'exact').length})
          </Button>
          <Button
            variant={filterType === 'similar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('similar')}
            className="gap-1"
          >
            <FileText className="w-3 h-3" />
            Ähnlich ({duplicates.filter(g => g.matchType === 'similar').length})
          </Button>
        </div>
      )}

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
          {filteredDuplicates.map((group, groupIndex) => (
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
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[400px]">
                        {group.originalName}
                      </h3>
                      {getMatchTypeBadge(group.matchType)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {group.items.length} Kopien • {formatFileSize(group.size, 1)} pro Datei
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
                      "relative rounded-xl overflow-hidden border transition-all group/item",
                      index === 0 
                        ? "border-green-500/50 ring-2 ring-green-500/20" 
                        : "border-border hover:border-destructive/50",
                      deletingItems.has(item.id) && "opacity-50 pointer-events-none"
                    )}
                  >
                    {/* Preview */}
                    {renderPreview(item)}

                    {/* Badge & Actions */}
                    {index === 0 ? (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-green-500 text-white text-xs font-medium flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Original
                      </div>
                    ) : (
                      <>
                        {/* Keep as Original button (visible on hover) */}
                        <button
                          onClick={() => handleKeepAsOriginal(group.hash, item.id)}
                          className="absolute top-2 left-2 p-1.5 rounded-md bg-green-500/90 text-white hover:bg-green-500 transition-all opacity-0 group-hover/item:opacity-100"
                          title="Als Original behalten"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete button */}
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
                      </>
                    )}

                    {/* Date & Size */}
                    <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-xs text-white/80 truncate">
                        {new Date(item.uploaded_at).toLocaleDateString('de-DE')}
                      </p>
                      {item.size > 0 && (
                        <p className="text-xs text-white/60">
                          {formatFileSize(item.size, 1)}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Savings Info */}
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Mögliche Einsparung: <span className="text-primary font-medium">{formatFileSize(group.size * (group.items.length - 1), 1)}</span>
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
