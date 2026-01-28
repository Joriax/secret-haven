import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Minimize2, Image, FileArchive, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileCompressorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  onCompressComplete?: (compressedFiles: File[]) => void;
}

interface CompressionResult {
  original: File;
  compressed: File | null;
  originalSize: number;
  compressedSize: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export function FileCompressor({ open, onOpenChange, files, onCompressComplete }: FileCompressorProps) {
  const [quality, setQuality] = useState([80]);
  const [maxWidth, setMaxWidth] = useState([1920]);
  const [results, setResults] = useState<CompressionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const compressImage = useCallback(async (file: File, quality: number, maxWidth: number): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize if larger than maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',
          quality / 100
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const startCompression = useCallback(async () => {
    setIsProcessing(true);
    setOverallProgress(0);

    const initialResults: CompressionResult[] = files.map((file) => ({
      original: file,
      compressed: null,
      originalSize: file.size,
      compressedSize: 0,
      status: 'pending',
    }));
    setResults(initialResults);

    const compressedFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: 'processing' } : r))
      );

      try {
        if (file.type.startsWith('image/')) {
          const compressed = await compressImage(file, quality[0], maxWidth[0]);
          compressedFiles.push(compressed);
          
          setResults((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? { ...r, compressed, compressedSize: compressed.size, status: 'done' }
                : r
            )
          );
        } else {
          // Non-image files - just pass through
          compressedFiles.push(file);
          setResults((prev) =>
            prev.map((r, idx) =>
              idx === i
                ? { ...r, compressed: file, compressedSize: file.size, status: 'done' }
                : r
            )
          );
        }
      } catch (error) {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: 'error', error: error instanceof Error ? error.message : 'Fehler' }
              : r
          )
        );
      }

      setOverallProgress(((i + 1) / files.length) * 100);
    }

    setIsProcessing(false);
    onCompressComplete?.(compressedFiles);
  }, [files, quality, maxWidth, compressImage, onCompressComplete]);

  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);
  const savedBytes = totalOriginal - totalCompressed;
  const savedPercent = totalOriginal > 0 ? ((savedBytes / totalOriginal) * 100).toFixed(1) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minimize2 className="w-5 h-5 text-primary" />
            Dateien komprimieren
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Bildqualität</span>
                <span className="text-muted-foreground">{quality[0]}%</span>
              </Label>
              <Slider
                value={quality}
                onValueChange={setQuality}
                min={10}
                max={100}
                step={5}
                disabled={isProcessing}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Max. Breite</span>
                <span className="text-muted-foreground">{maxWidth[0]}px</span>
              </Label>
              <Slider
                value={maxWidth}
                onValueChange={setMaxWidth}
                min={640}
                max={3840}
                step={160}
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* File list */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file, idx) => {
              const result = results[idx];
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <Image className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(file.size)}
                      {result?.status === 'done' && result.compressedSize < result.originalSize && (
                        <span className="text-green-500 ml-2">
                          → {formatSize(result.compressedSize)} (-{((1 - result.compressedSize / result.originalSize) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </p>
                  </div>
                  {result?.status === 'processing' && (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  {result?.status === 'done' && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                  {result?.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <Progress value={overallProgress} />
              <p className="text-sm text-center text-muted-foreground">
                Komprimiere... {Math.round(overallProgress)}%
              </p>
            </div>
          )}

          {/* Results summary */}
          {results.length > 0 && !isProcessing && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <FileArchive className="w-5 h-5" />
                <span className="font-medium">
                  {formatSize(savedBytes)} gespart ({savedPercent}%)
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatSize(totalOriginal)} → {formatSize(totalCompressed)}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Abbrechen
            </Button>
            <Button
              onClick={startCompression}
              disabled={isProcessing || files.length === 0}
              className="flex-1"
            >
              {isProcessing ? 'Komprimiere...' : 'Komprimieren'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FileCompressor;
