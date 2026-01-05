import React from 'react';
import { motion } from 'framer-motion';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardWidget } from '@/hooks/useDashboardWidgets';

interface DraggableWidgetProps {
  widget: DashboardWidget;
  index: number;
  isEditing: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  onToggleVisibility: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  widget,
  index,
  isEditing,
  onDragStart,
  onDragOver,
  onDragEnd,
  onToggleVisibility,
  children,
  className,
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: widget.visible ? 1 : 0.5, 
        scale: 1,
      }}
      transition={{ duration: 0.2 }}
      draggable={isEditing}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "relative",
        isEditing && "cursor-grab active:cursor-grabbing",
        !widget.visible && "opacity-50",
        className
      )}
    >
      {isEditing && (
        <div className="absolute -top-2 -right-2 z-10 flex gap-1">
          <button
            onClick={() => onToggleVisibility(widget.id)}
            className="p-1.5 rounded-full bg-card border border-border shadow-lg hover:bg-muted transition-colors"
          >
            {widget.visible ? (
              <Eye className="w-3 h-3 text-primary" />
            ) : (
              <EyeOff className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        </div>
      )}
      
      {isEditing && (
        <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-3 z-10">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      
      <div className={cn(
        isEditing && "ring-2 ring-primary/30 ring-dashed rounded-2xl"
      )}>
        {children}
      </div>
    </motion.div>
  );
};
