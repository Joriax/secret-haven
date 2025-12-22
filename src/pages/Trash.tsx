import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Trash2, 
  RotateCcw, 
  FileText, 
  Image, 
  FolderOpen,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TrashItem {
  id: string;
  type: 'note' | 'photo' | 'file';
  name: string;
  deleted_at: string;
  daysLeft: number;
}

const TRASH_RETENTION_DAYS = 30;

export default function Trash() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const { userId, isDecoyMode } = useAuth();

  const fetchTrashItems = useCallback(async () => {
    if (!userId || isDecoyMode) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
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
        if (daysLeft > 0) {
          trashItems.push({
            id: photo.id,
            type: 'photo',
            name: photo.filename,
            deleted_at: photo.deleted_at!,
            daysLeft
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
            name: file.filename,
            deleted_at: file.deleted_at!,
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
  }, [userId, isDecoyMode]);

  useEffect(() => {
    fetchTrashItems();
  }, [fetchTrashItems]);

  const restoreItem = async (item: TrashItem) => {
    const table = item.type === 'note' ? 'notes' : item.type === 'photo' ? 'photos' : 'files';
    
    try {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: null })
        .eq('id', item.id);

      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Error restoring item:', err);
    }
  };

  const deleteItemPermanently = async (item: TrashItem) => {
    const table = item.type === 'note' ? 'notes' : item.type === 'photo' ? 'photos' : 'files';
    
    try {
      // For photos and files, also delete from storage
      if (item.type === 'photo' || item.type === 'file') {
        const bucket = item.type === 'photo' ? 'photos' : 'files';
        await supabase.storage.from(bucket).remove([`${userId}/${item.name}`]);
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Error deleting item permanently:', err);
    }
  };

  const emptyTrash = async () => {
    if (!confirm('Papierkorb endgültig leeren? Diese Aktion kann nicht rückgängig gemacht werden.')) return;

    for (const item of items) {
      await deleteItemPermanently(item);
    }
  };

  const restoreAll = async () => {
    for (const item of items) {
      await restoreItem(item);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'note': return FileText;
      case 'photo': return Image;
      case 'file': return FolderOpen;
      default: return FileText;
    }
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
        <Trash2 className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Papierkorb</h2>
        <p className="text-white/50">Der Papierkorb ist leer</p>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Papierkorb</h1>
            <p className="text-white/60 text-sm">
              {items.length} Elemente · Automatische Löschung nach {TRASH_RETENTION_DAYS} Tagen
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={restoreAll}
              className="px-4 py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden md:inline">Alles wiederherstellen</span>
            </button>
            <button
              onClick={emptyTrash}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors flex items-center gap-2"
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
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <p className="text-white/80 text-sm">
            Elemente werden nach {TRASH_RETENTION_DAYS} Tagen automatisch endgültig gelöscht.
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/50">Lädt...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Trash2 className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/50">Der Papierkorb ist leer</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((item, index) => {
              const Icon = getTypeIcon(item.type);
              
              return (
                <motion.div
                  key={`${item.type}-${item.id}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4 hover:bg-white/5 transition-colors flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-white/60" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">{item.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-white/40">
                      <span>Gelöscht: {formatDate(item.deleted_at)}</span>
                      <span className={cn(
                        "flex items-center gap-1",
                        item.daysLeft <= 7 && "text-red-400"
                      )}>
                        <Clock className="w-3 h-3" />
                        {item.daysLeft} Tage übrig
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => restoreItem(item)}
                      className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                      title="Wiederherstellen"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteItemPermanently(item)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
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
    </motion.div>
  );
}
