'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'wechat' | 'glass' | 'aurora' | 'magazine' | 'xianxia';

interface ThemeContextValue {
  theme: ThemeMode;
  resolved: 'light' | 'dark';
  setTheme: (t: ThemeMode) => void;
  toggle: () => void;
  colorScheme: ColorScheme;
  setColorScheme: (c: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('wechat');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedTheme = params.get('theme') as ThemeMode | null;
    const sharedScheme = params.get('scheme') || params.get('style');
    const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
    const savedScheme = localStorage.getItem('colorScheme');

    if (sharedTheme === 'light' || sharedTheme === 'dark' || sharedTheme === 'system') {
      setThemeState(sharedTheme);
      localStorage.setItem('theme', sharedTheme);
    } else if (savedTheme) {
      setThemeState(savedTheme);
    }

    if (sharedScheme === 'wechat' || sharedScheme === 'glass' || sharedScheme === 'aurora' || sharedScheme === 'magazine' || sharedScheme === 'xianxia') {
      setColorSchemeState(sharedScheme);
      localStorage.setItem('colorScheme', sharedScheme);
    } else if (savedScheme === 'wechat' || savedScheme === 'glass' || savedScheme === 'aurora' || savedScheme === 'magazine' || savedScheme === 'xianxia') {
      setColorSchemeState(savedScheme);
    } else if (savedScheme) {
      // 旧主题（default/spring/summer/autumn/winter 等）统一迁移到微信主题。
      setColorSchemeState('wechat');
      localStorage.setItem('colorScheme', 'wechat');
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const r = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      setResolved(r);
      // 同时设置 theme 和 colorScheme
      document.documentElement.setAttribute('data-theme', r);
      document.documentElement.setAttribute('data-color-scheme', colorScheme);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [theme, colorScheme]);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
  };

  const setColorScheme = (c: ColorScheme) => {
    setColorSchemeState(c);
    localStorage.setItem('colorScheme', c);
    document.documentElement.setAttribute('data-color-scheme', c);
  };

  const toggle = () => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle, colorScheme, setColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
