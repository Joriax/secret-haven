import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  Package,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileJson,
  File,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type ImportSource = 'evernote' | 'notion' | 'apple-notes' | 'google-keep' | 'markdown' | 'json';

interface ImportItem {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  type: 'note' | 'file' | 'link';
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

const importSources: { id: ImportSource; label: string; icon: React.ReactNode; accepts: string; description: string }[] = [
  { 
    id: 'evernote', 
    label: 'Evernote', 
    icon: <Package className="w-5 h-5" />, 
    accepts: '.enex',
    description: 'Evernote Export (.enex)'
  },
  { 
    id: 'notion', 
    label: 'Notion', 
    icon: <FileText className="w-5 h-5" />, 
    accepts: '.html,.md,.zip',
    description: 'Notion HTML/Markdown Export'
  },
  { 
    id: 'apple-notes', 
    label: 'Apple Notes', 
    icon: <FileText className="w-5 h-5" />, 
    accepts: '.html',
    description: 'Apple Notes HTML Export'
  },
  { 
    id: 'google-keep', 
    label: 'Google Keep', 
    icon: <FileJson className="w-5 h-5" />, 
    accepts: '.json,.zip',
    description: 'Google Takeout JSON Export'
  },
  { 
    id: 'markdown', 
    label: 'Markdown', 
    icon: <FileText className="w-5 h-5" />, 
    accepts: '.md,.markdown,.txt',
    description: 'Markdown Dateien'
  },
  { 
    id: 'json', 
    label: 'JSON', 
    icon: <FileJson className="w-5 h-5" />, 
    accepts: '.json',
    description: 'Standard JSON Format'
  },
];

// Evernote ENEX Parser
function parseEvernote(content: string): ImportItem[] {
  const items: ImportItem[] = [];
  
  // Simple XML parsing for ENEX format
  const noteMatches = content.matchAll(/<note>([\s\S]*?)<\/note>/g);
  
  for (const match of noteMatches) {
    const noteXml = match[1];
    
    const titleMatch = noteXml.match(/<title>([\s\S]*?)<\/title>/);
    const contentMatch = noteXml.match(/<content>([\s\S]*?)<\/content>/);
    const createdMatch = noteXml.match(/<created>(\d{8}T\d{6}Z)<\/created>/);
    const tagMatches = noteXml.matchAll(/<tag>([\s\S]*?)<\/tag>/g);
    
    const tags: string[] = [];
    for (const tagMatch of tagMatches) {
      tags.push(tagMatch[1]);
    }
    
    // Extract text from CDATA/HTML content
    let noteContent = contentMatch?.[1] || '';
    noteContent = noteContent
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    if (titleMatch?.[1]) {
      items.push({
        id: crypto.randomUUID(),
        title: titleMatch[1],
        content: noteContent,
        created_at: createdMatch?.[1] ? parseEvernoteDate(createdMatch[1]) : undefined,
        tags,
        type: 'note',
      });
    }
  }
  
  return items;
}

function parseEvernoteDate(dateStr: string): string {
  // Format: 20231215T143022Z
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const hour = dateStr.slice(9, 11);
  const minute = dateStr.slice(11, 13);
  const second = dateStr.slice(13, 15);
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

// Notion HTML Parser
function parseNotion(content: string, filename: string): ImportItem[] {
  const items: ImportItem[] = [];
  
  // Extract title from filename
  const title = filename.replace(/\.(html|md)$/, '').replace(/[_-]/g, ' ');
  
  // For HTML: extract body content
  let noteContent = content;
  if (filename.endsWith('.html')) {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    noteContent = bodyMatch?.[1] || content;
    noteContent = noteContent
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
  
  items.push({
    id: crypto.randomUUID(),
    title,
    content: noteContent,
    type: 'note',
  });
  
  return items;
}

// Google Keep JSON Parser
function parseGoogleKeep(content: string): ImportItem[] {
  try {
    const data = JSON.parse(content);
    const items: ImportItem[] = [];
    
    // Handle array of notes
    const notes = Array.isArray(data) ? data : [data];
    
    for (const note of notes) {
      if (note.title || note.textContent) {
        items.push({
          id: crypto.randomUUID(),
          title: note.title || 'Unbenannte Notiz',
          content: note.textContent || '',
          created_at: note.createdTimestampUsec ? new Date(note.createdTimestampUsec / 1000).toISOString() : undefined,
          tags: note.labels?.map((l: any) => l.name) || [],
          type: 'note',
        });
      }
    }
    
    return items;
  } catch {
    return [];
  }
}

// Markdown Parser
function parseMarkdown(content: string, filename: string): ImportItem[] {
  // Extract title from first heading or filename
  const headingMatch = content.match(/^#\s+(.+)$/m);
  const title = headingMatch?.[1] || filename.replace(/\.(md|markdown|txt)$/, '');
  
  return [{
    id: crypto.randomUUID(),
    title,
    content,
    type: 'note',
  }];
}

// JSON Import Parser
function parseJsonImport(content: string): ImportItem[] {
  try {
    const data = JSON.parse(content);
    
    // Handle various JSON structures
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: crypto.randomUUID(),
        title: item.title || item.name || 'Unbenannte Notiz',
        content: item.content || item.text || item.body || JSON.stringify(item),
        created_at: item.created_at || item.createdAt || item.created,
        tags: item.tags || [],
        type: 'note' as const,
      }));
    }
    
    if (data.notes) {
      return parseJsonImport(JSON.stringify(data.notes));
    }
    
    return [{
      id: crypto.randomUUID(),
      title: data.title || 'Import',
      content: data.content || JSON.stringify(data, null, 2),
      type: 'note',
    }];
  } catch {
    return [];
  }
}

