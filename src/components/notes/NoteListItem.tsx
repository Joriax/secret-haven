import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Star, Lock, Trash2, Copy, Share, Share2, Folder, X, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Tag } from '@/hooks/useTags';

interface Note {
  id: string;
  title: string;
  content: string | null;
  secure_content: string | null;
  is_secure: boolean;
  is_favorite: boolean;
  tags: string[];
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface Folder {
  id: string;
  name: string;
  color: string | null;
}

interface NoteListItemProps {
  note: Note;
  isSelected: boolean;
  tags: Tag[];
  folders: Folder[];
  onSelect: (note: Note) => void;
  onToggleFavorite: (note: Note) => void;
  onDuplicate: (note: Note) => void;
  onShare: (note: Note) => void;
  onShareToAlbum: (note: Note) => void;
  onMoveToFolder: (noteId: string, folderId: string | null) => void;
  onDelete: (note: Note) => void;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const NoteListItem = memo(function NoteListItem({
  note,
  isSelected,
  tags,
  folders,
  onSelect,
  onToggleFavorite,
  onDuplicate,
  onShare,
  onShareToAlbum,
  onMoveToFolder,
  onDelete,
}: NoteListItemProps) {
  return (
    <motion.div
      variants={itemVariants}
      onClick={() => onSelect(note)}
      className={cn(
        "p-4 rounded-xl cursor-pointer transition-all group relative",
        isSelected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted border border-transparent"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {note.is_favorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
            {note.is_secure && <Lock className="w-3 h-3 text-primary" />}
            <h3 className="font-medium text-foreground truncate">{note.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {note.is_secure ? '[Verschlüsselt]' : (note.content || 'Keine Inhalte')}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-xs text-muted-foreground/70">{formatDate(note.updated_at)}</p>
            {note.tags?.length > 0 && (
              <div className="flex gap-1">
                {note.tags.slice(0, 2).map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  return tag ? (
                    <span key={tagId} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded-lg transition-all"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(note); }}>
              <Star className={cn("w-4 h-4 mr-2", note.is_favorite && "fill-yellow-500 text-yellow-500")} />
              {note.is_favorite ? 'Aus Favoriten' : 'Zu Favoriten'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(note); }}>
              <Copy className="w-4 h-4 mr-2" />
              Duplizieren
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(note); }}>
              <Share className="w-4 h-4 mr-2" />
              Teilen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShareToAlbum(note); }}>
              <Share2 className="w-4 h-4 mr-2" />
              Zu Album hinzufügen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Move to folder */}
            {folders.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">In Ordner verschieben</div>
                {note.folder_id && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveToFolder(note.id, null); }}>
                    <X className="w-4 h-4 mr-2" />
                    Aus Ordner entfernen
                  </DropdownMenuItem>
                )}
                {folders.filter(f => f.id !== note.folder_id).map(folder => (
                  <DropdownMenuItem 
                    key={folder.id}
                    onClick={(e) => { e.stopPropagation(); onMoveToFolder(note.id, folder.id); }}
                  >
                    <Folder className="w-4 h-4 mr-2" style={{ color: folder.color || undefined }} />
                    {folder.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(note); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
});

export default NoteListItem;
