import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, RotateCcw } from 'lucide-react';

interface NoteVersion {
  id: string;
  note_id: string;
  version_number: number;
  title: string;
  content: string | null;
  created_at: string;
}

interface NoteVersionsModalProps {
  isOpen: boolean;
  versions: NoteVersion[];
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

export const NoteVersionsModal = memo(function NoteVersionsModal({
  isOpen,
  versions,
  onRestore,
  onClose,
}: NoteVersionsModalProps) {
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
            className="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <History className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-bold text-foreground">Versionshistorie</h3>
              <span className="text-muted-foreground text-sm ml-auto">{versions.length} Versionen</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3">
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
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-primary font-semibold text-sm">v{version.version_number}</span>
                          <span className="text-muted-foreground text-xs">•</span>
                          <span className="text-muted-foreground text-sm">{formatDate(version.created_at)}</span>
                        </div>
                        <p className="text-foreground font-medium truncate">{version.title}</p>
                        {version.content && (
                          <p className="text-muted-foreground text-sm truncate mt-1">{version.content.slice(0, 100)}...</p>
                        )}
                      </div>
                      <button
                        onClick={() => onRestore(version)}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary transition-all"
                        title="Diese Version wiederherstellen"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex justify-end">
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

export default NoteVersionsModal;
