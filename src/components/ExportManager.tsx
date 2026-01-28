import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  FileText, 
  FileJson,
  File,
  FileCode,
  Loader2,
  CheckCircle2,
  FolderArchive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import * as fflate from 'fflate';

type ExportFormat = 'markdown' | 'html' | 'json' | 'txt';

interface ExportItem {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  folder?: string;
}

interface ExportManagerProps {
  open: boolean;
  onClose: () => void;
  items: ExportItem[];
  itemType: 'notes' | 'files' | 'links';
}

const formatOptions: { id: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    id: 'markdown', 
    label: 'Markdown', 
    icon: <FileCode className="w-4 h-4" />, 
    description: '.md Dateien mit Ordnerstruktur'
  },
  { 
    id: 'html', 
    label: 'HTML', 
    icon: <FileText className="w-4 h-4" />, 
    description: 'HTML-Dateien mit Styling'
  },
  { 
    id: 'json', 
    label: 'JSON', 
    icon: <FileJson className="w-4 h-4" />, 
    description: 'Strukturierte JSON-Daten'
  },
  { 
    id: 'txt', 
    label: 'Text', 
    icon: <File className="w-4 h-4" />, 
    description: 'Einfache Textdateien'
  },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateHtml(item: ExportItem): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(item.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    h1 { margin-bottom: 0.5rem; }
    .meta { color: #666; font-size: 0.875rem; margin-bottom: 2rem; }
    .tags { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
    .tag {
      background: #e5e7eb;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
    }
    .content { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${escapeHtml(item.title)}</h1>
  <div class="meta">
    ${item.created_at ? `<div>Erstellt: ${new Date(item.created_at).toLocaleString('de-DE')}</div>` : ''}
    ${item.updated_at ? `<div>Geändert: ${new Date(item.updated_at).toLocaleString('de-DE')}</div>` : ''}
    ${item.tags && item.tags.length > 0 ? `
    <div class="tags">
      ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
    </div>
    ` : ''}
  </div>
  <div class="content">${escapeHtml(item.content)}</div>
</body>
</html>`;
}

function generateMarkdown(item: ExportItem): string {
  let md = `# ${item.title}\n\n`;
  
  if (item.created_at || item.tags?.length) {
    md += '---\n';
    if (item.created_at) {
      md += `created: ${item.created_at}\n`;
    }
    if (item.updated_at) {
      md += `updated: ${item.updated_at}\n`;
    }
    if (item.tags?.length) {
      md += `tags: [${item.tags.join(', ')}]\n`;
    }
    md += '---\n\n';
  }
  
  md += item.content;
  
  return md;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

export function ExportManager({ open, onClose, items, itemType }: ExportManagerProps) {
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [createZip, setCreateZip] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);

    try {
      const files: { [key: string]: Uint8Array } = {};
      const encoder = new TextEncoder();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const filename = sanitizeFilename(item.title);
        let content: string;
        let extension: string;

        switch (format) {
          case 'markdown':
            content = generateMarkdown(item);
            extension = 'md';
            break;
          case 'html':
            content = generateHtml(item);
            extension = 'html';
            break;
          case 'json':
            content = JSON.stringify(includeMetadata ? item : { title: item.title, content: item.content }, null, 2);
            extension = 'json';
            break;
          case 'txt':
          default:
            content = `${item.title}\n${'='.repeat(item.title.length)}\n\n${item.content}`;
            extension = 'txt';
            break;
        }

        const path = item.folder 
          ? `${sanitizeFilename(item.folder)}/${filename}.${extension}`
          : `${filename}.${extension}`;
        
        files[path] = encoder.encode(content);
        
        setProgress(((i + 1) / items.length) * 90);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      if (createZip || items.length > 1) {
        // Create ZIP
        const zipped = fflate.zipSync(files, { level: 6 });
        const blob = new Blob([zipped.slice().buffer], { type: 'application/zip' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${itemType}_export_${new Date().toISOString().split('T')[0]}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (items.length === 1) {
        // Single file download
        const [path, data] = Object.entries(files)[0];
        const blob = new Blob([data.slice().buffer], { type: 'text/plain' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = path;
        a.click();
        URL.revokeObjectURL(url);
      }

      setProgress(100);
      setComplete(true);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const resetState = () => {
    setProgress(0);
    setComplete(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            {items.length} {itemType === 'notes' ? 'Notizen' : itemType === 'links' ? 'Links' : 'Dateien'} exportieren
          </DialogTitle>
        </DialogHeader>

        {complete ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Export abgeschlossen</h3>
            <p className="text-sm text-muted-foreground">
              {items.length} Elemente wurden exportiert
            </p>
            <Button onClick={handleClose} className="mt-6">
              Schließen
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Format</Label>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <div className="grid grid-cols-2 gap-2">
                  {formatOptions.map((option) => (
                    <label
                      key={option.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        format === option.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <RadioGroupItem value={option.id} id={option.id} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {option.icon}
                          <span className="font-medium text-sm">{option.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Optionen</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="metadata"
                    checked={includeMetadata}
                    onCheckedChange={(checked) => setIncludeMetadata(checked as boolean)}
                  />
                  <label htmlFor="metadata" className="text-sm cursor-pointer">
                    Metadaten einschließen (Datum, Tags)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="zip"
                    checked={createZip}
                    onCheckedChange={(checked) => setCreateZip(checked as boolean)}
                    disabled={items.length > 1}
                  />
                  <label htmlFor="zip" className="text-sm cursor-pointer">
                    Als ZIP-Archiv
                    {items.length > 1 && (
                      <span className="text-muted-foreground ml-1">(erforderlich bei mehreren Dateien)</span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FolderArchive className="w-4 h-4" />
                <span>
                  {items.length} × .{format === 'markdown' ? 'md' : format}
                  {(createZip || items.length > 1) && ' → .zip'}
                </span>
              </div>
            </div>

            {isExporting && (
              <Progress value={progress} className="h-1" />
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Exportieren
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ExportManager;
