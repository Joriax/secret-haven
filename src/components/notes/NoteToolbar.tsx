import React, { memo, useMemo } from 'react';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Link, 
  Heading1, 
  Heading2, 
  Heading3, 
  Eye, 
  EyeOff, 
  CheckSquare 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormatAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: () => void;
}

interface NoteToolbarProps {
  showPreview: boolean;
  onTogglePreview: () => void;
  onInsertMarkdown: (prefix: string, suffix?: string, placeholder?: string) => void;
  children?: React.ReactNode;
}

export const NoteToolbar = memo(function NoteToolbar({
  showPreview,
  onTogglePreview,
  onInsertMarkdown,
  children,
}: NoteToolbarProps) {
  const formatActions: FormatAction[] = useMemo(() => [
    { icon: Bold, label: 'Fett', action: () => onInsertMarkdown('**', '**', 'fett') },
    { icon: Italic, label: 'Kursiv', action: () => onInsertMarkdown('*', '*', 'kursiv') },
    { icon: Heading1, label: 'Überschrift 1', action: () => onInsertMarkdown('\n# ', '\n', 'Überschrift') },
    { icon: Heading2, label: 'Überschrift 2', action: () => onInsertMarkdown('\n## ', '\n', 'Überschrift') },
    { icon: Heading3, label: 'Überschrift 3', action: () => onInsertMarkdown('\n### ', '\n', 'Überschrift') },
    { icon: List, label: 'Liste', action: () => onInsertMarkdown('\n- ', '\n', 'Listenpunkt') },
    { icon: ListOrdered, label: 'Nummerierte Liste', action: () => onInsertMarkdown('\n1. ', '\n', 'Listenpunkt') },
    { icon: CheckSquare, label: 'Checkbox', action: () => onInsertMarkdown('\n- [ ] ', '\n', 'Aufgabe') },
    { icon: Quote, label: 'Zitat', action: () => onInsertMarkdown('\n> ', '\n', 'Zitat') },
    { icon: Code, label: 'Code', action: () => onInsertMarkdown('`', '`', 'code') },
    { icon: Link, label: 'Link', action: () => onInsertMarkdown('[', '](url)', 'Linktext') },
  ], [onInsertMarkdown]);

  return (
    <div className="flex items-center gap-1 px-6 py-3 border-b border-border bg-muted/30 flex-wrap">
      {formatActions.map((action, index) => (
        <button
          key={index}
          onClick={action.action}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={action.label}
        >
          <action.icon className="w-4 h-4" />
        </button>
      ))}
      
      {/* Additional buttons slot (e.g., OCR Scanner) */}
      {children}
      
      <div className="flex-1" />
      <button
        onClick={onTogglePreview}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm",
          showPreview ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground"
        )}
      >
        {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        <span className="hidden sm:inline">{showPreview ? 'Editor' : 'Vorschau'}</span>
      </button>
    </div>
  );
});

export default NoteToolbar;
