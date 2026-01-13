import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AlbumDeleteConfirmDialogProps {
  isOpen: boolean;
  albumName: string;
  itemCount: number;
  onClose: () => void;
  onDeleteWithItems: () => void;
  onDeleteKeepItems: () => void;
}

export function AlbumDeleteConfirmDialog({
  isOpen,
  albumName,
  itemCount,
  onClose,
  onDeleteWithItems,
  onDeleteKeepItems,
}: AlbumDeleteConfirmDialogProps) {
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
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Album löschen</h3>
                <p className="text-sm text-muted-foreground">"{albumName}"</p>
              </div>
            </div>

            <p className="text-foreground mb-6">
              {itemCount > 0 ? (
                <>
                  Dieses Album enthält <strong>{itemCount} Element{itemCount !== 1 ? 'e' : ''}</strong>. 
                  Was soll mit den Inhalten passieren?
                </>
              ) : (
                'Möchtest du dieses Album wirklich löschen?'
              )}
            </p>

            <div className="space-y-2">
              {itemCount > 0 && (
                <>
                  <Button
                    onClick={onDeleteWithItems}
                    variant="destructive"
                    className="w-full justify-start gap-3"
                  >
                    <Trash2 className="w-4 h-4" />
                    Album und alle Inhalte löschen
                  </Button>
                  <Button
                    onClick={onDeleteKeepItems}
                    variant="outline"
                    className="w-full justify-start gap-3"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Nur Album löschen (Inhalte behalten)
                  </Button>
                </>
              )}
              {itemCount === 0 && (
                <Button
                  onClick={onDeleteKeepItems}
                  variant="destructive"
                  className="w-full"
                >
                  Album löschen
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="ghost"
                className="w-full"
              >
                Abbrechen
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
