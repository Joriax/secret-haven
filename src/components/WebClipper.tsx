import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scissors, 
  Link2, 
  FileText, 
  Bookmark, 
  Copy, 
  Check, 
  ExternalLink,
  Code,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WebClipperProps {
  onClip?: (data: ClipData) => void;
  trigger?: React.ReactNode;
}

interface ClipData {
  url: string;
  title: string;
  description?: string;
  type: 'link' | 'note';
}

export const WebClipper: React.FC<WebClipperProps> = ({ onClip, trigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Get current app URL for bookmarklet
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  const bookmarkletCode = `javascript:(function(){
    var url=encodeURIComponent(window.location.href);
    var title=encodeURIComponent(document.title);
    var selection=encodeURIComponent(window.getSelection().toString().substring(0,500));
    window.open('${appUrl}/clip?url='+url+'&title='+title+'&text='+selection,'_blank','width=500,height=600');
  })();`;

  const handleCopyBookmarklet = async () => {
    await navigator.clipboard.writeText(bookmarkletCode);
    setCopied(true);
    toast.success('Bookmarklet-Code kopiert');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Scissors className="w-4 h-4" />
            Web Clipper
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Web Clipper einrichten
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="bookmarklet" className="pt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bookmarklet" className="gap-2">
              <Bookmark className="w-4 h-4" />
              Bookmarklet
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Link2 className="w-4 h-4" />
              Manuell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookmarklet" className="space-y-4 mt-4">
            {/* Instructions */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Bookmark erstellen</p>
                  <p className="text-sm text-muted-foreground">
                    Ziehe den Button unten in deine Lesezeichen-Leiste oder erstelle ein neues Lesezeichen
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Code einfügen</p>
                  <p className="text-sm text-muted-foreground">
                    Ersetze die URL des Lesezeichens durch den kopierten Code
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Webseiten speichern</p>
                  <p className="text-sm text-muted-foreground">
                    Klicke auf das Lesezeichen auf jeder Webseite, um sie zu speichern
                  </p>
                </div>
              </div>
            </div>

            {/* Bookmarklet Button */}
            <div className="flex flex-col items-center gap-4 py-6 px-4 bg-muted/50 rounded-xl">
              <a
                href={bookmarkletCode}
                onClick={(e) => e.preventDefault()}
                className={cn(
                  "px-6 py-3 rounded-xl font-medium text-white",
                  "bg-gradient-to-r from-primary to-primary/80",
                  "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
                  "transition-all cursor-grab active:cursor-grabbing"
                )}
                title="Ziehe mich in deine Lesezeichen-Leiste!"
              >
                <Scissors className="w-4 h-4 inline mr-2" />
                Save to Vault
              </a>
              <p className="text-xs text-muted-foreground text-center">
                ↑ Ziehe diesen Button in deine Lesezeichen-Leiste
              </p>
            </div>

            {/* Copy Code Button */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Oder kopiere den Code manuell:
              </p>
              <div className="flex gap-2">
                <code className="flex-1 p-3 bg-muted rounded-lg text-xs overflow-hidden text-ellipsis whitespace-nowrap">
                  {bookmarkletCode.substring(0, 50)}...
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyBookmarklet}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Du kannst Webseiten auch direkt über die Links-Seite speichern:
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <Link2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Links-Seite</p>
                  <p className="text-sm text-muted-foreground">
                    Gehe zu Links → Neuer Link und füge die URL ein
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Quick Capture</p>
                  <p className="text-sm text-muted-foreground">
                    Nutze das Dashboard-Widget für schnelles Speichern
                  </p>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                setIsOpen(false);
                window.location.href = '/links';
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Zu Links gehen
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Simple clip handler page component
export const ClipHandler: React.FC = () => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrl(decodeURIComponent(params.get('url') || ''));
    setTitle(decodeURIComponent(params.get('title') || ''));
    setText(decodeURIComponent(params.get('text') || ''));
  }, []);

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Seite speichern</h1>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">URL</label>
          <Input value={url} readOnly />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Titel</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {text && (
          <div>
            <label className="text-sm text-muted-foreground">Ausgewählter Text</label>
            <textarea 
              className="w-full p-2 border rounded-lg text-sm" 
              value={text} 
              rows={3}
              readOnly 
            />
          </div>
        )}
        <Button className="w-full">
          Als Link speichern
        </Button>
      </div>
    </div>
  );
};
