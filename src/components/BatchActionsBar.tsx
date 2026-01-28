import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Trash2, 
  Star, 
  Tag, 
  FolderInput, 
  Download,
  Share2,
  CheckSquare,
  Square,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface BatchItem {
  id: string;
  type: 'note' | 'photo' | 'file' | 'link' | 'tiktok';
  title: string;
  isFavorite?: boolean;
}

interface BatchActionsBarProps {
  selectedItems: BatchItem[];
  totalItems: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: (ids: string[]) => Promise<void>;
  onToggleFavorite?: (ids: string[], favorite: boolean) => Promise<void>;
  onMove?: (ids: string[], targetId: string | null) => Promise<void>;
  onAddTags?: (ids: string[], tags: string[]) => Promise<void>;
  onExport?: (ids: string[]) => Promise<void>;
  onShare?: (ids: string[]) => void;
  availableFolders?: { id: string; name: string }[];
  availableTags?: { id: string; name: string; color: string }[];
  className?: string;
}

export const BatchActionsBar: React.FC<BatchActionsBarProps> = ({
  selectedItems,
  totalItems,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onToggleFavorite,
  onMove,
  onAddTags,
  onExport,
  onShare,
  availableFolders = [],
  availableTags = [],
  className,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedIds = selectedItems.map(item => item.id);
  const allFavorites = selectedItems.every(item => item.isFavorite);
  const isVisible = selectedItems.length > 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(selectedIds);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!onToggleFavorite) return;
    setIsProcessing(true);
    try {
      await onToggleFavorite(selectedIds, !allFavorites);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMove = async (folderId: string | null) => {
    if (!onMove) return;
    setIsProcessing(true);
    try {
      await onMove(selectedIds, folderId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!onAddTags) return;
    setIsProcessing(true);
    try {
      await onAddTags(selectedIds, [tagName]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!onExport) return;
    setIsProcessing(true);
    try {
      await onExport(selectedIds);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
              'bg-card/95 backdrop-blur-md border shadow-2xl rounded-2xl',
              'px-4 py-3 flex items-center gap-4',
              className
            )}
          >
            {/* Selection Info */}
            <div className="flex items-center gap-3 pr-4 border-r">
              <Button
                variant="ghost"
                size="icon"
                onClick={onDeselectAll}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
              <div className="text-sm">
                <span className="font-semibold text-primary">{selectedItems.length}</span>
                <span className="text-muted-foreground"> von {totalItems} ausgewählt</span>
              </div>
              {selectedItems.length < totalItems && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSelectAll}
                  className="h-7 text-xs"
                >
                  <CheckSquare className="w-3 h-3 mr-1" />
                  Alle
                </Button>
              )}
            </div>

            {/* Primary Actions */}
            <div className="flex items-center gap-1">
              {/* Favorite Toggle */}
              {onToggleFavorite && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleFavorite}
                  disabled={isProcessing}
                  className="h-9"
                >
                  <Star className={cn(
                    'w-4 h-4 mr-1.5',
                    allFavorites && 'fill-yellow-500 text-yellow-500'
                  )} />
                  {allFavorites ? 'Entfernen' : 'Favorit'}
                </Button>
              )}

              {/* Move */}
              {onMove && availableFolders.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={isProcessing} className="h-9">
                      <FolderInput className="w-4 h-4 mr-1.5" />
                      Verschieben
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="max-h-64 overflow-y-auto">
                    <DropdownMenuItem onClick={() => handleMove(null)}>
                      Kein Ordner
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {availableFolders.map(folder => (
                      <DropdownMenuItem 
                        key={folder.id} 
                        onClick={() => handleMove(folder.id)}
                      >
                        {folder.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Tags */}
              {onAddTags && availableTags.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={isProcessing} className="h-9">
                      <Tag className="w-4 h-4 mr-1.5" />
                      Tag
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="max-h-64 overflow-y-auto">
                    {availableTags.map(tag => (
                      <DropdownMenuItem 
                        key={tag.id} 
                        onClick={() => handleAddTag(tag.name)}
                      >
                        <span 
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* More Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={isProcessing} className="h-9">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onExport && (
                    <DropdownMenuItem onClick={handleExport}>
                      <Download className="w-4 h-4 mr-2" />
                      Exportieren
                    </DropdownMenuItem>
                  )}
                  {onShare && (
                    <DropdownMenuItem onClick={() => onShare(selectedIds)}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Teilen
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Löschen ({selectedItems.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Delete Button */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="h-9"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Löschen
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedItems.length} Element{selectedItems.length !== 1 ? 'e' : ''} löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion verschiebt die ausgewählten Elemente in den Papierkorb.
              Du kannst sie von dort wiederherstellen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-32 overflow-y-auto my-4 space-y-1">
            {selectedItems.slice(0, 5).map(item => (
              <div key={item.id} className="text-sm text-muted-foreground truncate">
                • {item.title}
              </div>
            ))}
            {selectedItems.length > 5 && (
              <div className="text-sm text-muted-foreground">
                ... und {selectedItems.length - 5} weitere
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Lösche...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
