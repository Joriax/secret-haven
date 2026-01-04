import React, { useState } from 'react';
import { Share2, Plus, Loader2, Globe, Users, Copy, Check, X } from 'lucide-react';
import { useSharedAlbums, ContentType, SharedAlbum } from '@/hooks/useSharedAlbums';
import { useAuth } from '@/contexts/AuthContext';
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

interface SharedAlbumButtonProps {
  selectedItemIds: string[];
  itemType: 'photo' | 'note' | 'file' | 'link' | 'tiktok';
  contentType: ContentType;
  onComplete?: () => void;
}

export function SharedAlbumButton({
  selectedItemIds,
  itemType,
  contentType,
  onComplete,
}: SharedAlbumButtonProps) {
  const { supabaseClient: supabase } = useAuth();
  const {
    albums,
    isLoading,
    createAlbum,
    addItemToAlbum,
    generatePublicLink,
    shareWithUser,
    getAlbumAccess,
  } = useSharedAlbums();

  const [showDialog, setShowDialog] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
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

  const filteredAlbums = albums.filter(
    a => a.content_type === contentType || a.content_type === 'mixed'
  );

  const handleAddToExistingAlbum = async (album: SharedAlbum) => {
    let successCount = 0;
    for (const itemId of selectedItemIds) {
      const success = await addItemToAlbum(album.id, itemType, itemId);
      if (success) successCount++;
    }
    
    if (successCount > 0) {
      toast.success(`${successCount} Element(e) zu \"${album.name}\" hinzugefügt`);
      setShowDialog(false);
      onComplete?.();
    } else {
      toast.error('Fehler beim Hinzufügen');
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newName.trim()) {
      toast.error('Name erforderlich');
      return;
    }

    setIsCreating(true);
    const album = await createAlbum(newName, contentType, newColor);
    
    if (album) {
      let successCount = 0;
      for (const itemId of selectedItemIds) {
        const success = await addItemToAlbum(album.id, itemType, itemId);
        if (success) successCount++;
      }
      
      toast.success(`Album erstellt mit ${successCount} Element(en)`);
      setShowCreateNew(false);
      setShowDialog(false);
      setNewName('');
      onComplete?.();
    } else {
      toast.error('Fehler beim Erstellen');
    }
    setIsCreating(false);
  };

  const openShareDialog = async (album: SharedAlbum) => {
    setSelectedAlbum(album);
    setShowShareDialog(true);
    
    // Load users and access
    const { data: users } = await supabase
      .from('vault_users')
      .select('id')
      .neq('id', album.owner_id);
    setAvailableUsers(users || []);
    
    const access = await getAlbumAccess(album.id);
    setAlbumAccess(access);
  };

  const handleGenerateLink = async () => {
    if (!selectedAlbum) return;
    const link = await generatePublicLink(selectedAlbum.id);
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success('Öffentlicher Link kopiert!');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShareWithUser = async () => {
    if (!selectedAlbum || !selectedUserId) return;
    const success = await shareWithUser(selectedAlbum.id, selectedUserId, 'view');
    if (success) {
      toast.success('Benutzer hinzugefügt');
      setSelectedUserId('');
      const access = await getAlbumAccess(selectedAlbum.id);
      setAlbumAccess(access);
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`);
    setCopiedLink(true);
    toast.success('Link kopiert!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (selectedItemIds.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm"
      >
        <Share2 className="w-4 h-4" />
        Teilen ({selectedItemIds.length})
      </button>

      {/* Main Dialog - Select or Create Album */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              Zu geteiltem Album hinzufügen
            </DialogTitle>
          </DialogHeader>

          {showCreateNew ? (
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
                          onClick={() => openShareDialog(album)}
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

      {/* Share Options Dialog */}
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
                <button
                  onClick={handleGenerateLink}
                  className="text-xs text-primary hover:underline"
                >
                  {selectedAlbum?.public_link_enabled ? 'Neuen Link' : 'Link erstellen'}
                </button>
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
                    <div
                      key={access.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <span className="text-sm text-foreground">
                        Benutzer {access.user_id.slice(0, 8)}...
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {access.permission === 'edit' ? 'Bearbeiten' : 'Ansehen'}
                      </span>
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
              Fertig
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
