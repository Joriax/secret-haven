import React, { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, RotateCcw, ArrowLeftRight, Plus, Minus, X } from 'lucide-react';
import { diffLines, Change } from 'diff';
import { cn } from '@/lib/utils';

interface NoteVersion {
  id: string;
  note_id: string;
  version_number: number;
  title: string;
  content: string | null;
  created_at: string;
}

interface EnhancedVersionsModalProps {
  isOpen: boolean;
  versions: NoteVersion[];
  currentContent: string;
  onRestore: (version: NoteVersion) => void;
  onClose: () => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type ViewMode = 'list' | 'diff';

export const EnhancedVersionsModal = memo(function EnhancedVersionsModal({
  isOpen,
  versions,
  currentContent,
  onRestore,
  onClose,
}: EnhancedVersionsModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<NoteVersion | null>(null);

  // Calculate diff between two versions
  const diffResult = useMemo((): Change[] | null => {
    if (viewMode !== 'diff' || !selectedVersion) return null;
    
    const oldContent = compareVersion?.content || '';
    const newContent = selectedVersion.content || '';
    
    return diffLines(oldContent, newContent);
  }, [viewMode, selectedVersion, compareVersion]);

  const handleVersionClick = (version: NoteVersion) => {
    if (viewMode === 'diff') {
      if (!selectedVersion) {
        setSelectedVersion(version);
      } else if (!compareVersion && version.id !== selectedVersion.id) {
        setCompareVersion(version);
      } else {
        setSelectedVersion(version);
        setCompareVersion(null);
      }
    } else {
      setSelectedVersion(version);
    }
  };

  const resetDiff = () => {
    setSelectedVersion(null);
    setCompareVersion(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="glass-card p-6 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <History className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-bold text-foreground">Versionshistorie</h3>
              <span className="text-muted-foreground text-sm">{versions.length} Versionen</span>
              
              <div className="flex-1" />
              
              {/* View Mode Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-1">
                <button
                  onClick={() => { setViewMode('list'); resetDiff(); }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    viewMode === 'list' 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Liste
                </button>
                <button
                  onClick={() => { setViewMode('diff'); resetDiff(); }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                    viewMode === 'diff' 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Vergleich
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewMode === 'diff' && (
              <div className="mb-4 px-4 py-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                {!selectedVersion ? (
                  "Wähle die erste Version zum Vergleichen"
                ) : !compareVersion ? (
                  <>Vergleiche mit: <span className="text-primary font-medium">v{selectedVersion.version_number}</span> — Wähle die zweite Version</>
                ) : (
                  <div className="flex items-center gap-4">
                    <span>
                      <span className="text-destructive font-medium">v{compareVersion.version_number}</span>
                      <span className="mx-2">→</span>
                      <span className="text-green-500 font-medium">v{selectedVersion.version_number}</span>
                    </span>
                    <button
                      onClick={resetDiff}
                      className="text-primary hover:underline"
                    >
                      Zurücksetzen
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex-1 overflow-hidden flex gap-4">
              {/* Version List */}
              <div className={cn(
                "overflow-y-auto space-y-2",
                viewMode === 'diff' && diffResult ? "w-1/3" : "flex-1"
              )}>
                {versions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Keine früheren Versionen</p>
                    <p className="text-muted-foreground/60 text-sm mt-1">Versionen werden beim Speichern erstellt</p>
                  </div>
                ) : (
                  versions.map((version, index) => (
                    <motion.div 
                      key={version.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleVersionClick(version)}
                      className={cn(
                        "p-3 rounded-xl transition-colors cursor-pointer group",
                        selectedVersion?.id === version.id 
                          ? "bg-primary/20 border border-primary/40"
                          : compareVersion?.id === version.id
                            ? "bg-destructive/20 border border-destructive/40"
                            : "bg-muted/50 hover:bg-muted border border-transparent"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "font-semibold text-sm",
                              selectedVersion?.id === version.id 
                                ? "text-primary" 
                                : compareVersion?.id === version.id
                                  ? "text-destructive"
                                  : "text-foreground"
                            )}>
                              v{version.version_number}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {formatDate(version.created_at)}
                            </span>
                          </div>
                          <p className="text-foreground text-sm truncate">{version.title}</p>
                          {version.content && viewMode === 'list' && (
                            <p className="text-muted-foreground text-xs truncate mt-1">
                              {version.content.slice(0, 80)}...
                            </p>
                          )}
                        </div>
                        {viewMode === 'list' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRestore(version); }}
                            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary transition-all"
                            title="Diese Version wiederherstellen"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Diff View */}
              {viewMode === 'diff' && diffResult && (
                <div className="flex-1 overflow-y-auto border-l border-border pl-4">
                  <div className="font-mono text-sm space-y-0.5">
                    {diffResult.map((part, index) => (
                      <div
                        key={index}
                        className={cn(
                          "px-2 py-0.5 rounded-sm whitespace-pre-wrap",
                          part.added && "bg-green-500/20 text-green-400",
                          part.removed && "bg-destructive/20 text-destructive",
                          !part.added && !part.removed && "text-muted-foreground"
                        )}
                      >
                        <span className="inline-flex items-center gap-1">
                          {part.added && <Plus className="w-3 h-3 flex-shrink-0" />}
                          {part.removed && <Minus className="w-3 h-3 flex-shrink-0" />}
                          {part.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              {viewMode === 'diff' && selectedVersion && compareVersion ? (
                <button
                  onClick={() => onRestore(selectedVersion)}
                  className="px-6 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  v{selectedVersion.version_number} wiederherstellen
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
              >
                Schließen
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default EnhancedVersionsModal;
