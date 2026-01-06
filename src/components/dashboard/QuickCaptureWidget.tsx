import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  FileText, 
  Link2, 
  Send,
  X,
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type CaptureMode = 'note' | 'link' | null;

export function QuickCaptureWidget() {
  const [mode, setMode] = useState<CaptureMode>(null);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { userId, supabaseClient: supabase } = useAuth();

  const handleSubmit = async () => {
    if (!content.trim() || !userId || !supabase) return;

    setIsLoading(true);
    try {
      if (mode === 'note') {
        // Create quick note
        const { error } = await supabase.from('notes').insert({
          user_id: userId,
          title: content.length > 50 ? content.substring(0, 50) + '...' : content,
          content: content,
        });
        if (error) throw error;
        toast.success('Notiz erstellt');
      } else if (mode === 'link') {
        // Create link
        let url = content.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        
        const { error } = await supabase.from('links').insert({
          user_id: userId,
          url: url,
          title: new URL(url).hostname,
        });
        if (error) throw error;
        toast.success('Link gespeichert');
      }

      setContent('');
      setMode(null);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setMode(null);
      setContent('');
    }
  };

  return (
    <div className="bento-card h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Schnellerfassung</h2>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === null ? (
          <motion.div
            key="buttons"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-2 gap-3"
          >
            <button
              onClick={() => setMode('note')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl",
                "bg-muted/50 hover:bg-muted transition-colors",
                "border border-transparent hover:border-primary/30"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Notiz</span>
            </button>

            <button
              onClick={() => setMode('link')}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl",
                "bg-muted/50 hover:bg-muted transition-colors",
                "border border-transparent hover:border-orange-500/30"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-sm text-muted-foreground">Link</span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {mode === 'note' ? (
                  <FileText className="w-4 h-4 text-primary" />
                ) : (
                  <Link2 className="w-4 h-4 text-orange-400" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {mode === 'note' ? 'Neue Notiz' : 'Neuer Link'}
                </span>
              </div>
              <button
                onClick={() => { setMode(null); setContent(''); }}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {mode === 'note' ? (
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Schreibe eine Notiz..."
                className={cn(
                  "w-full h-24 px-3 py-2 rounded-lg resize-none",
                  "bg-muted border border-border",
                  "text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                )}
              />
            ) : (
              <input
                autoFocus
                type="url"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://..."
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg",
                  "bg-muted border border-border",
                  "text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                )}
              />
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                ⌘+Enter zum Speichern
              </span>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!content.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    Speichern
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
