import React from 'react';
import { motion } from 'framer-motion';
import { Type, Maximize2, Minimize2, Check, Palette } from 'lucide-react';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { cn } from '@/lib/utils';

const FONT_OPTIONS = [
  { id: 'system', label: 'System', preview: '-apple-system, sans-serif' },
  { id: 'inter', label: 'Inter', preview: 'Inter, sans-serif' },
  { id: 'geist', label: 'Geist', preview: 'Geist, sans-serif' },
  { id: 'jetbrains', label: 'JetBrains Mono', preview: 'JetBrains Mono, monospace' },
  { id: 'georgia', label: 'Georgia', preview: 'Georgia, serif' },
];

const FONT_SIZE_OPTIONS = [
  { id: 'small', label: 'Klein', value: '14px' },
  { id: 'normal', label: 'Normal', value: '16px' },
  { id: 'large', label: 'Groß', value: '18px' },
  { id: 'xlarge', label: 'Sehr groß', value: '20px' },
];

const DENSITY_OPTIONS = [
  { id: 'compact', label: 'Kompakt', description: 'Mehr Inhalt, weniger Abstand', icon: Minimize2 },
  { id: 'normal', label: 'Normal', description: 'Ausgewogenes Layout', icon: null },
  { id: 'comfortable', label: 'Komfortabel', description: 'Mehr Luft, größere Abstände', icon: Maximize2 },
];

export function PersonalizationSettings() {
  const { preferences, updatePreferences, isLoading } = useUserPreferences();

  if (isLoading || !preferences) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-24 bg-muted rounded-xl" />
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Font Family */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">Schriftart</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {FONT_OPTIONS.map((font) => {
            const isActive = preferences.font_family === font.id;
            
            return (
              <motion.button
                key={font.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updatePreferences({ font_family: font.id })}
                className={cn(
                  "relative p-3 rounded-xl border-2 transition-all text-left",
                  isActive 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <span 
                  className="block text-sm font-medium mb-1"
                  style={{ fontFamily: font.preview }}
                >
                  {font.label}
                </span>
                <span 
                  className="block text-xs text-muted-foreground"
                  style={{ fontFamily: font.preview }}
                >
                  Aa Bb Cc 123
                </span>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2"
                  >
                    <Check className="w-4 h-4 text-primary" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Font Size */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">Schriftgröße</h3>
        </div>

        <div className="flex gap-2">
          {FONT_SIZE_OPTIONS.map((size) => {
            const isActive = preferences.font_size === size.id;
            
            return (
              <button
                key={size.id}
                onClick={() => updatePreferences({ font_size: size.id })}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl border-2 transition-all",
                  isActive 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <span 
                  className="block font-medium"
                  style={{ fontSize: size.value }}
                >
                  A
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  {size.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Density */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">UI-Dichte</h3>
        </div>

        <div className="space-y-2">
          {DENSITY_OPTIONS.map((density) => {
            const isActive = preferences.density === density.id;
            const Icon = density.icon;
            
            return (
              <motion.button
                key={density.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => updatePreferences({ density: density.id as 'compact' | 'normal' | 'comfortable' })}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                  isActive 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                )}
              >
                {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
                {!Icon && <div className="w-5 h-5" />}
                
                <div className="flex-1">
                  <span className="font-medium text-foreground">{density.label}</span>
                  <p className="text-xs text-muted-foreground">{density.description}</p>
                </div>

                {isActive && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <Check className="w-5 h-5 text-primary" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div className="glass-card p-4">
        <h3 className="font-medium text-foreground mb-3">Vorschau</h3>
        <div 
          className={cn(
            "p-4 rounded-lg bg-muted/50 border border-border",
            preferences.density === 'compact' && "p-2",
            preferences.density === 'comfortable' && "p-6"
          )}
        >
          <h4 className="font-semibold mb-2">Beispiel-Notiz</h4>
          <p className="text-muted-foreground mb-3">
            Dies ist ein Beispieltext, der zeigt, wie deine Einstellungen aussehen werden. 
            Die Schriftart und -größe sowie die Abstände werden hier angewendet.
          </p>
          <div className="flex gap-2">
            <div className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">Tag 1</div>
            <div className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">Tag 2</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonalizationSettings;
