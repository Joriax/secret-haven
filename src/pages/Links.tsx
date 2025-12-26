import { useState, useMemo } from 'react';
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
import { useLinkFolders } from '@/hooks/useLinkFolders';
import { LinkFolderSidebar } from '@/components/LinkFolderSidebar';
import { useViewHistory } from '@/hooks/useViewHistory';
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
  Search,
  Globe,
  Copy,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Links() {
  const { links, isLoading, createLink, updateLink, deleteLink, toggleFavorite, moveToFolder } = useLinks();
  const { folders, createFolder, updateFolder, deleteFolder } = useLinkFolders();
  const { recordView } = useViewHistory();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter links
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      const matchesFolder = selectedFolderId === null || link.folder_id === selectedFolderId;
      const matchesSearch =
        searchQuery === '' ||
        link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (link.description?.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesFolder && matchesSearch;
    });
  }, [links, selectedFolderId, searchQuery]);

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

  const handleCreateLink = async () => {
    if (!newUrl.trim()) return;
    await createLink(newUrl.trim(), newTitle.trim() || newUrl.trim(), selectedFolderId || undefined);
    setNewUrl('');
    setNewTitle('');
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

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Folder Sidebar */}
        <LinkFolderSidebar
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onCreateFolder={createFolder}
          onUpdateFolder={updateFolder}
          onDeleteFolder={deleteFolder}
          linkCounts={linkCounts}
          totalLinks={links.length}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Links</h1>
                <p className="text-muted-foreground text-sm">
                  {selectedFolderId
                    ? folders.find((f) => f.id === selectedFolderId)?.name
                    : 'Alle Links'}
                  {' · '}{filteredLinks.length} Link{filteredLinks.length !== 1 ? 's' : ''}
                </p>
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {filteredLinks.map((link) => (
                    <motion.div
                      key={link.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group relative bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors"
                    >
                      {/* Favorite indicator */}
                      {link.is_favorite && (
                        <Star className="absolute top-3 right-3 h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}

                      {/* Link content */}
                      <div
                        className="cursor-pointer"
                        onClick={() => openLink(link)}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            {getFaviconUrl(link) ? (
                              <img
                                src={getFaviconUrl(link)!}
                                alt=""
                                className="w-6 h-6 rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Globe className="h-5 w-5 text-muted-foreground" />
                            )}
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

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8">
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
                              <Star className={`h-4 w-4 mr-2 ${link.is_favorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
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
                              onClick={() => deleteLink(link.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Link hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">URL</label>
              <Input
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Titel (optional)</label>
              <Input
                placeholder="Link-Titel..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateLink} disabled={!newUrl.trim()}>
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
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
    </>
  );
}
