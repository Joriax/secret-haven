import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Pause, Play, Square, Save, X, Loader2 } from 'lucide-react';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (voiceNote: { id: string; title: string }) => void;
  folderId?: string;
}

export function VoiceRecorder({ open, onClose, onSaved, folderId }: VoiceRecorderProps) {
  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    saveVoiceNote,
  } = useVoiceRecording();

  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      toast.error('Mikrofon-Zugriff verweigert');
    }
  };

  const handleStopRecording = async () => {
    const blob = await stopRecording();
    setRecordedBlob(blob);
  };

  const handleSave = async () => {
    if (!recordedBlob) return;
    
    setIsSaving(true);
    const result = await saveVoiceNote(recordedBlob, title, { folderId });
    setIsSaving(false);

    if (result) {
      toast.success('Sprachnotiz gespeichert');
      onSaved?.({ id: result.id, title: result.title });
      handleClose();
    } else {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleClose = () => {
    if (isRecording) {
      cancelRecording();
    }
    setTitle('');
    setRecordedBlob(null);
    onClose();
  };

  const handleDiscard = () => {
    cancelRecording();
    setRecordedBlob(null);
    setTitle('');
  };

  // Generate waveform bars based on audio level
  const waveformBars = Array.from({ length: 20 }, (_, i) => {
    const baseHeight = 0.2;
    const centerIndex = 10;
    const distance = Math.abs(i - centerIndex) / centerIndex;
    const heightMultiplier = 1 - distance * 0.5;
    const randomVariation = Math.random() * 0.3;
    const height = (baseHeight + audioLevel * heightMultiplier + randomVariation) * 100;
    return Math.min(100, Math.max(10, height));
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {recordedBlob ? 'Aufnahme speichern' : 'Sprachnotiz aufnehmen'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Waveform Visualization */}
          <div className="h-24 flex items-center justify-center gap-1 bg-muted/30 rounded-xl px-4">
            {isRecording && !isPaused ? (
              waveformBars.map((height, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 bg-primary rounded-full"
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.1 }}
                />
              ))
            ) : recordedBlob ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mic className="w-6 h-6" />
                <span>Aufnahme bereit zum Speichern</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mic className="w-6 h-6" />
                <span>Drücke Start zum Aufnehmen</span>
              </div>
            )}
          </div>

          {/* Duration Display */}
          <div className="text-center">
            <span className="text-4xl font-mono font-bold text-foreground">
              {formatDuration(duration)}
            </span>
            {isRecording && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-destructive"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-sm text-destructive">
                  {isPaused ? 'Pausiert' : 'Aufnahme läuft...'}
                </span>
              </div>
            )}
          </div>

          {/* Title Input (when recording is done) */}
          <AnimatePresence>
            {recordedBlob && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titel der Aufnahme (optional)"
                  className="vault-input"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {!isRecording && !recordedBlob && (
              <Button
                onClick={handleStartRecording}
                size="lg"
                className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
              >
                <Mic className="w-6 h-6" />
              </Button>
            )}

            {isRecording && (
              <>
                <Button
                  onClick={handleDiscard}
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>

                <Button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  variant="outline"
                  size="lg"
                  className="h-14 w-14 rounded-full"
                >
                  {isPaused ? (
                    <Play className="w-5 h-5" />
                  ) : (
                    <Pause className="w-5 h-5" />
                  )}
                </Button>

                <Button
                  onClick={handleStopRecording}
                  size="lg"
                  className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90"
                >
                  <Square className="w-6 h-6" />
                </Button>
              </>
            )}

            {recordedBlob && (
              <>
                <Button
                  onClick={handleDiscard}
                  variant="outline"
                  className="h-12"
                >
                  <X className="w-4 h-4 mr-2" />
                  Verwerfen
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-12 bg-primary"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Speichern
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
