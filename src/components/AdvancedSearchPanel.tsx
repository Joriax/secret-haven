import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Calendar, 
  HardDrive, 
  Star, 
  X,
  FileText,
  Image,
  FolderOpen,
  Link2,
  Play,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdvancedSearch, AdvancedSearchFilters, AdvancedSearchResult } from '@/hooks/useAdvancedSearch';
import { useTags } from '@/hooks/useTags';
import { cn, formatFileSize } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface AdvancedSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onResultClick: (result: AdvancedSearchResult) => void;
}

const typeOptions = [
  { id: 'note', label: 'Notizen', icon: FileText },
  { id: 'photo', label: 'Fotos', icon: Image },
  { id: 'file', label: 'Dateien', icon: FolderOpen },
  { id: 'link', label: 'Links', icon: Link2 },
  { id: 'tiktok', label: 'TikToks', icon: Play },
];

const sizePresets = [
  { label: 'Beliebig', min: undefined, max: undefined },
  { label: '< 1 MB', min: undefined, max: 1024 * 1024 },
  { label: '1 - 10 MB', min: 1024 * 1024, max: 10 * 1024 * 1024 },
  { label: '10 - 100 MB', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
  { label: '> 100 MB', min: 100 * 1024 * 1024, max: undefined },
];

export const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({
  isOpen,
  onClose,
  onResultClick,
}) => {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Partial<AdvancedSearchFilters>>({
    types: [],
    tags: [],
    operator: 'AND',
  });
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sizePreset, setSizePreset] = useState(0);

  const { results, loading, search, clearResults } = useAdvancedSearch();
  const { tags } = useTags();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setShowFilters(false);
      clearResults();
    }
  }, [isOpen, clearResults]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      const searchFilters: Partial<AdvancedSearchFilters> = {
        ...filters,
        dateFrom,
        dateTo,
        sizeMin: sizePresets[sizePreset].min,
        sizeMax: sizePresets[sizePreset].max,
      };
      search(query, searchFilters);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, filters, dateFrom, dateTo, sizePreset, search]);

  const handleTypeToggle = (typeId: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types?.includes(typeId)
        ? prev.types.filter(t => t !== typeId)
        : [...(prev.types || []), typeId],
    }));
  };

  const handleTagToggle = (tagName: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags?.includes(tagName)
        ? prev.tags.filter(t => t !== tagName)
        : [...(prev.tags || []), tagName],
    }));
  };

  const clearAllFilters = () => {
    setFilters({ types: [], tags: [], operator: 'AND' });
    setDateFrom(undefined);
    setDateTo(undefined);
    setSizePreset(0);
  };

  const hasActiveFilters = 
    (filters.types?.length || 0) > 0 ||
    (filters.tags?.length || 0) > 0 ||
    dateFrom !== undefined ||
    dateTo !== undefined ||
    sizePreset !== 0 ||
    filters.isFavorite !== undefined;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border bg-card shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Search Header */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Suche mit Operatoren: AND, OR, -ausschließen, &quot;exakte phrase&quot;..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="border-0 focus-visible:ring-0 text-lg"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(hasActiveFilters && 'text-primary')}
              >
                <Filter className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Search Syntax Help */}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium mb-1">Such-Syntax:</p>
                  <ul className="space-y-1 text-xs">
                    <li><code className="bg-muted px-1 rounded">"phrase"</code> — Exakte Phrase</li>
                    <li><code className="bg-muted px-1 rounded">-wort</code> — Ausschließen</li>
                    <li><code className="bg-muted px-1 rounded">AND / OR</code> — Operatoren</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
              <span>Tipp: Verwende "phrase", -ausschließen, AND/OR</span>
            </div>
          </div>

          {/* Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden border-b"
              >
                <div className="p-4 space-y-4 bg-muted/30">
                  {/* Types */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Typen</Label>
                    <div className="flex flex-wrap gap-2">
                      {typeOptions.map(type => (
                        <button
                          key={type.id}
                          onClick={() => handleTypeToggle(type.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors',
                            filters.types?.includes(type.id)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          )}
                        >
                          <type.icon className="w-3 h-3" />
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-2 block">Von</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Calendar className="w-4 h-4 mr-2" />
                            {dateFrom ? format(dateFrom, 'dd.MM.yyyy', { locale: de }) : 'Startdatum'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={dateFrom}
                            onSelect={setDateFrom}
                            locale={de}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-2 block">Bis</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Calendar className="w-4 h-4 mr-2" />
                            {dateTo ? format(dateTo, 'dd.MM.yyyy', { locale: de }) : 'Enddatum'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={dateTo}
                            onSelect={setDateTo}
                            locale={de}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Size Filter */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      <HardDrive className="w-3 h-3 inline mr-1" />
                      Dateigröße
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {sizePresets.map((preset, idx) => (
                        <button
                          key={preset.label}
                          onClick={() => setSizePreset(idx)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs transition-colors',
                            sizePreset === idx
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80'
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Tags</Label>
                      <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                        {tags.map(tag => (
                          <button
                            key={tag.id}
                            onClick={() => handleTagToggle(tag.name)}
                            className={cn(
                              'px-2 py-1 rounded-full text-xs transition-colors',
                              filters.tags?.includes(tag.name)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            )}
                            style={{
                              backgroundColor: filters.tags?.includes(tag.name) 
                                ? tag.color 
                                : undefined,
                            }}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Options */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="favorites"
                          checked={filters.isFavorite === true}
                          onCheckedChange={(checked) => 
                            setFilters(prev => ({ 
                              ...prev, 
                              isFavorite: checked ? true : undefined 
                            }))
                          }
                        />
                        <Label htmlFor="favorites" className="text-sm flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          Nur Favoriten
                        </Label>
                      </div>

                      <RadioGroup
                        value={filters.operator || 'AND'}
                        onValueChange={(v) => setFilters(prev => ({ ...prev, operator: v as 'AND' | 'OR' }))}
                        className="flex items-center gap-2"
                      >
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="AND" id="and" />
                          <Label htmlFor="and" className="text-xs">AND</Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="OR" id="or" />
                          <Label htmlFor="or" className="text-xs">OR</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                        Filter zurücksetzen
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                Suche...
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {query ? 'Keine Ergebnisse gefunden' : 'Gib einen Suchbegriff ein'}
              </div>
            ) : (
              <div className="divide-y">
                {results.map(result => {
                  const TypeIcon = typeOptions.find(t => t.id === result.type)?.icon || FileText;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => onResultClick(result)}
                      className="w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <TypeIcon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{result.title}</span>
                          {result.isFavorite && (
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                          )}
                        </div>
                        {result.subtitle && (
                          <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {typeOptions.find(t => t.id === result.type)?.label}
                          </Badge>
                          {result.size && (
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(result.size)}
                            </span>
                          )}
                          {result.date && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(result.date), 'dd.MM.yy')}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground text-center">
            {results.length} Ergebnis{results.length !== 1 ? 'se' : ''} 
            {hasActiveFilters && ' (gefiltert)'}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
