import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Trash2, 
  Shield, 
  CheckCircle, 
  X, 
  Loader2,
  KeyRound,
  Type,
  FileWarning
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 1 | 2 | 3 | 4;

const CONFIRMATION_PHRASE = 'KONTO LÖSCHEN';

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({ open, onOpenChange }) => {
  const [step, setStep] = useState<Step>(1);
  const [pin, setPin] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [checkboxes, setCheckboxes] = useState({
    understandPermanent: false,
    understandNoRecovery: false,
    understandDataLoss: false,
  });
  const [finalConfirmation, setFinalConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { sessionToken, logout } = useAuth();
  const navigate = useNavigate();

  const resetState = useCallback(() => {
    setStep(1);
    setPin('');
    setConfirmPhrase('');
    setCheckboxes({
      understandPermanent: false,
      understandNoRecovery: false,
      understandDataLoss: false,
    });
    setFinalConfirmation(false);
    setError(null);
  }, []);

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const allCheckboxesChecked = 
    checkboxes.understandPermanent && 
    checkboxes.understandNoRecovery && 
    checkboxes.understandDataLoss;

  const isPhraseCorrect = confirmPhrase.trim().toUpperCase() === CONFIRMATION_PHRASE;

  const handleDeleteAccount = async () => {
    if (!sessionToken || !pin || pin.length !== 6) {
      setError('Gültiger 6-stelliger PIN erforderlich');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'delete-account',
          pin,
          sessionToken,
          confirmPhrase: CONFIRMATION_PHRASE
        }
      });

      if (response.error) {
        throw new Error('Verbindungsfehler');
      }

      const data = response.data;

      if (data?.success) {
        toast.success('Konto wurde vollständig gelöscht', {
          description: 'Alle deine Daten wurden unwiderruflich entfernt.'
        });
        
        // Clear everything and logout
        sessionStorage.clear();
        localStorage.clear();
        logout();
        navigate('/login', { replace: true });
      } else {
        throw new Error(data?.error || 'Kontolöschung fehlgeschlagen');
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Kontos');
      setIsDeleting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-destructive">Warnung: Unwiderrufliche Aktion</h4>
                  <p className="text-sm text-muted-foreground">
                    Das Löschen deines Kontos ist permanent und kann nicht rückgängig gemacht werden. 
                    Alle deine Daten werden vollständig und unwiderruflich gelöscht.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Schritt 1: Bestätige dein Verständnis
              </h4>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={checkboxes.understandPermanent}
                    onCheckedChange={(checked) => 
                      setCheckboxes(prev => ({ ...prev, understandPermanent: checked === true }))
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground">
                    Ich verstehe, dass diese Aktion <strong>permanent</strong> ist und nicht rückgängig gemacht werden kann.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={checkboxes.understandNoRecovery}
                    onCheckedChange={(checked) => 
                      setCheckboxes(prev => ({ ...prev, understandNoRecovery: checked === true }))
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground">
                    Ich verstehe, dass keine Wiederherstellung möglich ist – auch nicht mit einem Recovery-Key.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={checkboxes.understandDataLoss}
                    onCheckedChange={(checked) => 
                      setCheckboxes(prev => ({ ...prev, understandDataLoss: checked === true }))
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground">
                    Ich verstehe, dass alle meine <strong>Notizen, Fotos, Dateien, Links, TikToks und geheimen Texte</strong> gelöscht werden.
                  </span>
                </label>
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!allCheckboxesChecked}
              className="w-full"
              variant="destructive"
            >
              Weiter zu Schritt 2
            </Button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <Type className="w-4 h-4 text-primary" />
                Schritt 2: Bestätigungsphrase eingeben
              </h4>
              
              <p className="text-sm text-muted-foreground">
                Gib zur Bestätigung folgenden Text ein:
              </p>
              
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                <code className="text-destructive font-mono font-bold text-lg">
                  {CONFIRMATION_PHRASE}
                </code>
              </div>

              <Input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="Phrase hier eingeben..."
                className="text-center font-mono"
              />

              {confirmPhrase && !isPhraseCorrect && (
                <p className="text-sm text-destructive text-center">
                  Phrase stimmt nicht überein
                </p>
              )}
              {isPhraseCorrect && (
                <p className="text-sm text-green-500 text-center flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Phrase korrekt
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                Zurück
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!isPhraseCorrect}
                variant="destructive"
                className="flex-1"
              >
                Weiter zu Schritt 3
              </Button>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                Schritt 3: PIN-Verifizierung
              </h4>
              
              <p className="text-sm text-muted-foreground">
                Gib deinen 6-stelligen PIN ein, um deine Identität zu bestätigen:
              </p>

              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="text-center tracking-widest text-xl"
              />

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep(2)} variant="outline" className="flex-1">
                Zurück
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  setStep(4);
                }}
                disabled={pin.length !== 6}
                variant="destructive"
                className="flex-1"
              >
                Weiter zu Schritt 4
              </Button>
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="p-4 rounded-xl bg-destructive/20 border border-destructive/30">
              <div className="flex items-start gap-3">
                <FileWarning className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-destructive">Letzte Warnung!</h4>
                  <p className="text-sm text-foreground">
                    Dies ist deine letzte Chance abzubrechen. Nach Bestätigung werden alle Daten 
                    <strong> sofort und unwiderruflich gelöscht</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 space-y-2">
              <h5 className="font-medium text-foreground text-sm">Was gelöscht wird:</h5>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Alle Notizen und Notiz-Anhänge</li>
                <li>Alle Fotos und Alben</li>
                <li>Alle Dateien und Datei-Ordner</li>
                <li>Alle gespeicherten Links</li>
                <li>Alle TikTok-Videos</li>
                <li>Alle geheimen Texte</li>
                <li>Alle Tags und Ordner</li>
                <li>Dein gesamtes Benutzerkonto</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 cursor-pointer">
              <Checkbox
                checked={finalConfirmation}
                onCheckedChange={(checked) => setFinalConfirmation(checked === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground font-medium">
                Ja, ich bin mir absolut sicher. Lösche mein Konto und alle meine Daten permanent.
              </span>
            </label>

            {error && (
              <p className="text-sm text-destructive text-center p-3 bg-destructive/10 rounded-lg">{error}</p>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep(3)} variant="outline" className="flex-1" disabled={isDeleting}>
                Zurück
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={!finalConfirmation || isDeleting}
                variant="destructive"
                className="flex-1"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Lösche...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Endgültig löschen
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Konto löschen
          </DialogTitle>
          <DialogDescription>
            Schritt {step} von 4 – Vierfache Sicherheitsbestätigung
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                s <= step ? "bg-destructive" : "bg-muted"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
