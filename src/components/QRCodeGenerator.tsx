import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Download, Copy, X, Check, Link2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';

interface QRCodeGeneratorProps {
  url?: string;
  title?: string;
  trigger?: React.ReactNode;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ 
  url: initialUrl = '', 
  title = 'QR-Code',
  trigger 
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
    }
  }, [initialUrl]);

  useEffect(() => {
    const generateQR = async () => {
      if (!url) {
        setQrDataUrl('');
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'H',
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQR();
  }, [url]);

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `qrcode-${Date.now()}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('QR-Code heruntergeladen');
  };

  const handleCopy = async () => {
    if (!qrDataUrl) return;

    try {
      // Convert data URL to blob
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      setCopied(true);
      toast.success('QR-Code kopiert');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback: copy URL
      await navigator.clipboard.writeText(url);
      toast.success('URL kopiert');
    }
  };

  const handleShare = async () => {
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          url: url,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error('Teilen fehlgeschlagen');
        }
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('URL kopiert');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon" title="QR-Code generieren">
            <QrCode className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* URL Input */}
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL eingeben..."
              className="pl-10"
            />
          </div>

          {/* QR Code Display */}
          <div className="flex justify-center">
            <AnimatePresence mode="wait">
              {qrDataUrl ? (
                <motion.div
                  key="qr"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="p-4 bg-white rounded-xl shadow-lg"
                >
                  <img 
                    src={qrDataUrl} 
                    alt="QR Code" 
                    className="w-[200px] h-[200px]"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-[232px] h-[232px] rounded-xl bg-muted flex items-center justify-center"
                >
                  <div className="text-center">
                    <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">URL eingeben</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopy}
              disabled={!qrDataUrl}
            >
              {copied ? (
                <Check className="w-4 h-4 mr-2 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              Kopieren
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownload}
              disabled={!qrDataUrl}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleShare}
              disabled={!url}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Teilen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Simplified version for quick share
export const QuickQRCode: React.FC<{ url: string; size?: number }> = ({ url, size = 150 }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const generateQR = async () => {
      if (!url) return;
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: size,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' },
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };
    generateQR();
  }, [url, size]);

  if (!qrDataUrl) return null;

  return (
    <div className="inline-block p-2 bg-white rounded-lg">
      <img src={qrDataUrl} alt="QR Code" style={{ width: size, height: size }} />
    </div>
  );
};
