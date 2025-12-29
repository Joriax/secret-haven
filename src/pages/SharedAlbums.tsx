import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Plus,
  Trash2,
  Edit2,
  Globe,
  Lock,
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  Loader2,
  MoreVertical,
  Eye,
  EyeOff,
  ExternalLink,
  Image,
  FileText,
  FolderOpen,
  Play,
  X,
  Settings2,
  Pin,
  PinOff,
} from 'lucide-react';
import { useSharedAlbums, SharedAlbum } from '@/hooks/useSharedAlbums';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

const ALBUM_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6',
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function SharedAlbums() {
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
    getAlbumItems,
    togglePin,
  } = useSharedAlbums();

  const { userId } = useAuth();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; album: SharedAlbum | null }>({ isOpen: false, album: null });

  // Form states
  const [editingAlbum, setEditingAlbum] = useState<SharedAlbum | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(ALBUM_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Share states
  const [sharingAlbum, setSharingAlbum] = useState<SharedAlbum | null>(null);
  const [albumAccess, setAlbumAccess] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{ id: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<'view' | 'edit'>('view');
  const [copiedLink, setCopiedLink] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Album items count
  const [albumItemCounts, setAlbumItemCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      for (const album of albums) {
        const items = await getAlbumItems(album.id);
        counts[album.id] = items.length;
      }
      setAlbumItemCounts(counts);
    };
    if (albums.length > 0) {
      fetchCounts();
    }
  }, [albums]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setColor(ALBUM_COLORS[0]);
    setEditingAlbum(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name erforderlich');
      return;
    }

    setIsSubmitting(true);
    const album = await createAlbum(name, 'mixed', color, description);
    if (album) {
      toast.success('Album erstellt');
      setIsCreateOpen(false);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const handleEdit = async () => {
    if (!editingAlbum || !name.trim()) return;

    setIsSubmitting(true);
    const success = await updateAlbum(editingAlbum.id, {
      name: name.trim(),
      description: description.trim() || null,
      color,
    });
    if (success) {
      toast.success('Album aktualisiert');
      setIsEditOpen(false);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.album) return;
    const success = await deleteAlbum(deleteConfirm.album.id);
    if (success) {
      toast.success('Album gelöscht');
    }
    setDeleteConfirm({ isOpen: false, album: null });
  };

  const openEditDialog = (album: SharedAlbum) => {
    setEditingAlbum(album);
    setName(album.name);
    setDescription(album.description || '');
    setColor(album.color || ALBUM_COLORS[0]);
    setIsEditOpen(true);
  };

  const openShareDialog = async (album: SharedAlbum) => {
    setSharingAlbum(album);
    setPassword(album.public_link_password || '');
    setIsShareOpen(true);

    const access = await getAlbumAccess(album.id);
    setAlbumAccess(access);

    const { data: users } = await supabase
      .from('vault_users')
      .select('id')
      .neq('id', album.owner_id);
    setAvailableUsers(users || []);
  };

  const handleGenerateLink = async () => {
    if (!sharingAlbum) return;
    const link = await generatePublicLink(sharingAlbum.id);
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success('Link erstellt und kopiert!');
      setTimeout(() => setCopiedLink(false), 2000);
      
      // Update password if set
      if (password.trim()) {
        await supabase
          .from('shared_albums')
          .update({ public_link_password: password.trim() })
          .eq('id', sharingAlbum.id);
      }
    }
  };

  const handleDisableLink = async () => {
    if (!sharingAlbum) return;
    const success = await disablePublicLink(sharingAlbum.id);
    if (success) {
      toast.success('Link deaktiviert');
      setSharingAlbum(prev => prev ? { ...prev, public_link_enabled: false, public_link_token: null } : null);
    }
  };

  const handleShareWithUser = async () => {
    if (!sharingAlbum || !selectedUserId) return;
    const success = await shareWithUser(sharingAlbum.id, selectedUserId, selectedPermission);
    if (success) {
      toast.success('Benutzer hinzugefügt');
      setSelectedUserId('');
      const access = await getAlbumAccess(sharingAlbum.id);
      setAlbumAccess(access);
    }
  };

  const handleRemoveAccess = async (accessUserId: string) => {
    if (!sharingAlbum) return;
    const success = await removeUserAccess(sharingAlbum.id, accessUserId);
    if (success) {
      toast.success('Zugriff entfernt');
      const access = await getAlbumAccess(sharingAlbum.id);
      setAlbumAccess(access);
    }
  };

  const handleSavePassword = async () => {
    if (!sharingAlbum) return;
    const { error } = await supabase
      .from('shared_albums')
      .update({ public_link_password: password.trim() || null })
      .eq('id', sharingAlbum.id);
    
    if (!error) {
      toast.success(password.trim() ? 'Passwort gesetzt' : 'Passwort entfernt');
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'photos': return <Image className="w-4 h-4" />;
      case 'notes': return <FileText className="w-4 h-4" />;
      case 'files': return <FolderOpen className="w-4 h-4" />;
      case 'links': return <LinkIcon className="w-4 h-4" />;
      case 'tiktoks': return <Play className="w-4 h-4" />;
      default: return <Share2 className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Share2 className="w-7 h-7 text-primary" />
            Geteilte Alben
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verwalte und teile deine Alben mit anderen
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Neues Album
        </Button>
      </div>

      {/* My Albums */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Meine Alben</h2>
        
        {albums.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Share2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Keine geteilten Alben</h3>
            <p className="text-muted-foreground mb-4">
              Erstelle dein erstes Album um Inhalte zu teilen
            </p>
            <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Album erstellen
            </Button>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {albums.map((album) => (
              <motion.div
                key={album.id}
                variants={itemVariants}
                className={cn(
                  "group relative bg-card border rounded-xl p-5 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer",
                  album.is_pinned ? "border-primary/40" : "border-border"
                )}
                onClick={() => window.location.href = `/shared-album/${album.id}`}
              >
                {/* Pin indicator */}
                {album.is_pinned && (
                  <div className="absolute top-2 right-2">
                    <Pin className="w-4 h-4 text-primary" />
                  </div>
                )}
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${album.color}20` }}
                  >
                    <Share2 className="w-6 h-6" style={{ color: album.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{album.name}</h3>
                    {album.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{album.description}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(album); }}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async (e) => { 
                        e.stopPropagation(); 
                        const success = await togglePin(album.id);
                        if (success) {
                          toast.success(album.is_pinned ? 'Album losgelöst' : 'Album angepinnt');
                        }
                      }}>
                        {album.is_pinned ? (
                          <>
                            <PinOff className="w-4 h-4 mr-2" />
                            Loslösen
                          </>
                        ) : (
                          <>
                            <Pin className="w-4 h-4 mr-2" />
                            Anpinnen
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openShareDialog(album); }}>
                        <Settings2 className="w-4 h-4 mr-2" />
                        Teilen-Einstellungen
                      </DropdownMenuItem>
                      {album.public_link_token && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`/shared/${album.public_link_token}`, '_blank'); }}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Öffentlicher Link
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, album }); }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {getContentTypeIcon(album.content_type)}
                    {albumItemCounts[album.id] || 0} Elemente
                  </span>
                  {album.public_link_enabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                      <Globe className="w-3 h-3" />
                      Öffentlich
                    </span>
                  )}
                  {album.public_link_password && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600">
                      <Lock className="w-3 h-3" />
                      Passwort
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>Erstellt {format(new Date(album.created_at), 'dd. MMM yyyy', { locale: de })}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); openShareDialog(album); }}
                  >
                    <Users className="w-3 h-3 mr-1" />
                    Teilen
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* Shared with me */}
      {sharedWithMe.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Mit mir geteilt</h2>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {sharedWithMe.map((album) => (
              <motion.div
                key={album.id}
                variants={itemVariants}
                className="group bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => window.location.href = `/shared-album/${album.id}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${album.color}20` }}
                  >
                    <Share2 className="w-6 h-6" style={{ color: album.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{album.name}</h3>
                    {album.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{album.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Von Benutzer {album.owner_id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Geteilt {format(new Date(album.created_at), 'dd. MMM yyyy', { locale: de })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/shared-album/${album.id}`;
                    }}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Album öffnen
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues geteiltes Album</DialogTitle>
            <DialogDescription>
              Erstelle ein Album um Inhalte mit anderen zu teilen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mein Album"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Beschreibung (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beschreibe dein Album..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Farbe</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ALBUM_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      color === c && 'ring-2 ring-offset-2 ring-offset-background ring-primary'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Album bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Beschreibung</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Farbe</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ALBUM_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      color === c && 'ring-2 ring-offset-2 ring-offset-background ring-primary'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); resetForm(); }}>
              Abbrechen
            </Button>
            <Button onClick={handleEdit} disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Settings Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Teilen-Einstellungen: {sharingAlbum?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Public Link Section */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Öffentlicher Link</span>
                </div>
                {sharingAlbum?.public_link_enabled ? (
                  <Button variant="destructive" size="sm" onClick={handleDisableLink}>
                    Deaktivieren
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleGenerateLink}>
                    Aktivieren
                  </Button>
                )}
              </div>

              {sharingAlbum?.public_link_token && (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/shared/${sharingAlbum.public_link_token}`}
                      className="text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/shared/${sharingAlbum.public_link_token}`);
                        setCopiedLink(true);
                        toast.success('Link kopiert!');
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  {/* Password Protection */}
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Passwortschutz</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Passwort setzen (optional)"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button variant="outline" onClick={handleSavePassword}>
                        Speichern
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Besucher müssen das Passwort eingeben, um das Album zu sehen
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Share with Users */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Mit Benutzern teilen</span>
              </div>

              <div className="flex gap-2 mb-4">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
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
                <select
                  value={selectedPermission}
                  onChange={(e) => setSelectedPermission(e.target.value as 'view' | 'edit')}
                  className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
                >
                  <option value="view">Ansehen</option>
                  <option value="edit">Bearbeiten</option>
                </select>
                <Button onClick={handleShareWithUser} disabled={!selectedUserId} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {albumAccess.length > 0 && (
                <div className="space-y-2">
                  {albumAccess.map((access) => (
                    <div key={access.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm text-foreground">Benutzer {access.user_id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-muted">
                          {access.permission === 'edit' ? 'Bearbeiten' : 'Ansehen'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveAccess(access.user_id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsShareOpen(false)}>Fertig</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, album: null })}
        onConfirm={handleDelete}
        itemName={deleteConfirm.album?.name || 'Album'}
      />
    </div>
  );
}
