import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeName = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggle: () => void;
  /**
   * Increments on every theme change.
   *
   * The canvas draws through Cytoscape, which resolves style values once when they are
   * applied and has no idea a custom property changed underneath it. Components that
   * imperatively style the graph key this off as a dependency, so a theme swap restyles
   * the drawing without remounting it and losing the viewport.
   */
  nonce: number;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'casetrace.theme';

function readInitialTheme(): ThemeName {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* Private browsing and locked-down profiles throw on localStorage. The system
       preference below is a perfectly good fallback, so the error is not worth
       surfacing to an investigator mid-case. */
  }
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

/**
 * Theme.
 *
 * The workspace has to stay legible in a bright room and in a dark one, and — the part
 * that is easy to get wrong — changing theme must not disturb the graph. Since the
 * canvas is styled through CSS custom properties and Cytoscape reads them once at
 * style-application time, the theme swap re-applies the graph style rather than
 * rebuilding the instance, and the viewport survives untouched.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  /* Theme and nonce are one value, so a change to either is a single atomic update.
     Deriving the nonce in an effect instead would schedule a second render for every
     theme change and would also fire once on mount, restyling a graph that has not
     even been drawn yet. */
  const [state, setState] = useState<{ theme: ThemeName; nonce: number }>(() => ({
    theme: readInitialTheme(),
    nonce: 0,
  }));
  const { theme, nonce } = state;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Not being able to remember the preference is not a failure worth reporting. */
    }
  }, [theme]);

  const setTheme = useCallback(
    (next: ThemeName) => setState((s) => ({ theme: next, nonce: s.nonce + 1 })),
    [],
  );
  const toggle = useCallback(
    () =>
      setState((s) => ({
        theme: s.theme === 'dark' ? 'light' : 'dark',
        nonce: s.nonce + 1,
      })),
    [],
  );

  const value = useMemo(() => ({ theme, setTheme, toggle, nonce }), [theme, setTheme, toggle, nonce]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
