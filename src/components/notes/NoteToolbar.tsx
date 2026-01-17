import React, { memo, useMemo, useCallback } from 'react';
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
  prefix: string;
  suffix: string;
  placeholder: string;
}

interface NoteToolbarProps {
  showPreview: boolean;
  onTogglePreview: () => void;
  onInsertMarkdown: (prefix: string, suffix?: string, placeholder?: string) => void;
  children?: React.ReactNode;
}

const FORMAT_ACTIONS: FormatAction[] = [
  { icon: Bold, label: 'Fett', prefix: '**', suffix: '**', placeholder: 'fett' },
  { icon: Italic, label: 'Kursiv', prefix: '*', suffix: '*', placeholder: 'kursiv' },
  { icon: Heading1, label: 'Überschrift 1', prefix: '\n# ', suffix: '\n', placeholder: 'Überschrift' },
  { icon: Heading2, label: 'Überschrift 2', prefix: '\n## ', suffix: '\n', placeholder: 'Überschrift' },
  { icon: Heading3, label: 'Überschrift 3', prefix: '\n### ', suffix: '\n', placeholder: 'Überschrift' },
  { icon: List, label: 'Liste', prefix: '\n- ', suffix: '\n', placeholder: 'Listenpunkt' },
  { icon: ListOrdered, label: 'Nummerierte Liste', prefix: '\n1. ', suffix: '\n', placeholder: 'Listenpunkt' },
  { icon: CheckSquare, label: 'Checkbox', prefix: '\n- [ ] ', suffix: '\n', placeholder: 'Aufgabe' },
  { icon: Quote, label: 'Zitat', prefix: '\n> ', suffix: '\n', placeholder: 'Zitat' },
  { icon: Code, label: 'Code', prefix: '`', suffix: '`', placeholder: 'code' },
  { icon: Link, label: 'Link', prefix: '[', suffix: '](url)', placeholder: 'Linktext' },
];

export const NoteToolbar = memo(function NoteToolbar({
  showPreview,
  onTogglePreview,
  onInsertMarkdown,
  children,
}: NoteToolbarProps) {
  const handleAction = useCallback((action: FormatAction) => {
    onInsertMarkdown(action.prefix, action.suffix, action.placeholder);
  }, [onInsertMarkdown]);

  return (
    <div className="flex items-center gap-1 px-6 py-3 border-b border-border bg-muted/30 flex-wrap">
      {FORMAT_ACTIONS.map((action, index) => (
        <button
          key={index}
          onClick={() => handleAction(action)}
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
