import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Image,
  FileText,
  FolderOpen,
  Link as LinkIcon,
  Play,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Download,
  Eye,
  Calendar,
  User,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Film,
  Pause,
  SkipForward,
  SkipBack,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddContentToAlbumDialog } from '@/components/AddContentToAlbumDialog';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

interface SharedAlbumData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  content_type: string;
  owner_id: string;
}

interface AlbumItem {
  id: string;
  type: 'photo' | 'note' | 'file' | 'link' | 'tiktok';
  data: any;
  added_at: string;
  added_by: string;
  added_by_name?: string;
  signedUrl?: string; // For photos and files
}

interface UserPermission {
  canEdit: boolean;
  canView: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { staggerChildren: 0.05 } 
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function SharedAlbumView() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const { userId, isAuthenticated, isAuthLoading, supabaseClient: supabase } = useAuth();
  
  const [album, setAlbum] = useState<SharedAlbumData | null>(null);
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<UserPermission>({ canEdit: false, canView: false });
  const [activeTab, setActiveTab] = useState('all');
  
  // Lightbox states
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  
  // Slideshow states
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowInterval, setSlideshowInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Add content dialog
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [addContentType, setAddContentType] = useState<'photo' | 'note' | 'file' | 'link' | 'tiktok'>('photo');

  const photoItems = items.filter(i => i.type === 'photo');
  const noteItems = items.filter(i => i.type === 'note');
  const fileItems = items.filter(i => i.type === 'file');
  const linkItems = items.filter(i => i.type === 'link');
  const tiktokItems = items.filter(i => i.type === 'tiktok');

  useEffect(() => {
    // Wait for auth to finish loading before deciding to redirect
    if (isAuthLoading) return;
    
    if (albumId && userId) {
      fetchAlbumData();
    } else if (!isAuthenticated) {
      navigate('/login');
    }
  }, [albumId, userId, isAuthenticated, isAuthLoading]);

  const fetchAlbumData = async () => {
    if (!albumId || !userId) return;

    try {
      // Check if user has access
      const { data: accessData } = await supabase
        .from('shared_album_access')
        .select('permission')
        .eq('shared_album_id', albumId)
        .eq('user_id', userId)
        .single();

      // Check if user is owner
      const { data: albumData, error: albumError } = await supabase
        .from('shared_albums')
        .select('*')
        .eq('id', albumId)
        .single();

      if (albumError || !albumData) {
        setError('Album nicht gefunden');
        setIsLoading(false);
        return;
      }

      const isOwner = albumData.owner_id === userId;
      const hasAccess = accessData || isOwner;

      if (!hasAccess) {
        setError('Du hast keinen Zugriff auf dieses Album');
        setIsLoading(false);
        return;
      }

      setAlbum(albumData as SharedAlbumData);
      setPermission({
        canView: true,
        canEdit: isOwner || accessData?.permission === 'edit',
      });

      // Fetch album items with added_by info
      const { data: itemsData, error: itemsError } = await supabase
        .from('shared_album_items')
        .select('*')
        .eq('shared_album_id', albumId)
        .order('added_at', { ascending: false });

      if (itemsError) throw itemsError;

      // Fetch actual item data and user names
      const enrichedItems: AlbumItem[] = [];

      for (const item of itemsData || []) {
        let itemData = null;
        let itemType: AlbumItem['type'] = 'photo';
        let signedUrl: string | undefined;

        if (item.photo_id) {
          const { data } = await supabase.from('photos').select('*').eq('id', item.photo_id).single();
          itemData = data;
          itemType = 'photo';
          // Get signed URL for the photo - include user_id in path
          if (data?.filename && data?.user_id) {
            const { data: urlData } = await supabase.storage
              .from('photos')
              .createSignedUrl(`${data.user_id}/${data.filename}`, 3600);
            signedUrl = urlData?.signedUrl;
          }
        } else if (item.note_id) {
          const { data } = await supabase.from('notes').select('id, title, content, created_at, updated_at').eq('id', item.note_id).single();
          itemData = data;
          itemType = 'note';
        } else if (item.file_id) {
          const { data } = await supabase.from('files').select('*').eq('id', item.file_id).single();
          itemData = data;
          itemType = 'file';
          // Get signed URL for the file - include user_id in path
          if (data?.filename && data?.user_id) {
            const { data: urlData } = await supabase.storage
              .from('files')
              .createSignedUrl(`${data.user_id}/${data.filename}`, 3600);
            signedUrl = urlData?.signedUrl;
          }
        } else if (item.link_id) {
          const { data } = await supabase.from('links').select('*').eq('id', item.link_id).single();
          itemData = data;
          itemType = 'link';
        } else if (item.tiktok_id) {
          const { data } = await supabase.from('tiktok_videos').select('*').eq('id', item.tiktok_id).single();
          itemData = data;
          itemType = 'tiktok';
        }

        if (itemData) {
          enrichedItems.push({
            id: item.id,
            type: itemType,
            data: itemData,
            added_at: item.added_at,
            added_by: item.added_by,
            added_by_name: `Benutzer ${item.added_by.slice(0, 8)}`,
            signedUrl,
          });
        }
      }

      setItems(enrichedItems);
    } catch (err) {
      console.error('Error fetching shared album:', err);
      setError('Fehler beim Laden des Albums');
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'photo': return <Image className="w-4 h-4" />;
      case 'note': return <FileText className="w-4 h-4" />;
      case 'file': return <FolderOpen className="w-4 h-4" />;
      case 'link': return <LinkIcon className="w-4 h-4" />;
      case 'tiktok': return <Film className="w-4 h-4" />;
      default: return <Share2 className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'photo': return 'text-green-500 bg-green-500/10';
      case 'note': return 'text-yellow-500 bg-yellow-500/10';
      case 'file': return 'text-purple-500 bg-purple-500/10';
      case 'link': return 'text-cyan-500 bg-cyan-500/10';
      case 'tiktok': return 'text-pink-500 bg-pink-500/10';
      default: return 'text-primary bg-primary/10';
    }
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (lightboxIndex === null) return;
    const newIndex = direction === 'next' 
      ? (lightboxIndex + 1) % photoItems.length 
      : (lightboxIndex - 1 + photoItems.length) % photoItems.length;
    setLightboxIndex(newIndex);
  };

