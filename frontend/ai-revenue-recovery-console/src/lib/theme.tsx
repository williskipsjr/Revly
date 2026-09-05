import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {}
});

const THEME_STORAGE_KEY = 'revly_theme';

export function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    // Default to light so the user immediately experiences the new light orange & neon orange card design
    return 'light';
  }
  return 'light';
}

export function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // localStorage may fail in sandboxed iframes
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
