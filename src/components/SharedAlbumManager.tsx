import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Plus,
  Link2,
  Users,
  Copy,
  Check,
  Trash2,
  Edit2,
  Globe,
  Lock,
  Image,
  FileText,
  FolderOpen,
  Link,
  Play,
  Loader2,
  X,
  UserPlus,
} from 'lucide-react';
import { useSharedAlbums, ContentType, SharedAlbum, SharedAlbumAccess } from '@/hooks/useSharedAlbums';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CONTENT_TYPE_ICONS: Record<ContentType, React.ElementType> = {
  photos: Image,
  notes: FileText,
  files: FolderOpen,
  links: Link,
  tiktoks: Play,
  mixed: Share2,
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  photos: 'Fotos',
  notes: 'Notizen',
  files: 'Dateien',
  links: 'Links',
  tiktoks: 'TikToks',
  mixed: 'Gemischt',
};

const ALBUM_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];

interface SharedAlbumManagerProps {
  contentType?: ContentType;
  onSelectAlbum?: (album: SharedAlbum) => void;
  selectedItemIds?: string[];
  itemType?: 'photo' | 'note' | 'file' | 'link' | 'tiktok';
}

export function SharedAlbumManager({
  contentType,
  onSelectAlbum,
  selectedItemIds = [],
  itemType,
}: SharedAlbumManagerProps) {
  const {
    albums,
    sharedWithMe,
    isLoading,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    generatePublicLink,
    disablePublicLink,
    shareWithUser,
    removeUserAccess,
    getAlbumAccess,
    addItemToAlbum,
  } = useSharedAlbums();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<SharedAlbum | null>(null);
  const [albumAccess, setAlbumAccess] = useState<SharedAlbumAccess[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; created_at: string }[]>([]);

  // Create dialog state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState(ALBUM_COLORS[0]);
  const [newContentType, setNewContentType] = useState<ContentType>(contentType || 'mixed');
  const [isCreating, setIsCreating] = useState(false);

  // Share dialog state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const filteredAlbums = contentType
    ? albums.filter(a => a.content_type === contentType || a.content_type === 'mixed')
    : albums;

  useEffect(() => {
    if (showShareDialog && selectedAlbum) {
      loadAlbumAccess();
      loadAvailableUsers();
    }
  }, [showShareDialog, selectedAlbum]);

  const loadAlbumAccess = async () => {
    if (!selectedAlbum) return;
    const access = await getAlbumAccess(selectedAlbum.id);
    setAlbumAccess(access);
  };

  const loadAvailableUsers = async () => {
    const { data } = await supabase
      .from('vault_users')
      .select('id, created_at')
      .order('created_at', { ascending: false });
    setAvailableUsers(data || []);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Name erforderlich');
      return;
    }

    setIsCreating(true);
    const album = await createAlbum(newName, newContentType, newColor, newDescription);
    setIsCreating(false);

    if (album) {
      toast.success('Geteiltes Album erstellt');
      setShowCreateDialog(false);
      setNewName('');
      setNewDescription('');
      setNewColor(ALBUM_COLORS[0]);

      // If items are selected, add them to the album
      if (selectedItemIds.length > 0 && itemType) {
        for (const itemId of selectedItemIds) {
          await addItemToAlbum(album.id, itemType, itemId);
        }
        toast.success(`${selectedItemIds.length} Elemente hinzugefügt`);
      }
    } else {
      toast.error('Fehler beim Erstellen');
    }
  };

  const handleGenerateLink = async () => {
    if (!selectedAlbum) return;
    const link = await generatePublicLink(selectedAlbum.id);
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success('Link kopiert!');
      setTimeout(() => setCopiedLink(false), 2000);
      loadAlbumAccess();
    }
  };

  const handleDisableLink = async () => {
    if (!selectedAlbum) return;
    await disablePublicLink(selectedAlbum.id);
    toast.success('Öffentlicher Link deaktiviert');
    loadAlbumAccess();
  };

  const handleShareWithUser = async () => {
    if (!selectedAlbum || !selectedUserId) return;
    const success = await shareWithUser(selectedAlbum.id, selectedUserId, 'view');
    if (success) {
      toast.success('Benutzer hinzugefügt');
      setSelectedUserId('');
      loadAlbumAccess();
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!selectedAlbum) return;
    await removeUserAccess(selectedAlbum.id, userId);
    loadAlbumAccess();
    toast.success('Zugriff entfernt');
  };

  const handleDelete = async (album: SharedAlbum) => {
    if (confirm(`Album "${album.name}" wirklich löschen?`)) {
      await deleteAlbum(album.id);
      toast.success('Album gelöscht');
    }
  };

  const handleAddToAlbum = async (album: SharedAlbum) => {
    if (selectedItemIds.length === 0 || !itemType) return;

    for (const itemId of selectedItemIds) {
      await addItemToAlbum(album.id, itemType, itemId);
    }
    toast.success(`${selectedItemIds.length} Elemente zu "${album.name}" hinzugefügt`);
    onSelectAlbum?.(album);
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success('Link kopiert!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Share2 className="w-5 h-5 text-primary" />
          Geteilte Alben
        </h3>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Neues Album
        </button>
      </div>

      {/* My Albums */}
      {filteredAlbums.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Meine geteilten Alben</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredAlbums.map((album) => {
              const Icon = CONTENT_TYPE_ICONS[album.content_type];
              return (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2.5 rounded-xl"
                      style={{ backgroundColor: `${album.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: album.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">{album.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {CONTENT_TYPE_LABELS[album.content_type]}
                        {album.public_link_enabled && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Öffentlich
                          </span>
                        )}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedAlbum(album);
                            setShowShareDialog(true);
                          }}
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Teilen
                        </DropdownMenuItem>
                        {album.public_link_token && (
                          <DropdownMenuItem onClick={() => copyLink(album.public_link_token!)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Link kopieren
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(album)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Add items button if items are selected */}
                  {selectedItemIds.length > 0 && (
                    <button
                      onClick={() => handleAddToAlbum(album)}
                      className="mt-3 w-full py-2 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
                    >
                      {selectedItemIds.length} hinzufügen
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shared with me */}
      {sharedWithMe.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Mit mir geteilt</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sharedWithMe.map((album) => {
              const Icon = CONTENT_TYPE_ICONS[album.content_type];
              return (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onSelectAlbum?.(album)}
                  className="glass-card p-4 hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2.5 rounded-xl"
                      style={{ backgroundColor: `${album.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: album.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">{album.name}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Geteilt
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredAlbums.length === 0 && sharedWithMe.length === 0 && (
        <div className="text-center py-8">
          <Share2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">Noch keine geteilten Alben</p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm"
          >
            Erstes Album erstellen
          </button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues geteiltes Album</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Album-Name"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Beschreibung (optional)
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Kurze Beschreibung"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Inhalt</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => {
                  const Icon = CONTENT_TYPE_ICONS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setNewContentType(type)}
                      className={cn(
                        'p-3 rounded-xl border transition-all flex flex-col items-center gap-1',
                        newContentType === type
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs">{CONTENT_TYPE_LABELS[type]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Farbe</label>
              <div className="flex flex-wrap gap-2">
                {ALBUM_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      newColor === color && 'ring-2 ring-offset-2 ring-offset-background ring-primary'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowCreateDialog(false)}
              className="px-4 py-2 rounded-xl hover:bg-muted transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              Erstellen
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Album teilen: {selectedAlbum?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Public Link */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Öffentlicher Link</span>
                </div>
                {selectedAlbum?.public_link_enabled ? (
                  <button
                    onClick={handleDisableLink}
                    className="text-xs text-destructive hover:underline"
                  >
                    Deaktivieren
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateLink}
                    className="text-xs text-primary hover:underline"
                  >
                    Aktivieren
                  </button>
                )}
              </div>
              {selectedAlbum?.public_link_token && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/shared/${selectedAlbum.public_link_token}`}
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-muted-foreground"
                  />
                  <button
                    onClick={() => copyLink(selectedAlbum.public_link_token!)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    {copiedLink ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Share with users */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Mit Benutzern teilen</span>
              </div>
              <div className="flex gap-2 mb-3">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                >
                  <option value="">Benutzer auswählen...</option>
                  {availableUsers
                    .filter(u => u.id !== selectedAlbum?.owner_id)
                    .filter(u => !albumAccess.some(a => a.user_id === u.id))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        Benutzer {user.id.slice(0, 8)}...
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleShareWithUser}
                  disabled={!selectedUserId}
                  className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>

              {/* Current access list */}
              {albumAccess.length > 0 && (
                <div className="space-y-2">
                  {albumAccess.map((access) => (
                    <div
                      key={access.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <span className="text-sm text-foreground">
                        Benutzer {access.user_id.slice(0, 8)}...
                      </span>
                      <button
                        onClick={() => handleRemoveUser(access.user_id)}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowShareDialog(false)}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              Schließen
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
