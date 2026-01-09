import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export const PWAUpdatePrompt: React.FC = () => {
  const { showUpdatePrompt, updateApp, dismissUpdate } = usePWAUpdate();

  return (
    <AnimatePresence>
      {showUpdatePrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md"
        >
          <div className="bg-card border border-border rounded-xl shadow-2xl p-4 backdrop-blur-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm">
                  Neue Version verfügbar
                </h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Eine neue Version der App ist bereit. Jetzt aktualisieren für die neuesten Funktionen.
                </p>
                
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={updateApp}
                    className="flex-1 gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Jetzt aktualisieren
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={dismissUpdate}
                    className="px-3"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
