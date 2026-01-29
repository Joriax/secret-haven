import React, { useState, useEffect } from 'react';
import { Clock, Timer, Trash2, LogOut, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { toast } from 'sonner';

export const GeneralSettings: React.FC = () => {
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const { getTimeoutDuration, setTimeoutDuration, isEnabled, setEnabled } = useAutoLock();
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  const [autoLockEnabled, setAutoLockEnabled] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);

  useEffect(() => {
    setAutoLockEnabled(isEnabled());
    setAutoLockMinutes(getTimeoutDuration() / 60000);
  }, [isEnabled, getTimeoutDuration]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-4">
      {/* Auto-Lock Section */}
      <div className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Timer className="w-5 h-5 text-cyan-500" />
          <h3 className="text-base font-semibold text-foreground">Auto-Lock</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-muted/30">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500" />
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm sm:text-base">Automatische Sperre</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">Bei Inaktivität sperren</p>
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

          {autoLockEnabled && (
            <div className="p-3 sm:p-4 rounded-xl bg-muted/30 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs sm:text-sm">Sperren nach:</span>
                <span className="text-cyan-500 font-medium text-sm">
                  {autoLockMinutes < 60 
                    ? `${autoLockMinutes} Min` 
                    : `${autoLockMinutes / 60} Std`
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

      {/* Logout */}
      <div className="glass-card p-4 sm:p-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-muted flex items-center justify-center">
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
            </div>
            <div className="text-left">
              <h4 className="font-medium text-foreground text-sm sm:text-base">Abmelden</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">Vault sperren & abmelden</p>
            </div>
          </div>
        </button>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-4 sm:p-6 border-destructive/30">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="w-5 h-5 text-destructive" />
          <h3 className="text-base font-semibold text-destructive">Gefahrenzone</h3>
        </div>

        <button
          onClick={() => setShowDeleteAccount(true)}
          className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-destructive/10 transition-colors border border-destructive/20"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
            </div>
            <div className="text-left">
              <h4 className="font-medium text-destructive text-sm sm:text-base">Konto löschen</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">Alle Daten unwiderruflich entfernen</p>
            </div>
          </div>
        </button>
      </div>

      <DeleteAccountDialog 
        open={showDeleteAccount} 
        onOpenChange={setShowDeleteAccount}
      />
    </div>
  );
};
