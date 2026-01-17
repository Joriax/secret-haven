import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityLogs } from '@/hooks/useSecurityLogs';
import { AUTO_LOCK_TIMEOUT_MINUTES } from '@/config';

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

export const useAutoLock = () => {
  const { isAuthenticated, logout, userId } = useAuth();
  const { logEvent } = useSecurityLogs();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Get timeout from localStorage, use config default
  const getTimeoutDuration = useCallback(() => {
    const stored = localStorage.getItem('vault_auto_lock_timeout');
    if (stored) {
      return parseInt(stored, 10);
    }
    return AUTO_LOCK_TIMEOUT_MINUTES * 60 * 1000; // From config
  }, []);

  const setTimeoutDuration = useCallback((minutes: number) => {
    const ms = minutes * 60 * 1000;
    localStorage.setItem('vault_auto_lock_timeout', ms.toString());
  }, []);

  const isEnabled = useCallback(() => {
    const stored = localStorage.getItem('vault_auto_lock_enabled');
    return stored !== 'false'; // Enabled by default
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem('vault_auto_lock_enabled', enabled.toString());
  }, []);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!isAuthenticated || !isEnabled()) return;

    const timeout = getTimeoutDuration();
    if (timeout <= 0) return;

    timeoutRef.current = setTimeout(() => {
      if (userId) {
        logEvent('auto_lock', { reason: 'inactivity', timeout_minutes: timeout / 60000 });
      }
      logout();
    }, timeout);
  }, [isAuthenticated, logout, getTimeoutDuration, isEnabled, userId, logEvent]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    // Initial timer setup
    resetTimer();

    // Activity listeners
    const handleActivity = () => {
      resetTimer();
    };

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Visibility change - lock when tab becomes hidden (optional)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if we should have locked while hidden
        const timeout = getTimeoutDuration();
        const elapsed = Date.now() - lastActivityRef.current;
        
        if (isEnabled() && elapsed > timeout) {
          if (userId) {
            logEvent('auto_lock', { reason: 'visibility_timeout', elapsed_ms: elapsed });
          }
          logout();
        } else {
          resetTimer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isAuthenticated, resetTimer, getTimeoutDuration, isEnabled, logout, userId, logEvent]);

  return {
    getTimeoutDuration,
    setTimeoutDuration,
    isEnabled,
    setEnabled,
    resetTimer,
  };
};
