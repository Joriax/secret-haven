import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Plus, X, Check } from 'lucide-react';
import { useTags, Tag as TagType } from '@/hooks/useTags';
import { cn } from '@/lib/utils';
import { ColorPicker } from '@/components/ColorPicker';

interface TagManagerProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  compact?: boolean;
}

export const TagManager: React.FC<TagManagerProps> = ({ 
  selectedTags, 
  onTagsChange,
  compact = false 
}) => {
  const { tags, createTag } = useTags();
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    const newTag = await createTag(newTagName.trim(), newTagColor);
    if (newTag) {
      onTagsChange([...selectedTags, newTag.id]);
      setNewTagName('');
      setNewTagColor('#6366f1');
      setShowCreate(false);
    }
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Tag className="w-4 h-4" />
        <span>Tags</span>
      </div>

      {/* Tag List */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag.id);
          return (
            <motion.button
              key={tag.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all border",
                isSelected 
                  ? "bg-primary/20 text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              style={{ 
                borderColor: isSelected ? tag.color : 'transparent',
                boxShadow: isSelected ? `0 0 10px ${tag.color}40` : 'none'
              }}
            >
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
              {isSelected && <Check className="w-3 h-3" />}
            </motion.button>
          );
        })}

        {/* Add Tag Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-all text-sm"
        >
          <Plus className="w-3 h-3" />
          Neuer Tag
        </motion.button>
      </div>

      {/* Create Tag Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-muted/50 rounded-xl space-y-4 border border-border">
              <div className="flex items-center gap-3">
                <ColorPicker 
                  color={newTagColor} 
                  onChange={setNewTagColor}
                  size="md"
                />
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag Name"
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground text-sm focus:border-primary outline-none"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Erstellen
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setNewTagName('');
                    setNewTagColor('#6366f1');
                  }}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Compact tag display component
export const TagDisplay: React.FC<{ tagIds: string[] }> = ({ tagIds }) => {
  const { tags } = useTags();
  const displayTags = tags.filter(t => tagIds.includes(t.id));

  if (displayTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {displayTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
          {tag.name}
        </span>
      ))}
    </div>
  );
};