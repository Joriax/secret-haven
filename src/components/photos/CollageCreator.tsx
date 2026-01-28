import React, { memo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Grid3X3, 
  LayoutGrid,
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  Save,
  RotateCcw,
  Palette,
  Square,
  Columns,
  Rows
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollageCreatorProps {
  isOpen: boolean;
  availablePhotos: { id: string; url: string; filename: string }[];
  onSave: (blob: Blob) => void;
  onClose: () => void;
}

type LayoutType = '2x1' | '1x2' | '2x2' | '3x1' | '1x3' | '3x3' | 'free';

interface CollageSlot {
  id: string;
  photoUrl: string | null;
  photoId: string | null;
}

const LAYOUTS: { type: LayoutType; label: string; icon: React.ReactNode; slots: number }[] = [
  { type: '2x1', label: '2 horizontal', icon: <Columns className="w-4 h-4" />, slots: 2 },
  { type: '1x2', label: '2 vertikal', icon: <Rows className="w-4 h-4" />, slots: 2 },
  { type: '2x2', label: '2×2', icon: <Grid3X3 className="w-4 h-4" />, slots: 4 },
  { type: '3x1', label: '3 horizontal', icon: <Columns className="w-4 h-4" />, slots: 3 },
  { type: '1x3', label: '3 vertikal', icon: <Rows className="w-4 h-4" />, slots: 3 },
  { type: '3x3', label: '3×3', icon: <LayoutGrid className="w-4 h-4" />, slots: 9 },
];

const BACKGROUNDS = [
  { color: '#ffffff', label: 'Weiß' },
  { color: '#000000', label: 'Schwarz' },
  { color: '#18181b', label: 'Dunkel' },
  { color: '#f5f5f4', label: 'Grau' },
  { color: '#fef3c7', label: 'Warm' },
  { color: '#dbeafe', label: 'Kalt' },
  { color: '#dcfce7', label: 'Grün' },
  { color: '#fce7f3', label: 'Rosa' },
];

const GAP_OPTIONS = [0, 2, 4, 8, 12, 16];

export const CollageCreator = memo(function CollageCreator({
  isOpen,
  availablePhotos,
  onSave,
  onClose
}: CollageCreatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<LayoutType>('2x2');
  const [slots, setSlots] = useState<CollageSlot[]>([]);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [gap, setGap] = useState(4);
  const [borderRadius, setBorderRadius] = useState(8);
  const [isSaving, setIsSaving] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState<number | null>(null);

  // Initialize slots when layout changes
  React.useEffect(() => {
    const layoutConfig = LAYOUTS.find(l => l.type === layout);
    if (!layoutConfig) return;

    const newSlots: CollageSlot[] = Array.from({ length: layoutConfig.slots }, (_, i) => ({
      id: `slot-${i}`,
      photoUrl: slots[i]?.photoUrl || null,
      photoId: slots[i]?.photoId || null
    }));
    setSlots(newSlots);
  }, [layout]);

  // Get grid configuration
  const getGridStyle = useCallback((): React.CSSProperties => {
    switch (layout) {
      case '2x1': return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1fr' };
      case '1x2': return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(2, 1fr)' };
      case '2x2': return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' };
      case '3x1': return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr' };
      case '1x3': return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(3, 1fr)' };
      case '3x3': return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' };
      default: return {};
    }
  }, [layout]);

  // Assign photo to slot
  const assignPhoto = (slotIndex: number, photo: { id: string; url: string }) => {
    setSlots(prev => prev.map((slot, i) => 
      i === slotIndex 
        ? { ...slot, photoUrl: photo.url, photoId: photo.id }
        : slot
    ));
    setShowPhotoPicker(null);
  };

  // Remove photo from slot
  const removePhoto = (slotIndex: number) => {
    setSlots(prev => prev.map((slot, i) => 
      i === slotIndex 
        ? { ...slot, photoUrl: null, photoId: null }
        : slot
    ));
  };

  // Reset all
  const handleReset = () => {
    setSlots(prev => prev.map(slot => ({ ...slot, photoUrl: null, photoId: null })));
  };

  // Export collage
  const handleSave = async () => {
    if (!canvasRef.current) return;
    
    setIsSaving(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size (1200px base)
      const size = 1200;
      canvas.width = size;
      canvas.height = size;

      // Fill background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, size, size);

      // Calculate grid dimensions
      const layoutConfig = LAYOUTS.find(l => l.type === layout);
      if (!layoutConfig) return;

      let cols = 1, rows = 1;
      switch (layout) {
        case '2x1': cols = 2; rows = 1; break;
        case '1x2': cols = 1; rows = 2; break;
        case '2x2': cols = 2; rows = 2; break;
        case '3x1': cols = 3; rows = 1; break;
        case '1x3': cols = 1; rows = 3; break;
        case '3x3': cols = 3; rows = 3; break;
      }

      const scaledGap = (gap / 100) * size;
      const cellWidth = (size - scaledGap * (cols + 1)) / cols;
      const cellHeight = (size - scaledGap * (rows + 1)) / rows;
      const scaledRadius = (borderRadius / 100) * Math.min(cellWidth, cellHeight);

      // Load and draw images
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot.photoUrl) continue;

        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = scaledGap + col * (cellWidth + scaledGap);
        const y = scaledGap + row * (cellHeight + scaledGap);

        // Load image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Draw with rounded corners
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, cellWidth, cellHeight, scaledRadius);
            ctx.clip();

            // Cover-fit the image
            const imgRatio = img.width / img.height;
            const cellRatio = cellWidth / cellHeight;
            let drawWidth, drawHeight, drawX, drawY;

            if (imgRatio > cellRatio) {
              drawHeight = cellHeight;
              drawWidth = cellHeight * imgRatio;
              drawX = x - (drawWidth - cellWidth) / 2;
              drawY = y;
            } else {
              drawWidth = cellWidth;
              drawHeight = cellWidth / imgRatio;
              drawX = x;
              drawY = y - (drawHeight - cellHeight) / 2;
            }

            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            ctx.restore();
            resolve();
          };
          img.onerror = () => resolve(); // Skip failed images
          img.src = slot.photoUrl!;
        });
      }

      canvas.toBlob(
        blob => {
          if (blob) onSave(blob);
        },
        'image/jpeg',
        0.92
      );
    } finally {
      setIsSaving(false);
    }
  };

  const filledSlots = slots.filter(s => s.photoUrl).length;

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
            <Grid3X3 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Collage erstellen</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Zurücksetzen
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || filledSlots < 2}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Erstellen...' : 'Speichern'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Preview */}
          <div className="flex-1 flex items-center justify-center p-8 bg-black/50">
            <div 
              className="w-full max-w-xl aspect-square grid"
              style={{
                ...getGridStyle(),
                gap: `${gap}px`,
                backgroundColor,
                padding: `${gap}px`,
                borderRadius: `${borderRadius}px`
              }}
            >
              {slots.map((slot, index) => (
                <div
                  key={slot.id}
                  className={cn(
                    "relative overflow-hidden flex items-center justify-center cursor-pointer group",
                    !slot.photoUrl && "border-2 border-dashed border-white/20"
                  )}
                  style={{ borderRadius: `${borderRadius}px` }}
                  onClick={() => setShowPhotoPicker(index)}
                >
                  {slot.photoUrl ? (
                    <>
                      <img
                        src={slot.photoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-white/40 flex flex-col items-center gap-2">
                      <Plus className="w-8 h-8" />
                      <span className="text-xs">Foto hinzufügen</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Sidebar */}
          <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Layout Selection */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Layout</h3>
                <div className="grid grid-cols-3 gap-2">
                  {LAYOUTS.map(l => (
                    <button
                      key={l.type}
                      onClick={() => setLayout(l.type)}
                      className={cn(
                        "p-3 rounded-lg border transition-colors flex flex-col items-center gap-1",
                        layout === l.type
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 text-foreground"
                      )}
                    >
                      {l.icon}
                      <span className="text-xs">{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Hintergrund
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {BACKGROUNDS.map(bg => (
                    <button
                      key={bg.color}
                      onClick={() => setBackgroundColor(bg.color)}
                      className={cn(
                        "w-full aspect-square rounded-lg border-2 transition-all",
                        backgroundColor === bg.color
                          ? "border-primary scale-95"
                          : "border-transparent hover:border-primary/50"
                      )}
                      style={{ backgroundColor: bg.color }}
                      title={bg.label}
                    />
                  ))}
                </div>
              </div>

              {/* Gap */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Abstand</h3>
                <div className="flex gap-2 flex-wrap">
                  {GAP_OPTIONS.map(g => (
                    <button
                      key={g}
                      onClick={() => setGap(g)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                        gap === g
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 text-foreground"
                      )}
                    >
                      {g}px
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Radius */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Ecken-Radius</h3>
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="text-xs text-muted-foreground text-center">{borderRadius}px</div>
              </div>

              {/* Stats */}
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Fotos ausgewählt:</span>
                  <span className="font-medium text-foreground">{filledSlots} / {slots.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Photo Picker Modal */}
        <AnimatePresence>
          {showPhotoPicker !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
              onClick={() => setShowPhotoPicker(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-card rounded-xl p-4 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Foto auswählen</h3>
                  <button
                    onClick={() => setShowPhotoPicker(null)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {availablePhotos.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Keine Fotos verfügbar</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {availablePhotos.map(photo => (
                        <button
                          key={photo.id}
                          onClick={() => assignPhoto(showPhotoPicker, photo)}
                          className={cn(
                            "aspect-square rounded-lg overflow-hidden border-2 transition-all hover:opacity-90",
                            slots.some(s => s.photoId === photo.id)
                              ? "border-primary opacity-50"
                              : "border-transparent hover:border-primary/50"
                          )}
                        >
                          <img
                            src={photo.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
});

export default CollageCreator;
