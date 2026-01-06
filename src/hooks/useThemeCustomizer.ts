import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface ThemeColors {
  primary: string;
  accent: string;
}

const DEFAULT_THEMES = [
  { id: 'purple', name: 'Lila', primary: '262 83% 58%', accent: '280 70% 60%' },
  { id: 'blue', name: 'Blau', primary: '217 91% 60%', accent: '199 89% 48%' },
  { id: 'green', name: 'Grün', primary: '142 71% 45%', accent: '158 64% 52%' },
  { id: 'orange', name: 'Orange', primary: '24 95% 53%', accent: '38 92% 50%' },
  { id: 'pink', name: 'Pink', primary: '330 81% 60%', accent: '340 75% 55%' },
  { id: 'cyan', name: 'Cyan', primary: '186 100% 42%', accent: '192 91% 36%' },
  { id: 'red', name: 'Rot', primary: '0 84% 60%', accent: '348 83% 47%' },
  { id: 'yellow', name: 'Gelb', primary: '45 93% 47%', accent: '36 100% 50%' },
];

export function useThemeCustomizer() {
  const { userId } = useAuth();
  const [currentTheme, setCurrentTheme] = useState('purple');
  const [customColors, setCustomColors] = useState<ThemeColors | null>(null);

  // Load saved theme
  useEffect(() => {
    if (!userId) return;
    
    const saved = localStorage.getItem(`theme-${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentTheme(parsed.themeId || 'purple');
        if (parsed.customColors) {
          setCustomColors(parsed.customColors);
        }
        applyTheme(parsed.themeId, parsed.customColors);
      } catch {
        applyTheme('purple', null);
      }
    }
  }, [userId]);

  const applyTheme = useCallback((themeId: string, colors: ThemeColors | null) => {
    const root = document.documentElement;
    
    if (colors) {
      root.style.setProperty('--primary', colors.primary);
      root.style.setProperty('--accent', colors.accent);
      root.style.setProperty('--ring', colors.primary);
      root.style.setProperty('--sidebar-primary', colors.primary);
      root.style.setProperty('--purple-glow', colors.primary);
    } else {
      const theme = DEFAULT_THEMES.find(t => t.id === themeId) || DEFAULT_THEMES[0];
      root.style.setProperty('--primary', theme.primary);
      root.style.setProperty('--accent', theme.accent);
      root.style.setProperty('--ring', theme.primary);
      root.style.setProperty('--sidebar-primary', theme.primary);
      root.style.setProperty('--purple-glow', theme.primary);
    }
  }, []);

  const setTheme = useCallback((themeId: string) => {
    if (!userId) return;
    
    setCurrentTheme(themeId);
    setCustomColors(null);
    applyTheme(themeId, null);
    
    localStorage.setItem(`theme-${userId}`, JSON.stringify({ themeId }));
  }, [userId, applyTheme]);

  const setCustomTheme = useCallback((colors: ThemeColors) => {
    if (!userId) return;
    
    setCurrentTheme('custom');
    setCustomColors(colors);
    applyTheme('custom', colors);
    
    localStorage.setItem(`theme-${userId}`, JSON.stringify({ 
      themeId: 'custom', 
      customColors: colors 
    }));
  }, [userId, applyTheme]);

  return {
    currentTheme,
    customColors,
    themes: DEFAULT_THEMES,
    setTheme,
    setCustomTheme,
  };
}
