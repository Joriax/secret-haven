import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Palette, 
  Check,
  Folder,
  FileText,
  Image,
  Video,
  Music,
  Link2,
  Star,
  Heart,
  Settings,
  Home,
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Bell,
  User,
  Users,
  Mail,
  Phone,
  Camera,
  Mic,
  Volume2,
  Play,
  Pause
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface IconPackSelectorProps {
  onClose?: () => void;
}

// Available icon packs
const ICON_PACKS = [
  {
    id: 'lucide',
    name: 'Lucide (Standard)',
    description: 'Moderne, klare Icons',
    preview: [Folder, FileText, Image, Star, Settings],
  },
  {
    id: 'outline',
    name: 'Outline',
    description: 'Dünne Linien, minimalistisch',
    preview: [Folder, FileText, Image, Star, Settings],
    className: '[&_svg]:stroke-1',
  },
  {
    id: 'filled',
    name: 'Filled',
    description: 'Ausgefüllte Icons',
    preview: [Folder, FileText, Image, Star, Settings],
    className: '[&_svg]:fill-current',
  },
  {
    id: 'emoji',
    name: 'Emoji',
    description: 'Bunte Emoji-Icons',
    emojiMap: {
      folder: '📁',
      file: '📄',
      image: '🖼️',
      video: '🎬',
      music: '🎵',
      link: '🔗',
      star: '⭐',
      heart: '❤️',
      settings: '⚙️',
      home: '🏠',
      search: '🔍',
      plus: '➕',
      trash: '🗑️',
      download: '📥',
      upload: '📤',
      lock: '🔒',
      unlock: '🔓',
      calendar: '📅',
      clock: '🕐',
      bell: '🔔',
      user: '👤',
      camera: '📷',
      mic: '🎤',
    },
  },
];

// Custom folder icons/emojis
const FOLDER_ICONS = [
  { icon: '📁', label: 'Ordner' },
  { icon: '📂', label: 'Geöffnet' },
  { icon: '🗂️', label: 'Kartei' },
  { icon: '📦', label: 'Box' },
  { icon: '🎨', label: 'Kunst' },
  { icon: '📸', label: 'Fotos' },
  { icon: '🎬', label: 'Videos' },
  { icon: '🎵', label: 'Musik' },
  { icon: '📚', label: 'Bücher' },
  { icon: '💼', label: 'Arbeit' },
  { icon: '🏠', label: 'Zuhause' },
  { icon: '✈️', label: 'Reisen' },
  { icon: '🎮', label: 'Spiele' },
  { icon: '💰', label: 'Finanzen' },
  { icon: '🔒', label: 'Privat' },
  { icon: '❤️', label: 'Favoriten' },
  { icon: '🌟', label: 'Wichtig' },
  { icon: '📝', label: 'Notizen' },
  { icon: '🎓', label: 'Bildung' },
  { icon: '🏋️', label: 'Fitness' },
  { icon: '🍔', label: 'Essen' },
  { icon: '🎁', label: 'Geschenke' },
  { icon: '🔧', label: 'Tools' },
  { icon: '🌈', label: 'Kreativ' },
];

