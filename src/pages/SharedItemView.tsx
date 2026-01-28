import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, AlertTriangle, Image, FileText, File, Clock, Eye, EyeOff, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShareInfo {
  requires_password: boolean;
  item_type: string;
  expires_at: string;
  clicks_remaining: number | null;
}

interface SharedItem {
  id: string;
  url?: string;
  filename?: string;
  title?: string;
  content?: string;
  caption?: string;
  mime_type?: string;
}

export default function SharedItemView() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [item, setItem] = useState<SharedItem | null>(null);
  const [itemType, setItemType] = useState<string | null>(null);

  // Fetch share info on mount
  useEffect(() => {
    if (!token) return;

    const fetchShareInfo = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('access-shared', {
          body: {},
          headers: {},
        });

        // Use query params approach instead
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/access-shared?token=${token}&action=info`
        );

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Link nicht verfügbar');
          setErrorCode(result.code);
          setLoading(false);
          return;
        }

        setShareInfo(result);
        setLoading(false);

        // If no password required, fetch content immediately
        if (!result.requires_password) {
          await fetchContent();
        }
      } catch (err) {
        console.error('Error fetching share info:', err);
        setError('Fehler beim Laden');
        setLoading(false);
      }
    };

    fetchShareInfo();
  }, [token]);

  const fetchContent = async (pwd?: string) => {
    setVerifying(true);
    try {
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/access-shared`);
      url.searchParams.set('token', token!);
      url.searchParams.set('action', 'access');
      if (pwd) url.searchParams.set('password', pwd);

      const response = await fetch(url.toString());
      const result = await response.json();

      if (!response.ok) {
        if (result.code === 'WRONG_PASSWORD') {
          toast.error('Falsches Passwort');
        } else {
          setError(result.error);
          setErrorCode(result.code);
        }
        setVerifying(false);
        return;
      }

      setItem(result.item);
      setItemType(result.item_type);
      setShareInfo(null); // Hide password form
    } catch (err) {
      console.error('Error accessing content:', err);
      toast.error('Fehler beim Laden');
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    fetchContent(password);
  };

  const handleDownload = () => {
    if (!item?.url) return;
    
    const link = document.createElement('a');
    link.href = item.url;
    link.download = item.filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getExpiryText = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    
    if (diff < 0) return 'Abgelaufen';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} Tag${days !== 1 ? 'e' : ''} verbleibend`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m verbleibend`;
    }
    return `${minutes} Minuten verbleibend`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {errorCode === 'EXPIRED' ? 'Link abgelaufen' : 
             errorCode === 'LIMIT_REACHED' ? 'Limit erreicht' : 
             errorCode === 'NOT_FOUND' ? 'Link nicht gefunden' : 
             'Fehler'}
          </h1>
          <p className="text-muted-foreground">{error}</p>
        </motion.div>
      </div>
    );
  }

  // Password form
  if (shareInfo?.requires_password && !item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 max-w-md w-full"
        >
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          
          <h1 className="text-xl font-semibold text-foreground text-center mb-2">
            Passwortgeschützt
          </h1>
          <p className="text-muted-foreground text-center mb-6">
            Dieser Inhalt ist passwortgeschützt
          </p>

          <form onSubmit={handleSubmitPassword} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort eingeben..."
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            <Button type="submit" className="w-full" disabled={verifying || !password.trim()}>
              {verifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              Entsperren
            </Button>
          </form>

          {shareInfo.expires_at && (
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />
                {getExpiryText(shareInfo.expires_at)}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Content view
  if (item) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="p-4 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {itemType === 'photo' && <Image className="w-5 h-5 text-primary" />}
              {itemType === 'file' && <File className="w-5 h-5 text-primary" />}
              {itemType === 'note' && <FileText className="w-5 h-5 text-primary" />}
              <h1 className="font-medium text-foreground truncate">
                {item.caption || item.title || item.filename || 'Geteilter Inhalt'}
              </h1>
            </div>
            {item.url && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center"
              >
                {itemType === 'photo' && item.url && (
                  <img
                    src={item.url}
                    alt={item.caption || 'Geteiltes Bild'}
                    className="max-w-full max-h-[80vh] rounded-xl shadow-lg object-contain"
                  />
                )}

                {itemType === 'file' && item.url && (
                  <div className="bg-card border border-border rounded-xl p-8 text-center">
                    <File className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-lg font-medium text-foreground mb-2">
                      {item.filename}
                    </h2>
                    <Button onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Datei herunterladen
                    </Button>
                  </div>
                )}

                {itemType === 'note' && (
                  <div className="bg-card border border-border rounded-xl p-8 w-full max-w-2xl">
                    <h2 className="text-xl font-semibold text-foreground mb-4">
                      {item.title || 'Notiz'}
                    </h2>
                    <div className="prose prose-invert max-w-none">
                      <p className="text-foreground whitespace-pre-wrap">
                        {item.content}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-4 border-t border-border bg-card/50">
          <p className="text-xs text-muted-foreground text-center">
            Geteilt via PhantomVault
          </p>
        </footer>
      </div>
    );
  }

  return null;
}