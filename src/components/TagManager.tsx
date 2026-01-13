import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Plus, X, Check, Palette } from 'lucide-react';
import { useTags, Tag as TagType } from '@/hooks/useTags';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  // Primary colors
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  // Extended palette
  '#f43f5e', '#fb923c', '#facc15', '#4ade80',
  '#2dd4bf', '#60a5fa', '#a855f7', '#f472b6',
  // Neutral tones
  '#64748b', '#78716c', '#71717a', '#737373',
];

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
  const { tags, createTag, deleteTag } = useTags();
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[4]);

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
      setShowCreate(false);
    }
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex items-center gap-2 text-white/60 text-sm">
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
                  ? "bg-white/20 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-all text-sm"
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
            <div className="p-3 bg-white/5 rounded-xl space-y-3">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag Name"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-white/40 text-sm focus:border-purple-500/50 outline-none"
                autoFocus
              />

              {/* Color Picker */}
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-white/50" />
                <div className="flex gap-1 flex-wrap">
                  {PRESET_COLORS.slice(0, 16).map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={cn(
                        "w-6 h-6 rounded-full transition-transform",
                        newTagColor === color && "scale-110 ring-2 ring-white/50"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="flex-1 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Erstellen
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setNewTagName('');
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 text-sm transition-colors"
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
