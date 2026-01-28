import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scan, 
  Camera, 
  X, 
  CheckCircle, 
  AlertCircle,
  Copy,
  ExternalLink,
  FileText,
  Image,
  Link2,
  Loader2,
  Flashlight,
  FlashlightOff,
  RotateCcw
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScanned?: (data: string, type: 'url' | 'text' | 'phantomvault') => void;
}

interface ScanResult {
  data: string;
  type: 'url' | 'text' | 'phantomvault';
  timestamp: Date;
}

export function QRScanner({ open, onClose, onScanned }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const navigate = useNavigate();

  // Simple QR code decoder using canvas analysis
  const decodeQR = useCallback((imageData: ImageData): string | null => {
    // Basic QR pattern detection - looking for finder patterns
    // This is a simplified implementation. For production, use a library like jsQR
    const { data, width, height } = imageData;
    
    // Check for URL patterns in any detected text
    // In a real implementation, this would use proper QR decoding
    return null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsScanning(true);

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start scanning loop
      scanFrame();
    } catch (err: any) {
      console.error('Camera error:', err);
      setError(err.message === 'Permission denied' 
        ? 'Kamera-Zugriff verweigert' 
        : 'Kamera nicht verfügbar');
      setHasCamera(false);
      setIsScanning(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Try to decode QR from canvas
    // In production, use jsQR or similar library here
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = decodeQR(imageData);

    if (result) {
      handleScanResult(result);
    } else {
      animationRef.current = requestAnimationFrame(scanFrame);
    }
  }, [decodeQR]);

  const handleScanResult = useCallback((data: string) => {
    stopCamera();

    let type: 'url' | 'text' | 'phantomvault' = 'text';
    
    if (data.startsWith('http://') || data.startsWith('https://')) {
      type = 'url';
    } else if (data.startsWith('phantomvault://')) {
      type = 'phantomvault';
    }

    const result: ScanResult = {
      data,
      type,
      timestamp: new Date(),
    };

    setScanResult(result);
    onScanned?.(data, type);
    toast.success('QR-Code erkannt!');
  }, [stopCamera, onScanned]);

  // Manual text input fallback
  const handleManualInput = () => {
    const input = prompt('QR-Code Inhalt eingeben:');
    if (input) {
      handleScanResult(input);
    }
  };

  // Handle file upload for QR scanning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = new window.Image();
      img.src = URL.createObjectURL(file);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = decodeQR(imageData);
        
        if (result) {
          handleScanResult(result);
        } else {
          toast.error('Kein QR-Code im Bild gefunden');
        }
      }
    } catch (err) {
      toast.error('Fehler beim Verarbeiten des Bildes');
    }
  };

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.() as any;
    
    if (capabilities?.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn } as any],
        });
        setTorchOn(!torchOn);
      } catch (err) {
        console.error('Torch toggle failed:', err);
      }
    }
  }, [torchOn]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, [stopCamera]);

  useEffect(() => {
    if (open && !scanResult) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera, scanResult, facingMode]);

  const handleClose = () => {
    stopCamera();
    setScanResult(null);
    setError(null);
    onClose();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Kopiert!');
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  const handleAction = () => {
    if (!scanResult) return;

    switch (scanResult.type) {
      case 'url':
        window.open(scanResult.data, '_blank', 'noopener,noreferrer');
        break;
      case 'phantomvault':
        // Handle phantomvault:// URLs
        const path = scanResult.data.replace('phantomvault://', '/action/');
        navigate(path);
        handleClose();
        break;
      case 'text':
        // Create a new note with the scanned text
        navigate('/notes', { state: { newNoteContent: scanResult.data } });
        handleClose();
        break;
    }
  };

  const resetScan = () => {
    setScanResult(null);
    startCamera();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-primary" />
            QR-Code Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {/* Camera View */}
          <AnimatePresence mode="wait">
            {!scanResult ? (
              <motion.div
                key="scanner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative aspect-square bg-black"
              >
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scanning Overlay */}
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-64 h-64">
                      {/* Corner markers */}
                      <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-lg" />
                      
                      {/* Scanning line animation */}
                      <motion.div
                        className="absolute left-4 right-4 h-0.5 bg-primary shadow-lg shadow-primary/50"
                        animate={{ top: ['10%', '90%', '10%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      />
                    </div>
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center p-6">
                      <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                      <p className="text-foreground font-medium mb-2">{error}</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Du kannst stattdessen ein Bild hochladen
                      </p>
                    </div>
                  </div>
                )}

                {/* Camera Controls */}
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full bg-black/50 border-white/20"
                    onClick={toggleTorch}
                  >
                    {torchOn ? (
                      <FlashlightOff className="w-4 h-4 text-white" />
                    ) : (
                      <Flashlight className="w-4 h-4 text-white" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full bg-black/50 border-white/20"
                    onClick={switchCamera}
                  >
                    <RotateCcw className="w-4 h-4 text-white" />
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="p-6"
              >
                <div className="text-center mb-6">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground">Erfolgreich gescannt!</h3>
                </div>

                <div className="p-4 rounded-lg bg-muted mb-4">
                  <div className="flex items-start gap-3">
                    {scanResult.type === 'url' ? (
                      <Link2 className="w-5 h-5 text-primary mt-0.5" />
                    ) : scanResult.type === 'phantomvault' ? (
                      <Scan className="w-5 h-5 text-primary mt-0.5" />
                    ) : (
                      <FileText className="w-5 h-5 text-primary mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        {scanResult.type === 'url' ? 'URL' : 
                         scanResult.type === 'phantomvault' ? 'PhantomVault Aktion' : 'Text'}
                      </p>
                      <p className="text-sm text-foreground break-all">
                        {scanResult.data}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(scanResult.data)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Kopieren
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAction}
                  >
                    {scanResult.type === 'url' ? (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Öffnen
                      </>
                    ) : scanResult.type === 'phantomvault' ? (
                      <>
                        <Scan className="w-4 h-4 mr-2" />
                        Ausführen
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Als Notiz
                      </>
                    )}
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  className="w-full mt-3"
                  onClick={resetScan}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Erneut scannen
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Alternative Input Methods */}
        {!scanResult && (
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <Image className="w-4 h-4 mr-2" />
                    Bild wählen
                  </span>
                </Button>
              </label>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleManualInput}
              >
                <FileText className="w-4 h-4 mr-2" />
                Manuell eingeben
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default QRScanner;
