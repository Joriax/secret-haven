import React, { memo, useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  RotateCw, 
  RotateCcw, 
  FlipHorizontal, 
  FlipVertical,
  Crop,
  Sun,
  Contrast,
  Palette,
  Download,
  Save,
  Undo,
  Check,
  Square,
  Smartphone,
  Monitor,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageEditorProps {
  isOpen: boolean;
  imageUrl: string;
  filename: string;
  onSave: (blob: Blob, saveAsNew: boolean) => void;
  onClose: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

type AspectRatio = 'free' | '1:1' | '4:3' | '16:9' | '3:4' | '9:16';

interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  sepia: number;
  grayscale: number;
  hueRotate: number;
}

const FILTER_PRESETS = [
  { name: 'Original', settings: { brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0 } },
  { name: 'Vintage', settings: { brightness: 110, contrast: 85, saturation: 80, blur: 0, sepia: 30, grayscale: 0, hueRotate: 0 } },
  { name: 'B&W', settings: { brightness: 100, contrast: 120, saturation: 0, blur: 0, sepia: 0, grayscale: 100, hueRotate: 0 } },
  { name: 'Warm', settings: { brightness: 105, contrast: 100, saturation: 110, blur: 0, sepia: 20, grayscale: 0, hueRotate: -10 } },
  { name: 'Cold', settings: { brightness: 100, contrast: 105, saturation: 90, blur: 0, sepia: 0, grayscale: 0, hueRotate: 180 } },
  { name: 'Vivid', settings: { brightness: 110, contrast: 130, saturation: 150, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0 } },
  { name: 'Fade', settings: { brightness: 120, contrast: 80, saturation: 70, blur: 0, sepia: 10, grayscale: 20, hueRotate: 0 } },
  { name: 'Drama', settings: { brightness: 90, contrast: 150, saturation: 110, blur: 0, sepia: 0, grayscale: 0, hueRotate: 0 } },
  { name: 'Soft', settings: { brightness: 105, contrast: 90, saturation: 90, blur: 1, sepia: 5, grayscale: 0, hueRotate: 0 } },
  { name: 'Retro', settings: { brightness: 95, contrast: 110, saturation: 80, blur: 0, sepia: 40, grayscale: 0, hueRotate: 10 } },
];

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: React.ReactNode }[] = [
  { value: 'free', label: 'Frei', icon: <Crop className="w-4 h-4" /> },
  { value: '1:1', label: '1:1', icon: <Square className="w-4 h-4" /> },
  { value: '4:3', label: '4:3', icon: <Monitor className="w-4 h-4" /> },
  { value: '16:9', label: '16:9', icon: <Monitor className="w-4 h-4" /> },
  { value: '3:4', label: '3:4', icon: <Smartphone className="w-4 h-4" /> },
  { value: '9:16', label: '9:16', icon: <Smartphone className="w-4 h-4" /> },
];

type EditorTab = 'crop' | 'adjust' | 'filters';

