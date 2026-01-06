import React from 'react';
import { motion } from 'framer-motion';
import { Palette, Check } from 'lucide-react';
import { useThemeCustomizer } from '@/hooks/useThemeCustomizer';
import { cn } from '@/lib/utils';

export function ThemeCustomizer() {
  const { currentTheme, themes, setTheme } = useThemeCustomizer();

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <Palette className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Farbschema</h2>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {themes.map((theme) => {
          const isActive = currentTheme === theme.id;
          // Convert HSL string to CSS
          const primaryHsl = `hsl(${theme.primary})`;
          
          return (
            <motion.button
              key={theme.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTheme(theme.id)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
                "border-2",
                isActive 
                  ? "border-primary bg-primary/10" 
                  : "border-transparent bg-muted/50 hover:bg-muted"
              )}
            >
              <div 
                className="w-10 h-10 rounded-full relative"
                style={{ backgroundColor: primaryHsl }}
              >
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Check className="w-5 h-5 text-white" />
                  </motion.div>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {theme.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
