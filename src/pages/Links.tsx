import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLinks, Link } from '@/hooks/useLinks';
import { useLinkFolders, LinkFolder } from '@/hooks/useLinkFolders';
import { useViewHistory } from '@/hooks/useViewHistory';
import { useAuth } from '@/contexts/AuthContext';
import {
  Link2,
  Plus,
  ExternalLink,
  Star,
  MoreVertical,
  Pencil,
  Trash2,
  Folder,
  FolderMinus,
  FolderPlus,
  Search,
  Globe,
  Copy,
  Check,
  Loader2,
  X,
  Share2,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { ShareToAlbumDialog } from '@/components/ShareToAlbumDialog';

const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Links() {
  const { links, isLoading, createLink, updateLink, deleteLink, toggleFavorite, moveToFolder } = useLinks();
  const { folders, createFolder, updateFolder, deleteFolder } = useLinkFolders();
  const { recordView } = useViewHistory();
  const { sessionToken, supabaseClient: supabase } = useAuth();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; link: Link | null }>({ isOpen: false, link: null });
  const [shareToAlbum, setShareToAlbum] = useState<{ isOpen: boolean; link: Link | null }>({ isOpen: false, link: null });

  // Folder management states
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolder, setEditingFolder] = useState<LinkFolder | null>(null);

  // Filter links
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      const matchesFolder = selectedFolderId === null || link.folder_id === selectedFolderId;
      const matchesSearch =
        searchQuery === '' ||
        link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (link.description?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFavorite = !filterFavorites || link.is_favorite;
      return matchesFolder && matchesSearch && matchesFavorite;
    });
  }, [links, selectedFolderId, searchQuery, filterFavorites]);

  // Fetch metadata when URL changes
  const fetchMetadata = async (url: string) => {
    if (!url.trim() || !sessionToken) return;
    
    setIsFetchingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-link-metadata', {
        body: { url, sessionToken },
      });

      if (error) throw error;

      if (data?.title) {
        setNewTitle(data.title);
      }
      if (data?.description) {
        setNewDescription(data.description);
      }
      if (data?.image) {
        setNewImageUrl(data.image);
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    } finally {
      setIsFetchingMeta(false);
    }
  };

  // Debounced URL fetch
  useEffect(() => {
    if (!newUrl.trim() || !isCreateDialogOpen) return;
    
    const timeout = setTimeout(() => {
      fetchMetadata(newUrl);
    }, 500);

    return () => clearTimeout(timeout);
  }, [newUrl, isCreateDialogOpen]);

  const handleCreateLink = async () => {
    if (!newUrl.trim()) return;
    await createLink(
      newUrl.trim(), 
      newTitle.trim() || newUrl.trim(), 
      selectedFolderId || undefined,
      newDescription.trim() || undefined,
      newImageUrl || undefined
    );
    setNewUrl('');
    setNewTitle('');
    setNewDescription('');
    setNewImageUrl(null);
    setIsCreateDialogOpen(false);
  };

  const handleEditLink = async () => {
    if (!editingLink) return;
    await updateLink(editingLink.id, {
      url: newUrl.trim(),
      title: newTitle.trim(),
      description: newDescription.trim() || null,
    });
    setEditingLink(null);
    setIsEditDialogOpen(false);
  };

  const openEditDialog = (link: Link) => {
    setEditingLink(link);
    setNewUrl(link.url);
    setNewTitle(link.title);
    setNewDescription(link.description || '');
    setIsEditDialogOpen(true);
  };

  const openLink = (link: Link) => {
    recordView(link.id, 'link');
    window.open(link.url, '_blank');
  };

  const copyLink = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Link kopiert');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getFaviconUrl = (link: Link) => {
    if (link.favicon_url) return link.favicon_url;
    try {
      const urlObj = new URL(link.url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
    } catch {
      return null;
    }
  };

  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.link) return;
    await deleteLink(deleteConfirm.link.id);
    setDeleteConfirm({ isOpen: false, link: null });
  };

  // Folder management
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim(), newFolderColor);
    setNewFolderName('');
    setNewFolderColor(FOLDER_COLORS[0]);
    setIsFolderDialogOpen(false);
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;
    await updateFolder(editingFolder.id, { name: newFolderName.trim(), color: newFolderColor });
    setEditingFolder(null);
    setNewFolderName('');
    setNewFolderColor(FOLDER_COLORS[0]);
    setIsFolderDialogOpen(false);
  };

  const openEditFolderDialog = (folder: LinkFolder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setNewFolderColor(folder.color);
    setIsFolderDialogOpen(true);
  };

  const selectedFolderName = selectedFolderId 
    ? folders.find(f => f.id === selectedFolderId)?.name 
    : 'Alle Links';

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Links</h1>
              <p className="text-muted-foreground text-sm">
                {filteredLinks.length} Link{filteredLinks.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Link hinzufügen
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Links durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Folder Filter */}
            <Select
              value={selectedFolderId || 'all'}
              onValueChange={(value) => setSelectedFolderId(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-[180px]">
                <Folder className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Alle Ordner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Ordner</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: folder.color }}
                      />
                      {folder.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Favorites Filter */}
            <Button
              variant={filterFavorites ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterFavorites(!filterFavorites)}
              className="gap-2"
            >
              <Star className={cn("h-4 w-4", filterFavorites && "fill-current")} />
              Favoriten
            </Button>

            {/* Manage Folders */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  Ordner
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => {
                  setEditingFolder(null);
                  setNewFolderName('');
                  setNewFolderColor(FOLDER_COLORS[0]);
                  setIsFolderDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer Ordner
                </DropdownMenuItem>
                {folders.length > 0 && <DropdownMenuSeparator />}
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: folder.color }}
                      />
                      <span>{folder.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditFolderDialog(folder);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFolder(folder.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Links Grid */}
        <ScrollArea className="h-[calc(100vh-220px)]">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Link2 className="h-12 w-12 mb-4 opacity-50" />
              <p>Keine Links gefunden</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                Ersten Link hinzufügen
              </Button>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {filteredLinks.map((link) => (
                <motion.div
                  key={link.id}
                  variants={itemVariants}
                  layout
                  className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-200"
                >
                  {/* Preview Image */}
                  {link.image_url && (
                    <div 
                      className="relative h-32 bg-muted overflow-hidden cursor-pointer"
                      onClick={() => openLink(link)}
                    >
                      <img
                        src={link.image_url}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                    </div>
                  )}

                  {/* Favorite indicator */}
                  {link.is_favorite && (
                    <div className={cn("absolute z-10", link.image_url ? "top-3 right-3" : "top-3 right-3")}>
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 drop-shadow-md" />
                    </div>
                  )}

                  {/* Link content */}
                  <div
                    className="cursor-pointer p-4"
                    onClick={() => openLink(link)}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        {getFaviconUrl(link) ? (
                          <img
                            src={getFaviconUrl(link)!}
                            alt=""
                            className="w-6 h-6 rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <Globe className={cn("h-5 w-5 text-muted-foreground", getFaviconUrl(link) && "hidden")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {link.title}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {getDomain(link.url)}
                        </p>
                      </div>
                    </div>

                    {link.description && !link.image_url && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {link.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                      <span>
                        {format(new Date(link.created_at), 'dd. MMM yyyy', { locale: de })}
                      </span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyLink(link.url, link.id)}>
                          {copiedId === link.id ? (
                            <Check className="h-4 w-4 mr-2" />
                          ) : (
                            <Copy className="h-4 w-4 mr-2" />
                          )}
                          Link kopieren
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleFavorite(link.id)}>
                          <Star className={cn("h-4 w-4 mr-2", link.is_favorite && 'fill-yellow-500 text-yellow-500')} />
                          {link.is_favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(link)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Bearbeiten
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Move to folder */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Folder className="h-4 w-4 mr-2" />
                            In Ordner verschieben
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {folders.map((folder) => (
                              <DropdownMenuItem
                                key={folder.id}
                                onClick={() => moveToFolder(link.id, folder.id)}
                                disabled={link.folder_id === folder.id}
                              >
                                <div
                                  className="w-3 h-3 rounded-full mr-2"
                                  style={{ backgroundColor: folder.color }}
                                />
                                {folder.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {link.folder_id && (
                          <DropdownMenuItem onClick={() => moveToFolder(link.id, null)}>
                            <FolderMinus className="h-4 w-4 mr-2" />
                            Aus Ordner entfernen
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => setShareToAlbum({ isOpen: true, link })}>
                          <Share2 className="h-4 w-4 mr-2" />
                          Zu Album hinzufügen
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConfirm({ isOpen: true, link })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </ScrollArea>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuen Link hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">URL</label>
              <div className="relative mt-1">
                <Input
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  autoFocus
                />
                {isFetchingMeta && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Titel und Beschreibung werden automatisch abgerufen
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Titel</label>
              <Input
                placeholder="Link-Titel..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Beschreibung (optional)</label>
              <Textarea
                placeholder="Beschreibung..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setNewUrl('');
              setNewTitle('');
              setNewDescription('');
              setNewImageUrl(null);
            }}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateLink} disabled={!newUrl.trim() || isFetchingMeta}>
              {isFetchingMeta ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">URL</label>
              <Input
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Titel</label>
              <Input
                placeholder="Link-Titel..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Beschreibung</label>
              <Textarea
                placeholder="Beschreibung hinzufügen..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleEditLink} disabled={!newUrl.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFolder ? 'Ordner bearbeiten' : 'Neuer Ordner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                placeholder="Ordnername..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Farbe</label>
              <div className="flex gap-2 flex-wrap mt-2">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-transform",
                      newFolderColor === color && 'scale-110 ring-2 ring-offset-2 ring-offset-background ring-primary'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsFolderDialogOpen(false);
              setEditingFolder(null);
              setNewFolderName('');
              setNewFolderColor(FOLDER_COLORS[0]);
            }}>
              Abbrechen
            </Button>
            <Button 
              onClick={editingFolder ? handleUpdateFolder : handleCreateFolder} 
              disabled={!newFolderName.trim()}
            >
              {editingFolder ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, link: null })}
        onConfirm={handleDelete}
        itemName={deleteConfirm.link?.title || 'Link'}
      />

      {/* Share to Album Dialog */}
      <ShareToAlbumDialog
        isOpen={shareToAlbum.isOpen}
        onClose={() => setShareToAlbum({ isOpen: false, link: null })}
        itemId={shareToAlbum.link?.id || ''}
        itemType="link"
        contentType="links"
      />
    </>
  );
}
