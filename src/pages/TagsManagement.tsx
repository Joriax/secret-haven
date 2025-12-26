import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Tag, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useTags, Tag as TagType } from '@/hooks/useTags';
import { cn } from '@/lib/utils';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { toast } from 'sonner';

const colorOptions = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

export default function TagsManagement() {
  const { tags, loading, createTag, updateTag, deleteTag } = useTags();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; tag: TagType | null }>({ isOpen: false, tag: null });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    
    setIsCreating(true);
    const result = await createTag(newTagName.trim(), newTagColor);
    setIsCreating(false);
    
    if (result) {
      setNewTagName('');
      setNewTagColor('#6366f1');
      toast.success('Tag erstellt');
    } else {
      toast.error('Fehler beim Erstellen');
    }
  };

  const handleUpdate = async () => {
    if (!editingTag || !editName.trim()) return;
    
    const success = await updateTag(editingTag.id, { name: editName.trim(), color: editColor });
    
    if (success) {
      setEditingTag(null);
      toast.success('Tag aktualisiert');
    } else {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.tag) return;
    
    const success = await deleteTag(deleteConfirm.tag.id);
    setDeleteConfirm({ isOpen: false, tag: null });
    
    if (success) {
      toast.success('Tag gelöscht');
    } else {
      toast.error('Fehler beim Löschen');
    }
  };

  const startEditing = (tag: TagType) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setEditName('');
    setEditColor('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tags verwalten</h1>
        <p className="text-muted-foreground text-sm">
          {tags.length} Tags erstellt
        </p>
      </motion.div>

      {/* Create new tag */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Neuen Tag erstellen</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag-Name..."
              className="w-full px-4 py-2 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-foreground"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-wrap">
              {colorOptions.slice(0, 8).map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-transform hover:scale-110",
                    newTagColor === color && "ring-2 ring-offset-2 ring-offset-background ring-primary"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            
            <button
              onClick={handleCreate}
              disabled={!newTagName.trim() || isCreating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-primary hover:shadow-glow transition-all text-primary-foreground disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Erstellen</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tags List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-4"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Alle Tags</h3>
        
        {tags.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Noch keine Tags erstellt</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {tags.map((tag) => (
                <motion.div
                  key={tag.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl transition-colors",
                    editingTag?.id === tag.id ? "bg-primary/10" : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  {editingTag?.id === tag.id ? (
                    <div className="flex-1 flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: editColor }}
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-3 py-1 rounded-lg bg-background border border-border focus:border-primary outline-none text-foreground"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {colorOptions.slice(0, 6).map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className={cn(
                              "w-5 h-5 rounded-full transition-transform hover:scale-110",
                              editColor === color && "ring-2 ring-offset-1 ring-primary"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleUpdate}
                          className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-foreground font-medium">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditing(tag)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, tag })}
                          className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Color Palette Reference */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-4"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Farbpalette</h3>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((color) => (
            <div
              key={color}
              className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg"
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-muted-foreground font-mono">{color}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, tag: null })}
        onConfirm={handleDelete}
        title="Tag löschen"
        description={`Möchtest du den Tag "${deleteConfirm.tag?.name}" wirklich löschen? Der Tag wird von allen Elementen entfernt.`}
        isPermanent
      />
    </div>
  );
}