// Custom icon colors
const ICON_COLORS = [
  { color: '#6366f1', name: 'Indigo' },
  { color: '#8b5cf6', name: 'Violett' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#ef4444', name: 'Rot' },
  { color: '#f97316', name: 'Orange' },
  { color: '#eab308', name: 'Gelb' },
  { color: '#22c55e', name: 'Grün' },
  { color: '#14b8a6', name: 'Teal' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#3b82f6', name: 'Blau' },
  { color: '#64748b', name: 'Slate' },
  { color: '#ffffff', name: 'Weiß' },
];

export function IconPackSelector({ onClose }: IconPackSelectorProps) {
  const { userId } = useAuth();
  const [selectedPack, setSelectedPack] = useState('lucide');
  const [customFolderIcon, setCustomFolderIcon] = useState('📁');
  const [iconColor, setIconColor] = useState('#6366f1');
  const [isSaving, setIsSaving] = useState(false);

  // Load saved preferences
  useEffect(() => {
    if (!userId) return;
    
    const savedPack = localStorage.getItem(`icon-pack-${userId}`);
    const savedFolderIcon = localStorage.getItem(`folder-icon-${userId}`);
    const savedColor = localStorage.getItem(`icon-color-${userId}`);
    
    if (savedPack) setSelectedPack(savedPack);
    if (savedFolderIcon) setCustomFolderIcon(savedFolderIcon);
    if (savedColor) setIconColor(savedColor);
  }, [userId]);

  // Save preferences
  const handleSave = async () => {
    if (!userId) return;
    
    setIsSaving(true);
    try {
      localStorage.setItem(`icon-pack-${userId}`, selectedPack);
      localStorage.setItem(`folder-icon-${userId}`, customFolderIcon);
      localStorage.setItem(`icon-color-${userId}`, iconColor);
      
      // Apply icon pack class to body
      document.body.dataset.iconPack = selectedPack;
      document.documentElement.style.setProperty('--icon-color', iconColor);
      
      toast.success('Icon-Einstellungen gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const currentPack = ICON_PACKS.find(p => p.id === selectedPack);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Palette className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Icon-Packs</h2>
          <p className="text-sm text-muted-foreground">Wähle deinen Icon-Stil</p>
        </div>
      </div>

      {/* Icon Pack Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Icon-Stil</h3>
        <div className="grid gap-3">
          {ICON_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setSelectedPack(pack.id)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                selectedPack === pack.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              {/* Preview icons */}
              <div className={cn("flex items-center gap-2", pack.className)}>
                {pack.emojiMap ? (
                  // Emoji pack preview
                  <div className="flex gap-1 text-xl">
                    <span>📁</span>
                    <span>📄</span>
                    <span>🖼️</span>
                    <span>⭐</span>
                    <span>⚙️</span>
                  </div>
                ) : (
                  // Lucide icons preview
                  pack.preview?.map((Icon, idx) => (
                    <Icon key={idx} className="w-5 h-5 text-muted-foreground" />
                  ))
                )}
              </div>

              <div className="flex-1">
                <div className="font-medium text-foreground">{pack.name}</div>
                <div className="text-sm text-muted-foreground">{pack.description}</div>
              </div>

              {selectedPack === pack.id && (
                <Check className="w-5 h-5 text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Folder Icons */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Ordner-Symbol</h3>
        <div className="grid grid-cols-8 gap-2">
          {FOLDER_ICONS.map((item) => (
            <button
              key={item.icon}
              onClick={() => setCustomFolderIcon(item.icon)}
              title={item.label}
              className={cn(
                "w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all",
                customFolderIcon === item.icon
                  ? "bg-primary/20 ring-2 ring-primary"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {item.icon}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Wird als Standard-Symbol für neue Ordner verwendet
        </p>
      </div>

      {/* Icon Colors */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Icon-Farbe</h3>
        <div className="flex flex-wrap gap-2">
          {ICON_COLORS.map((item) => (
            <button
              key={item.color}
              onClick={() => setIconColor(item.color)}
              title={item.name}
              className={cn(
                "w-8 h-8 rounded-full transition-all",
                iconColor === item.color && "ring-2 ring-offset-2 ring-offset-background ring-primary"
              )}
              style={{ backgroundColor: item.color }}
            >
              {iconColor === item.color && (
                <Check className={cn(
                  "w-4 h-4 mx-auto",
                  item.color === '#ffffff' ? "text-black" : "text-white"
                )} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border">
        <h4 className="text-sm font-medium text-foreground mb-3">Vorschau</h4>
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${iconColor}20` }}
          >
            {customFolderIcon}
          </div>
          <div>
            <div className="font-medium text-foreground">Beispiel-Ordner</div>
            <div className="text-sm text-muted-foreground">12 Elemente</div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isSaving ? 'Speichern...' : 'Einstellungen speichern'}
      </button>
    </motion.div>
  );
}
