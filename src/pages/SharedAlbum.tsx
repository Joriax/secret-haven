import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Image,
  FileText,
  FolderOpen,
  Link as LinkIcon,
  Play,
  Lock,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Download,
  Eye,
  Calendar,
  User,
  Globe,
  Heart,
  X,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  Film,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
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
  public_link_enabled: boolean;
  public_link_password: string | null;
}

interface AlbumItem {
  id: string;
  type: 'photo' | 'note' | 'file' | 'link' | 'tiktok';
  data: any;
  added_at: string;
}

type ViewMode = 'grid' | 'list';

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

// Helper to get photo URL from Supabase Storage
const getPhotoUrl = (filename: string): string => {
  const { data } = supabase.storage.from('photos').getPublicUrl(filename);
  return data.publicUrl;
};

export default function SharedAlbum() {
  const { token } = useParams<{ token: string }>();
  const { userId, isAuthenticated } = useAuth();
  const [album, setAlbum] = useState<SharedAlbumData | null>(null);
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedItem, setSelectedItem] = useState<AlbumItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  
  // Password protection states
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    if (token) {
      fetchAlbum();
    }
  }, [token]);

  const fetchAlbum = async (skipPasswordCheck = false) => {
    try {
      // Fetch album by public token
      const { data: albumData, error: albumError } = await supabase
        .from('shared_albums')
        .select('*')
        .eq('public_link_token', token)
        .eq('public_link_enabled', true)
        .single();

      if (albumError || !albumData) {
        setError('Album nicht gefunden oder nicht öffentlich');
        setIsLoading(false);
        return;
      }

      setAlbum(albumData as SharedAlbumData);
      
      // Check if password is required
      if (albumData.public_link_password && !skipPasswordCheck && !isUnlocked) {
        setNeedsPassword(true);
        setIsLoading(false);
        return;
      }

      // Fetch album items
      const { data: itemsData, error: itemsError } = await supabase
        .from('shared_album_items')
        .select('*')
        .eq('shared_album_id', albumData.id)
        .order('added_at', { ascending: false });

      if (itemsError) throw itemsError;

      // Fetch actual item data based on type
      const enrichedItems: AlbumItem[] = [];

      for (const item of itemsData || []) {
        if (item.photo_id) {
          const { data } = await supabase.from('photos').select('*').eq('id', item.photo_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'photo', data, added_at: item.added_at });
        }
        if (item.note_id) {
          const { data } = await supabase.from('notes').select('id, title, content, created_at, updated_at').eq('id', item.note_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'note', data, added_at: item.added_at });
        }
        if (item.file_id) {
          const { data } = await supabase.from('files').select('*').eq('id', item.file_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'file', data, added_at: item.added_at });
        }
        if (item.link_id) {
          const { data } = await supabase.from('links').select('*').eq('id', item.link_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'link', data, added_at: item.added_at });
        }
        if (item.tiktok_id) {
          const { data } = await supabase.from('tiktok_videos').select('*').eq('id', item.tiktok_id).single();
          if (data) enrichedItems.push({ id: item.id, type: 'tiktok', data, added_at: item.added_at });
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

  const handlePasswordSubmit = () => {
    if (!album) return;
    
    if (passwordInput === album.public_link_password) {
      setIsUnlocked(true);
      setNeedsPassword(false);
      setPasswordError(false);
      setIsLoading(true);
      fetchAlbum(true);
    } else {
      setPasswordError(true);
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

  const getTypeName = (type: string) => {
    switch (type) {
      case 'photo': return 'Foto';
      case 'note': return 'Notiz';
      case 'file': return 'Datei';
      case 'link': return 'Link';
      case 'tiktok': return 'TikTok';
      default: return 'Element';
    }
  };

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, AlbumItem[]>);

  const photoItems = items.filter(i => i.type === 'photo');

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (lightboxIndex === null) return;
    const newIndex = direction === 'next' 
      ? (lightboxIndex + 1) % photoItems.length 
      : (lightboxIndex - 1 + photoItems.length) % photoItems.length;
    setLightboxIndex(newIndex);
  };

  const handleDownload = async (item: AlbumItem) => {
    try {
      const bucket = item.type === 'photo' ? 'photos' : 'files';
      const filename = item.data.filename;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(filename);
      
      if (error) throw error;
      
      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.split('/').pop() || filename;
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Album wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">{error}</h1>
          <p className="text-muted-foreground mb-6">
            Dieses Album ist nicht verfügbar oder wurde gelöscht.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
        </div>
      </div>
    );
  }

  if (!album) {
    return <Navigate to="/login" replace />;
  }

  // Password protection screen
  if (needsPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md px-4"
        >
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: `${album.color}20` }}
          >
            <Lock className="w-10 h-10" style={{ color: album.color }} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{album.name}</h1>
          <p className="text-muted-foreground mb-6">
            Dieses Album ist passwortgeschützt. Bitte gib das Passwort ein.
          </p>
          <div className="space-y-4">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="Passwort eingeben"
                className={cn(
                  "w-full px-4 py-3 rounded-xl bg-muted border text-foreground text-center text-lg",
                  passwordError ? "border-destructive" : "border-border"
                )}
                autoFocus
              />
              {passwordError && (
                <p className="text-destructive text-sm mt-2">Falsches Passwort</p>
              )}
            </div>
            <Button onClick={handlePasswordSubmit} className="w-full" size="lg">
              Album öffnen
            </Button>
            <Button variant="ghost" onClick={() => window.history.back()} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header 
        className="relative border-b border-border overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${album.color}15 0%, ${album.color}05 100%)` 
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
        <div className="relative max-w-6xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-5 rounded-2xl shadow-lg"
              style={{ backgroundColor: `${album.color}20`, border: `2px solid ${album.color}40` }}
            >
              <Share2 className="w-10 h-10" style={{ color: album.color }} />
            </motion.div>
            <div className="flex-1">
              <motion.h1 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl md:text-4xl font-bold text-foreground mb-2"
              >
                {album.name}
              </motion.h1>
              {album.description && (
                <motion.p 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-lg text-muted-foreground mb-4"
                >
                  {album.description}
                </motion.p>
              )}
              <motion.div 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap items-center gap-3"
              >
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  Öffentliches Album
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground">
                  <Share2 className="w-4 h-4" />
                  {items.length} Element{items.length !== 1 ? 'e' : ''}
                </span>
                {Object.keys(groupedItems).map(type => (
                  <span 
                    key={type}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      getTypeColor(type)
                    )}
                  >
                    {getTypeIcon(type)}
                    {groupedItems[type].length} {getTypeName(type)}{groupedItems[type].length !== 1 ? (type === 'notiz' ? 'en' : 's') : ''}
                  </span>
                ))}
              </motion.div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {items.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Share2 className="w-12 h-12 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Dieses Album ist leer</h2>
            <p className="text-muted-foreground">
              Es wurden noch keine Inhalte zu diesem Album hinzugefügt.
            </p>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-200"
              >
                {/* Type Badge */}
                <div className={cn(
                  "absolute top-3 left-3 z-10 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                  getTypeColor(item.type)
                )}>
                  {getTypeIcon(item.type)}
                  {getTypeName(item.type)}
                </div>

                {/* Photo */}
                {item.type === 'photo' && (
                  <div 
                    className="aspect-square bg-muted cursor-pointer relative overflow-hidden"
                    onClick={() => setLightboxIndex(photoItems.findIndex(p => p.id === item.id))}
                  >
                    {item.data.filename ? (
                      <img 
                        src={getPhotoUrl(item.data.filename)} 
                        alt={item.data.caption || 'Foto'} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={cn(
                      "w-full h-full flex items-center justify-center bg-gradient-to-br from-green-500/20 to-emerald-500/10 absolute inset-0",
                      item.data.filename ? "hidden" : ""
                    )}>
                      <Image className="w-16 h-16 text-green-500/50" />
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-8 h-8 text-white" />
                    </div>
                  </div>
                )}

                {/* Note */}
                {item.type === 'note' && (
                  <div className="p-5">
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-4">
                      <FileText className="w-6 h-6 text-yellow-500" />
                    </div>
                    <h3 className="font-semibold text-foreground text-lg mb-2 line-clamp-1">
                      {item.data.title || 'Unbenannte Notiz'}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {item.data.content || 'Keine Vorschau verfügbar'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(item.data.created_at), 'dd. MMM yyyy', { locale: de })}
                    </div>
                  </div>
                )}

                {/* File */}
                {item.type === 'file' && (
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <FolderOpen className="w-6 h-6 text-purple-500" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={() => handleDownload(item)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                    <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                      {item.data.filename}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="px-2 py-1 rounded bg-muted">
                        {item.data.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                      </span>
                      <span>{(item.data.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>
                )}

                {/* Link */}
                {item.type === 'link' && (
                  <a
                    href={item.data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {item.data.image_url && (
                      <div className="h-32 bg-muted overflow-hidden">
                        <img
                          src={item.data.image_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="p-5">
                      {!item.data.image_url && (
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                          {item.data.favicon_url ? (
                            <img src={item.data.favicon_url} alt="" className="w-6 h-6 rounded" />
                          ) : (
                            <LinkIcon className="w-6 h-6 text-cyan-500" />
                          )}
                        </div>
                      )}
                      <h3 className="font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                        {item.data.title}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {new URL(item.data.url).hostname.replace('www.', '')}
                      </p>
                    </div>
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-4 h-4 text-primary" />
                    </div>
                  </a>
                )}

                {/* TikTok */}
                {item.type === 'tiktok' && (
                  <a
                    href={item.data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="aspect-[9/16] bg-gradient-to-br from-pink-500/20 to-purple-500/20 relative overflow-hidden">
                      {item.data.thumbnail_url ? (
                        <img
                          src={item.data.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="w-16 h-16 text-pink-500/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        {item.data.author_name && (
                          <p className="text-sm font-medium flex items-center gap-1">
                            <User className="w-3 h-3" />
                            @{item.data.author_name}
                          </p>
                        )}
                        {item.data.title && (
                          <p className="text-xs opacity-80 line-clamp-2 mt-1">{item.data.title}</p>
                        )}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-8 h-8 text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  </a>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* List View */
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {items.map((item) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors group"
              >
                {/* Thumbnail / Icon */}
                {item.type === 'photo' && item.data.filename ? (
                  <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-muted">
                    <img 
                      src={getPhotoUrl(item.data.filename)} 
                      alt={item.data.caption || 'Foto'} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                    getTypeColor(item.type)
                  )}>
                    {getTypeIcon(item.type)}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {item.type === 'photo' && (item.data.caption || item.data.filename)}
                    {item.type === 'note' && (item.data.title || 'Unbenannte Notiz')}
                    {item.type === 'file' && item.data.filename}
                    {item.type === 'link' && item.data.title}
                    {item.type === 'tiktok' && (item.data.title || `TikTok von @${item.data.author_name}`)}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {item.type === 'photo' && `Foto • ${format(new Date(item.data.taken_at || item.data.uploaded_at), 'dd. MMM yyyy', { locale: de })}`}
                    {item.type === 'note' && (item.data.content?.substring(0, 100) || 'Keine Vorschau')}
                    {item.type === 'file' && `${item.data.mime_type} • ${(item.data.size / 1024 / 1024).toFixed(2)} MB`}
                    {item.type === 'link' && new URL(item.data.url).hostname}
                    {item.type === 'tiktok' && `@${item.data.author_name}`}
                  </p>
                </div>

                {/* Added date */}
                <div className="text-xs text-muted-foreground hidden sm:block">
                  {format(new Date(item.added_at), 'dd. MMM yyyy', { locale: de })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(item.type === 'link' || item.type === 'tiktok') && (
                    <a
                      href={item.data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Photo Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && photoItems[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              onClick={() => setLightboxIndex(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

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

            <div className="max-w-4xl max-h-[80vh] p-4" onClick={(e) => e.stopPropagation()}>
              {photoItems[lightboxIndex].data.filename ? (
                <img 
                  src={getPhotoUrl(photoItems[lightboxIndex].data.filename)} 
                  alt={photoItems[lightboxIndex].data.caption || 'Foto'} 
                  className="max-w-full max-h-[70vh] object-contain rounded-xl mx-auto"
                />
              ) : (
                <div className="bg-muted rounded-xl flex items-center justify-center min-h-[300px]">
                  <Image className="w-24 h-24 text-muted-foreground/50" />
                </div>
              )}
              <div className="text-center mt-4 text-white">
                <p className="font-medium">{photoItems[lightboxIndex].data.caption || photoItems[lightboxIndex].data.filename}</p>
                <p className="text-sm text-white/60">
                  {lightboxIndex + 1} / {photoItems.length}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
