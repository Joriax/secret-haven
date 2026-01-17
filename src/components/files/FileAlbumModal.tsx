import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  Folder,
  Music,
  BookOpen,
  Archive,
  Briefcase,
  Camera,
  Film,
  Heart,
  Home,
  Image as ImageIcon,
  Inbox,
  Layers,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOLDER_COLORS } from '@/lib/constants';

interface FileAlbum {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  parent_id?: string | null;
}

interface FileAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  album?: FileAlbum | null;
  albums: FileAlbum[];
  name: string;
  color: string;
  icon: string;
  parentId: string | null;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string) => void;
  onParentIdChange: (parentId: string | null) => void;
  onSave: () => void;
}

const ICON_OPTIONS = [
  { id: 'folder', Icon: Folder },
  { id: 'music', Icon: Music },
  { id: 'book', Icon: BookOpen },
  { id: 'archive', Icon: Archive },
  { id: 'briefcase', Icon: Briefcase },
  { id: 'camera', Icon: Camera },
  { id: 'film', Icon: Film },
  { id: 'heart', Icon: Heart },
  { id: 'home', Icon: Home },
  { id: 'image', Icon: ImageIcon },
  { id: 'inbox', Icon: Inbox },
  { id: 'layers', Icon: Layers },
  { id: 'package', Icon: Package },
];

const getIconComponent = (iconName: string, color: string) => {
  const icons: Record<string, React.ReactNode> = {
    folder: <Folder className="w-6 h-6" style={{ color }} />,
    music: <Music className="w-6 h-6" style={{ color }} />,
    book: <BookOpen className="w-6 h-6" style={{ color }} />,
    archive: <Archive className="w-6 h-6" style={{ color }} />,
    briefcase: <Briefcase className="w-6 h-6" style={{ color }} />,
    camera: <Camera className="w-6 h-6" style={{ color }} />,
    film: <Film className="w-6 h-6" style={{ color }} />,
    heart: <Heart className="w-6 h-6" style={{ color }} />,
    home: <Home className="w-6 h-6" style={{ color }} />,
    image: <ImageIcon className="w-6 h-6" style={{ color }} />,
    inbox: <Inbox className="w-6 h-6" style={{ color }} />,
    layers: <Layers className="w-6 h-6" style={{ color }} />,
    package: <Package className="w-6 h-6" style={{ color }} />,
  };
  return icons[iconName] || icons.folder;
};

export const FileAlbumModal = memo(function FileAlbumModal({
  isOpen,
  onClose,
  mode,
  album,
  albums,
  name,
  color,
  icon,
  parentId,
  onNameChange,
  onColorChange,
  onIconChange,
  onParentIdChange,
  onSave,
}: FileAlbumModalProps) {
  if (!isOpen) return null;

  const title = mode === 'create' ? 'Neues Album' : 'Album bearbeiten';
  const saveText = mode === 'create' ? 'Erstellen' : 'Speichern';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
        
        {/* Preview */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/50">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            {getIconComponent(icon, color)}
          </div>
          <span className="text-foreground font-medium">
            {name || 'Album-Name'}
          </span>
        </div>
        
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Album-Name"
          className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
          autoFocus
        />
        
        {/* Color Selection */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">Farbe</p>
          <div className="flex flex-wrap gap-2">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onColorChange(c)}
                className={cn(
                  "w-8 h-8 rounded-full transition-all",
                  color === c && "ring-2 ring-offset-2 ring-offset-card ring-foreground"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        
        {/* Icon Selection */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">Icon</p>
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map(({ id, Icon }) => (
              <button
                key={id}
                onClick={() => onIconChange(id)}
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                  icon === id 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
        
        {/* Parent Album Selection */}
        {albums.length > 0 && mode === 'create' && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">Überordner (optional)</p>
            <select
              value={parentId || ''}
              onChange={(e) => onParentIdChange(e.target.value || null)}
              className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-foreground"
            >
              <option value="">Kein Überordner (Hauptebene)</option>
              {albums.filter(a => a.id !== album?.id).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={onSave}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saveText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