export const ImageEditor = memo(function ImageEditor({
  isOpen,
  imageUrl,
  filename,
  onSave,
  onClose
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<EditorTab>('adjust');
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [filters, setFilters] = useState<FilterSettings>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    sepia: 0,
    grayscale: 0,
    hueRotate: 0
  });
  const [cropMode, setCropMode] = useState(false);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load image
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      saveToHistory();
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl]);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev, { rotation, flipH, flipV, filters: { ...filters }, cropArea }].slice(-20));
  }, [rotation, flipH, flipV, filters, cropArea]);

  // Undo
  const handleUndo = useCallback(() => {
    if (history.length < 2) return;
    const prevState = history[history.length - 2];
    setRotation(prevState.rotation);
    setFlipH(prevState.flipH);
    setFlipV(prevState.flipV);
    setFilters(prevState.filters);
    setCropArea(prevState.cropArea);
    setHistory(prev => prev.slice(0, -1));
  }, [history]);

  // Rotation
  const rotateRight = () => {
    setRotation(prev => (prev + 90) % 360);
    saveToHistory();
  };
  
  const rotateLeft = () => {
    setRotation(prev => (prev - 90 + 360) % 360);
    saveToHistory();
  };

  // Flip
  const toggleFlipH = () => {
    setFlipH(prev => !prev);
    saveToHistory();
  };
  
  const toggleFlipV = () => {
    setFlipV(prev => !prev);
    saveToHistory();
  };

  // Filter change
  const handleFilterChange = (key: keyof FilterSettings, value: number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: typeof FILTER_PRESETS[0]) => {
    setFilters(preset.settings);
    saveToHistory();
  };

  // Reset all
  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      sepia: 0,
      grayscale: 0,
      hueRotate: 0
    });
    setCropArea(null);
    saveToHistory();
  };

  // Generate CSS filter string
  const getFilterString = () => {
    return `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${filters.blur}px) sepia(${filters.sepia}%) grayscale(${filters.grayscale}%) hue-rotate(${filters.hueRotate}deg)`;
  };

  // Get transform string
  const getTransformString = () => {
    let transform = `rotate(${rotation}deg)`;
    if (flipH) transform += ' scaleX(-1)';
    if (flipV) transform += ' scaleY(-1)';
    return transform;
  };

  // Export image
  const handleSave = async (saveAsNew: boolean) => {
    if (!imageRef.current || !canvasRef.current) return;
    
    setIsSaving(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = imageRef.current;
      
      // Calculate dimensions based on rotation
      const isRotated90or270 = rotation === 90 || rotation === 270;
      const targetWidth = isRotated90or270 ? img.height : img.width;
      const targetHeight = isRotated90or270 ? img.width : img.height;
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Apply transformations
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (flipH) ctx.scale(-1, 1);
      if (flipV) ctx.scale(1, -1);
      
      // Apply filters
      ctx.filter = getFilterString();
      
      // Draw image centered
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      // Apply crop if set
      if (cropArea) {
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropArea.width;
        croppedCanvas.height = cropArea.height;
        const croppedCtx = croppedCanvas.getContext('2d');
        if (croppedCtx) {
          croppedCtx.drawImage(
            canvas,
            cropArea.x, cropArea.y, cropArea.width, cropArea.height,
            0, 0, cropArea.width, cropArea.height
          );
          croppedCanvas.toBlob(
            blob => {
              if (blob) onSave(blob, saveAsNew);
            },
            'image/jpeg',
            0.92
          );
          return;
        }
      }

      canvas.toBlob(
        blob => {
          if (blob) onSave(blob, saveAsNew);
        },
        'image/jpeg',
        0.92
      );
    } finally {
      setIsSaving(false);
    }
  };

  const SliderControl = ({ 
    label, 
    value, 
    onChange, 
    min = 0, 
    max = 200,
    defaultValue = 100
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    defaultValue?: number;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        onMouseUp={() => saveToHistory()}
        className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">Bild bearbeiten</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={history.length < 2}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Rückgängig"
            >
              <Undo className="w-5 h-5" />
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              Zurücksetzen
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-foreground transition-colors text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Als Kopie
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Speichern
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Preview */}
          <div 
            ref={containerRef}
            className="flex-1 flex items-center justify-center p-8 bg-black/50 overflow-hidden"
          >
            {imageLoaded && imageRef.current && (
              <div className="relative max-w-full max-h-full">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="max-w-full max-h-[calc(100vh-12rem)] object-contain"
                  style={{
                    filter: getFilterString(),
                    transform: getTransformString(),
                    transition: 'filter 0.2s, transform 0.3s'
                  }}
                />
              </div>
            )}
            {/* Hidden canvas for export */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Sidebar Controls */}
          <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {[
                { id: 'adjust', label: 'Anpassen', icon: Sun },
                { id: 'filters', label: 'Filter', icon: Palette },
                { id: 'crop', label: 'Zuschneiden', icon: Crop }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as EditorTab)}
                  className={cn(
                    "flex-1 py-3 px-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                    activeTab === tab.id 
                      ? "bg-primary/10 text-primary border-b-2 border-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {activeTab === 'adjust' && (
                <>
                  {/* Transform Controls */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Transformieren</h3>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={rotateLeft}
                        className="p-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors flex flex-col items-center gap-1"
                        title="Links drehen"
                      >
                        <RotateCcw className="w-5 h-5" />
                        <span className="text-[10px] text-muted-foreground">-90°</span>
                      </button>
                      <button
                        onClick={rotateRight}
                        className="p-3 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors flex flex-col items-center gap-1"
                        title="Rechts drehen"
                      >
                        <RotateCw className="w-5 h-5" />
                        <span className="text-[10px] text-muted-foreground">+90°</span>
                      </button>
                      <button
                        onClick={toggleFlipH}
                        className={cn(
                          "p-3 rounded-lg transition-colors flex flex-col items-center gap-1",
                          flipH ? "bg-primary/20 text-primary" : "bg-muted hover:bg-muted/80 text-foreground"
                        )}
                        title="Horizontal spiegeln"
                      >
                        <FlipHorizontal className="w-5 h-5" />
                        <span className="text-[10px] text-muted-foreground">H</span>
                      </button>
                      <button
                        onClick={toggleFlipV}
                        className={cn(
                          "p-3 rounded-lg transition-colors flex flex-col items-center gap-1",
                          flipV ? "bg-primary/20 text-primary" : "bg-muted hover:bg-muted/80 text-foreground"
                        )}
                        title="Vertikal spiegeln"
                      >
                        <FlipVertical className="w-5 h-5" />
                        <span className="text-[10px] text-muted-foreground">V</span>
                      </button>
                    </div>
                  </div>

                  {/* Adjustment Sliders */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">Anpassungen</h3>
                    <SliderControl
                      label="Helligkeit"
                      value={filters.brightness}
                      onChange={(v) => handleFilterChange('brightness', v)}
                    />
                    <SliderControl
                      label="Kontrast"
                      value={filters.contrast}
                      onChange={(v) => handleFilterChange('contrast', v)}
                    />
                    <SliderControl
                      label="Sättigung"
                      value={filters.saturation}
                      onChange={(v) => handleFilterChange('saturation', v)}
                    />
                    <SliderControl
                      label="Sepia"
                      value={filters.sepia}
                      onChange={(v) => handleFilterChange('sepia', v)}
                      defaultValue={0}
                    />
                    <SliderControl
                      label="Graustufen"
                      value={filters.grayscale}
                      onChange={(v) => handleFilterChange('grayscale', v)}
                      max={100}
                      defaultValue={0}
                    />
                  </div>
                </>
              )}

              {activeTab === 'filters' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Filter-Vorlagen</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {FILTER_PRESETS.map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => applyPreset(preset)}
                        className={cn(
                          "p-3 rounded-xl border transition-colors text-center",
                          JSON.stringify(filters) === JSON.stringify(preset.settings)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 text-foreground"
                        )}
                      >
                        <div className="w-full h-12 rounded-lg bg-muted mb-2 overflow-hidden">
                          {imageLoaded && (
                            <img
                              src={imageUrl}
                              alt={preset.name}
                              className="w-full h-full object-cover"
                              style={{
                                filter: `brightness(${preset.settings.brightness}%) contrast(${preset.settings.contrast}%) saturate(${preset.settings.saturation}%) sepia(${preset.settings.sepia}%) grayscale(${preset.settings.grayscale}%)`
                              }}
                            />
                          )}
                        </div>
                        <span className="text-xs font-medium">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'crop' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Seitenverhältnis</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECT_RATIOS.map(ratio => (
                      <button
                        key={ratio.value}
                        onClick={() => setAspectRatio(ratio.value)}
                        className={cn(
                          "p-3 rounded-lg border transition-colors flex flex-col items-center gap-1",
                          aspectRatio === ratio.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 text-foreground"
                        )}
                      >
                        {ratio.icon}
                        <span className="text-xs">{ratio.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Zuschneiden: Klicke und ziehe auf dem Bild um den Bereich zu markieren.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

export default ImageEditor;
