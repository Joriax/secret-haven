import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, RotateCcw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardWidget } from '@/hooks/useDashboardWidgets';

interface WidgetCustomizerProps {
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onReset: () => void;
  widgets: DashboardWidget[];
}

export const WidgetCustomizer: React.FC<WidgetCustomizerProps> = ({
  isEditing,
  onStartEditing,
  onStopEditing,
  onReset,
}) => {
  return (
    <AnimatePresence mode="wait">
      {isEditing ? (
        <motion.div
          key="editing"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center gap-2"
        >
          <span className="text-xs text-muted-foreground mr-2">
            Widgets anordnen
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            className="h-8"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Zurücksetzen
          </Button>
          <Button
            size="sm"
            onClick={onStopEditing}
            className="h-8 bg-primary"
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            Fertig
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="not-editing"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={onStartEditing}
            className="h-8 text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="w-3.5 h-3.5 mr-1" />
            Anpassen
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