  const startSlideshow = () => {
    if (photoItems.length === 0) return;
    setLightboxIndex(0);
    setSlideshowActive(true);
    const interval = setInterval(() => {
      setLightboxIndex(prev => {
        if (prev === null) return 0;
        return (prev + 1) % photoItems.length;
      });
    }, 3000);
    setSlideshowInterval(interval);
  };

  const stopSlideshow = () => {
    setSlideshowActive(false);
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      setSlideshowInterval(null);
    }
  };

  const toggleSlideshow = () => {
    if (slideshowActive) {
      stopSlideshow();
    } else {
      startSlideshow();
    }
  };

  const handleDownload = async (item: AlbumItem) => {
    try {
      const bucket = item.type === 'photo' ? 'photos' : 'files';
      const filename = item.data.filename;
      const ownerId = item.data.user_id;
      
      // Build full path with user_id prefix
      const fullPath = ownerId ? `${ownerId}/${filename}` : filename;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(fullPath);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      // Remove timestamp prefix from filename for cleaner download name
      const cleanFilename = filename.replace(/^\d+-/, '');
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Download gestartet');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Download fehlgeschlagen');
    }
  };

  const handleRemoveItem = async (item: AlbumItem) => {
    if (!album || !permission.canEdit) return;

    try {
      const { error } = await supabase
        .from('shared_album_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Element entfernt');
    } catch (err) {
      console.error('Error removing item:', err);
      toast.error('Fehler beim Entfernen');
    }
  };

  const renderItemMeta = (item: AlbumItem) => (
    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
      <span className="flex items-center gap-1">
        <User className="w-3 h-3" />
        {item.added_by_name}
      </span>
      <span className="flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {format(new Date(item.added_at), 'dd.MM.yyyy', { locale: de })}
      </span>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {format(new Date(item.added_at), 'HH:mm', { locale: de })} Uhr
      </span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
          <Share2 className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{error || 'Album nicht gefunden'}</h1>
        <Button variant="outline" onClick={() => navigate('/shared-albums')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zu Geteilte Alben
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/shared-albums')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${album.color}20` }}
        >
          <Share2 className="w-7 h-7" style={{ color: album.color }} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{album.name}</h1>
          {album.description && (
            <p className="text-muted-foreground">{album.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>{items.length} Elemente</span>
            {permission.canEdit && (
              <span className="text-green-600 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Bearbeitungsrechte
              </span>
            )}
          </div>
        </div>
        {permission.canEdit && (
          <Button onClick={() => setAddContentOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Inhalt hinzufügen
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <Share2 className="w-4 h-4" />
              Alle ({items.length})
            </TabsTrigger>
            {photoItems.length > 0 && (
              <TabsTrigger value="photos" className="gap-2">
                <Image className="w-4 h-4" />
                Fotos ({photoItems.length})
              </TabsTrigger>
            )}
            {noteItems.length > 0 && (
              <TabsTrigger value="notes" className="gap-2">
                <FileText className="w-4 h-4" />
                Notizen ({noteItems.length})
              </TabsTrigger>
            )}
            {fileItems.length > 0 && (
              <TabsTrigger value="files" className="gap-2">
                <FolderOpen className="w-4 h-4" />
                Dateien ({fileItems.length})
              </TabsTrigger>
            )}
            {linkItems.length > 0 && (
              <TabsTrigger value="links" className="gap-2">
                <LinkIcon className="w-4 h-4" />
                Links ({linkItems.length})
              </TabsTrigger>
            )}
            {tiktokItems.length > 0 && (
              <TabsTrigger value="tiktoks" className="gap-2">
                <Film className="w-4 h-4" />
                TikToks ({tiktokItems.length})
              </TabsTrigger>
            )}
          </TabsList>
          
          {photoItems.length > 1 && activeTab === 'photos' && (
            <Button variant="outline" onClick={toggleSlideshow} className="gap-2">
              {slideshowActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              Diashow
            </Button>
          )}
        </div>

        {/* All items */}
        <TabsContent value="all">
          {items.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Album ist leer</h2>
              <p className="text-muted-foreground">
                {permission.canEdit ? 'Füge Inhalte hinzu um loszulegen' : 'Noch keine Inhalte vorhanden'}
              </p>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  className="group bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
                >
                  {/* Item content */}
                  {item.type === 'photo' && (
                    <div 
                      className="aspect-square bg-muted cursor-pointer relative overflow-hidden"
                      onClick={() => setLightboxIndex(photoItems.findIndex(p => p.id === item.id))}
                    >
                      <img 
                        src={item.signedUrl || ''} 
                        alt={item.data.caption || 'Foto'} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  )}

                  {item.type === 'note' && (
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground mb-2 line-clamp-1">
                        {item.data.title || 'Unbenannte Notiz'}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {item.data.content || 'Keine Vorschau verfügbar'}
                      </p>
                    </div>
                  )}

                  {item.type === 'file' && (
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <FolderOpen className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{item.data.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {(item.data.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {item.type === 'link' && (
                    <a href={item.data.url} target="_blank" rel="noopener noreferrer" className="block p-4 hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        {item.data.favicon_url ? (
                          <img src={item.data.favicon_url} alt="" className="w-8 h-8 rounded" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center">
                            <LinkIcon className="w-4 h-4 text-cyan-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{item.data.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {new URL(item.data.url).hostname}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </a>
                  )}

                  {item.type === 'tiktok' && (
                    <a href={item.data.url} target="_blank" rel="noopener noreferrer" className="block">
                      <div className="aspect-video bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center relative">
                        {item.data.thumbnail_url ? (
                          <img src={item.data.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Play className="w-12 h-12 text-white" />
                        )}
                        <div className="absolute bottom-2 left-2 right-2 text-white text-xs">
                          @{item.data.author_name}
                        </div>
                      </div>
                    </a>
                  )}

                  {/* Meta info */}
                  <div className="p-3 border-t border-border">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-2",
                      getTypeColor(item.type)
                    )}>
                      {getTypeIcon(item.type)}
                      {item.type === 'photo' ? 'Foto' : 
                       item.type === 'note' ? 'Notiz' : 
                       item.type === 'file' ? 'Datei' : 
                       item.type === 'link' ? 'Link' : 'TikTok'}
                    </div>
                    {renderItemMeta(item)}
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(item.type === 'photo' || item.type === 'file') && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => handleDownload(item)}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      )}
                      {permission.canEdit && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleRemoveItem(item)}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Entfernen
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </TabsContent>

        {/* Photos tab */}
        <TabsContent value="photos">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            {photoItems.map((item, index) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                className="group aspect-square bg-muted rounded-xl overflow-hidden cursor-pointer relative"
                onClick={() => setLightboxIndex(index)}
              >
                <img 
                  src={item.signedUrl || ''} 
                  alt={item.data.caption || 'Foto'} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-2 left-2 right-2 text-white text-xs">
                    <p className="truncate">{item.added_by_name}</p>
                    <p>{format(new Date(item.added_at), 'dd.MM.yyyy HH:mm', { locale: de })}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* Notes tab */}
        <TabsContent value="notes">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {noteItems.map((item) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors"
              >
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {item.data.title || 'Unbenannte Notiz'}
                </h3>
                <p className="text-muted-foreground whitespace-pre-wrap mb-4">
                  {item.data.content || 'Keine Inhalte'}
                </p>
                {renderItemMeta(item)}
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* Files tab */}
        <TabsContent value="files">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {fileItems.map((item) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.data.filename}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{(item.data.size / 1024 / 1024).toFixed(2)} MB</span>
                    <span>{item.data.mime_type}</span>
                  </div>
                  {renderItemMeta(item)}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDownload(item)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* Links tab */}
        <TabsContent value="links">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {linkItems.map((item) => (
              <motion.a
                key={item.id}
                variants={itemVariants}
                href={item.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
              >
                {item.data.image_url && (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img src={item.data.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {item.data.favicon_url && (
                      <img src={item.data.favicon_url} alt="" className="w-4 h-4" />
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                      {new URL(item.data.url).hostname}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground line-clamp-2 mb-1">{item.data.title}</h3>
                  {item.data.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.data.description}</p>
                  )}
                  {renderItemMeta(item)}
                </div>
              </motion.a>
            ))}
          </motion.div>
        </TabsContent>

        {/* TikToks tab */}
        <TabsContent value="tiktoks">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {tiktokItems.map((item) => (
              <motion.a
                key={item.id}
                variants={itemVariants}
                href={item.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <div className="aspect-[9/16] bg-gradient-to-br from-pink-500 to-purple-600 relative">
                  {item.data.thumbnail_url ? (
                    <img src={item.data.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-16 h-16 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="font-medium">@{item.data.author_name}</p>
                    {item.data.title && (
                      <p className="text-sm opacity-80 line-clamp-2">{item.data.title}</p>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  {renderItemMeta(item)}
                </div>
              </motion.a>
            ))}
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Photo Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && photoItems[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => { setLightboxIndex(null); stopSlideshow(); }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); stopSlideshow(); }}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Slideshow controls */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); toggleSlideshow(); }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                {slideshowActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              {slideshowActive && (
                <span className="text-white text-sm">Diashow läuft</span>
              )}
            </div>

            {photoItems.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); navigateLightbox('prev'); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigateLightbox('next'); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            <div className="max-w-5xl max-h-[85vh] p-4" onClick={(e) => e.stopPropagation()}>
              <img 
                src={photoItems[lightboxIndex].signedUrl || ''} 
                alt={photoItems[lightboxIndex].data.caption || 'Foto'} 
                className="max-w-full max-h-[75vh] object-contain rounded-xl mx-auto"
              />
              <div className="text-center mt-4 text-white">
                <p className="font-medium">{photoItems[lightboxIndex].data.caption || photoItems[lightboxIndex].data.filename}</p>
                <p className="text-sm text-white/60 mt-1">
                  Hinzugefügt von {photoItems[lightboxIndex].added_by_name} am {format(new Date(photoItems[lightboxIndex].added_at), 'dd.MM.yyyy HH:mm', { locale: de })} Uhr
                </p>
                <p className="text-sm text-white/40 mt-1">
                  {lightboxIndex + 1} / {photoItems.length}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Content Dialog */}
      <AddContentToAlbumDialog
        open={addContentOpen}
        onOpenChange={setAddContentOpen}
        albumId={albumId || ''}
        existingItemIds={items.map(item => item.data.id)}
        onItemsAdded={fetchAlbumData}
      />
    </div>
  );
}
