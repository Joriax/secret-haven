import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scan, 
  Upload, 
  Loader2, 
  Copy, 
  Check, 
  X, 
  FileText, 
  Image as ImageIcon,
  RefreshCw,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { createWorker, Worker } from 'tesseract.js';
import { cn } from '@/lib/utils';

interface OCRScannerProps {
  onTextExtracted?: (text: string) => void;
  trigger?: React.ReactNode;
}

export const OCRScanner: React.FC<OCRScannerProps> = ({ onTextExtracted, trigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const processImage = useCallback(async (imageFile: File | Blob) => {
    setIsProcessing(true);
    setProgress(0);
    setProgressStatus('Initialisiere...');
    setExtractedText('');

    try {
      // Create worker if not exists
      if (!workerRef.current) {
        workerRef.current = await createWorker('deu+eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
              setProgressStatus('Erkenne Text...');
            } else if (m.status === 'loading language traineddata') {
              setProgress(Math.round(m.progress * 50));
              setProgressStatus('Lade Sprachmodell...');
            }
          },
        });
      }

      setProgressStatus('Verarbeite Bild...');
      const { data } = await workerRef.current.recognize(imageFile);
      
      setExtractedText(data.text);
      setProgress(100);
      setProgressStatus('Fertig!');
      
      if (data.text.trim()) {
        toast.success(`${data.text.split(/\s+/).length} Wörter erkannt`);
      } else {
        toast.info('Kein Text erkannt');
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast.error('Fehler bei der Texterkennung');
      setProgressStatus('Fehler');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    await processImage(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setImagePreview(ev.target?.result as string);
          };
          reader.readAsDataURL(blob);
          
          await processImage(blob);
        }
        break;
      }
    }
  }, [processImage]);

  // Clipboard listener
  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [isOpen, handlePaste]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(extractedText);
    setCopied(true);
    toast.success('Text kopiert');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseText = () => {
    if (onTextExtracted && extractedText) {
      onTextExtracted(extractedText);
      setIsOpen(false);
      toast.success('Text übernommen');
    }
  };

  const handleReset = () => {
    setExtractedText('');
    setImagePreview(null);
    setProgress(0);
    setProgressStatus('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Scan className="w-4 h-4" />
            OCR Scanner
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-primary" />
            Text aus Bild extrahieren (OCR)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Upload Area */}
          {!imagePreview && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer",
                "transition-colors hover:border-primary hover:bg-primary/5"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium mb-2">
                Bild hochladen oder einfügen
              </p>
              <p className="text-sm text-muted-foreground">
                Klicken zum Auswählen oder Strg+V zum Einfügen
              </p>
            </motion.div>
          )}

          {/* Image Preview */}
          <AnimatePresence>
            {imagePreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative"
              >
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-64 object-contain rounded-xl bg-muted"
                />
                {!isProcessing && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleReset}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {progressStatus}
                  </span>
                  <span className="text-primary font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Extracted Text */}
          <AnimatePresence>
            {extractedText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Erkannter Text
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {extractedText.split(/\s+/).filter(Boolean).length} Wörter
                  </span>
                </div>
                
                <Textarea
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  className="min-h-[150px] font-mono text-sm"
                  placeholder="Erkannter Text erscheint hier..."
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    Kopieren
                  </Button>
                  
                  {onTextExtracted && (
                    <Button className="flex-1" onClick={handleUseText}>
                      <FileText className="w-4 h-4 mr-2" />
                      Übernehmen
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    title="Neues Bild"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tips */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <p className="font-medium mb-1">Tipps für beste Ergebnisse:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Hochauflösende Bilder verwenden</li>
              <li>Guter Kontrast zwischen Text und Hintergrund</li>
              <li>Text sollte gerade/horizontal sein</li>
              <li>Unterstützt Deutsch und Englisch</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
