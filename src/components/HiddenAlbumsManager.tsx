import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Folder, ChevronRight, ChevronDown, Search, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Album {
  id: string;
  name: string;
  parent_id: string | null;
  is_hidden: boolean;
  color?: string;
  icon?: string;
}

interface AlbumTreeItemProps {
  album: Album;
  depth: number;
  children: Album[];
  allAlbums: Album[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  isParentHidden: boolean;
}

const AlbumTreeItem: React.FC<AlbumTreeItemProps> = ({
  album,
  depth,
  children,
  allAlbums,
  expandedIds,
  onToggleExpand,
  onToggleHidden,
  isParentHidden,
}) => {
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(album.id);
  const isHidden = album.is_hidden || isParentHidden;
  const isExplicitlyHidden = album.is_hidden;

  const childAlbums = allAlbums.filter(a => a.parent_id === album.id);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-lg transition-colors",
          "hover:bg-muted/50",
          isHidden && "opacity-60"
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={() => onToggleExpand(album.id)}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded transition-colors",
            hasChildren ? "hover:bg-muted" : "invisible"
          )}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          )}
        </button>

        {/* Folder Icon */}
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${album.color || '#6366f1'}20` }}
        >
          <Folder 
            className="w-4 h-4" 
            style={{ color: album.color || '#6366f1' }} 
          />
        </div>

        {/* Name */}
        <span className={cn(
          "flex-1 text-sm font-medium truncate",
          isHidden ? "text-muted-foreground" : "text-foreground"
        )}>
          {album.name}
        </span>

        {/* Hidden indicator from parent */}
        {isParentHidden && !isExplicitlyHidden && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            (vererbt)
          </span>
        )}

        {/* Toggle Switch */}
        <div className="flex items-center gap-2">
          {isHidden ? (
            <EyeOff className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Eye className="w-4 h-4 text-primary" />
          )}
          <Switch
            checked={!isExplicitlyHidden}
            onCheckedChange={(checked) => onToggleHidden(album.id, !checked)}
            disabled={isParentHidden && !isExplicitlyHidden}
          />
        </div>
      </div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {childAlbums.map(child => (
              <AlbumTreeItem
                key={child.id}
                album={child}
                depth={depth + 1}
                children={allAlbums.filter(a => a.parent_id === child.id)}
                allAlbums={allAlbums}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                onToggleHidden={onToggleHidden}
                isParentHidden={isHidden}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const HiddenAlbumsManager: React.FC = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const { userId, supabaseClient: supabase } = useAuth();

  const fetchAlbums = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('albums')
        .select('id, name, parent_id, is_hidden, color, icon')
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;

      setAlbums((data || []).map(a => ({
        ...a,
        is_hidden: a.is_hidden ?? false,
      })));

      // Expand all by default for better visibility
      const allIds = new Set((data || []).map(a => a.id));
      setExpandedIds(allIds);
    } catch (error) {
      console.error('Error fetching albums:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleHidden = useCallback(async (id: string, hidden: boolean) => {
    try {
      const { error } = await supabase
        .from('albums')
        .update({ is_hidden: hidden })
        .eq('id', id);

      if (error) throw error;

      setAlbums(prev => prev.map(a => 
        a.id === id ? { ...a, is_hidden: hidden } : a
      ));

      toast.success(hidden ? 'Album ausgeblendet' : 'Album eingeblendet');
    } catch (error) {
      console.error('Error toggling hidden:', error);
      toast.error('Fehler beim Ändern');
    }
  }, [supabase]);

  // Filter and build tree
  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albums;
    const query = searchQuery.toLowerCase();
    return albums.filter(a => a.name.toLowerCase().includes(query));
  }, [albums, searchQuery]);

  const rootAlbums = useMemo(() => {
    return filteredAlbums.filter(a => !a.parent_id);
  }, [filteredAlbums]);

  const hiddenCount = useMemo(() => {
    return albums.filter(a => a.is_hidden).length;
  }, [albums]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Keine Alben vorhanden</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-500">Ausgeblendete Alben</p>
          <p className="text-muted-foreground mt-1">
            Ausgeblendete Alben und alle ihre Unteralben samt Inhalten werden 
            komplett unsichtbar – auch in Statistiken, Smart-Alben und der Übersicht.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
        <span className="text-sm text-muted-foreground">
          {hiddenCount} von {albums.length} Alben ausgeblendet
        </span>
        {hiddenCount > 0 && (
          <button
            onClick={async () => {
              const hidden = albums.filter(a => a.is_hidden);
              for (const album of hidden) {
                await toggleHidden(album.id, false);
              }
            }}
            className="text-xs text-primary hover:underline"
          >
            Alle einblenden
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Alben suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Album Tree */}
      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
        {rootAlbums.map(album => (
          <AlbumTreeItem
            key={album.id}
            album={album}
            depth={0}
            children={filteredAlbums.filter(a => a.parent_id === album.id)}
            allAlbums={filteredAlbums}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onToggleHidden={toggleHidden}
            isParentHidden={false}
          />
        ))}
      </div>
    </div>
  );
};

export default HiddenAlbumsManager;
