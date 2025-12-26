import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LinkFolder } from '@/hooks/useLinkFolders';
import { Link2, Plus, MoreHorizontal, Pencil, Trash2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

interface LinkFolderSidebarProps {
  folders: LinkFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string, color: string) => Promise<any>;
  onUpdateFolder: (id: string, updates: { name?: string; color?: string }) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  linkCounts: Record<string, number>;
  totalLinks: number;
}

export function LinkFolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  linkCounts,
  totalLinks,
}: LinkFolderSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim(), newFolderColor);
    setNewFolderName('');
    setNewFolderColor(FOLDER_COLORS[0]);
    setIsCreating(false);
  };

  const handleStartEdit = (folder: LinkFolder) => {
    setEditingFolder(folder.id);
    setEditName(folder.name);
    setEditColor(folder.color);
  };

  const handleSaveEdit = async () => {
    if (!editingFolder || !editName.trim()) return;
    await onUpdateFolder(editingFolder, { name: editName.trim(), color: editColor });
    setEditingFolder(null);
  };

  return (
    <div className="w-64 border-r border-border bg-card/50 flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Link-Ordner
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* All Links */}
          <button
            onClick={() => onSelectFolder(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedFolderId === null
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Alle Links
            </span>
            <span className="text-xs text-muted-foreground">{totalLinks}</span>
          </button>

          {/* Folders */}
          {folders.map((folder) => (
            <div key={folder.id}>
              {editingFolder === folder.id ? (
                <div className="p-2 space-y-2 bg-muted rounded-lg">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                  />
                  <div className="flex gap-1 flex-wrap">
                    {FOLDER_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditColor(color)}
                        className={`w-5 h-5 rounded-full transition-transform ${
                          editColor === color ? 'scale-125 ring-2 ring-offset-2 ring-offset-background ring-primary' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditingFolder(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                    selectedFolderId === folder.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted'
                  }`}
                  onClick={() => onSelectFolder(folder.id)}
                >
                  <span className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: folder.color }}
                    />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {linkCounts[folder.id] || 0}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStartEdit(folder)}>
                          <Pencil className="h-3 w-3 mr-2" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDeleteFolder(folder.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Create folder */}
      <div className="p-2 border-t border-border">
        <AnimatePresence>
          {isCreating ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <Input
                placeholder="Ordnername..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="flex gap-1 flex-wrap">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      newFolderColor === color ? 'scale-125 ring-2 ring-offset-2 ring-offset-background ring-primary' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setIsCreating(false)}
                >
                  Abbrechen
                </Button>
                <Button size="sm" className="flex-1" onClick={handleCreate}>
                  Erstellen
                </Button>
              </div>
            </motion.div>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4" />
              Neuer Ordner
            </Button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
