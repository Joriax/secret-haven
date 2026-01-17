import React, { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  FolderPlus, 
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  FileText,
  X,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NoteFolder } from '@/hooks/useNoteFolders';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NoteFolderSidebarProps {
  folders: NoteFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, color: string) => void;
  onUpdateFolder: (id: string, updates: { name?: string; color?: string }) => void;
  onDeleteFolder: (id: string) => void;
  noteCounts: Record<string, number>;
  totalNotes: number;
}

const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', 
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

export const NoteFolderSidebar = memo(function NoteFolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  noteCounts,
  totalNotes,
}: NoteFolderSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#6366f1');
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreate = useCallback(() => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderColor);
      setNewFolderName('');
      setNewFolderColor('#6366f1');
      setIsCreating(false);
    }
  }, [newFolderName, newFolderColor, onCreateFolder]);

  const handleStartEdit = (folder: NoteFolder) => {
    setEditingFolder(folder.id);
    setEditName(folder.name);
    setEditColor(folder.color);
  };

  const handleSaveEdit = () => {
    if (editingFolder && editName.trim()) {
      onUpdateFolder(editingFolder, { name: editName.trim(), color: editColor });
      setEditingFolder(null);
    }
  };

  return (
    <div className="space-y-2">
      {/* All Notes */}
      <button
        onClick={() => onSelectFolder(null)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
          selectedFolderId === null 
            ? "bg-primary/20 text-primary" 
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <FileText className="w-4 h-4" />
        <span className="flex-1 text-left text-sm font-medium">Alle Notizen</span>
        <span className="text-xs opacity-60">{totalNotes}</span>
      </button>

      {/* Folders */}
      <div className="space-y-1">
        {folders.map(folder => (
          <div key={folder.id}>
            {editingFolder === folder.id ? (
              <div className="p-2 rounded-xl bg-muted/50 space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground"
                  autoFocus
                />
                <div className="flex gap-1 flex-wrap">
                  {FOLDER_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={cn(
                        "w-5 h-5 rounded-full transition-all",
                        editColor === color && "ring-2 ring-offset-2 ring-offset-background ring-primary"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm"
                  >
                    <Check className="w-3 h-3" />
                    Speichern
                  </button>
                  <button
                    onClick={() => setEditingFolder(null)}
                    className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "group flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all cursor-pointer",
                  selectedFolderId === folder.id 
                    ? "bg-primary/20" 
                    : "hover:bg-muted"
                )}
                onClick={() => onSelectFolder(folder.id)}
              >
                <Folder 
                  className="w-4 h-4 shrink-0" 
                  style={{ color: folder.color }}
                />
                <span className={cn(
                  "flex-1 text-sm font-medium truncate",
                  selectedFolderId === folder.id ? "text-primary" : "text-foreground"
                )}>
                  {folder.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {noteCounts[folder.id] || 0}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button className="p-1 rounded hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStartEdit(folder); }}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Folder */}
      <AnimatePresence>
        {isCreating ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3 rounded-xl bg-muted/50 space-y-3"
          >
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Ordnername..."
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-1 flex-wrap">
              {FOLDER_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewFolderColor(color)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all",
                    newFolderColor === color && "ring-2 ring-offset-2 ring-offset-background ring-primary"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newFolderName.trim()}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                Erstellen
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewFolderName(''); }}
                className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm"
              >
                Abbrechen
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            <span className="text-sm">Neuer Ordner</span>
          </button>
        )}
      </AnimatePresence>
    </div>
  );
});
