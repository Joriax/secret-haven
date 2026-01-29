import React, { useState, useEffect } from 'react';
import { 
  Lock, Shield, Key, EyeOff, Fingerprint, 
  Loader2, CheckCircle, AlertCircle, Copy, RefreshCw 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useBiometric } from '@/hooks/useBiometric';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PIN_LENGTH = 6;

export const SecuritySettings: React.FC = () => {
  const [showPinChange, setShowPinChange] = useState(false);
  const [showDecoyPin, setShowDecoyPin] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [decoyPin, setDecoyPin] = useState('');
  const [confirmDecoyPin, setConfirmDecoyPin] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricRegistering, setIsBiometricRegistering] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const { userId, sessionToken } = useAuth();
  const { 
    isAvailable: biometricAvailable, 
    isEnabled: biometricEnabled, 
    register: registerBiometric, 
    disable: disableBiometric 
  } = useBiometric();

  // Fetch existing recovery key
  useEffect(() => {
    const fetchRecoveryKey = async () => {
      if (!userId || !sessionToken) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('verify-pin', {
          body: { action: 'get-recovery-key', sessionToken }
        });
        
        if (!error && data?.success && data?.recoveryKey) {
          setRecoveryKey(data.recoveryKey);
        }
      } catch (err) {
        console.error('Failed to fetch recovery key:', err);
      }
    };
    fetchRecoveryKey();
  }, [userId, sessionToken]);

  const handleBiometricToggle = async (enabled: boolean) => {
    if (enabled && userId) {
      setIsBiometricRegistering(true);
      try {
        const success = await registerBiometric(userId);
        if (success) {
          toast.success('Biometrische Authentifizierung aktiviert');
        } else {
          toast.error('Biometrie-Registrierung fehlgeschlagen');
        }
      } catch (error) {
        toast.error('Biometrie-Registrierung fehlgeschlagen');
      } finally {
        setIsBiometricRegistering(false);
      }
    } else {
      disableBiometric();
      toast.success('Biometrische Authentifizierung deaktiviert');
    }
  };

  const handlePinChange = async () => {
    setMessage(null);

    if (currentPin.length !== PIN_LENGTH || !/^\d+$/.test(currentPin)) {
      setMessage({ type: 'error', text: 'Aktueller PIN muss 6 Ziffern haben' });
      return;
    }
    if (newPin.length !== PIN_LENGTH || !/^\d+$/.test(newPin)) {
      setMessage({ type: 'error', text: 'Neuer PIN muss 6 Ziffern haben' });
      return;
    }
    if (newPin !== confirmPin) {
      setMessage({ type: 'error', text: 'PINs stimmen nicht überein' });
      return;
    }
    if (currentPin === newPin) {
      setMessage({ type: 'error', text: 'Neuer PIN muss anders sein' });
      return;
    }

    if (!sessionToken) {
      setMessage({ type: 'error', text: 'Session abgelaufen – bitte neu anmelden' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('verify-pin', {
        body: { action: 'change', pin: currentPin, newPin, sessionToken }
      });

      const data = response.data;
      const invokeError = response.error;

      if (invokeError) {
        const errMsg = (invokeError as any)?.context?.body
          ? JSON.parse((invokeError as any).context.body)?.error
          : null;
        throw new Error(errMsg || 'Verbindungsfehler');
      }

      if (data?.success) {
        setMessage({ type: 'success', text: 'PIN erfolgreich geändert!' });
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => setShowPinChange(false), 2000);
      } else {
        throw new Error(data?.error || 'PIN-Änderung fehlgeschlagen');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Fehler beim Ändern des PINs' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDecoyPin = async () => {
    setMessage(null);

    if (currentPin.length !== PIN_LENGTH || !/^\d+$/.test(currentPin)) {
      setMessage({ type: 'error', text: 'Aktueller PIN muss 6 Ziffern haben' });
      return;
    }
    if (decoyPin.length !== PIN_LENGTH || !/^\d+$/.test(decoyPin)) {
      setMessage({ type: 'error', text: 'Tarn-PIN muss 6 Ziffern haben' });
      return;
    }
    if (decoyPin !== confirmDecoyPin) {
      setMessage({ type: 'error', text: 'Tarn-PINs stimmen nicht überein' });
      return;
    }
    if (currentPin === decoyPin) {
      setMessage({ type: 'error', text: 'Tarn-PIN muss anders als Haupt-PIN sein' });
      return;
    }

    if (!sessionToken) {
      setMessage({ type: 'error', text: 'Session abgelaufen – bitte neu anmelden' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('verify-pin', {
        body: { action: 'set-decoy', pin: currentPin, newPin: decoyPin, sessionToken }
      });

      const data = response.data;
      const invokeError = response.error;

      if (invokeError) {
        const errMsg = (invokeError as any)?.context?.body
          ? JSON.parse((invokeError as any).context.body)?.error
          : null;
        throw new Error(errMsg || 'Verbindungsfehler');
      }

      if (data?.success) {
        setMessage({ type: 'success', text: 'Tarn-PIN erfolgreich gesetzt!' });
        setCurrentPin('');
        setDecoyPin('');
        setConfirmDecoyPin('');
        setTimeout(() => setShowDecoyPin(false), 2000);
        toast.success('Tarn-PIN aktiviert', { description: 'Bei Eingabe des Tarn-PINs wird ein leerer Vault angezeigt.' });
      } else {
        throw new Error(data?.error || 'Tarn-PIN konnte nicht gesetzt werden');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Fehler beim Setzen des Tarn-PINs' });
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewRecoveryKey = async () => {
    if (!userId || !sessionToken) return;

    const currentPinInput = prompt('Gib deinen aktuellen 6-stelligen PIN ein, um einen neuen Recovery-Key zu generieren:');
    if (!currentPinInput || currentPinInput.length !== 6 || !/^\d+$/.test(currentPinInput)) {
      toast.error('Gültiger 6-stelliger PIN erforderlich');
      return;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('verify-pin', {
        body: { 
          action: 'generate-recovery-key',
          pin: currentPinInput,
          sessionToken 
        }
      });

      const data = response.data;
      if (response.error) throw new Error('Verbindungsfehler');

      if (data?.success && data?.recoveryKey) {
        setRecoveryKey(data.recoveryKey);
        toast.success('Recovery-Key generiert', { description: 'Speichere ihn sicher ab!' });
      } else {
        throw new Error(data?.error || 'Fehler beim Generieren des Recovery-Keys');
      }
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Generieren des Recovery-Keys');
    } finally {
      setIsLoading(false);
    }
  };

  const copyRecoveryKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    toast.success('Recovery-Key kopiert');
  };

  return (
    <div className="space-y-4">
      {/* Biometric Authentication */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Fingerprint className="w-5 h-5 text-green-500" />
          <h3 className="text-base font-semibold text-foreground">Biometrie</h3>
        </div>

        <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-muted/30">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={cn(
              "w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center",
              biometricAvailable ? "bg-green-500/20" : "bg-muted"
            )}>
              <Fingerprint className={cn(
                "w-4 h-4 sm:w-5 sm:h-5",
                biometricAvailable ? "text-green-500" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <h4 className="font-medium text-foreground text-sm sm:text-base">Touch/Face ID</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {biometricAvailable 
                  ? "Schneller Zugang per Biometrie"
                  : "Nicht verfügbar"
                }
              </p>
            </div>
          </div>
          <Switch
            checked={biometricEnabled}
            onCheckedChange={handleBiometricToggle}
            disabled={isBiometricRegistering || !biometricAvailable}
          />
        </div>
      </div>

      {/* PIN & Security */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-purple-500" />
          <h3 className="text-base font-semibold text-foreground">PIN & Zugang</h3>
        </div>

        <div className="space-y-3">
          {/* Change PIN */}
          <button
            onClick={() => { setShowPinChange(!showPinChange); setShowDecoyPin(false); setShowRecoveryKey(false); setMessage(null); }}
            className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
              </div>
              <div className="text-left">
                <h4 className="font-medium text-foreground text-sm sm:text-base">PIN ändern</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">6-stelliger Zugangs-PIN</p>
              </div>
            </div>
            <span className={cn("text-muted-foreground transition-transform text-sm", showPinChange && "rotate-180")}>▼</span>
          </button>

          {showPinChange && (
            <div className="p-3 sm:p-4 space-y-3 bg-muted/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-2">Aktueller PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground/50 text-center tracking-widest"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-2">Neuer PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground/50 text-center tracking-widest"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-2">PIN bestätigen</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground/50 text-center tracking-widest"
                />
              </div>

              {message && (
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg animate-in fade-in duration-150 text-sm",
                  message.type === 'success' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                )}>
                  {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{message.text}</span>
                </div>
              )}

              <button
                onClick={handlePinChange}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" /> : (
                  <>
                    <Lock className="w-4 h-4 text-primary-foreground" />
                    <span className="text-primary-foreground font-medium">PIN ändern</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Decoy PIN */}
          <button
            onClick={() => { setShowDecoyPin(!showDecoyPin); setShowPinChange(false); setShowRecoveryKey(false); setMessage(null); }}
            className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <EyeOff className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
              </div>
              <div className="text-left">
                <h4 className="font-medium text-foreground text-sm sm:text-base">Tarn-PIN</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">Fake Vault für Notfälle</p>
              </div>
            </div>
            <span className={cn("text-muted-foreground transition-transform text-sm", showDecoyPin && "rotate-180")}>▼</span>
          </button>

          {showDecoyPin && (
            <div className="p-3 sm:p-4 space-y-3 bg-muted/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-yellow-500 text-xs sm:text-sm">
                  Der Tarn-PIN zeigt einen leeren Vault an.
                </p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-2">Haupt-PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground/50 text-center tracking-widest"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-2">Tarn-PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={decoyPin}
                  onChange={(e) => setDecoyPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground/50 text-center tracking-widest"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-2">Tarn-PIN bestätigen</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmDecoyPin}
                  onChange={(e) => setConfirmDecoyPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl vault-input text-foreground placeholder:text-muted-foreground/50 text-center tracking-widest"
                />
              </div>

              {message && (
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg animate-in fade-in duration-150 text-sm",
                  message.type === 'success' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                )}>
                  {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{message.text}</span>
                </div>
              )}

              <button
                onClick={handleSetDecoyPin}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" /> : (
                  <>
                    <EyeOff className="w-4 h-4 text-primary-foreground" />
                    <span className="text-primary-foreground font-medium">Tarn-PIN aktivieren</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Recovery Key */}
          <button
            onClick={() => { setShowRecoveryKey(!showRecoveryKey); setShowPinChange(false); setShowDecoyPin(false); }}
            className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Key className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div className="text-left">
                <h4 className="font-medium text-foreground text-sm sm:text-base">Recovery-Key</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">Notfall-Backup</p>
              </div>
            </div>
            <span className={cn("text-muted-foreground transition-transform text-sm", showRecoveryKey && "rotate-180")}>▼</span>
          </button>

          {showRecoveryKey && (
            <div className="p-3 sm:p-4 space-y-3 bg-muted/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              {recoveryKey ? (
                <>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-blue-500 text-xs sm:text-sm mb-2">Dein Recovery-Schlüssel:</p>
                    <div className="font-mono text-sm sm:text-lg text-foreground bg-background/50 p-3 rounded-lg text-center break-all">
                      {recoveryKey}
                    </div>
                  </div>
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={copyRecoveryKey}
                      className="flex-1 py-2.5 sm:py-3 rounded-xl border border-border hover:bg-muted/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4 text-foreground" />
                      <span className="text-foreground text-sm">Kopieren</span>
                    </button>
                    <button
                      onClick={generateNewRecoveryKey}
                      disabled={isLoading}
                      className="flex-1 py-2.5 sm:py-3 rounded-xl border border-border hover:bg-muted/30 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={cn("w-4 h-4 text-foreground", isLoading && "animate-spin")} />
                      <span className="text-foreground text-sm">Neu</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Generiere einen Recovery-Schlüssel für Notfallzugriff.
                  </p>
                  <button
                    onClick={generateNewRecoveryKey}
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" /> : (
                      <>
                        <Key className="w-4 h-4 text-primary-foreground" />
                        <span className="text-primary-foreground font-medium">Generieren</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
