import React, { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  children: ChecklistItem[];
  collapsed?: boolean;
}

interface NestedChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  level?: number;
  className?: string;
}

// Calculate progress percentage
export function calculateProgress(items: ChecklistItem[]): number {
  let total = 0;
  let checked = 0;

  const countItems = (list: ChecklistItem[]) => {
    list.forEach(item => {
      total++;
      if (item.checked) checked++;
      if (item.children.length > 0) {
        countItems(item.children);
      }
    });
  };

  countItems(items);
  return total === 0 ? 0 : Math.round((checked / total) * 100);
}

// Parse markdown checkboxes into nested structure
export function parseChecklistFromMarkdown(content: string): ChecklistItem[] {
  const lines = content.split('\n');
  const items: ChecklistItem[] = [];
  const stack: { level: number; items: ChecklistItem[] }[] = [{ level: -1, items }];

  lines.forEach((line, index) => {
    const match = line.match(/^(\s*)- \[([ xX])\] (.+)$/);
    if (!match) return;

    const indent = match[1].length;
    const checked = match[2].toLowerCase() === 'x';
    const text = match[3];

    const item: ChecklistItem = {
      id: `item-${index}-${Date.now()}`,
      text,
      checked,
      children: [],
      collapsed: false
    };

    // Find the correct parent level
    while (stack.length > 1 && stack[stack.length - 1].level >= indent) {
      stack.pop();
    }

    stack[stack.length - 1].items.push(item);
    stack.push({ level: indent, items: item.children });
  });

  return items;
}

// Convert nested structure back to markdown
export function checklistToMarkdown(items: ChecklistItem[], indent: number = 0): string {
  let result = '';
  const spaces = '  '.repeat(indent);

  items.forEach(item => {
    const checkbox = item.checked ? '[x]' : '[ ]';
    result += `${spaces}- ${checkbox} ${item.text}\n`;
    if (item.children.length > 0) {
      result += checklistToMarkdown(item.children, indent + 1);
    }
  });

  return result;
}

const ChecklistItemComponent = memo(function ChecklistItemComponent({
  item,
  onToggle,
  onTextChange,
  onDelete,
  onAddChild,
  onToggleCollapse,
  onReorder,
  siblings,
  level
}: {
  item: ChecklistItem;
  onToggle: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onReorder: (newOrder: ChecklistItem[]) => void;
  siblings: ChecklistItem[];
  level: number;
}) {
  const hasChildren = item.children.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="group"
    >
      <div className={cn(
        "flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors",
        item.checked && "opacity-60"
      )}>
        <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {hasChildren && (
          <button
            onClick={() => onToggleCollapse(item.id)}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground"
          >
            {item.collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
        
        {!hasChildren && <div className="w-5" />}

        <button
          onClick={() => onToggle(item.id)}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
            item.checked 
              ? "bg-primary border-primary text-primary-foreground" 
              : "border-muted-foreground/40 hover:border-primary"
          )}
        >
          {item.checked && <Check className="w-3 h-3" />}
        </button>

        <input
          type="text"
          value={item.text}
          onChange={(e) => onTextChange(item.id, e.target.value)}
          className={cn(
            "flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground",
            item.checked && "line-through text-muted-foreground"
          )}
          placeholder="Aufgabe..."
        />

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAddChild(item.id)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Unteraufgabe hinzufügen"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
            title="Löschen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && !item.collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-6 border-l-2 border-border/50 pl-2"
          >
            <NestedChecklist
              items={item.children}
              onChange={(newChildren) => {
                // This will bubble up through parent
              }}
              level={level + 1}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export const NestedChecklist = memo(function NestedChecklist({
  items,
  onChange,
  level = 0,
  className
}: NestedChecklistProps) {
  const progress = calculateProgress(items);

  const handleToggle = useCallback((id: string) => {
    const toggleItem = (list: ChecklistItem[]): ChecklistItem[] => {
      return list.map(item => {
        if (item.id === id) {
          return { ...item, checked: !item.checked };
        }
        if (item.children.length > 0) {
          return { ...item, children: toggleItem(item.children) };
        }
        return item;
      });
    };
    onChange(toggleItem(items));
  }, [items, onChange]);

  const handleTextChange = useCallback((id: string, text: string) => {
    const updateText = (list: ChecklistItem[]): ChecklistItem[] => {
      return list.map(item => {
        if (item.id === id) {
          return { ...item, text };
        }
        if (item.children.length > 0) {
          return { ...item, children: updateText(item.children) };
        }
        return item;
      });
    };
    onChange(updateText(items));
  }, [items, onChange]);

  const handleDelete = useCallback((id: string) => {
    const deleteItem = (list: ChecklistItem[]): ChecklistItem[] => {
      return list.filter(item => {
        if (item.id === id) return false;
        if (item.children.length > 0) {
          item.children = deleteItem(item.children);
        }
        return true;
      });
    };
    onChange(deleteItem(items));
  }, [items, onChange]);

  const handleAddChild = useCallback((parentId: string) => {
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: '',
      checked: false,
      children: [],
      collapsed: false
    };

    const addChild = (list: ChecklistItem[]): ChecklistItem[] => {
      return list.map(item => {
        if (item.id === parentId) {
          return { ...item, children: [...item.children, newItem], collapsed: false };
        }
        if (item.children.length > 0) {
          return { ...item, children: addChild(item.children) };
        }
        return item;
      });
    };
    onChange(addChild(items));
  }, [items, onChange]);

  const handleToggleCollapse = useCallback((id: string) => {
    const toggleCollapse = (list: ChecklistItem[]): ChecklistItem[] => {
      return list.map(item => {
        if (item.id === id) {
          return { ...item, collapsed: !item.collapsed };
        }
        if (item.children.length > 0) {
          return { ...item, children: toggleCollapse(item.children) };
        }
        return item;
      });
    };
    onChange(toggleCollapse(items));
  }, [items, onChange]);

  const handleAddItem = useCallback(() => {
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: '',
      checked: false,
      children: [],
      collapsed: false
    };
    onChange([...items, newItem]);
  }, [items, onChange]);

  return (
    <div className={cn("space-y-1", className)}>
      {/* Progress Bar (only at root level) */}
      {level === 0 && items.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Fortschritt</span>
            <span className="text-foreground font-medium">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      <AnimatePresence>
        {items.map((item) => (
          <ChecklistItemComponent
            key={item.id}
            item={item}
            onToggle={handleToggle}
            onTextChange={handleTextChange}
            onDelete={handleDelete}
            onAddChild={handleAddChild}
            onToggleCollapse={handleToggleCollapse}
            onReorder={onChange}
            siblings={items}
            level={level}
          />
        ))}
      </AnimatePresence>

      {/* Add Button */}
      <button
        onClick={handleAddItem}
        className="flex items-center gap-2 py-2 px-3 w-full rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm"
      >
        <Plus className="w-4 h-4" />
        {level === 0 ? 'Aufgabe hinzufügen' : 'Unteraufgabe hinzufügen'}
      </button>
    </div>
  );
});

export default NestedChecklist;
