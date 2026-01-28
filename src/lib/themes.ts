// Full Theme System with Light/Dark modes
export interface FullTheme {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    sidebarBackground: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarAccent: string;
    sidebarBorder: string;
    purpleGlow: string;
    purpleSubtle: string;
  };
}

export const THEMES: FullTheme[] = [
  // Dark Themes
  {
    id: 'dark-purple',
    name: 'Lila Dunkel',
    mode: 'dark',
    colors: {
      background: '240 10% 4%',
      foreground: '0 0% 98%',
      card: '240 10% 6%',
      cardForeground: '0 0% 98%',
      popover: '240 10% 6%',
      popoverForeground: '0 0% 98%',
      primary: '262 83% 58%',
      primaryForeground: '0 0% 100%',
      secondary: '240 10% 10%',
      secondaryForeground: '0 0% 98%',
      muted: '240 10% 12%',
      mutedForeground: '240 5% 55%',
      accent: '262 83% 58%',
      accentForeground: '0 0% 100%',
      destructive: '0 62% 50%',
      destructiveForeground: '0 0% 100%',
      border: '240 10% 12%',
      input: '240 10% 12%',
      ring: '262 83% 58%',
      sidebarBackground: '240 10% 5%',
      sidebarForeground: '0 0% 90%',
      sidebarPrimary: '262 83% 58%',
      sidebarAccent: '240 10% 10%',
      sidebarBorder: '240 10% 10%',
      purpleGlow: '262 83% 58%',
      purpleSubtle: '262 30% 20%',
    },
  },
  {
    id: 'dark-blue',
    name: 'Blau Dunkel',
    mode: 'dark',
    colors: {
      background: '222 47% 4%',
      foreground: '0 0% 98%',
      card: '222 47% 6%',
      cardForeground: '0 0% 98%',
      popover: '222 47% 6%',
      popoverForeground: '0 0% 98%',
      primary: '217 91% 60%',
      primaryForeground: '0 0% 100%',
      secondary: '222 47% 10%',
      secondaryForeground: '0 0% 98%',
      muted: '222 47% 12%',
      mutedForeground: '215 20% 55%',
      accent: '199 89% 48%',
      accentForeground: '0 0% 100%',
      destructive: '0 62% 50%',
      destructiveForeground: '0 0% 100%',
      border: '222 47% 12%',
      input: '222 47% 12%',
      ring: '217 91% 60%',
      sidebarBackground: '222 47% 5%',
      sidebarForeground: '0 0% 90%',
      sidebarPrimary: '217 91% 60%',
      sidebarAccent: '222 47% 10%',
      sidebarBorder: '222 47% 10%',
      purpleGlow: '217 91% 60%',
      purpleSubtle: '217 40% 20%',
    },
  },
  {
    id: 'dark-green',
    name: 'Grün Dunkel',
    mode: 'dark',
    colors: {
      background: '150 20% 4%',
      foreground: '0 0% 98%',
      card: '150 20% 6%',
      cardForeground: '0 0% 98%',
      popover: '150 20% 6%',
      popoverForeground: '0 0% 98%',
      primary: '142 71% 45%',
      primaryForeground: '0 0% 100%',
      secondary: '150 20% 10%',
      secondaryForeground: '0 0% 98%',
      muted: '150 20% 12%',
      mutedForeground: '150 10% 55%',
      accent: '158 64% 52%',
      accentForeground: '0 0% 100%',
      destructive: '0 62% 50%',
      destructiveForeground: '0 0% 100%',
      border: '150 20% 12%',
      input: '150 20% 12%',
      ring: '142 71% 45%',
      sidebarBackground: '150 20% 5%',
      sidebarForeground: '0 0% 90%',
      sidebarPrimary: '142 71% 45%',
      sidebarAccent: '150 20% 10%',
      sidebarBorder: '150 20% 10%',
      purpleGlow: '142 71% 45%',
      purpleSubtle: '142 30% 20%',
    },
  },
  {
    id: 'amoled',
    name: 'AMOLED',
    mode: 'dark',
    colors: {
      background: '0 0% 0%',
      foreground: '0 0% 98%',
      card: '0 0% 3%',
      cardForeground: '0 0% 98%',
      popover: '0 0% 3%',
      popoverForeground: '0 0% 98%',
      primary: '262 83% 58%',
      primaryForeground: '0 0% 100%',
      secondary: '0 0% 8%',
      secondaryForeground: '0 0% 98%',
      muted: '0 0% 10%',
      mutedForeground: '0 0% 55%',
      accent: '262 83% 58%',
      accentForeground: '0 0% 100%',
      destructive: '0 62% 50%',
      destructiveForeground: '0 0% 100%',
      border: '0 0% 10%',
      input: '0 0% 10%',
      ring: '262 83% 58%',
      sidebarBackground: '0 0% 0%',
      sidebarForeground: '0 0% 90%',
      sidebarPrimary: '262 83% 58%',
      sidebarAccent: '0 0% 8%',
      sidebarBorder: '0 0% 8%',
      purpleGlow: '262 83% 58%',
      purpleSubtle: '262 30% 15%',
    },
  },
  {
    id: 'high-contrast',
    name: 'Kontrast',
    mode: 'dark',
    colors: {
      background: '0 0% 0%',
      foreground: '0 0% 100%',
      card: '0 0% 5%',
      cardForeground: '0 0% 100%',
      popover: '0 0% 5%',
      popoverForeground: '0 0% 100%',
      primary: '60 100% 50%',
      primaryForeground: '0 0% 0%',
      secondary: '0 0% 15%',
      secondaryForeground: '0 0% 100%',
      muted: '0 0% 20%',
      mutedForeground: '0 0% 80%',
      accent: '60 100% 50%',
      accentForeground: '0 0% 0%',
      destructive: '0 100% 50%',
      destructiveForeground: '0 0% 100%',
      border: '0 0% 30%',
      input: '0 0% 20%',
      ring: '60 100% 50%',
      sidebarBackground: '0 0% 0%',
      sidebarForeground: '0 0% 100%',
      sidebarPrimary: '60 100% 50%',
      sidebarAccent: '0 0% 15%',
      sidebarBorder: '0 0% 30%',
      purpleGlow: '60 100% 50%',
      purpleSubtle: '60 50% 20%',
    },
  },
  // Light Themes
  {
    id: 'light-purple',
    name: 'Lila Hell',
    mode: 'light',
    colors: {
      background: '0 0% 100%',
      foreground: '240 10% 4%',
      card: '0 0% 98%',
      cardForeground: '240 10% 4%',
      popover: '0 0% 100%',
      popoverForeground: '240 10% 4%',
      primary: '262 83% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '240 5% 92%',
      secondaryForeground: '240 10% 4%',
      muted: '240 5% 96%',
      mutedForeground: '240 5% 35%',
      accent: '262 83% 50%',
      accentForeground: '0 0% 100%',
      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',
      border: '240 5% 90%',
      input: '240 5% 90%',
      ring: '262 83% 50%',
      sidebarBackground: '240 5% 97%',
      sidebarForeground: '240 10% 20%',
      sidebarPrimary: '262 83% 50%',
      sidebarAccent: '240 5% 92%',
      sidebarBorder: '240 5% 90%',
      purpleGlow: '262 83% 50%',
      purpleSubtle: '262 30% 90%',
    },
  },
  {
    id: 'light-blue',
    name: 'Blau Hell',
    mode: 'light',
    colors: {
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 98%',
      cardForeground: '222 47% 11%',
      popover: '0 0% 100%',
      popoverForeground: '222 47% 11%',
      primary: '217 91% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '214 32% 91%',
      secondaryForeground: '222 47% 11%',
      muted: '210 40% 96%',
      mutedForeground: '215 20% 35%',
      accent: '199 89% 48%',
      accentForeground: '0 0% 100%',
      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',
      border: '214 32% 91%',
      input: '214 32% 91%',
      ring: '217 91% 50%',
      sidebarBackground: '210 40% 98%',
      sidebarForeground: '222 47% 20%',
      sidebarPrimary: '217 91% 50%',
      sidebarAccent: '214 32% 91%',
      sidebarBorder: '214 32% 91%',
      purpleGlow: '217 91% 50%',
      purpleSubtle: '217 40% 90%',
    },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    mode: 'light',
    colors: {
      background: '40 30% 96%',
      foreground: '30 20% 15%',
      card: '40 30% 94%',
      cardForeground: '30 20% 15%',
      popover: '40 30% 96%',
      popoverForeground: '30 20% 15%',
      primary: '30 60% 45%',
      primaryForeground: '0 0% 100%',
      secondary: '40 20% 88%',
      secondaryForeground: '30 20% 15%',
      muted: '40 20% 90%',
      mutedForeground: '30 15% 40%',
      accent: '25 70% 50%',
      accentForeground: '0 0% 100%',
      destructive: '0 62% 50%',
      destructiveForeground: '0 0% 100%',
      border: '40 20% 85%',
      input: '40 20% 85%',
      ring: '30 60% 45%',
      sidebarBackground: '40 30% 94%',
      sidebarForeground: '30 20% 20%',
      sidebarPrimary: '30 60% 45%',
      sidebarAccent: '40 20% 88%',
      sidebarBorder: '40 20% 85%',
      purpleGlow: '30 60% 45%',
      purpleSubtle: '30 30% 85%',
    },
  },
];

