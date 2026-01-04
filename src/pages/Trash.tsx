import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Trash2, 
  RotateCcw, 
  FileText, 
  Image, 
  FolderOpen,
  Clock,
  AlertTriangle,
  Video,
  CheckCircle2,
  Play
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { MultiSelectBar } from '@/components/MultiSelect';
import { toast } from 'sonner';

interface TrashItem {
  id: string;
  type: 'note' | 'photo' | 'file' | 'tiktok';
  name: string;
  deleted_at: string;
  daysLeft: number;
  isVideo?: boolean;
}

const TRASH_RETENTION_DAYS = 30;

export default function Trash() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TrashItem | null>(null);
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
  const { userId, isDecoyMode, supabaseClient: supabase } = useAuth();

  // Auto-cleanup expired items (client-side backup for cron job)
  const cleanupExpiredItems = useCallback(async () => {
    if (!userId) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS);
    const cutoffDateStr = cutoffDate.toISOString();

    try {
      // Find and delete expired notes
      const { data: expiredNotes } = await supabase
        .from('notes')
        .select('id')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDateStr);

      if (expiredNotes && expiredNotes.length > 0) {
        await supabase
          .from('notes')
          .delete()
          .in('id', expiredNotes.map(n => n.id));
        console.log(`Auto-deleted ${expiredNotes.length} expired notes`);
      }

      // Find and delete expired photos
      const { data: expiredPhotos } = await supabase
        .from('photos')
        .select('id, filename')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDateStr);

      if (expiredPhotos && expiredPhotos.length > 0) {
        for (const photo of expiredPhotos) {
          if (photo.filename) {
            await supabase.storage.from('photos').remove([`${userId}/${photo.filename}`]);
          }
        }
        await supabase
          .from('photos')
          .delete()
          .in('id', expiredPhotos.map(p => p.id));
        console.log(`Auto-deleted ${expiredPhotos.length} expired photos`);
      }

      // Find and delete expired files
      const { data: expiredFiles } = await supabase
        .from('files')
        .select('id, filename')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .lt('deleted_at', cutoffDateStr);

      if (expiredFiles && expiredFiles.length > 0) {
        for (const file of expiredFiles) {
          if (file.filename) {
            await supabase.storage.from('files').remove([`${userId}/${file.filename}`]);
          }
        }
        await supabase
          .from('files')
          .delete()
          .in('id', expiredFiles.map(f => f.id));
        console.log(`Auto-deleted ${expiredFiles.length} expired files`);
      }
    } catch (err) {
      console.error('Error during auto-cleanup:', err);
    }
  }, [userId]);

  const fetchTrashItems = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      // First, cleanup any expired items
      await cleanupExpiredItems();

      const now = new Date();
      const trashItems: TrashItem[] = [];

      // Fetch deleted notes
      const { data: notes } = await supabase
        .from('notes')
        .select('id, title, deleted_at')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null);

      notes?.forEach(note => {
        const deletedAt = new Date(note.deleted_at!);
        const daysLeft = TRASH_RETENTION_DAYS - Math.floor((now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0) {
          trashItems.push({
            id: note.id,
            type: 'note',
            name: note.title || 'Unbenannte Notiz',
            deleted_at: note.deleted_at!,
            daysLeft
          });
        }
      });

      // Fetch deleted photos
      const { data: photos } = await supabase
        .from('photos')
        .select('id, filename, deleted_at')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null);

      photos?.forEach(photo => {
        const deletedAt = new Date(photo.deleted_at!);
        const daysLeft = TRASH_RETENTION_DAYS - Math.floor((now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
        const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(photo.filename);
        if (daysLeft > 0) {
          trashItems.push({
            id: photo.id,
            type: 'photo',
            name: photo.filename?.replace(/^\d+-/, '') || 'Foto/Video',
            deleted_at: photo.deleted_at!,
            daysLeft,
            isVideo
          });
        }
      });

      // Fetch deleted files
      const { data: files } = await supabase
        .from('files')
        .select('id, filename, deleted_at')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null);

      files?.forEach(file => {
        const deletedAt = new Date(file.deleted_at!);
        const daysLeft = TRASH_RETENTION_DAYS - Math.floor((now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0) {
          trashItems.push({
            id: file.id,
            type: 'file',
            name: file.filename?.replace(/^\d+-/, '') || 'Datei',
            deleted_at: file.deleted_at!,
            daysLeft
          });
        }
      });

      // Fetch deleted TikTok videos
      const { data: tiktokVideos } = await supabase
        .from('tiktok_videos')
        .select('id, title, author_name, deleted_at')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null);

      tiktokVideos?.forEach(video => {
        const deletedAt = new Date(video.deleted_at!);
        const daysLeft = TRASH_RETENTION_DAYS - Math.floor((now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0) {
          trashItems.push({
            id: video.id,
            type: 'tiktok',
            name: video.title || (video.author_name ? `@${video.author_name}` : 'TikTok Video'),
            deleted_at: video.deleted_at!,
            daysLeft
          });
        }
      });

      // Sort by deleted_at descending
      trashItems.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
      setItems(trashItems);
    } catch (err) {
      console.error('Error fetching trash items:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, isDecoyMode, cleanupExpiredItems]);


  useEffect(() => {
    fetchTrashItems();
  }, [fetchTrashItems]);

  // Real-time updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('trash-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, fetchTrashItems)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, fetchTrashItems)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, fetchTrashItems)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTrashItems]);

  const restoreItem = async (item: TrashItem) => {
    const table = item.type === 'note' ? 'notes' : item.type === 'photo' ? 'photos' : item.type === 'tiktok' ? 'tiktok_videos' : 'files';
    
    try {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: null })
        .eq('id', item.id);

      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(`${item.name} wiederhergestellt`);
    } catch (err) {
      console.error('Error restoring item:', err);
      toast.error('Fehler beim Wiederherstellen');
    }
  };

  const deleteItemPermanently = async (item: TrashItem) => {
    try {
      if (item.type === 'photo') {
        const { data: dbItem } = await supabase
          .from('photos')
          .select('filename')
          .eq('id', item.id)
          .single();
        
        if (dbItem?.filename) {
          await supabase.storage.from('photos').remove([`${userId}/${dbItem.filename}`]);
        }
        await supabase.from('photos').delete().eq('id', item.id);
      } else if (item.type === 'file') {
        const { data: dbItem } = await supabase
          .from('files')
          .select('filename')
          .eq('id', item.id)
          .single();
        
        if (dbItem?.filename) {
          await supabase.storage.from('files').remove([`${userId}/${dbItem.filename}`]);
        }
        await supabase.from('files').delete().eq('id', item.id);
      } else if (item.type === 'tiktok') {
        await supabase.from('tiktok_videos').delete().eq('id', item.id);
      } else {
        await supabase.from('notes').delete().eq('id', item.id);
      }

      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(`${item.name} endgültig gelöscht`);
    } catch (err) {
      console.error('Error deleting item permanently:', err);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleDeleteClick = (item: TrashItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      deleteItemPermanently(itemToDelete);
      setItemToDelete(null);
    }
  };

  const emptyTrash = async () => {
    for (const item of items) {
      await deleteItemPermanently(item);
    }
    setEmptyTrashDialogOpen(false);
    toast.success('Papierkorb geleert');
  };

  const restoreAll = async () => {
    for (const item of items) {
      await restoreItem(item);
    }
    toast.success('Alle Elemente wiederhergestellt');
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleRestoreSelected = async () => {
    const selectedItemsList = items.filter(i => selectedItems.has(i.id));
    for (const item of selectedItemsList) {
      await restoreItem(item);
    }
    setSelectedItems(new Set());
  };

  const handleDeleteSelected = async () => {
    const selectedItemsList = items.filter(i => selectedItems.has(i.id));
    for (const item of selectedItemsList) {
      await deleteItemPermanently(item);
    }
    setSelectedItems(new Set());
  };

  const getTypeIcon = (item: TrashItem) => {
    if (item.type === 'note') return FileText;
    if (item.type === 'photo') return item.isVideo ? Video : Image;
    if (item.type === 'tiktok') return Play;
    return FolderOpen;
  };

  const getTypeLabel = (item: TrashItem) => {
    if (item.type === 'note') return 'Notiz';
    if (item.type === 'photo') return item.isVideo ? 'Video' : 'Foto';
    if (item.type === 'tiktok') return 'TikTok';
    return 'Datei';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isDecoyMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-[60vh] text-center"
      >
        <Trash2 className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Papierkorb</h2>
        <p className="text-muted-foreground">Der Papierkorb ist leer</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Papierkorb</h1>
            <p className="text-muted-foreground text-sm">
              {items.length} Elemente · Automatische Löschung nach {TRASH_RETENTION_DAYS} Tagen
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={restoreAll}
              className="px-4 py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-500 transition-colors flex items-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden md:inline">Alles wiederherstellen</span>
            </button>
            <button
              onClick={() => setEmptyTrashDialogOpen(true)}
              className="px-4 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden md:inline">Leeren</span>
            </button>
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
          <p className="text-foreground/80 text-sm">
            Elemente werden nach {TRASH_RETENTION_DAYS} Tagen automatisch endgültig gelöscht.
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Lädt...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Trash2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground">Der Papierkorb ist leer</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {items.map((item, index) => {
              const Icon = getTypeIcon(item);
              const isSelected = selectedItems.has(item.id);
              
              return (
                <motion.div
                  key={`${item.type}-${item.id}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "p-4 hover:bg-muted/30 transition-colors flex items-center gap-4 cursor-pointer",
                    isSelected && "bg-primary/10"
                  )}
                  onClick={() => toggleSelection(item.id)}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isSelected ? "bg-primary/20" : "bg-muted/50"
                  )}>
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">{item.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="text-xs bg-muted/50 px-2 py-0.5 rounded">{getTypeLabel(item)}</span>
                      <span>Gelöscht: {formatDate(item.deleted_at)}</span>
                      <span className={cn(
                        "flex items-center gap-1",
                        item.daysLeft <= 7 && "text-destructive"
                      )}>
                        <Clock className="w-3 h-3" />
                        {item.daysLeft} Tage übrig
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => restoreItem(item)}
                      className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-500 transition-colors"
                      title="Wiederherstellen"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(item)}
                      className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                      title="Endgültig löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Multi-select bar */}
      <MultiSelectBar
        selectedCount={selectedItems.size}
        onClear={() => setSelectedItems(new Set())}
        onDelete={handleDeleteSelected}
        onRestore={handleRestoreSelected}
        isTrash={true}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        itemName={itemToDelete?.name || ''}
        isPermanent={true}
        title="Endgültig löschen?"
      />

      {/* Empty Trash Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={emptyTrashDialogOpen}
        onClose={() => setEmptyTrashDialogOpen(false)}
        onConfirm={emptyTrash}
        itemName={`${items.length} Elemente`}
        isPermanent={true}
        title="Papierkorb leeren?"
        description="Möchtest du wirklich den gesamten Papierkorb leeren? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </motion.div>
  );
}
