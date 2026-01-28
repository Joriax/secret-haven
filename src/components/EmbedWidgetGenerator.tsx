import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  Code2, 
  Copy, 
  Check, 
  Image, 
  FileText, 
  Link2,
  ExternalLink,
  Palette
} from 'lucide-react';
import { toast } from 'sonner';

interface EmbedWidgetGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: 'photo' | 'note' | 'album' | 'link';
  itemId: string;
  itemName: string;
  shareToken?: string;
}

export function EmbedWidgetGenerator({
  open,
  onOpenChange,
  itemType,
  itemId,
  itemName,
  shareToken,
}: EmbedWidgetGeneratorProps) {
  const [width, setWidth] = useState([400]);
  const [height, setHeight] = useState([300]);
  const [showBorder, setShowBorder] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      embed: 'true',
      theme: darkMode ? 'dark' : 'light',
      title: showTitle ? '1' : '0',
      border: showBorder ? '1' : '0',
    });
    
    if (shareToken) {
      params.set('token', shareToken);
    }
    
    return `${baseUrl}/embed/${itemType}/${itemId}?${params.toString()}`;
  }, [baseUrl, itemType, itemId, shareToken, darkMode, showTitle, showBorder]);

  const iframeCode = useMemo(() => {
    return `<iframe
  src="${embedUrl}"
  width="${width[0]}"
  height="${height[0]}"
  frameborder="${showBorder ? '1' : '0'}"
  style="border: ${showBorder ? '1px solid #e5e7eb' : 'none'}; border-radius: 8px;"
  title="${itemName}"
  loading="lazy"
></iframe>`;
  }, [embedUrl, width, height, showBorder, itemName]);

  const markdownCode = useMemo(() => {
    return `[![${itemName}](${embedUrl})](${baseUrl}/shared/${itemType}/${itemId})`;
  }, [embedUrl, baseUrl, itemType, itemId, itemName]);

  const directLink = useMemo(() => {
    return `${baseUrl}/shared/${itemType}/${itemId}${shareToken ? `?token=${shareToken}` : ''}`;
  }, [baseUrl, itemType, itemId, shareToken]);

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${type} kopiert!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  const typeIcons: Record<string, React.ReactNode> = {
    photo: <Image className="w-5 h-5" />,
    note: <FileText className="w-5 h-5" />,
    album: <Image className="w-5 h-5" />,
    link: <Link2 className="w-5 h-5" />,
  };

  const typeLabels: Record<string, string> = {
    photo: 'Foto',
    note: 'Notiz',
    album: 'Album',
    link: 'Link',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-primary" />
            Widget einbetten
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            {typeIcons[itemType]}
            <div>
              <p className="font-medium">{itemName}</p>
              <p className="text-sm text-muted-foreground">{typeLabels[itemType]}</p>
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Breite</span>
                <span className="text-muted-foreground">{width[0]}px</span>
              </Label>
              <Slider
                value={width}
                onValueChange={setWidth}
                min={200}
                max={800}
                step={50}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Höhe</span>
                <span className="text-muted-foreground">{height[0]}px</span>
              </Label>
              <Slider
                value={height}
                onValueChange={setHeight}
                min={150}
                max={600}
                step={50}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={showBorder} onCheckedChange={setShowBorder} id="border" />
              <Label htmlFor="border">Rahmen</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={darkMode} onCheckedChange={setDarkMode} id="dark" />
              <Label htmlFor="dark">Dark Mode</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={showTitle} onCheckedChange={setShowTitle} id="title" />
              <Label htmlFor="title">Titel anzeigen</Label>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Vorschau</Label>
            <div 
              className="border rounded-lg bg-muted/30 p-4 flex items-center justify-center overflow-auto"
              style={{ minHeight: Math.min(height[0] + 40, 350) }}
            >
              <div
                className={`rounded-lg ${showBorder ? 'border' : ''} ${darkMode ? 'bg-slate-900' : 'bg-white'}`}
                style={{ width: width[0], height: height[0] }}
              >
                <div className={`h-full flex items-center justify-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <div className="text-center">
                    {typeIcons[itemType]}
                    {showTitle && <p className="mt-2 text-sm">{itemName}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Widget Vorschau</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Code tabs */}
          <Tabs defaultValue="iframe">
            <TabsList className="w-full">
              <TabsTrigger value="iframe" className="flex-1">iFrame</TabsTrigger>
              <TabsTrigger value="link" className="flex-1">Direct Link</TabsTrigger>
              <TabsTrigger value="markdown" className="flex-1">Markdown</TabsTrigger>
            </TabsList>

            <TabsContent value="iframe" className="space-y-2">
              <div className="relative">
                <Textarea
                  value={iframeCode}
                  readOnly
                  className="font-mono text-xs h-32 resize-none"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(iframeCode, 'iFrame Code')}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Füge diesen Code in deine Website ein, um das Widget anzuzeigen.
              </p>
            </TabsContent>

            <TabsContent value="link" className="space-y-2">
              <div className="relative">
                <Input value={directLink} readOnly className="pr-20" />
                <div className="absolute right-1 top-1 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(directLink, 'Link')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(directLink, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Direkter Link zum geteilten Inhalt.
              </p>
            </TabsContent>

            <TabsContent value="markdown" className="space-y-2">
              <div className="relative">
                <Textarea
                  value={markdownCode}
                  readOnly
                  className="font-mono text-xs h-20 resize-none"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(markdownCode, 'Markdown')}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Für GitHub, Notion oder andere Markdown-Editoren.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EmbedWidgetGenerator;
