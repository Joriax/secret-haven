import React, { useState, useEffect } from 'react';
import { Fingerprint, ArrowLeft, Trash2, Code, Palette, Shield as ShieldIcon, Monitor, FolderX } from 'lucide-react';
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
import { FullThemeCustomizer } from '@/components/FullThemeCustomizer';
import { BackupManager } from '@/components/BackupManager';
import { ImportBackup } from '@/components/ImportBackup';
import { ImportManager } from '@/components/ImportManager';
import { ScheduledBackups } from '@/components/ScheduledBackups';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { CustomCSSEditor } from '@/components/CustomCSSEditor';
import { IconPackSelector } from '@/components/IconPackSelector';
import { DecoyVaultManager } from '@/components/DecoyVaultManager';
import { HiddenAlbumsManager } from '@/components/HiddenAlbumsManager';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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

const sectionFallback = (title: string) => (
  <div className="p-4 rounded-xl bg-muted/30 border border-border">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-4 h-4 text-destructive" />
      <p className="text-sm text-foreground font-medium">{title} konnte nicht geladen werden</p>
    </div>
    <p className="text-sm text-muted-foreground mt-2">
      Bitte Seite neu laden oder später erneut versuchen.
    </p>
  </div>
);

export default function Settings() {
  const [showPinChange, setShowPinChange] = useState(false);
  const [showDecoyPin, setShowDecoyPin] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showAutoLock, setShowAutoLock] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showImportManager, setShowImportManager] = useState(false);
  const [showHiddenAlbums, setShowHiddenAlbums] = useState(false);
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
  const { userId, sessionToken, logout, isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const { getTimeoutDuration, setTimeoutDuration, isEnabled, setEnabled } = useAutoLock();
  const { isAvailable: biometricAvailable, isEnabled: biometricEnabled, register: registerBiometric, disable: disableBiometric } = useBiometric();
  
  const [autoLockEnabled, setAutoLockEnabled] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !userId) {
      navigate('/login', { replace: true });
    }
  }, [isAuthLoading, userId, navigate]);

  // Show loading while auth is loading or redirecting
  if (isAuthLoading || !userId) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle import
  const handleImport = async (items: any[]) => {
    if (!userId) return { total: 0, imported: 0, skipped: 0, errors: [] };
    
    let imported = 0;
    const errors: string[] = [];
    
    for (const item of items) {
      try {
        if (item.type === 'note') {
          await supabase.from('notes').insert({
            user_id: userId,
            title: item.title,
            content: item.content,
            tags: item.tags || [],
          });
          imported++;
        }
      } catch (err: any) {
        errors.push(err.message || 'Unknown error');
      }
    }
    
    return {
      total: items.length,
      imported,
      skipped: items.length - imported - errors.length,
      errors,
    };
  };

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

  // Fetch existing recovery key via edge function
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
    if (!userId || !sessionToken) return;

    // Prompt for current PIN to authorize
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
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-200">
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
          <Timer className="w-5 h-5 text-cyan-500" />
          <h2 className="text-lg font-semibold text-foreground">Auto-Lock</h2>
        </div>

        <div className="space-y-4">
          {/* Auto-Lock Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Automatische Sperre</h3>
                <p className="text-sm text-muted-foreground">Bei Inaktivität automatisch sperren</p>
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
            <div className="p-4 rounded-xl bg-muted/30 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Sperren nach:</span>
                <span className="text-cyan-500 font-medium">
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
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 Min</span>
                <span>30 Min</span>
                <span>60 Min</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Biometric Authentication Section - Always show, with availability note */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Fingerprint className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-foreground">Biometrie</h2>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              biometricAvailable ? "bg-green-500/20" : "bg-muted"
            )}>
              <Fingerprint className={cn(
                "w-5 h-5",
                biometricAvailable ? "text-green-500" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Touch/Face ID</h3>
              <p className="text-sm text-muted-foreground">
                {biometricAvailable 
                  ? "Biometrische Authentifizierung für schnellen Zugang"
                  : "Nicht verfügbar auf diesem Gerät/Browser"
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
        
        {biometricEnabled && (
          <p className="text-green-500/70 text-xs mt-3 px-4">
            ✓ Biometrie aktiviert - Du kannst dich jetzt mit Touch/Face ID anmelden
          </p>
        )}
      </div>

      {/* Security Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-foreground">Sicherheit</h2>
        </div>

        <div className="space-y-4">
          {/* Change PIN */}
          <button
            onClick={() => { setShowPinChange(!showPinChange); setShowDecoyPin(false); setShowRecoveryKey(false); setMessage(null); }}
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-foreground">PIN ändern</h3>
                <p className="text-sm text-muted-foreground">Ändere deinen 6-stelligen Zugangs-PIN</p>
              </div>
            </div>
            <span className={cn("text-muted-foreground transition-transform", showPinChange && "rotate-180")}>▼</span>
          </button>

          {showPinChange && (
            <div className="p-4 space-y-4 bg-muted/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Aktueller PIN</label>
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
                <label className="block text-sm text-muted-foreground mb-2">Neuer PIN</label>
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
                <label className="block text-sm text-muted-foreground mb-2">PIN bestätigen</label>
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
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg animate-in fade-in duration-150",
                    message.type === 'success' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}
                >
                  {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span className="text-sm">{message.text}</span>
                </div>
              )}

              <button
                onClick={handlePinChange}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-primary hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <EyeOff className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-foreground">Tarn-PIN (Fake Vault)</h3>
                <p className="text-sm text-muted-foreground">Zweiter PIN zeigt leeren/harmlosen Vault</p>
              </div>
            </div>
            <span className={cn("text-muted-foreground transition-transform", showDecoyPin && "rotate-180")}>▼</span>
          </button>

          {showDecoyPin && (
            <div className="p-4 space-y-4 bg-muted/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-yellow-500 text-sm">
                  Der Tarn-PIN zeigt einen leeren Vault an, falls du gezwungen wirst, dein Gerät zu entsperren.
                </p>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Aktueller Haupt-PIN</label>
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
                <label className="block text-sm text-muted-foreground mb-2">Neuer Tarn-PIN</label>
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
                <label className="block text-sm text-muted-foreground mb-2">Tarn-PIN bestätigen</label>
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
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg animate-in fade-in duration-150",
                    message.type === 'success' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}
                >
                  {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span className="text-sm">{message.text}</span>
                </div>
              )}

              <button
                onClick={handleSetDecoyPin}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-orange-600 hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-foreground">Recovery-Schlüssel</h3>
                <p className="text-sm text-muted-foreground">Backup-Code für Notfallzugriff</p>
              </div>
            </div>
            <span className={cn("text-muted-foreground transition-transform", showRecoveryKey && "rotate-180")}>▼</span>
          </button>

          {showRecoveryKey && (
            <div className="p-4 space-y-4 bg-muted/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
              {recoveryKey ? (
                <>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-blue-500 text-sm mb-2">Dein Recovery-Schlüssel:</p>
                    <div className="font-mono text-lg text-foreground bg-background/50 p-3 rounded-lg text-center break-all">
                      {recoveryKey}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={copyRecoveryKey}
                      className="flex-1 py-3 rounded-xl border border-border hover:bg-muted/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4 text-foreground" />
                      <span className="text-foreground">Kopieren</span>
                    </button>
                    <button
                      onClick={generateNewRecoveryKey}
                      disabled={isLoading}
                      className="flex-1 py-3 rounded-xl border border-border hover:bg-muted/30 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={cn("w-4 h-4 text-foreground", isLoading && "animate-spin")} />
                      <span className="text-foreground">Neu generieren</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">
                    Generiere einen Recovery-Schlüssel, um im Notfall Zugriff zu erhalten.
                  </p>
                  <button
                    onClick={generateNewRecoveryKey}
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" /> : (
                      <>
                        <Key className="w-4 h-4 text-primary-foreground" />
                        <span className="text-primary-foreground font-medium">Recovery-Key generieren</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Theme Customizer */}
      <div className="glass-card p-6">
        <ErrorBoundary fallback={sectionFallback('Theme-Einstellungen')}>
          <FullThemeCustomizer />
        </ErrorBoundary>
      </div>

      {/* Icon Pack Selector */}
      <div className="glass-card p-6">
        <ErrorBoundary fallback={sectionFallback('Icon-Pakete')}>
          <IconPackSelector />
        </ErrorBoundary>
      </div>

      {/* Custom CSS Editor */}
      <div className="glass-card p-6">
        <ErrorBoundary fallback={sectionFallback('Custom CSS')}>
          <CustomCSSEditor />
        </ErrorBoundary>
      </div>

      {/* Decoy Vault Manager */}
      <div className="glass-card p-6">
        <ErrorBoundary fallback={sectionFallback('Tarn-Vault')}>
          <DecoyVaultManager />
        </ErrorBoundary>
      </div>

      {/* Backup Manager */}
      <ErrorBoundary fallback={sectionFallback('Backups')}>
        <BackupManager />
      </ErrorBoundary>

      {/* Scheduled Backups */}
      <ErrorBoundary fallback={sectionFallback('Geplante Backups')}>
        <ScheduledBackups />
      </ErrorBoundary>

      {/* Hidden Albums Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FolderX className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">Ausgeblendete Alben</h2>
          </div>
          <button
            onClick={() => setShowHiddenAlbums(!showHiddenAlbums)}
            className="text-sm text-primary hover:underline"
          >
            {showHiddenAlbums ? 'Schließen' : 'Verwalten'}
          </button>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          Blende Alben aus, um sie vollständig zu verstecken – inklusive aller Unteralben und Inhalte.
        </p>
        
        {showHiddenAlbums && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <ErrorBoundary fallback={sectionFallback('Ausgeblendete Alben')}>
              <HiddenAlbumsManager />
            </ErrorBoundary>
          </div>
        )}
      </div>


      {/* Import Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Upload className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-foreground">Daten importieren</h2>
        </div>
        
        <button
          onClick={() => setShowImportManager(true)}
          className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Upload className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-left">
              <h3 className="font-medium text-foreground">Aus anderen Apps importieren</h3>
              <p className="text-sm text-muted-foreground">Evernote, Notion, Google Keep, Apple Notes</p>
            </div>
          </div>
        </button>
      </div>

      {/* Import Manager Dialog */}
      <ErrorBoundary fallback={null}>
        <ImportManager 
          open={showImportManager}
          onClose={() => setShowImportManager(false)}
          onImport={handleImport}
        />
      </ErrorBoundary>

      {/* Danger Zone */}
      <div className="glass-card p-6 border-destructive/30">
        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="w-5 h-5 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Gefahrenzone</h2>
        </div>

        <button
          onClick={() => setShowDeleteAccount(true)}
          className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-destructive/10 transition-colors group border border-destructive/20"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <div className="text-left">
              <h3 className="font-medium text-destructive">Konto löschen</h3>
              <p className="text-sm text-muted-foreground">Alle Daten unwiderruflich entfernen</p>
            </div>
          </div>
        </button>
      </div>

      {/* Logout */}
      <div className="glass-card p-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-destructive/10 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-destructive" />
            </div>
            <div className="text-left">
              <h3 className="font-medium text-foreground">Abmelden</h3>
              <p className="text-sm text-muted-foreground">Sitzung beenden und zum Login zurückkehren</p>
            </div>
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Info</h3>
        <div className="space-y-2 text-sm text-muted-foreground/70">
          <p>Version: 1.0.0</p>
          <p>Private Vault - Dein sicherer Tresor</p>
        </div>
      </div>

      {/* Delete Account Dialog */}
      <ErrorBoundary fallback={null}>
        <DeleteAccountDialog 
          open={showDeleteAccount} 
          onOpenChange={setShowDeleteAccount} 
        />
      </ErrorBoundary>
    </div>
  );
}
