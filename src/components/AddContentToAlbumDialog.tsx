import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Image,
  FileText,
  FolderOpen,
  Link as LinkIcon,
  Film,
  Check,
  Loader2,
  X,
  Search,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface AddContentToAlbumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albumId: string;
  existingItemIds: string[];
  onItemsAdded: () => void;
}

interface ContentItem {
  id: string;
  type: 'photo' | 'note' | 'file' | 'link' | 'tiktok';
  title: string;
  subtitle?: string;
  thumbnail?: string;
}

const getPhotoSignedUrl = async (filename: string): Promise<string> => {
  const { data } = await supabase.storage.from('photos').createSignedUrl(filename, 3600);
  return data?.signedUrl || '';
};

export function AddContentToAlbumDialog({
  open,
  onOpenChange,
  albumId,
  existingItemIds,
  onItemsAdded,
}: AddContentToAlbumDialogProps) {
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState('photos');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [photos, setPhotos] = useState<ContentItem[]>([]);
  const [notes, setNotes] = useState<ContentItem[]>([]);
  const [files, setFiles] = useState<ContentItem[]>([]);
  const [links, setLinks] = useState<ContentItem[]>([]);
  const [tiktoks, setTiktoks] = useState<ContentItem[]>([]);
  
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && userId) {
      fetchContent();
    }
  }, [open, userId]);

  useEffect(() => {
    if (!open) {
      setSelectedItems(new Set());
      setSearchQuery('');
    }
  }, [open]);

  const fetchContent = async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      // Fetch photos with signed URLs
      const { data: photosData } = await supabase
        .from('photos')
        .select('id, filename, caption')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false })
        .limit(100);

      // Generate signed URLs for photos
      const photosWithUrls = await Promise.all(
        (photosData || []).map(async (p) => {
          const thumbnail = await getPhotoSignedUrl(p.filename);
          return {
            id: p.id,
            type: 'photo' as const,
            title: p.caption || p.filename.split('/').pop() || 'Foto',
            thumbnail,
          };
        })
      );
      setPhotos(photosWithUrls);

      // Fetch notes
      const { data: notesData } = await supabase
        .from('notes')
        .select('id, title, content')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(100);

      setNotes((notesData || []).map(n => ({
        id: n.id,
        type: 'note' as const,
        title: n.title || 'Unbenannte Notiz',
        subtitle: n.content?.substring(0, 50) || '',
      })));

      // Fetch files
      const { data: filesData } = await supabase
        .from('files')
        .select('id, filename, mime_type, size')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false })
        .limit(100);

      setFiles((filesData || []).map(f => ({
        id: f.id,
        type: 'file' as const,
        title: f.filename.split('/').pop() || f.filename,
        subtitle: `${f.mime_type} • ${(f.size / 1024 / 1024).toFixed(2)} MB`,
      })));

      // Fetch links
      const { data: linksData } = await supabase
        .from('links')
        .select('id, title, url, favicon_url')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      setLinks((linksData || []).map(l => ({
        id: l.id,
        type: 'link' as const,
        title: l.title || l.url,
        subtitle: new URL(l.url).hostname,
        thumbnail: l.favicon_url || undefined,
      })));

      // Fetch tiktoks
      const { data: tiktoksData } = await supabase
        .from('tiktok_videos')
        .select('id, title, author_name, thumbnail_url')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      setTiktoks((tiktoksData || []).map(t => ({
        id: t.id,
        type: 'tiktok' as const,
        title: t.title || `TikTok von @${t.author_name}`,
        subtitle: `@${t.author_name}`,
        thumbnail: t.thumbnail_url || undefined,
      })));

    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Fehler beim Laden der Inhalte');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddItems = async () => {
    if (!userId || selectedItems.size === 0) return;
    setIsSubmitting(true);

    try {
      const allItems = [...photos, ...notes, ...files, ...links, ...tiktoks];
      const itemsToAdd = allItems.filter(item => selectedItems.has(item.id));

      for (const item of itemsToAdd) {
        const insertData: Record<string, string> = {
          shared_album_id: albumId,
          added_by: userId,
        };
        insertData[`${item.type}_id`] = item.id;

        await supabase
          .from('shared_album_items')
          .insert(insertData as any);
      }

      toast.success(`${itemsToAdd.length} Element${itemsToAdd.length !== 1 ? 'e' : ''} hinzugefügt`);
      onItemsAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding items:', error);
      toast.error('Fehler beim Hinzufügen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filterItems = (items: ContentItem[]) => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item.title.toLowerCase().includes(query) ||
      item.subtitle?.toLowerCase().includes(query)
    );
  };

  const isAlreadyInAlbum = (id: string) => existingItemIds.includes(id);

  const renderItemGrid = (items: ContentItem[], type: string) => {
    const filtered = filterItems(items).filter(item => !isAlreadyInAlbum(item.id));
    
    if (filtered.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          {items.length === 0 ? (
            <p>Keine {type} vorhanden</p>
          ) : filterItems(items).length === 0 ? (
            <p>Keine Ergebnisse für "{searchQuery}"</p>
          ) : (
            <p>Alle {type} sind bereits im Album</p>
          )}
        </div>
      );
    }

    if (type === 'Fotos') {
      return (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={cn(
                "aspect-square rounded-lg overflow-hidden relative group border-2 transition-all",
                selectedItems.has(item.id) 
                  ? "border-primary ring-2 ring-primary/30" 
                  : "border-transparent hover:border-primary/50"
              )}
            >
              <img 
                src={item.thumbnail} 
                alt={item.title} 
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {selectedItems.has(item.id) && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-5 h-5 text-primary-foreground" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filtered.map(item => (
          <button
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
              selectedItems.has(item.id)
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              item.type === 'note' && "bg-yellow-500/10 text-yellow-500",
              item.type === 'file' && "bg-purple-500/10 text-purple-500",
              item.type === 'link' && "bg-cyan-500/10 text-cyan-500",
              item.type === 'tiktok' && "bg-pink-500/10 text-pink-500",
            )}>
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" className="w-6 h-6 rounded" />
              ) : (
                <>
                  {item.type === 'note' && <FileText className="w-5 h-5" />}
                  {item.type === 'file' && <FolderOpen className="w-5 h-5" />}
                  {item.type === 'link' && <LinkIcon className="w-5 h-5" />}
                  {item.type === 'tiktok' && <Film className="w-5 h-5" />}
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{item.title}</p>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
              )}
            </div>
            {selectedItems.has(item.id) && (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>
    );
  };

  const totalSelected = selectedItems.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Inhalte zum Album hinzufügen</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="photos" className="gap-1.5">
                <Image className="w-4 h-4" />
                Fotos ({photos.filter(p => !isAlreadyInAlbum(p.id)).length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5">
                <FileText className="w-4 h-4" />
                Notizen ({notes.filter(n => !isAlreadyInAlbum(n.id)).length})
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5">
                <FolderOpen className="w-4 h-4" />
                Dateien ({files.filter(f => !isAlreadyInAlbum(f.id)).length})
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-1.5">
                <LinkIcon className="w-4 h-4" />
                Links ({links.filter(l => !isAlreadyInAlbum(l.id)).length})
              </TabsTrigger>
              <TabsTrigger value="tiktoks" className="gap-1.5">
                <Film className="w-4 h-4" />
                TikToks ({tiktoks.filter(t => !isAlreadyInAlbum(t.id)).length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="photos" className="mt-0">
                {renderItemGrid(photos, 'Fotos')}
              </TabsContent>
              <TabsContent value="notes" className="mt-0">
                {renderItemGrid(notes, 'Notizen')}
              </TabsContent>
              <TabsContent value="files" className="mt-0">
                {renderItemGrid(files, 'Dateien')}
              </TabsContent>
              <TabsContent value="links" className="mt-0">
                {renderItemGrid(links, 'Links')}
              </TabsContent>
              <TabsContent value="tiktoks" className="mt-0">
                {renderItemGrid(tiktoks, 'TikToks')}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {totalSelected > 0 ? `${totalSelected} ausgewählt` : 'Nichts ausgewählt'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleAddItems} 
              disabled={totalSelected === 0 || isSubmitting}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {totalSelected > 0 ? `${totalSelected} hinzufügen` : 'Hinzufügen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
