import React from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, FileText, Star, Image, Tag, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface MiniCalendarWidgetProps {
  className?: string;
}

export function MiniCalendarWidget({ className }: MiniCalendarWidgetProps) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const today = new Date();

  return (
    <div className={cn("bento-card", className)}>
      <div className="flex items-center gap-2 mb-4">
        <CalendarIcon className="w-5 h-5 text-primary" />
        <h3 className="font-medium">Kalender</h3>
      </div>
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          locale={de}
          className="rounded-md border-0"
        />
      </div>
    </div>
  );
}

interface PinnedNotesWidgetProps {
  notes: Array<{ id: string; title: string; isFavorite: boolean }>;
  onNoteClick?: (id: string) => void;
  className?: string;
}

export function PinnedNotesWidget({ notes, onNoteClick, className }: PinnedNotesWidgetProps) {
  const pinnedNotes = notes.filter(n => n.isFavorite).slice(0, 5);

  return (
    <div className={cn("bento-card", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-yellow-500" />
        <h3 className="font-medium">Favoriten</h3>
      </div>
      {pinnedNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Keine Favoriten vorhanden
        </p>
      ) : (
        <div className="space-y-2">
          {pinnedNotes.map(note => (
            <motion.button
              key={note.id}
              whileHover={{ x: 4 }}
              onClick={() => onNoteClick?.(note.id)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-left transition-colors"
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate">{note.title}</span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

interface RandomPhotoWidgetProps {
  photoUrl?: string;
  photoTitle?: string;
  onRefresh?: () => void;
  className?: string;
}

export function RandomPhotoWidget({ photoUrl, photoTitle, onRefresh, className }: RandomPhotoWidgetProps) {
  return (
    <div className={cn("bento-card overflow-hidden", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Image className="w-5 h-5 text-pink-500" />
          <h3 className="font-medium">Zufälliges Foto</h3>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="text-xs text-muted-foreground hover:text-foreground">
            Neues Foto
          </button>
        )}
      </div>
      {photoUrl ? (
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
          <img 
            src={photoUrl} 
            alt={photoTitle || 'Zufälliges Foto'} 
            className="w-full h-full object-cover"
          />
          {photoTitle && (
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60">
              <p className="text-xs text-white truncate">{photoTitle}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
          <Image className="w-12 h-12 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );
}

interface TagCloudWidgetProps {
  tags: Array<{ id: string; name: string; color: string; count: number }>;
  onTagClick?: (tagId: string) => void;
  className?: string;
}

export function TagCloudWidget({ tags, onTagClick, className }: TagCloudWidgetProps) {
  const topTags = tags.slice(0, 10);
  const maxCount = Math.max(...topTags.map(t => t.count), 1);

  return (
    <div className={cn("bento-card", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-5 h-5 text-primary" />
        <h3 className="font-medium">Tags</h3>
      </div>
      {topTags.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Keine Tags vorhanden
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {topTags.map(tag => {
            const size = 0.75 + (tag.count / maxCount) * 0.5;
            return (
              <motion.button
                key={tag.id}
                whileHover={{ scale: 1.05 }}
                onClick={() => onTagClick?.(tag.id)}
                className="px-2 py-1 rounded-full text-xs transition-colors"
                style={{ 
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                  fontSize: `${size}rem`,
                }}
              >
                {tag.name}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface QuickNoteWidgetProps {
  onSave?: (content: string) => void;
  className?: string;
}

export function QuickNoteWidget({ onSave, className }: QuickNoteWidgetProps) {
  const [content, setContent] = React.useState('');

  const handleSave = () => {
    if (content.trim()) {
      onSave?.(content);
      setContent('');
    }
  };

  return (
    <div className={cn("bento-card", className)}>
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="w-5 h-5 text-primary" />
        <h3 className="font-medium">Schnelle Notiz</h3>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Schnell etwas notieren..."
        className="w-full h-20 p-2 text-sm bg-muted rounded-lg border-0 resize-none focus:ring-1 focus:ring-primary"
      />
      <button
        onClick={handleSave}
        disabled={!content.trim()}
        className="mt-2 w-full py-2 text-sm font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        Speichern
      </button>
    </div>
  );
}
