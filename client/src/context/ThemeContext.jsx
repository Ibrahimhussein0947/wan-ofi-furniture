import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Default lets components render outside the provider (e.g. in tests).
const ThemeContext = createContext({ theme: 'light', setTheme: () => {}, toggle: () => {} });
// Also read by the inline script in index.html so the saved theme applies before first paint.
const STORAGE_KEY = 'wanofi.theme';

function initialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage unavailable — fall through to the system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#16110e' : '#3f2a21');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable — the theme still applies for this visit.
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
