import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackLink {
  noteId: string;
  noteTitle: string;
}

interface BacklinksPanelProps {
  backlinks: BackLink[];
  onNavigate: (noteId: string) => void;
  className?: string;
}

export const BacklinksPanel = memo(function BacklinksPanel({
  backlinks,
  onNavigate,
  className
}: BacklinksPanelProps) {
  if (backlinks.length === 0) return null;

  return (
    <div className={cn("border-t border-border pt-4 mt-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">
          Verlinkt von ({backlinks.length})
        </h4>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {backlinks.map((backlink, index) => (
          <motion.button
            key={backlink.noteId}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onNavigate(backlink.noteId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground transition-colors group"
          >
            <ArrowLeft className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="truncate max-w-[150px]">{backlink.noteTitle}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
});

export default BacklinksPanel;
