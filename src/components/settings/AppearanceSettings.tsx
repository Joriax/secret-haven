import React from 'react';
import { Palette, AlertCircle } from 'lucide-react';
import { FullThemeCustomizer } from '@/components/FullThemeCustomizer';
import { IconPackSelector } from '@/components/IconPackSelector';
import { CustomCSSEditor } from '@/components/CustomCSSEditor';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const sectionFallback = (title: string) => (
  <div className="p-4 rounded-xl bg-muted/30 border border-border">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-4 h-4 text-destructive" />
      <p className="text-sm text-foreground font-medium">{title} konnte nicht geladen werden</p>
    </div>
    <p className="text-sm text-muted-foreground mt-2">
      Bitte Seite neu laden oder später erneut versuchen.
    </p>
  </div>
);

export const AppearanceSettings: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Theme Customizer */}
      <div className="glass-card p-4 sm:p-6">
        <ErrorBoundary fallback={sectionFallback('Theme-Einstellungen')}>
          <FullThemeCustomizer />
        </ErrorBoundary>
      </div>

      {/* Icon Pack Selector */}
      <div className="glass-card p-4 sm:p-6">
        <ErrorBoundary fallback={sectionFallback('Icon-Pakete')}>
          <IconPackSelector />
        </ErrorBoundary>
      </div>

      {/* Custom CSS Editor */}
      <div className="glass-card p-4 sm:p-6">
        <ErrorBoundary fallback={sectionFallback('Custom CSS')}>
          <CustomCSSEditor />
        </ErrorBoundary>
      </div>
    </div>
  );
};