export const getThemeById = (id: string): FullTheme | undefined => {
  return THEMES.find(t => t.id === id);
};

export const getThemesByMode = (mode: 'dark' | 'light'): FullTheme[] => {
  return THEMES.filter(t => t.mode === mode);
};

export const applyTheme = (theme: FullTheme) => {
  const root = document.documentElement;
  const colors = theme.colors;
  
  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--foreground', colors.foreground);
  root.style.setProperty('--card', colors.card);
  root.style.setProperty('--card-foreground', colors.cardForeground);
  root.style.setProperty('--popover', colors.popover);
  root.style.setProperty('--popover-foreground', colors.popoverForeground);
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', colors.primaryForeground);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-foreground', colors.secondaryForeground);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-foreground', colors.mutedForeground);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-foreground', colors.accentForeground);
  root.style.setProperty('--destructive', colors.destructive);
  root.style.setProperty('--destructive-foreground', colors.destructiveForeground);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--input', colors.input);
  root.style.setProperty('--ring', colors.ring);
  root.style.setProperty('--sidebar-background', colors.sidebarBackground);
  root.style.setProperty('--sidebar-foreground', colors.sidebarForeground);
  root.style.setProperty('--sidebar-primary', colors.sidebarPrimary);
  root.style.setProperty('--sidebar-accent', colors.sidebarAccent);
  root.style.setProperty('--sidebar-border', colors.sidebarBorder);
  root.style.setProperty('--purple-glow', colors.purpleGlow);
  root.style.setProperty('--purple-subtle', colors.purpleSubtle);
};
