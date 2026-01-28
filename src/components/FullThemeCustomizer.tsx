import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor, Clock, Check } from 'lucide-react';
import { useFullTheme } from '@/hooks/useFullTheme';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function FullThemeCustomizer() {
  const { themes, currentTheme, settings, setTheme, setUseSystemTheme, setScheduledMode } = useFullTheme();

  const darkThemes = themes.filter(t => t.mode === 'dark');
  const lightThemes = themes.filter(t => t.mode === 'light');

  return (
    <div className="space-y-6">
      {/* Mode Options */}
      <div className="glass-card p-4 space-y-4">
        <h3 className="font-medium text-foreground">Modus</h3>
        
        {/* System Theme Toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <Monitor className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">System-Theme</p>
              <p className="text-xs text-muted-foreground">Automatisch an Systemeinstellung anpassen</p>
            </div>
          </div>
          <Switch
            checked={settings.useSystemTheme}
            onCheckedChange={setUseSystemTheme}
          />
        </label>

        {/* Scheduled Mode Toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Zeitgesteuert</p>
              <p className="text-xs text-muted-foreground">
                Hell: {settings.lightStartHour}:00 - {settings.darkStartHour}:00
              </p>
            </div>
          </div>
          <Switch
            checked={settings.scheduledMode}
            onCheckedChange={(checked) => setScheduledMode(checked)}
          />
        </label>
      </div>

      {/* Dark Themes */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Moon className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">Dunkle Themes</h3>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {darkThemes.map((theme) => {
            const isActive = currentTheme.id === theme.id;
            
            return (
              <motion.button
                key={theme.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTheme(theme.id)}
                className={cn(
                  "relative p-3 rounded-xl border-2 transition-all overflow-hidden",
                  isActive 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-primary/50"
                )}
              >
                {/* Theme Preview */}
                <div 
                  className="h-16 rounded-lg mb-2 relative"
                  style={{ backgroundColor: `hsl(${theme.colors.background})` }}
                >
                  <div 
                    className="absolute bottom-2 left-2 right-2 h-3 rounded"
                    style={{ backgroundColor: `hsl(${theme.colors.card})` }}
                  />
                  <div 
                    className="absolute top-2 left-2 w-6 h-2 rounded"
                    style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{theme.name}</span>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <Check className="w-4 h-4 text-primary" />
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Light Themes */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sun className="w-5 h-5 text-yellow-500" />
          <h3 className="font-medium text-foreground">Helle Themes</h3>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {lightThemes.map((theme) => {
            const isActive = currentTheme.id === theme.id;
            
            return (
              <motion.button
                key={theme.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTheme(theme.id)}
                className={cn(
                  "relative p-3 rounded-xl border-2 transition-all overflow-hidden",
                  isActive 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-primary/50"
                )}
              >
                {/* Theme Preview */}
                <div 
                  className="h-16 rounded-lg mb-2 relative border"
                  style={{ 
                    backgroundColor: `hsl(${theme.colors.background})`,
                    borderColor: `hsl(${theme.colors.border})`
                  }}
                >
                  <div 
                    className="absolute bottom-2 left-2 right-2 h-3 rounded border"
                    style={{ 
                      backgroundColor: `hsl(${theme.colors.card})`,
                      borderColor: `hsl(${theme.colors.border})`
                    }}
                  />
                  <div 
                    className="absolute top-2 left-2 w-6 h-2 rounded"
                    style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{theme.name}</span>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <Check className="w-4 h-4 text-primary" />
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
