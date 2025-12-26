import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { useLinks, Link } from '@/hooks/useLinks';
import { useLinkFolders, LinkFolder } from '@/hooks/useLinkFolders';
import { useViewHistory } from '@/hooks/useViewHistory';
import { supabase } from '@/integrations/supabase/client';
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
  ChevronLeft,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';

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
  const { links, isLoading, createLink, updateLink, deleteLink, toggleFavorite, moveToFolder, refetch } = useLinks();
  const { folders, createFolder, updateFolder, deleteFolder } = useLinkFolders();
  const { recordView } = useViewHistory();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [showFolderSidebar, setShowFolderSidebar] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; link: Link | null }>({ isOpen: false, link: null });

  // Folder management states
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState('');

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

  // Count links per folder
  const linkCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    links.forEach((link) => {
      if (link.folder_id) {
        counts[link.folder_id] = (counts[link.folder_id] || 0) + 1;
      }
    });
    return counts;
  }, [links]);

  // Fetch metadata when URL changes
  const fetchMetadata = async (url: string) => {
    if (!url.trim()) return;
    
    setIsFetchingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-link-metadata', {
        body: { url },
      });

      if (error) throw error;

      if (data?.title) {
        setNewTitle(data.title);
      }
      if (data?.description) {
        setNewDescription(data.description);
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
    await createLink(newUrl.trim(), newTitle.trim() || newUrl.trim(), selectedFolderId || undefined);
    // Also save description if provided
    if (newDescription.trim()) {
      // Get the newly created link and update it with description
      refetch();
    }
    setNewUrl('');
    setNewTitle('');
    setNewDescription('');
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
    setIsCreatingFolder(false);
  };

  const handleStartEditFolder = (folder: LinkFolder) => {
    setEditingFolder(folder.id);
    setEditFolderName(folder.name);
    setEditFolderColor(folder.color);
  };

  const handleSaveEditFolder = async () => {
    if (!editingFolder || !editFolderName.trim()) return;
    await updateFolder(editingFolder, { name: editFolderName.trim(), color: editFolderColor });
    setEditingFolder(null);
  };

  const selectedFolderName = selectedFolderId 
    ? folders.find(f => f.id === selectedFolderId)?.name 
    : 'Alle Links';

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar - similar to Notes */}
        <AnimatePresence>
          {showFolderSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-border bg-card/50 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Link-Ordner
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowFolderSidebar(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {/* All Links */}
                  <button
                    onClick={() => setSelectedFolderId(null)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                      selectedFolderId === null
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Alle Links
                    </span>
                    <span className="text-xs text-muted-foreground">{links.length}</span>
                  </button>

                  {/* Favorites */}
                  <button
                    onClick={() => setFilterFavorites(!filterFavorites)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                      filterFavorites
                        ? 'bg-yellow-500/10 text-yellow-600'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Star className={cn("h-4 w-4", filterFavorites && "fill-yellow-500")} />
                      Favoriten
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {links.filter(l => l.is_favorite).length}
                    </span>
                  </button>

                  <div className="h-px bg-border my-2" />

                  {/* Folders */}
                  {folders.map((folder) => (
                    <div key={folder.id}>
                      {editingFolder === folder.id ? (
                        <div className="p-2 space-y-2 bg-muted rounded-lg">
                          <Input
                            value={editFolderName}
                            onChange={(e) => setEditFolderName(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEditFolder()}
                          />
                          <div className="flex gap-1 flex-wrap">
                            {FOLDER_COLORS.map((color) => (
                              <button
                                key={color}
                                onClick={() => setEditFolderColor(color)}
                                className={cn(
                                  "w-5 h-5 rounded-full transition-transform",
                                  editFolderColor === color && 'scale-125 ring-2 ring-offset-2 ring-offset-background ring-primary'
                                )}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingFolder(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                            <Button size="sm" onClick={handleSaveEditFolder}>
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                            selectedFolderId === folder.id
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground hover:bg-muted'
                          )}
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            setFilterFavorites(false);
                          }}
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
                                <DropdownMenuItem onClick={() => handleStartEditFolder(folder)}>
                                  <Pencil className="h-3 w-3 mr-2" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteFolder(folder.id)}
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
                  {isCreatingFolder ? (
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
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                      />
                      <div className="flex gap-1 flex-wrap">
                        {FOLDER_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewFolderColor(color)}
                            className={cn(
                              "w-5 h-5 rounded-full transition-transform",
                              newFolderColor === color && 'scale-125 ring-2 ring-offset-2 ring-offset-background ring-primary'
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1"
                          onClick={() => setIsCreatingFolder(false)}
                        >
                          Abbrechen
                        </Button>
                        <Button size="sm" className="flex-1" onClick={handleCreateFolder}>
                          Erstellen
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2"
                      onClick={() => setIsCreatingFolder(true)}
                    >
                      <FolderPlus className="h-4 w-4" />
                      Neuer Ordner
                    </Button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {!showFolderSidebar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFolderSidebar(true)}
                  >
                    <Folder className="h-5 w-5" />
                  </Button>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {filterFavorites ? 'Favoriten' : selectedFolderName}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {filteredLinks.length} Link{filteredLinks.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Link hinzufügen
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Links durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Links Grid */}
          <ScrollArea className="flex-1 p-6">
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
                    {/* Favorite indicator */}
                    {link.is_favorite && (
                      <div className="absolute top-3 right-3 z-10">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      </div>
                    )}

                    {/* Link content */}
                    <div
                      className="cursor-pointer p-4"
                      onClick={() => openLink(link)}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          {getFaviconUrl(link) ? (
                            <img
                              src={getFaviconUrl(link)!}
                              alt=""
                              className="w-8 h-8 rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <Globe className={cn("h-6 w-6 text-muted-foreground", getFaviconUrl(link) && "hidden")} />
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

                      {link.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
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

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, link: null })}
        onConfirm={handleDelete}
        itemName={deleteConfirm.link?.title || 'Link'}
      />
    </>
  );
}
