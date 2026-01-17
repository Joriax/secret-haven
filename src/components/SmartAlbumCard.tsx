import React from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, 
  Clock, 
  Calendar, 
  Video, 
  Image, 
  FileText, 
  Music, 
  HardDrive, 
  Tag, 
  Tags,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartAlbum } from '@/hooks/useSmartAlbums';

interface SmartAlbumCardProps {
  album: SmartAlbum;
  isSelected?: boolean;
  onClick?: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart,
  Clock,
  Calendar,
  Video,
  Image,
  FileText,
  Music,
  HardDrive,
  Tag,
  Tags,
  Sparkles,
  Zap,
};

export function SmartAlbumCard({ album, isSelected, onClick }: SmartAlbumCardProps) {
  const IconComponent = iconMap[album.icon] || Sparkles;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative w-full p-4 rounded-2xl text-left transition-all",
        "bg-gradient-to-br from-card to-muted/50",
        "border border-border/50 hover:border-border",
        "shadow-sm hover:shadow-md",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      {/* Smart Badge */}
      <div className="absolute top-2 right-2">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
          <Zap className="w-2.5 h-2.5" />
          Smart
        </div>
      </div>

      {/* Icon */}
      <div 
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: `${album.color}20` }}
      >
        <IconComponent 
          className="w-6 h-6" 
          style={{ color: album.color }} 
        />
      </div>

      {/* Content */}
      <h3 className="font-semibold text-foreground text-sm truncate">
        {album.name}
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
        {album.description}
      </p>

      {/* Count */}
      <div className="mt-3 flex items-center gap-2">
        <span 
          className="px-2 py-1 rounded-lg text-xs font-medium"
          style={{ 
            backgroundColor: `${album.color}15`,
            color: album.color 
          }}
        >
          {album.count} {album.count === 1 ? 'Element' : 'Elemente'}
        </span>
      </div>
    </motion.button>
  );
}

interface SmartAlbumListProps {
  albums: SmartAlbum[];
  selectedId?: string | null;
  onSelect?: (albumId: string | null) => void;
  compact?: boolean;
}

export function SmartAlbumList({ albums, selectedId, onSelect, compact }: SmartAlbumListProps) {
  if (albums.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="space-y-1">
        {albums.map((album) => {
          const IconComponent = iconMap[album.icon] || Sparkles;
          return (
            <button
              key={album.id}
              onClick={() => onSelect?.(album.id)}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
                selectedId === album.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/50 text-foreground"
              )}
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${album.color}20` }}
              >
                <IconComponent 
                  className="w-4 h-4" 
                  style={{ color: album.color }} 
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{album.name}</span>
                  <Zap className="w-3 h-3 text-primary flex-shrink-0" />
                </div>
              </div>
              <span 
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ 
                  backgroundColor: `${album.color}15`,
                  color: album.color 
                }}
              >
                {album.count}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {albums.map((album) => (
        <SmartAlbumCard
          key={album.id}
          album={album}
          isSelected={selectedId === album.id}
          onClick={() => onSelect?.(album.id)}
        />
      ))}
    </div>
  );
}
