import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'coral' | 'ocean' | 'violet' | 'forest' | 'sunset';

export interface ThemePalette {
  id: ThemeId;
  name: string;
  /** HSL triplet strings (no hsl() wrapper) */
  primary: string;
  accent: string;
  /** Hex swatches for the picker preview */
  swatches: string[];
}

export const THEMES: ThemePalette[] = [
  {
    id: 'coral',
    name: 'Sunset Coral',
    primary: '24 85% 55%',
    accent: '350 75% 55%',
    swatches: ['#e07830', '#e8a87c', '#e05a6e', '#a83b4c'],
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    primary: '217 81% 56%',
    accent: '235 71% 52%',
    swatches: ['#347aea', '#1e4ba3', '#1e2fb0', '#223068'],
  },
  {
    id: 'violet',
    name: 'Royal Violet',
    primary: '266 90% 55%',
    accent: '286 52% 52%',
    swatches: ['#6000d3', '#7c44a5', '#9a4dff', '#361269'],
  },
  {
    id: 'forest',
    name: 'Emerald Forest',
    primary: '160 70% 42%',
    accent: '174 64% 40%',
    swatches: ['#1fae7e', '#0d7a5f', '#2dd4a8', '#0c5d4a'],
  },
  {
    id: 'sunset',
    name: 'Golden Hour',
    primary: '38 92% 52%',
    accent: '18 88% 55%',
    swatches: ['#f5a623', '#e8772a', '#ff5722', '#c4451f'],
  },
];

const STORAGE_KEY = 'color-theme';

const applyTheme = (theme: ThemePalette) => {
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--ring', theme.primary);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--sidebar-primary', theme.primary);
  root.style.setProperty('--sidebar-ring', theme.primary);
};

interface ThemeContextValue {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  themes: ThemePalette[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return saved && THEMES.some(t => t.id === saved) ? saved : 'coral';
  });

  useEffect(() => {
    const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0];
    applyTheme(theme);
  }, [themeId]);

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useColorTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useColorTheme must be used within ThemeProvider');
  return ctx;
};
