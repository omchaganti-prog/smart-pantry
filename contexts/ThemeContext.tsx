import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemePreference } from '../types';

interface AccentColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  gradient: string;
  ring: string;
  bg: string;
  text: string;
  shadow: string;
}

const ACCENT_COLOR_MAP: Record<ThemePreference, AccentColors> = {
  [ThemePreference.BASIL]: {
    primary: '#22c55e',
    primaryHover: '#16a34a',
    primaryLight: '#dcfce7',
    primaryDark: '#166534',
    gradient: 'from-green-500 to-emerald-600',
    ring: 'ring-green-500',
    bg: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
    shadow: 'shadow-green-200',
  },
  [ThemePreference.TOMATO]: {
    primary: '#ef4444',
    primaryHover: '#dc2626',
    primaryLight: '#fee2e2',
    primaryDark: '#991b1b',
    gradient: 'from-red-500 to-rose-600',
    ring: 'ring-red-500',
    bg: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    shadow: 'shadow-red-200',
  },
  [ThemePreference.LEMON]: {
    primary: '#eab308',
    primaryHover: '#ca8a04',
    primaryLight: '#fef9c3',
    primaryDark: '#854d0e',
    gradient: 'from-yellow-400 to-amber-500',
    ring: 'ring-yellow-400',
    bg: 'bg-yellow-400',
    text: 'text-yellow-600 dark:text-yellow-400',
    shadow: 'shadow-yellow-200',
  },
  [ThemePreference.BLUEBERRY]: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryLight: '#dbeafe',
    primaryDark: '#1e40af',
    gradient: 'from-blue-500 to-indigo-600',
    ring: 'ring-blue-500',
    bg: 'bg-blue-600',
    text: 'text-blue-600 dark:text-blue-400',
    shadow: 'shadow-blue-200',
  },
  [ThemePreference.LATTE]: {
    primary: '#78716c',
    primaryHover: '#57534e',
    primaryLight: '#f5f5f4',
    primaryDark: '#44403c',
    gradient: 'from-stone-500 to-stone-600',
    ring: 'ring-stone-500',
    bg: 'bg-stone-500',
    text: 'text-stone-600 dark:text-stone-400',
    shadow: 'shadow-stone-200',
  },
};

interface ThemeContextType {
  accentTheme: ThemePreference;
  accentColors: AccentColors;
  setAccentTheme: (theme: ThemePreference) => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'smartpantry_accent_theme';
const DARK_MODE_KEY = 'smartpantry_dark_mode';

const getInitialAccentTheme = (): ThemePreference => {
  if (typeof window === 'undefined') return ThemePreference.BASIL;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && Object.values(ThemePreference).includes(stored as ThemePreference)) {
      return stored as ThemePreference;
    }
  } catch {}
  return ThemePreference.BASIL;
};

const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {}
  return false;
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accentTheme, setAccentThemeState] = useState<ThemePreference>(getInitialAccentTheme);
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(getInitialDarkMode);

  const setAccentTheme = (theme: ThemePreference) => {
    setAccentThemeState(theme);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
      updateCSSVariables(theme);
    }
  };

  const setIsDarkMode = (dark: boolean) => {
    setIsDarkModeState(dark);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(DARK_MODE_KEY, String(dark)); } catch {}
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const updateCSSVariables = (theme: ThemePreference) => {
    if (typeof window === 'undefined') return;
    const colors = ACCENT_COLOR_MAP[theme];
    document.documentElement.style.setProperty('--accent-primary', colors.primary);
    document.documentElement.style.setProperty('--accent-primary-hover', colors.primaryHover);
    document.documentElement.style.setProperty('--accent-primary-light', colors.primaryLight);
    document.documentElement.style.setProperty('--accent-primary-dark', colors.primaryDark);
  };

  useEffect(() => {
    updateCSSVariables(accentTheme);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const accentColors = ACCENT_COLOR_MAP[accentTheme];

  return (
    <ThemeContext.Provider
      value={{
        accentTheme,
        accentColors,
        setAccentTheme,
        isDarkMode,
        setIsDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { ACCENT_COLOR_MAP };
