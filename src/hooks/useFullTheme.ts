import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { THEMES, FullTheme, applyTheme, getThemeById } from '@/lib/themes';

interface ThemeSettings {
  themeId: string;
  useSystemTheme: boolean;
  scheduledMode: boolean;
  lightStartHour: number;
  darkStartHour: number;
}

const DEFAULT_SETTINGS: ThemeSettings = {
  themeId: 'dark-purple',
  useSystemTheme: false,
  scheduledMode: false,
  lightStartHour: 7,
  darkStartHour: 20,
};

export function useFullTheme() {
  const { userId } = useAuth();
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [currentTheme, setCurrentTheme] = useState<FullTheme>(THEMES[0]);

  // Load settings on mount
  useEffect(() => {
    if (!userId) return;
    
    const saved = localStorage.getItem(`full-theme-${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ThemeSettings;
        setSettings(parsed);
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    }
  }, [userId]);

  // Determine current theme based on settings
  const determineTheme = useCallback(() => {
    const hour = new Date().getHours();
    let themeId = settings.themeId;

    if (settings.useSystemTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const matchingThemes = THEMES.filter(t => t.mode === (prefersDark ? 'dark' : 'light'));
      const currentThemeMode = getThemeById(settings.themeId)?.mode;
      
      if (currentThemeMode !== (prefersDark ? 'dark' : 'light')) {
        // Switch to matching mode theme with same color family if possible
        const colorFamily = settings.themeId.split('-')[1];
        const match = matchingThemes.find(t => t.id.includes(colorFamily));
        themeId = match?.id || matchingThemes[0]?.id || settings.themeId;
      }
    } else if (settings.scheduledMode) {
      const isLightTime = hour >= settings.lightStartHour && hour < settings.darkStartHour;
      const currentThemeMode = getThemeById(settings.themeId)?.mode;
      
      if ((isLightTime && currentThemeMode === 'dark') || (!isLightTime && currentThemeMode === 'light')) {
        const targetMode = isLightTime ? 'light' : 'dark';
        const colorFamily = settings.themeId.split('-')[1];
        const matchingThemes = THEMES.filter(t => t.mode === targetMode);
        const match = matchingThemes.find(t => t.id.includes(colorFamily));
        themeId = match?.id || matchingThemes[0]?.id || settings.themeId;
      }
    }

    const theme = getThemeById(themeId) || THEMES[0];
    setCurrentTheme(theme);
    applyTheme(theme);
  }, [settings]);

  // Apply theme when settings change
  useEffect(() => {
    determineTheme();
  }, [determineTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!settings.useSystemTheme) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => determineTheme();
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [settings.useSystemTheme, determineTheme]);

  // Check scheduled mode every minute
  useEffect(() => {
    if (!settings.scheduledMode) return;
    
    const interval = setInterval(determineTheme, 60000);
    return () => clearInterval(interval);
  }, [settings.scheduledMode, determineTheme]);

  const saveSettings = useCallback((newSettings: Partial<ThemeSettings>) => {
    if (!userId) return;
    
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(`full-theme-${userId}`, JSON.stringify(updated));
  }, [userId, settings]);

  const setTheme = useCallback((themeId: string) => {
    saveSettings({ themeId, useSystemTheme: false, scheduledMode: false });
  }, [saveSettings]);

  const setUseSystemTheme = useCallback((enabled: boolean) => {
    saveSettings({ useSystemTheme: enabled, scheduledMode: false });
  }, [saveSettings]);

  const setScheduledMode = useCallback((enabled: boolean, lightStart?: number, darkStart?: number) => {
    saveSettings({ 
      scheduledMode: enabled, 
      useSystemTheme: false,
      ...(lightStart !== undefined && { lightStartHour: lightStart }),
      ...(darkStart !== undefined && { darkStartHour: darkStart }),
    });
  }, [saveSettings]);

  return {
    themes: THEMES,
    currentTheme,
    settings,
    setTheme,
    setUseSystemTheme,
    setScheduledMode,
  };
}
