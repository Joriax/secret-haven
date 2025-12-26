import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share, Plus, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';

export const PWAInstallPrompt = () => {
  const { isInstallable, isInstalled, isIOS, isSafari, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('pwa_prompt_dismissed') === 'true';
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      handleDismiss();
    }
  };

  // Don't show if already installed or dismissed
  if (isInstalled || isDismissed) return null;

  // iOS Safari specific instructions
  if (isIOS && isSafari) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-4 left-4 right-4 z-50"
        >
          <div className="glass-card p-4 rounded-2xl border border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold mb-1">App installieren</h3>
                {!isExpanded ? (
                  <p className="text-white/60 text-sm">
                    Installiere Private Vault auf deinem Homescreen
                  </p>
                ) : (
                  <div className="text-white/60 text-sm space-y-2">
                    <p className="flex items-center gap-2">
                      <Share className="w-4 h-4" />
                      1. Tippe auf "Teilen"
                    </p>
                    <p className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      2. Wähle "Zum Home-Bildschirm"
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleDismiss}
                className="text-white/40 hover:text-white/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {!isExpanded && (
              <Button
                onClick={() => setIsExpanded(true)}
                className="w-full mt-3 bg-gradient-primary hover:opacity-90"
              >
                Anleitung zeigen
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Standard install prompt for other browsers
  if (!isInstallable) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-4 left-4 right-4 z-50"
      >
        <div className="glass-card p-4 rounded-2xl border border-white/10">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold mb-1">App installieren</h3>
              <p className="text-white/60 text-sm">
                Installiere Private Vault für schnelleren Zugriff
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/40 hover:text-white/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Button
            onClick={handleInstall}
            className="w-full mt-3 bg-gradient-primary hover:opacity-90"
          >
            <Download className="w-4 h-4 mr-2" />
            Jetzt installieren
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
