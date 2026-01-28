import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVoiceCommands } from '@/hooks/useVoiceCommands';
import { cn } from '@/lib/utils';

interface VoiceCommandButtonProps {
  className?: string;
  showInline?: boolean;
}

export function VoiceCommandButton({ className, showInline = false }: VoiceCommandButtonProps) {
  const [showHelp, setShowHelp] = useState(false);
  const {
    isSupported,
    isListening,
    transcript,
    toggleListening,
    availableCommands,
  } = useVoiceCommands();

  if (!isSupported) {
    return null;
  }

  return (
    <>
      {/* Floating Button or Inline Button */}
      {showInline ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleListening}
          className={cn(
            "relative",
            isListening && "text-primary",
            className
          )}
        >
          {isListening ? (
            <Mic className="w-5 h-5 animate-pulse" />
          ) : (
            <MicOff className="w-5 h-5" />
          )}
        </Button>
      ) : (
        <motion.div
          className={cn(
            "fixed bottom-24 right-4 z-40",
            className
          )}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="relative">
            {/* Pulsing ring when listening */}
            <AnimatePresence>
              {isListening && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/30"
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </AnimatePresence>

            <Button
              size="icon"
              className={cn(
                "h-14 w-14 rounded-full shadow-lg",
                isListening 
                  ? "bg-primary hover:bg-primary/90" 
                  : "bg-muted hover:bg-muted/90"
              )}
              onClick={toggleListening}
            >
              {isListening ? (
                <Mic className="w-6 h-6 animate-pulse" />
              ) : (
                <MicOff className="w-6 h-6" />
              )}
            </Button>

            {/* Help button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-muted"
              onClick={() => setShowHelp(true)}
            >
              <HelpCircle className="w-3 h-3" />
            </Button>
          </div>

          {/* Transcript bubble */}
          <AnimatePresence>
            {isListening && transcript && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className="absolute bottom-full right-0 mb-2 p-3 rounded-lg bg-card border border-border shadow-lg max-w-xs"
              >
                <p className="text-sm text-foreground italic">"{transcript}"</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" />
              Sprachbefehle
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tippe auf das Mikrofon und sage einen der folgenden Befehle:
            </p>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {availableCommands.map((command, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {command.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sag: "{command.phrases[0]}"
                      {command.phrases.length > 1 && (
                        <span className="text-muted-foreground/60">
                          {' '}oder "{command.phrases[1]}"
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-3 rounded-lg bg-primary/10 text-sm">
              <p className="text-primary font-medium">Tipp:</p>
              <p className="text-muted-foreground mt-1">
                Sprich deutlich und warte kurz nach dem Tippen auf das Mikrofon.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default VoiceCommandButton;
