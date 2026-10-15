import { useLayoutEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'continental_ui_theme_v1';

function savedTheme(): Theme {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

/** Appearance belongs to this browser, never to the shared financial state. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(savedTheme);
  useLayoutEffect(() => {
    document.documentElement.dataset.ctTheme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* A blocked store must not prevent rendering. */ }
  }, [theme]);
  useLayoutEffect(() => {
    const changed = (event: StorageEvent) => { if (event.key === KEY) setTheme(savedTheme()); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  return { theme, setTheme };
}
