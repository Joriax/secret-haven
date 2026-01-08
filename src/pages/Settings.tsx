import React, { useState, useEffect } from 'react';
import { Fingerprint, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';
import { 
  Settings as SettingsIcon, 
  Lock,
  Shield, 
  LogOut, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Key,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Clock,
  Timer
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { generateRecoveryKey, encryptText, decryptText } from '@/lib/encryption';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useBiometric } from '@/hooks/useBiometric';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ThemeCustomizer } from '@/components/ThemeCustomizer';
import { ExportBackup } from '@/components/ExportBackup';

const PIN_LENGTH = 6;

const AUTO_LOCK_OPTIONS = [
  { value: 1, label: '1 Minute' },
  { value: 2, label: '2 Minuten' },
  { value: 5, label: '5 Minuten' },
  { value: 10, label: '10 Minuten' },
  { value: 15, label: '15 Minuten' },
  { value: 30, label: '30 Minuten' },
  { value: 60, label: '1 Stunde' },
];

export default function Settings() {
  const [showPinChange, setShowPinChange] = useState(false);
  const [showDecoyPin, setShowDecoyPin] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showAutoLock, setShowAutoLock] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [decoyPin, setDecoyPin] = useState('');
  const [confirmDecoyPin, setConfirmDecoyPin] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [isBiometricRegistering, setIsBiometricRegistering] = useState(false);
  const { userId, sessionToken, logout } = useAuth();
  const navigate = useNavigate();
  const { getTimeoutDuration, setTimeoutDuration, isEnabled, setEnabled } = useAutoLock();
  const { isAvailable: biometricAvailable, isEnabled: biometricEnabled, register: registerBiometric, disable: disableBiometric } = useBiometric();
  
  const [autoLockEnabled, setAutoLockEnabled] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);

  // Initialize auto-lock settings
  useEffect(() => {
    setAutoLockEnabled(isEnabled());
    setAutoLockMinutes(getTimeoutDuration() / 60000);
  }, [isEnabled, getTimeoutDuration]);

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

  // Fetch existing recovery key
  useEffect(() => {
    const fetchRecoveryKey = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from('vault_users')
        .select('recovery_key')
        .eq('id', userId)
        .single();
      
      if (data?.recovery_key) {
        setRecoveryKey(data.recovery_key);
      }
    };
    fetchRecoveryKey();
  }, [userId]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
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
    if (!userId) return;

    setIsLoading(true);
    try {
      const newKey = generateRecoveryKey();
      const { error } = await supabase
        .from('vault_users')
        .update({ recovery_key: newKey })
        .eq('id', userId);

      if (error) throw error;

      setRecoveryKey(newKey);
      toast.success('Recovery-Key generiert', { description: 'Speichere ihn sicher ab!' });
    } catch (err) {
      toast.error('Fehler beim Generieren des Recovery-Keys');
    } finally {
      setIsLoading(false);
    }
  };

  const copyRecoveryKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    toast.success('Recovery-Key kopiert');
  };

  const handleBackup = async () => {
    if (!userId || !backupPassword) {
      toast.error('Bitte gib ein Backup-Passwort ein');
      return;
    }

    setIsLoading(true);
    try {
      // Fetch all user data
      const [notesRes, photosRes, filesRes, secretsRes, tagsRes] = await Promise.all([
        supabase.from('notes').select('*').eq('user_id', userId),
        supabase.from('photos').select('*').eq('user_id', userId),
        supabase.from('files').select('*').eq('user_id', userId),
        supabase.from('secret_texts').select('*').eq('user_id', userId),
        supabase.from('tags').select('*').eq('user_id', userId),
      ]);

      const backupData = {
        version: '1.0',
        created_at: new Date().toISOString(),
        notes: notesRes.data || [],
        photos: photosRes.data || [],
        files: filesRes.data || [],
        secret_texts: secretsRes.data || [],
        tags: tagsRes.data || [],
      };

      const encrypted = await encryptText(JSON.stringify(backupData), backupPassword);
      
      // Download as file
      const blob = new Blob([encrypted], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-backup-${new Date().toISOString().split('T')[0]}.vlt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup erstellt', { description: 'Die verschlüsselte Datei wurde heruntergeladen.' });
      setBackupPassword('');
    } catch (err) {
      console.error('Backup error:', err);
      toast.error('Fehler beim Erstellen des Backups');
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
      <PageHeader
        title="Einstellungen"
        subtitle="Verwalte deinen Vault"
        icon={<SettingsIcon className="w-5 h-5 text-primary" />}
        backTo="/dashboard"
      />

      {/* Auto-Lock Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Timer className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Auto-Lock</h2>
        </div>

        <div className="space-y-4">
          {/* Auto-Lock Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Automatische Sperre</h3>
                <p className="text-sm text-white/50">Bei Inaktivität automatisch sperren</p>
              </div>
            </div>
            <Switch
              checked={autoLockEnabled}
              onCheckedChange={(checked) => {
                setAutoLockEnabled(checked);
                setEnabled(checked);
                toast.success(checked ? 'Auto-Lock aktiviert' : 'Auto-Lock deaktiviert');
              }}
            />
          </div>

          {/* Auto-Lock Timer */}
          {autoLockEnabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-4 rounded-xl bg-white/5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Sperren nach:</span>
                <span className="text-cyan-400 font-medium">
                  {autoLockMinutes < 60 
                    ? `${autoLockMinutes} Minute${autoLockMinutes !== 1 ? 'n' : ''}` 
                    : `${autoLockMinutes / 60} Stunde${autoLockMinutes / 60 !== 1 ? 'n' : ''}`
                  }
                </span>
              </div>
              <Slider
                value={[autoLockMinutes]}
                onValueChange={(value) => {
                  const minutes = value[0];
                  setAutoLockMinutes(minutes);
                  setTimeoutDuration(minutes);
                }}
                min={1}
                max={60}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-white/40">
                <span>1 Min</span>
                <span>30 Min</span>
                <span>60 Min</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Biometric Authentication Section */}
      {biometricAvailable && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Fingerprint className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Biometrie</h2>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Touch/Face ID</h3>
                <p className="text-sm text-white/50">Biometrische Authentifizierung für schnellen Zugang</p>
              </div>
            </div>
            <Switch
              checked={biometricEnabled}
              onCheckedChange={handleBiometricToggle}
              disabled={isBiometricRegistering}
            />
          </div>
          
          {biometricEnabled && (
            <p className="text-green-400/70 text-xs mt-3 px-4">
              ✓ Biometrie aktiviert - Du kannst dich jetzt mit Touch/Face ID anmelden
            </p>
          )}
        </div>
      )}

      {/* Security Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Sicherheit</h2>
        </div>

        <div className="space-y-4">
          {/* Change PIN */}
          <button
            onClick={() => { setShowPinChange(!showPinChange); setShowDecoyPin(false); setShowRecoveryKey(false); setMessage(null); }}
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
            <motion.div animate={{ rotate: showPinChange ? 180 : 0 }} className="text-white/40">▼</motion.div>
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
                        {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span className="text-sm">{message.text}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={handlePinChange}
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-gradient-primary hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : (
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

          {/* Decoy PIN */}
          <button
            onClick={() => { setShowDecoyPin(!showDecoyPin); setShowPinChange(false); setShowRecoveryKey(false); setMessage(null); }}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <EyeOff className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-white">Tarn-PIN (Fake Vault)</h3>
                <p className="text-sm text-white/50">Zweiter PIN zeigt leeren/harmlosen Vault</p>
              </div>
            </div>
            <motion.div animate={{ rotate: showDecoyPin ? 180 : 0 }} className="text-white/40">▼</motion.div>
          </button>

          <AnimatePresence>
            {showDecoyPin && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-4 bg-white/5 rounded-xl">
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-yellow-400 text-sm">
                      Der Tarn-PIN zeigt einen leeren Vault an, falls du gezwungen wirst, dein Gerät zu entsperren.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Aktueller Haupt-PIN</label>
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
                    <label className="block text-sm text-white/60 mb-2">Neuer Tarn-PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={decoyPin}
                      onChange={(e) => setDecoyPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full px-4 py-3 rounded-xl vault-input text-white placeholder:text-white/30 text-center tracking-widest"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Tarn-PIN bestätigen</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmDecoyPin}
                      onChange={(e) => setConfirmDecoyPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full px-4 py-3 rounded-xl vault-input text-white placeholder:text-white/30 text-center tracking-widest"
                    />
                  </div>

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
                        {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span className="text-sm">{message.text}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={handleSetDecoyPin}
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-orange-600 hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : (
                      <>
                        <EyeOff className="w-4 h-4 text-white" />
                        <span className="text-white font-medium">Tarn-PIN aktivieren</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recovery Key */}
          <button
            onClick={() => { setShowRecoveryKey(!showRecoveryKey); setShowPinChange(false); setShowDecoyPin(false); }}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-white">Recovery-Schlüssel</h3>
                <p className="text-sm text-white/50">Backup-Code für Notfallzugriff</p>
              </div>
            </div>
            <motion.div animate={{ rotate: showRecoveryKey ? 180 : 0 }} className="text-white/40">▼</motion.div>
          </button>

          <AnimatePresence>
            {showRecoveryKey && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-4 bg-white/5 rounded-xl">
                  {recoveryKey ? (
                    <>
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-blue-400 text-sm mb-2">Dein Recovery-Schlüssel:</p>
                        <div className="font-mono text-lg text-white bg-black/30 p-3 rounded-lg text-center break-all">
                          {recoveryKey}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={copyRecoveryKey}
                          className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                        >
                          <Copy className="w-4 h-4 text-white" />
                          <span className="text-white">Kopieren</span>
                        </button>
                        <button
                          onClick={generateNewRecoveryKey}
                          disabled={isLoading}
                          className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw className={cn("w-4 h-4 text-white", isLoading && "animate-spin")} />
                          <span className="text-white">Neu generieren</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-white/60 text-sm">
                        Generiere einen Recovery-Schlüssel, um im Notfall Zugriff zu erhalten.
                      </p>
                      <button
                        onClick={generateNewRecoveryKey}
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : (
                          <>
                            <Key className="w-4 h-4 text-white" />
                            <span className="text-white font-medium">Recovery-Key generieren</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Theme Customizer */}
      <ThemeCustomizer />

      {/* Export/Backup Section */}
      <ExportBackup />

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
