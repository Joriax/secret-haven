import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pipette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f43f5e', '#fb923c', '#facc15', '#4ade80',
  '#2dd4bf', '#60a5fa', '#a855f7', '#f472b6',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ 
  color, 
  onChange,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const pickerRef = useRef<HTMLDivElement>(null);
  const satLightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Parse initial color
  useEffect(() => {
    const hex = color.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      
      let h = 0;
      let s = 0;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      setHue(h * 360);
      setSaturation(s * 100);
      setLightness(l * 100);
    }
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const updateColor = (h: number, s: number, l: number) => {
    setHue(h);
    setSaturation(s);
    setLightness(l);
    onChange(hslToHex(h, s, l));
  };

  const handleSatLightMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!satLightRef.current) return;
    const rect = satLightRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    
    const s = x * 100;
    const l = (1 - y) * 50 + 25;
    
    updateColor(hue, s, l);
  };

  const handleHueMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    updateColor(x * 360, saturation, lightness);
  };

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "rounded-full border-2 border-white/20 shadow-lg transition-all hover:scale-110 hover:border-white/40",
          sizeClasses[size]
        )}
        style={{ backgroundColor: color }}
      />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute z-50 top-full mt-2 left-0 p-4 rounded-2xl bg-background/95 backdrop-blur-xl border border-border shadow-2xl min-w-[280px]"
          >
            {/* Saturation/Lightness picker */}
            <div
              ref={satLightRef}
              className="w-full h-40 rounded-xl cursor-crosshair relative overflow-hidden mb-3"
              style={{
                background: `
                  linear-gradient(to bottom, transparent, black),
                  linear-gradient(to right, white, hsl(${hue}, 100%, 50%))
                `
              }}
              onMouseDown={(e) => {
                handleSatLightMove(e);
                const onMove = (e: MouseEvent) => handleSatLightMove(e as any);
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              onTouchStart={(e) => {
                handleSatLightMove(e);
              }}
              onTouchMove={handleSatLightMove}
            >
              <div
                className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${saturation}%`,
                  top: `${100 - (lightness - 25) * 2}%`,
                  backgroundColor: color
                }}
              />
            </div>

            {/* Hue slider */}
            <div
              ref={hueRef}
              className="w-full h-4 rounded-full cursor-pointer relative overflow-hidden mb-4"
              style={{
                background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
              }}
              onMouseDown={(e) => {
                handleHueMove(e);
                const onMove = (e: MouseEvent) => handleHueMove(e as any);
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              onTouchStart={(e) => {
                handleHueMove(e);
              }}
              onTouchMove={handleHueMove}
            >
              <div
                className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none top-1/2"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  backgroundColor: `hsl(${hue}, 100%, 50%)`
                }}
              />
            </div>

            {/* Preset colors */}
            <div className="grid grid-cols-8 gap-2 mb-3">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => {
                    onChange(presetColor);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-6 h-6 rounded-full transition-transform hover:scale-125",
                    color === presetColor && "ring-2 ring-offset-2 ring-offset-background ring-primary"
                  )}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
            </div>

            {/* Hex input */}
            <div className="flex items-center gap-2">
              <Pipette className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={color}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                    if (value.length === 7) {
                      onChange(value);
                    }
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-lg bg-muted border border-border text-foreground text-sm font-mono focus:border-primary outline-none"
                placeholder="#6366f1"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};