interface ImportManagerProps {
  open: boolean;
  onClose: () => void;
  onImport: (items: ImportItem[]) => Promise<ImportResult>;
}

export function ImportManager({ open, onClose, onImport }: ImportManagerProps) {
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [parsedItems, setParsedItems] = useState<ImportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    
    setFiles(selectedFiles);
    setIsParsing(true);
    setParsedItems([]);
    
    const allItems: ImportItem[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const content = await file.text();
      
      let items: ImportItem[] = [];
      
      switch (selectedSource) {
        case 'evernote':
          items = parseEvernote(content);
          break;
        case 'notion':
        case 'apple-notes':
          items = parseNotion(content, file.name);
          break;
        case 'google-keep':
          items = parseGoogleKeep(content);
          break;
        case 'markdown':
          items = parseMarkdown(content, file.name);
          break;
        case 'json':
          items = parseJsonImport(content);
          break;
      }
      
      allItems.push(...items);
      setProgress(((i + 1) / selectedFiles.length) * 100);
    }
    
    setParsedItems(allItems);
    setIsParsing(false);
    setProgress(0);
  };

  const handleImport = async () => {
    if (parsedItems.length === 0) return;
    
    setIsLoading(true);
    setProgress(0);
    
    try {
      const importResult = await onImport(parsedItems);
      setResult(importResult);
      
      if (importResult.imported > 0) {
        toast.success(`${importResult.imported} Elemente importiert`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Fehler beim Import');
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setSelectedSource(null);
    setFiles([]);
    setParsedItems([]);
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Daten importieren
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Import abgeschlossen</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{result.imported} von {result.total} erfolgreich importiert</p>
              {result.skipped > 0 && <p>{result.skipped} übersprungen</p>}
              {result.errors.length > 0 && (
                <p className="text-destructive">{result.errors.length} Fehler</p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-6">
              Schließen
            </Button>
          </motion.div>
        ) : !selectedSource ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wähle eine Import-Quelle:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {importSources.map((source) => (
                <motion.button
                  key={source.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedSource(source.id)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {source.icon}
                  </div>
                  <div>
                    <p className="font-medium">{source.label}</p>
                    <p className="text-xs text-muted-foreground">{source.description}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={resetState}>
                ← Zurück
              </Button>
              <Badge variant="secondary">
                {importSources.find(s => s.id === selectedSource)?.label}
              </Badge>
            </div>

            {files.length === 0 ? (
              <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Dateien auswählen</p>
                <p className="text-xs text-muted-foreground">
                  {importSources.find(s => s.id === selectedSource)?.accepts}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={importSources.find(s => s.id === selectedSource)?.accepts}
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            ) : isParsing ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Dateien werden analysiert...</p>
                <Progress value={progress} className="h-1 mt-4" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {files.length} Datei(en) • {parsedItems.length} Elemente gefunden
                  </span>
                  <Button variant="ghost" size="sm" onClick={resetState}>
                    Andere Dateien
                  </Button>
                </div>

                <ScrollArea className="h-[250px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {parsedItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.content.slice(0, 100)}...
                          </p>
                        </div>
                        {item.tags && item.tags.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {item.tags.length} Tags
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {isLoading && (
                  <Progress value={progress} className="h-1" />
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handleImport} 
                    disabled={parsedItems.length === 0 || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {parsedItems.length} importieren
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImportManager;
