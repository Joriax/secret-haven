import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Lock, Shield, LogOut, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const PIN_LENGTH = 6;

export default function Settings() {
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { userId, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handlePinChange = async () => {
    setMessage(null);

    // Validation
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

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'change', pin: currentPin, newPin, userId }
      });

      if (error) {
        throw new Error('Verbindungsfehler');
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Einstellungen</h1>
          <p className="text-white/60 text-sm">Verwalte deinen Vault</p>
        </div>
      </div>

      {/* Security Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Sicherheit</h2>
        </div>

        {/* Change PIN */}
        <div className="space-y-4">
          <button
            onClick={() => setShowPinChange(!showPinChange)}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-white">PIN ändern</h3>
                <p className="text-sm text-white/50">Ändere deinen 6-stelligen Zugangs-PIN</p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: showPinChange ? 180 : 0 }}
              className="text-white/40"
            >
              ▼
            </motion.div>
          </button>

          <AnimatePresence>
            {showPinChange && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-4 bg-white/5 rounded-xl">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Aktueller PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full px-4 py-3 rounded-xl vault-input text-white placeholder:text-white/30 text-center tracking-widest"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Neuer PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full px-4 py-3 rounded-xl vault-input text-white placeholder:text-white/30 text-center tracking-widest"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">PIN bestätigen</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full px-4 py-3 rounded-xl vault-input text-white placeholder:text-white/30 text-center tracking-widest"
                    />
                  </div>

                  {/* Message */}
                  <AnimatePresence>
                    {message && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg",
                          message.type === 'success' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}
                      >
                        {message.type === 'success' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        <span className="text-sm">{message.text}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={handlePinChange}
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-gradient-primary hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-white" />
                        <span className="text-white font-medium">PIN ändern</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Logout */}
      <div className="glass-card p-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-red-500/10 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-left">
              <h3 className="font-medium text-white">Abmelden</h3>
              <p className="text-sm text-white/50">Sitzung beenden und zum Login zurückkehren</p>
            </div>
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-white/60 mb-3">Info</h3>
        <div className="space-y-2 text-sm text-white/40">
          <p>Version: 1.0.0</p>
          <p>Private Vault - Dein sicherer Tresor</p>
        </div>
      </div>
    </motion.div>
  );
}
