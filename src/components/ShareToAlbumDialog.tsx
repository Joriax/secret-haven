import React, { useState, forwardRef, useCallback, useMemo } from 'react';
import { Share2, Plus, Loader2, Globe, Users, Copy, Check } from 'lucide-react';
import { useSharedAlbums, ContentType, SharedAlbum } from '@/hooks/useSharedAlbums';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const ALBUM_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
];

interface ShareToAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'photo' | 'note' | 'file' | 'link' | 'tiktok';
  contentType: ContentType;
}

export const ShareToAlbumDialog = forwardRef<HTMLDivElement, ShareToAlbumDialogProps>(
  function ShareToAlbumDialog({
    isOpen,
    onClose,
    itemId,
    itemType,
    contentType,
  }, ref) {
    const {
      albums,
      isLoading,
      createAlbum,
      addItemToAlbum,
      generatePublicLink,
      shareWithUser,
      getAlbumAccess,
    } = useSharedAlbums();

    const [showCreateNew, setShowCreateNew] = useState(false);
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [selectedAlbum, setSelectedAlbum] = useState<SharedAlbum | null>(null);

    // Create new album state
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(ALBUM_COLORS[0]);
    const [isCreating, setIsCreating] = useState(false);

    // Share state
    const [availableUsers, setAvailableUsers] = useState<{ id: string }[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [albumAccess, setAlbumAccess] = useState<any[]>([]);
    const [copiedLink, setCopiedLink] = useState(false);

    const filteredAlbums = useMemo(() => 
      albums.filter(a => a.content_type === contentType || a.content_type === 'mixed'),
      [albums, contentType]
    );

    const handleAddToExistingAlbum = useCallback(async (album: SharedAlbum) => {
      const success = await addItemToAlbum(album.id, itemType, itemId);
      if (success) {
        toast.success(`Zu "${album.name}" hinzugefügt`);
        onClose();
      } else {
        toast.error('Fehler beim Hinzufügen');
      }
    }, [addItemToAlbum, itemType, itemId, onClose]);

    const handleCreateAndAdd = useCallback(async () => {
      if (!newName.trim()) {
        toast.error('Name erforderlich');
        return;
      }

      setIsCreating(true);
      const album = await createAlbum(newName, contentType, newColor);

      if (album) {
        const success = await addItemToAlbum(album.id, itemType, itemId);
        if (success) {
          toast.success(`Album erstellt und Element hinzugefügt`);
          setShowCreateNew(false);
          setNewName('');
          onClose();
        }
      } else {
        toast.error('Fehler beim Erstellen');
      }
      setIsCreating(false);
    }, [newName, contentType, newColor, createAlbum, addItemToAlbum, itemType, itemId, onClose]);

    const openShareOptions = useCallback(async (album: SharedAlbum) => {
      setSelectedAlbum(album);
      setShowShareOptions(true);
      setAvailableUsers([]);
      const access = await getAlbumAccess(album.id);
      setAlbumAccess(access);
    }, [getAlbumAccess]);

    const handleGenerateLink = useCallback(async () => {
      if (!selectedAlbum) return;
      const link = await generatePublicLink(selectedAlbum.id);
      if (link) {
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        toast.success('Öffentlicher Link kopiert!');
        setTimeout(() => setCopiedLink(false), 2000);
      }
    }, [selectedAlbum, generatePublicLink]);

    const handleShareWithUser = useCallback(async () => {
      if (!selectedAlbum || !selectedUserId) return;
      const success = await shareWithUser(selectedAlbum.id, selectedUserId, 'view');
      if (success) {
        toast.success('Benutzer hinzugefügt');
        setSelectedUserId('');
        const access = await getAlbumAccess(selectedAlbum.id);
        setAlbumAccess(access);
      }
    }, [selectedAlbum, selectedUserId, shareWithUser, getAlbumAccess]);

    const handleClose = useCallback(() => {
      setShowCreateNew(false);
      setShowShareOptions(false);
      setSelectedAlbum(null);
      onClose();
    }, [onClose]);

    const handleCopyLink = useCallback(() => {
      if (!selectedAlbum?.public_link_token) return;
      navigator.clipboard.writeText(`${window.location.origin}/shared/${selectedAlbum.public_link_token}`);
      setCopiedLink(true);
      toast.success('Link kopiert!');
      setTimeout(() => setCopiedLink(false), 2000);
    }, [selectedAlbum?.public_link_token]);

    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent ref={ref} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              {showShareOptions ? `Teilen: ${selectedAlbum?.name}` : 'Zu geteiltem Album hinzufügen'}
            </DialogTitle>
          </DialogHeader>

          {showShareOptions && selectedAlbum ? (
            <div className="space-y-6 py-4">
              {/* Public Link */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Öffentlicher Link</span>
                  </div>
                  <button
                    onClick={handleGenerateLink}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedAlbum.public_link_enabled ? 'Link kopieren' : 'Link erstellen'}
                  </button>
                </div>
                {selectedAlbum.public_link_token && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/shared/${selectedAlbum.public_link_token}`}
                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-muted-foreground"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
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
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {albumAccess.length > 0 && (
                  <div className="space-y-2">
                    {albumAccess.map((access) => (
                      <div key={access.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="text-sm text-foreground">Benutzer {access.user_id.slice(0, 8)}...</span>
                        <span className="text-xs text-muted-foreground">
                          {access.permission === 'edit' ? 'Bearbeiten' : 'Ansehen'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <button
                  onClick={() => setShowShareOptions(false)}
                  className="px-4 py-2 rounded-xl hover:bg-muted transition-colors"
                >
                  Zurück
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Fertig
                </button>
              </DialogFooter>
            </div>
          ) : showCreateNew ? (
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Album-Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Mein geteiltes Album"
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground"
                  autoFocus
                />
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
              <DialogFooter>
                <button
                  onClick={() => setShowCreateNew(false)}
                  className="px-4 py-2 rounded-xl hover:bg-muted transition-colors"
                >
                  Zurück
                </button>
                <button
                  onClick={handleCreateAndAdd}
                  disabled={isCreating || !newName.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Erstellen & Hinzufügen
                </button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {/* Create new button */}
              <button
                onClick={() => setShowCreateNew(true)}
                className="w-full p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-5 h-5" />
                Neues geteiltes Album erstellen
              </button>

              {/* Existing albums */}
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : filteredAlbums.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  <p className="text-xs text-muted-foreground font-medium">Vorhandene Alben</p>
                  {filteredAlbums.map((album) => (
                    <div
                      key={album.id}
                      className="p-3 rounded-xl border border-border hover:border-primary/30 transition-colors flex items-center gap-3"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${album.color}20` }}
                      >
                        <Share2 className="w-5 h-5" style={{ color: album.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">{album.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {album.public_link_enabled && (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Öffentlich
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openShareOptions(album)}
                          className="p-2 rounded-lg hover:bg-muted transition-colors"
                          title="Teilen-Optionen"
                        >
                          <Users className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleAddToExistingAlbum(album)}
                          className="px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  Noch keine geteilten Alben vorhanden
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

export default ShareToAlbumDialog;
