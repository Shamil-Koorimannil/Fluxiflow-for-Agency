import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('fluxiflow-theme');
    return (saved as ThemeMode) || 'light';
  });

  const [systemIsDark, setSystemIsDark] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'system' ? systemIsDark : themeMode === 'dark';

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      const link = document.querySelector("link[rel*='icon']");
      if (link) {
        link.setAttribute('href', '/Fluxiflow%20logo%20white.png');
      }
    } else {
      document.documentElement.classList.remove('dark');
      const link = document.querySelector("link[rel*='icon']");
      if (link) {
        link.setAttribute('href', '/Fluxiflow%20logo%20black.png');
      }
    }
  }, [isDark]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('fluxiflow-theme', mode);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};
