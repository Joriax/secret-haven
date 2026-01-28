import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, LogOut, Trash2, EyeOff, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PanicButtonProps {
  enabled?: boolean;
}

export const PanicButton: React.FC<PanicButtonProps> = ({ enabled = true }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on login page
  const isLoginPage = location.pathname === '/login' || location.pathname === '/';

  const HOLD_DURATION = 1500; // 1.5 seconds

  const handlePanicAction = useCallback(() => {
    // Clear session storage
    sessionStorage.clear();
    
    // Clear sensitive localStorage items
    const sensitiveKeys = [
      'vault_session_token',
      'vault_session_expires',
      'vault_user_id',
      'biometric_credential_id',
      'biometric_user_id',
    ];
    sensitiveKeys.forEach(key => localStorage.removeItem(key));
    
    // Logout and redirect
    logout();
    navigate('/login', { replace: true });
    
    // Optional: close tab (only works if opened by script)
    if (window.opener) {
      window.close();
    }
  }, [logout, navigate]);

  const startPress = useCallback(() => {
    if (!enabled) return;
    setIsPressed(true);
    setProgress(0);
    
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setProgress(newProgress);
      
      if (newProgress >= 100) {
        clearInterval(timer);
        handlePanicAction();
      }
    }, 16);
    
    setPressTimer(timer);
  }, [enabled, handlePanicAction]);

  const endPress = useCallback(() => {
    setIsPressed(false);
    setProgress(0);
    if (pressTimer) {
      clearInterval(pressTimer);
      setPressTimer(null);
    }
  }, [pressTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pressTimer) {
        clearInterval(pressTimer);
      }
    };
  }, [pressTimer]);

  // Keyboard shortcut (Shift + Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'Escape') {
        e.preventDefault();
        setShowConfirm(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!enabled || isLoginPage) return null;

  return (
    <>
      {/* Floating Panic Button */}
      <motion.button
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full",
          "bg-destructive text-destructive-foreground shadow-lg",
          "flex items-center justify-center transition-all",
          "hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive/50",
          isPressed && "ring-4 ring-destructive/50"
        )}
        title="Panic Button - Halten zum Aktivieren (Shift+Esc)"
      >
        <div className="relative">
          <AlertTriangle className="w-6 h-6" />
          
          {/* Progress ring */}
          <AnimatePresence>
            {isPressed && progress > 0 && (
              <svg
                className="absolute inset-[-8px] w-[calc(100%+16px)] h-[calc(100%+16px)] -rotate-90"
                viewBox="0 0 36 36"
              >
                <motion.circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${progress} 100`}
                  initial={{ strokeDasharray: "0 100" }}
                  animate={{ strokeDasharray: `${progress} 100` }}
                  className="text-white"
                />
              </svg>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      {/* Confirmation Dialog (for keyboard shortcut) */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm mx-4 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Panic-Modus</h3>
                  <p className="text-sm text-muted-foreground">Sofort ausloggen?</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                Dies wird dich sofort abmelden und alle Session-Daten löschen.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowConfirm(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setShowConfirm(false);
                    handlePanicAction();
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Ausloggen
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
