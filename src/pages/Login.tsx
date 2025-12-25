import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, AlertCircle, Loader2, Key, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 10 * 60 * 1000; // 10 minutes

export default function Login() {
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Check for existing lockout
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

    // Auto-submit when all digits entered
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
      // Call edge function for secure PIN verification
      const { data, error: invokeError } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'verify', pin: pinValue }
      });

      if (invokeError) {
        console.error('Edge function error:', invokeError);
        throw new Error('Verbindungsfehler');
      }

      if (data?.success && data?.userId) {
        localStorage.removeItem('vault_attempts');
        localStorage.removeItem('vault_lockout');
        login(data.userId, data.isDecoy || false);
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
      const { data, error: invokeError } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'verify-recovery', recoveryKey: recoveryKey.trim() }
      });

      if (invokeError) {
        console.error('Edge function error:', invokeError);
        throw new Error('Verbindungsfehler');
      }

      if (data?.success && data?.userId) {
        localStorage.removeItem('vault_attempts');
        localStorage.removeItem('vault_lockout');
        login(data.userId, false);
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-vault">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn(
          "glass-card p-8 md:p-12 w-full max-w-md",
          shake && "animate-shake"
        )}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 15 }}
          className="flex justify-center mb-8"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center pulse-glow">
            <Shield className="w-10 h-10 text-white" />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {!showRecovery ? (
            <motion.div
              key="pin-entry"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Private Vault
                </h1>
                <p className="text-white/60">
                  Gib deinen 6-stelligen PIN ein
                </p>
                <p className="text-white/40 text-xs mt-2">
                  Standard-PIN: 123456
                </p>
              </div>

              {/* PIN Input */}
              <div className="flex justify-center gap-3 mb-6">
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
                      "w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/20 rounded-xl text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all",
                      digit && "border-purple-500/50"
                    )}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-center gap-2 mb-6 text-red-400"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lockout timer */}
              {lockoutUntil && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center mb-6"
                >
                  <div className="text-white/60 text-sm">
                    Entsperrt in: <span className="text-purple-400 font-mono">{getRemainingLockoutTime()}</span>
                  </div>
                </motion.div>
              )}

              {/* Loading indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center mb-6"
                >
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </motion.div>
              )}

              {/* Recovery key link */}
              <button
                onClick={() => {
                  setShowRecovery(true);
                  setError('');
                }}
                className="w-full text-center text-white/50 hover:text-white/70 text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                PIN vergessen? Mit Recovery-Key anmelden
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="recovery-entry"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Recovery-Key
                </h1>
                <p className="text-white/60">
                  Gib deinen Recovery-Key ein
                </p>
              </div>

              {/* Recovery Key Input */}
              <div className="mb-6">
                <textarea
                  value={recoveryKey}
                  onChange={(e) => {
                    setRecoveryKey(e.target.value);
                    setError('');
                  }}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                  disabled={isLoading}
                  className="w-full h-24 p-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-white/30 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all resize-none font-mono text-center"
                />
              </div>

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-center gap-2 mb-6 text-red-400"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <button
                onClick={handleRecoverySubmit}
                disabled={isLoading || !recoveryKey.trim()}
                className="w-full py-3 rounded-xl bg-gradient-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
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

              {/* Back to PIN */}
              <button
                onClick={() => {
                  setShowRecovery(false);
                  setError('');
                  setRecoveryKey('');
                }}
                className="w-full text-center text-white/50 hover:text-white/70 text-sm transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Zurück zur PIN-Eingabe
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-2 text-white/40 text-xs mt-8"
        >
          <Lock className="w-3 h-3" />
          <span>Ende-zu-Ende verschlüsselt</span>
        </motion.div>
      </motion.div>
    </div>
  );
}