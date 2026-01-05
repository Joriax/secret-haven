import React from 'react';
import { Calendar, Tag, HardDrive, FileText, Image, FolderOpen, Lock, Play, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tag as TagType } from '@/hooks/useTags';

interface GlobalSearchFiltersProps {
  selectedTypes: string[];
  onTypeChange: (types: string[]) => void;
  selectedTags: string[];
  onTagChange: (tags: string[]) => void;
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  onDateRangeChange: (range: 'all' | 'today' | 'week' | 'month' | 'year') => void;
  availableTags: TagType[];
}

const typeFilters = [
  { id: 'note', label: 'Notizen', icon: FileText },
  { id: 'photo', label: 'Fotos', icon: Image },
  { id: 'file', label: 'Dateien', icon: FolderOpen },
  { id: 'link', label: 'Links', icon: Link2 },
  { id: 'tiktok', label: 'TikToks', icon: Play },
  { id: 'secret_text', label: 'Geheim', icon: Lock },
];

const dateRanges = [
  { id: 'all', label: 'Alle' },
  { id: 'today', label: 'Heute' },
  { id: 'week', label: 'Diese Woche' },
  { id: 'month', label: 'Dieser Monat' },
  { id: 'year', label: 'Dieses Jahr' },
] as const;

export const GlobalSearchFilters: React.FC<GlobalSearchFiltersProps> = ({
  selectedTypes,
  onTypeChange,
  selectedTags,
  onTagChange,
  dateRange,
  onDateRangeChange,
  availableTags,
}) => {
  const toggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      onTypeChange(selectedTypes.filter(t => t !== typeId));
    } else {
      onTypeChange([...selectedTypes, typeId]);
    }
  };

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagChange(selectedTags.filter(t => t !== tagId));
    } else {
      onTagChange([...selectedTags, tagId]);
    }
  };

  return (
    <div className="space-y-3 p-4 border-b border-border/30">
      {/* Type Filters */}
      <div className="flex flex-wrap gap-2">
        {typeFilters.map((type) => (
          <button
            key={type.id}
            onClick={() => toggleType(type.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all",
              selectedTypes.includes(type.id)
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <type.icon className="w-3.5 h-3.5" />
            {type.label}
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-1.5">
          {dateRanges.map((range) => (
            <button
              key={range.id}
              onClick={() => onDateRangeChange(range.id)}
              className={cn(
                "px-2 py-1 rounded text-xs transition-all",
                dateRange === range.id
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tag Filters */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
          {availableTags.slice(0, 8).map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "px-2 py-1 rounded text-xs transition-all",
                selectedTags.includes(tag.id) ? "ring-2 ring-primary" : ""
              )}
              style={{ 
                backgroundColor: `${tag.color}20`, 
                color: tag.color,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
