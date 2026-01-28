import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Printer, FileText, Download } from 'lucide-react';

interface NotePrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  note: {
    title: string;
    content: string | null;
    created_at: string;
    updated_at: string;
    tags?: string[];
  };
}

export const NotePrintDialog: React.FC<NotePrintDialogProps> = ({
  isOpen,
  onClose,
  note,
}) => {
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  const [paperSize, setPaperSize] = useState<'a4' | 'letter'>('a4');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const generatePrintHTML = () => {
    const formattedDate = new Date(note.updated_at).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const createdDate = new Date(note.created_at).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    // Convert markdown-like content to HTML
    const processContent = (content: string) => {
      return content
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Strikethrough
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        // Inline code
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Checkboxes
        .replace(/^\s*-\s*\[x\]\s*(.+)$/gm, '<div class="checkbox checked">✓ $1</div>')
        .replace(/^\s*-\s*\[\s*\]\s*(.+)$/gm, '<div class="checkbox">☐ $1</div>')
        // Bullet lists
        .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
        // Numbered lists
        .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Blockquotes
        .replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    };

    const bgColor = theme === 'dark' ? '#1a1a2e' : '#ffffff';
    const textColor = theme === 'dark' ? '#e0e0e0' : '#1a1a1a';
    const mutedColor = theme === 'dark' ? '#888888' : '#666666';
    const borderColor = theme === 'dark' ? '#333355' : '#e5e5e5';
    const accentColor = '#6366f1';

    return `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>${note.title}</title>
        <style>
          @page {
            size: ${paperSize === 'a4' ? 'A4' : 'letter'};
            margin: 2cm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.7;
            color: ${textColor};
            background: ${bgColor};
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            border-bottom: 3px solid ${accentColor};
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            font-size: 28px;
            color: ${accentColor};
            margin-bottom: 12px;
            font-weight: 600;
          }
          .metadata {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 12px;
            color: ${mutedColor};
          }
          .metadata-item {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
          }
          .tag {
            background: ${theme === 'dark' ? '#2a2a4e' : '#f0f0ff'};
            color: ${accentColor};
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
          }
          .content {
            font-size: 14px;
          }
          .content h1 { font-size: 24px; margin: 24px 0 12px; color: ${textColor}; }
          .content h2 { font-size: 20px; margin: 20px 0 10px; color: ${textColor}; }
          .content h3 { font-size: 16px; margin: 16px 0 8px; color: ${textColor}; }
          .content p { margin-bottom: 12px; }
          .content ul, .content ol { margin: 12px 0; padding-left: 24px; }
          .content li { margin: 4px 0; }
          .content blockquote {
            border-left: 4px solid ${accentColor};
            padding-left: 16px;
            margin: 16px 0;
            color: ${mutedColor};
            font-style: italic;
          }
          .content code {
            background: ${theme === 'dark' ? '#2a2a4e' : '#f5f5f5'};
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 13px;
          }
          .content hr {
            border: none;
            border-top: 1px solid ${borderColor};
            margin: 24px 0;
          }
          .content a {
            color: ${accentColor};
            text-decoration: underline;
          }
          .checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 0;
          }
          .checkbox.checked {
            color: ${mutedColor};
            text-decoration: line-through;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid ${borderColor};
            font-size: 10px;
            color: ${mutedColor};
            text-align: center;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${note.title || 'Unbenannte Notiz'}</h1>
          ${includeMetadata ? `
            <div class="metadata">
              <span class="metadata-item">Erstellt: ${createdDate}</span>
              <span class="metadata-item">Aktualisiert: ${formattedDate}</span>
            </div>
          ` : ''}
          ${includeTags && note.tags && note.tags.length > 0 ? `
            <div class="tags">
              ${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        
        <div class="content">
          <p>${processContent(note.content || '')}</p>
        </div>
        
        <div class="footer">
          PhantomLock Vault — Exportiert am ${new Date().toLocaleDateString('de-DE')}
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const html = generatePrintHTML();
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      // Fallback: Download as HTML
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title || 'notiz'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    
    onClose();
  };

  const handleDownloadHTML = () => {
    const html = generatePrintHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'notiz'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            Notiz drucken / exportieren
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Paper Size */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Papiergröße</Label>
            <RadioGroup value={paperSize} onValueChange={(v) => setPaperSize(v as 'a4' | 'letter')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="a4" id="a4" />
                <Label htmlFor="a4" className="font-normal">A4 (210 × 297 mm)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="letter" id="letter" />
                <Label htmlFor="letter" className="font-normal">Letter (8.5 × 11 in)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Theme */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Stil</Label>
            <RadioGroup value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light" className="font-normal">Hell (für Druck)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark" className="font-normal">Dunkel</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="metadata" className="font-normal">Metadaten anzeigen</Label>
              <Switch
                id="metadata"
                checked={includeMetadata}
                onCheckedChange={setIncludeMetadata}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="tags" className="font-normal">Tags anzeigen</Label>
              <Switch
                id="tags"
                checked={includeTags}
                onCheckedChange={setIncludeTags}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDownloadHTML} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Als HTML
          </Button>
          <Button onClick={handlePrint} className="w-full sm:w-auto">
            <Printer className="w-4 h-4 mr-2" />
            Drucken / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
