import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, AlertCircle, Loader2, Key, ArrowLeft, Fingerprint } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useBiometric } from '@/hooks/useBiometric';
import { toast } from 'sonner';

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 10 * 60 * 1000;

export default function Login() {
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { isAvailable: biometricAvailable, isEnabled: biometricEnabled, authenticate: authenticateBiometric } = useBiometric();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const storedLockout = localStorage.getItem('vault_lockout');
    if (storedLockout) {
      const lockoutDate = new Date(storedLockout);
      if (lockoutDate > new Date()) {
        setLockoutUntil(lockoutDate);
      } else {
        localStorage.removeItem('vault_lockout');
      }
    }
    
    const storedAttempts = localStorage.getItem('vault_attempts');
    if (storedAttempts) {
      setAttempts(parseInt(storedAttempts));
    }
  }, []);

  useEffect(() => {
    if (lockoutUntil) {
      const interval = setInterval(() => {
        if (new Date() > lockoutUntil) {
          setLockoutUntil(null);
          setAttempts(0);
          localStorage.removeItem('vault_lockout');
          localStorage.removeItem('vault_attempts');
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutUntil]);

  useEffect(() => {
    const tryBiometric = async () => {
      if (biometricEnabled && !isAuthenticated && !lockoutUntil) {
        setIsBiometricLoading(true);
        try {
          const result = await authenticateBiometric();
          if (result) {
            localStorage.removeItem('vault_attempts');
            localStorage.removeItem('vault_lockout');
            login(result, false, '');
            toast.success('Biometrische Anmeldung erfolgreich');
            navigate('/dashboard', { replace: true });
          }
        } catch (error) {
          console.error('Auto biometric failed:', error);
        } finally {
          setIsBiometricLoading(false);
        }
      }
    };
    
    const timeout = setTimeout(tryBiometric, 500);
    return () => clearTimeout(timeout);
  }, [biometricEnabled, isAuthenticated, lockoutUntil]);

  const handleBiometricLogin = async () => {
    if (!biometricEnabled || lockoutUntil) return;
    
    setIsBiometricLoading(true);
    setError('');
    
    try {
      const result = await authenticateBiometric();
      if (result) {
        localStorage.removeItem('vault_attempts');
        localStorage.removeItem('vault_lockout');
        login(result, false, '');
        toast.success('Biometrische Anmeldung erfolgreich');
        navigate('/dashboard', { replace: true });
      } else {
        setError('Biometrische Authentifizierung fehlgeschlagen');
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      setError('Biometrische Authentifizierung fehlgeschlagen');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const focusInput = (index: number) => {
    if (index >= 0 && index < PIN_LENGTH) {
      inputRefs.current[index]?.focus();
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');

    if (value && index < PIN_LENGTH - 1) {
      focusInput(index + 1);
    }

    if (newPin.every(d => d !== '') && newPin.join('').length === PIN_LENGTH) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handleSubmit = async (pinValue: string) => {
    if (lockoutUntil && new Date() < lockoutUntil) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await supabase.functions.invoke('verify-pin', {
        body: { action: 'verify', pin: pinValue }
      });

      // supabase.functions.invoke always returns data (even on HTTP errors); parse error from JSON body
      const data = response.data;
      const invokeError = response.error;

      if (invokeError) {
        console.error('Edge function error:', invokeError);
        // Try to extract message from context or body
        const errMsg = (invokeError as any)?.context?.body
          ? JSON.parse((invokeError as any).context.body)?.error
          : null;
        throw new Error(errMsg || 'Verbindungsfehler');
      }

      if (data?.success && data?.userId && data?.sessionToken) {
        localStorage.removeItem('vault_attempts');
        localStorage.removeItem('vault_lockout');
        login(data.userId, data.isDecoy || false, data.sessionToken);
        navigate('/dashboard', { replace: true });
      } else {
        throw new Error(data?.error || 'Falscher PIN');
      }

    } catch (err: any) {
      console.error('Login error:', err);
      
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem('vault_attempts', newAttempts.toString());

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockout = new Date(Date.now() + LOCKOUT_DURATION);
        setLockoutUntil(lockout);
        localStorage.setItem('vault_lockout', lockout.toISOString());
        setError(`Zu viele Versuche. Gesperrt für 10 Minuten.`);
      } else {
        setError(err.message || `Falscher PIN. ${MAX_ATTEMPTS - newAttempts} Versuche übrig.`);
      }

      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin(Array(PIN_LENGTH).fill(''));
      focusInput(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverySubmit = async () => {
    if (!recoveryKey.trim()) {
      setError('Bitte Recovery-Key eingeben');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await supabase.functions.invoke('verify-pin', {
        body: { action: 'verify-recovery', recoveryKey: recoveryKey.trim() }
      });

      const data = response.data;
      const invokeError = response.error;

      if (invokeError) {
        console.error('Edge function error:', invokeError);
        const errMsg = (invokeError as any)?.context?.body
          ? JSON.parse((invokeError as any).context.body)?.error
          : null;
        throw new Error(errMsg || 'Verbindungsfehler');
      }

      if (data?.success && data?.userId && data?.sessionToken) {
        localStorage.removeItem('vault_attempts');
        localStorage.removeItem('vault_lockout');
        login(data.userId, false, data.sessionToken);
        navigate('/dashboard', { replace: true });
      } else {
        throw new Error(data?.error || 'Ungültiger Recovery-Key');
      }

    } catch (err: any) {
      console.error('Recovery error:', err);
      setError(err.message || 'Ungültiger Recovery-Key');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  const getRemainingLockoutTime = () => {
    if (!lockoutUntil) return '';
    const remaining = Math.max(0, lockoutUntil.getTime() - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Subtle background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          "w-full max-w-sm p-8 rounded-2xl bg-card border border-border",
          shake && "animate-[shake_0.5s_ease-in-out]"
        )}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {!showRecovery ? (
            <motion.div
              key="pin-entry"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-xl font-display font-semibold text-foreground mb-1">
                  Private Vault
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gib deinen 6-stelligen PIN ein
                </p>
              </div>

              {/* PIN Input */}
              <div className="flex justify-center gap-2.5 mb-6">
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={isLoading || !!lockoutUntil}
                    className={cn(
                      "w-11 h-13 text-center text-xl font-semibold rounded-xl transition-all",
                      "bg-muted border border-border text-foreground",
                      "focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none",
                      digit && "border-primary/50"
                    )}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center justify-center gap-2 mb-4 text-destructive"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lockout */}
              {lockoutUntil && (
                <div className="text-center mb-4">
                  <span className="text-sm text-muted-foreground">
                    Entsperrt in: <span className="text-primary font-mono">{getRemainingLockoutTime()}</span>
                  </span>
                </div>
              )}

              {/* Loading */}
              {isLoading && (
                <div className="flex justify-center mb-4">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              )}

              {/* Biometric */}
              {biometricEnabled && !lockoutUntil && (
                <button
                  onClick={handleBiometricLogin}
                  disabled={isBiometricLoading || isLoading}
                  className="w-full py-3 mb-4 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isBiometricLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Fingerprint className="w-5 h-5" />
                      <span>Mit Biometrie</span>
                    </>
                  )}
                </button>
              )}

              {/* Recovery Link */}
              <button
                onClick={() => {
                  setShowRecovery(true);
                  setError('');
                }}
                className="w-full text-center text-muted-foreground hover:text-foreground text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                Mit Recovery-Key anmelden
              </button>

            </motion.div>
          ) : (
            <motion.div
              key="recovery-entry"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-xl font-display font-semibold text-foreground mb-1">
                  Recovery-Key
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gib deinen Recovery-Key ein
                </p>
              </div>

              {/* Input */}
              <textarea
                value={recoveryKey}
                onChange={(e) => {
                  setRecoveryKey(e.target.value);
                  setError('');
                }}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                disabled={isLoading}
                className="w-full h-20 p-3 mb-4 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none font-mono text-center text-sm"
              />

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center justify-center gap-2 mb-4 text-destructive"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                onClick={handleRecoverySubmit}
                disabled={isLoading || !recoveryKey.trim()}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mb-4"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Key className="w-5 h-5" />
                    Anmelden
                  </>
                )}
              </button>

              {/* Back */}
              <button
                onClick={() => {
                  setShowRecovery(false);
                  setError('');
                  setRecoveryKey('');
                }}
                className="w-full text-center text-muted-foreground hover:text-foreground text-sm transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Zurück zur PIN-Eingabe
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mt-8">
          <Lock className="w-3 h-3" />
          <span>Ende-zu-Ende verschlüsselt</span>
        </div>
      </motion.div>
    </div>
  );
}