import { useCallback, useEffect, useState } from 'react';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

interface HapticPatterns {
  light: number[];
  medium: number[];
  heavy: number[];
  success: number[];
  warning: number[];
  error: number[];
  selection: number[];
}

const HAPTIC_PATTERNS: HapticPatterns = {
  light: [10],
  medium: [25],
  heavy: [50],
  success: [10, 50, 30],
  warning: [30, 50, 30],
  error: [50, 100, 50, 100, 50],
  selection: [5],
};

interface UseHapticsReturn {
  isSupported: boolean;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  vibrate: (pattern?: HapticPattern | number[]) => void;
  vibrateLight: () => void;
  vibrateMedium: () => void;
  vibrateHeavy: () => void;
  vibrateSuccess: () => void;
  vibrateWarning: () => void;
  vibrateError: () => void;
  vibrateSelection: () => void;
}

const HAPTICS_STORAGE_KEY = 'vault-haptics-enabled';

export function useHaptics(): UseHapticsReturn {
  const [isSupported] = useState(() => {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  });

  const [isEnabled, setIsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(HAPTICS_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  // Persist enabled state
  useEffect(() => {
    localStorage.setItem(HAPTICS_STORAGE_KEY, String(isEnabled));
  }, [isEnabled]);

  const vibrate = useCallback((pattern: HapticPattern | number[] = 'medium') => {
    if (!isSupported || !isEnabled) return;

    try {
      const vibrationPattern = Array.isArray(pattern) 
        ? pattern 
        : HAPTIC_PATTERNS[pattern] || HAPTIC_PATTERNS.medium;
      
      navigator.vibrate(vibrationPattern);
    } catch (error) {
      // Silently fail - vibration may be blocked by browser/OS
      console.debug('Haptic feedback failed:', error);
    }
  }, [isSupported, isEnabled]);

  const vibrateLight = useCallback(() => vibrate('light'), [vibrate]);
  const vibrateMedium = useCallback(() => vibrate('medium'), [vibrate]);
  const vibrateHeavy = useCallback(() => vibrate('heavy'), [vibrate]);
  const vibrateSuccess = useCallback(() => vibrate('success'), [vibrate]);
  const vibrateWarning = useCallback(() => vibrate('warning'), [vibrate]);
  const vibrateError = useCallback(() => vibrate('error'), [vibrate]);
  const vibrateSelection = useCallback(() => vibrate('selection'), [vibrate]);

  return {
    isSupported,
    isEnabled,
    setEnabled: setIsEnabled,
    vibrate,
    vibrateLight,
    vibrateMedium,
    vibrateHeavy,
    vibrateSuccess,
    vibrateWarning,
    vibrateError,
    vibrateSelection,
  };
}

export default useHaptics;
