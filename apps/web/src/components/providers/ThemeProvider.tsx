'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'wechat' | 'glass' | 'aurora' | 'magazine' | 'xianxia';
/** 排版维度：grid = 卡片网格（默认），list = 左栏导航 + 单列横向行 */
export type LayoutMode = 'grid' | 'list';

const COLOR_SCHEMES: readonly ColorScheme[] = ['wechat', 'glass', 'aurora', 'magazine', 'xianxia'];
const LAYOUT_MODES: readonly LayoutMode[] = ['grid', 'list'];
const LAYOUT_STORAGE_KEY = 'storing:layout';

interface ThemeContextValue {
  theme: ThemeMode;
  resolved: 'light' | 'dark';
  setTheme: (t: ThemeMode) => void;
  toggle: () => void;
  colorScheme: ColorScheme;
  setColorScheme: (c: ColorScheme) => void;
  layout: LayoutMode;
  setLayout: (l: LayoutMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';

  const params = new URLSearchParams(window.location.search);
  const sharedTheme = params.get('theme') as ThemeMode | null;
  const savedTheme = localStorage.getItem('theme') as ThemeMode | null;

  if (sharedTheme === 'light' || sharedTheme === 'dark' || sharedTheme === 'system') return sharedTheme;
  if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') return savedTheme;
  return 'system';
}

function readInitialColorScheme(): ColorScheme {
  if (typeof window === 'undefined') return 'wechat';

  const params = new URLSearchParams(window.location.search);
  const sharedScheme = params.get('scheme') || params.get('style');
  const savedScheme = localStorage.getItem('colorScheme');

  if (COLOR_SCHEMES.includes(sharedScheme as ColorScheme)) return sharedScheme as ColorScheme;
  if (COLOR_SCHEMES.includes(savedScheme as ColorScheme)) return savedScheme as ColorScheme;
  return 'wechat';
}

function readInitialLayout(): LayoutMode {
  if (typeof window === 'undefined') return 'grid';

  const params = new URLSearchParams(window.location.search);
  const sharedLayout = params.get('layout');
  const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);

  if (LAYOUT_MODES.includes(sharedLayout as LayoutMode)) return sharedLayout as LayoutMode;
  if (LAYOUT_MODES.includes(savedLayout as LayoutMode)) return savedLayout as LayoutMode;
  return 'grid';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme);
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(readInitialColorScheme);
  const [layout, setLayoutState] = useState<LayoutMode>(readInitialLayout);
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedTheme = params.get('theme') as ThemeMode | null;
    const sharedScheme = params.get('scheme') || params.get('style');
    const sharedLayout = params.get('layout');
    const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
    const savedScheme = localStorage.getItem('colorScheme');
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);

    if (sharedTheme === 'light' || sharedTheme === 'dark' || sharedTheme === 'system') {
      setThemeState(sharedTheme);
      localStorage.setItem('theme', sharedTheme);
    } else if (savedTheme) {
      setThemeState(savedTheme);
    }

    if (COLOR_SCHEMES.includes(sharedScheme as ColorScheme)) {
      setColorSchemeState(sharedScheme as ColorScheme);
      localStorage.setItem('colorScheme', sharedScheme as string);
    } else if (COLOR_SCHEMES.includes(savedScheme as ColorScheme)) {
      setColorSchemeState(savedScheme as ColorScheme);
    } else if (savedScheme) {
      // 旧主题（default/spring/summer/autumn/winter 等）统一迁移到微信主题。
      setColorSchemeState('wechat');
      localStorage.setItem('colorScheme', 'wechat');
    }

    if (LAYOUT_MODES.includes(sharedLayout as LayoutMode)) {
      setLayoutState(sharedLayout as LayoutMode);
      localStorage.setItem(LAYOUT_STORAGE_KEY, sharedLayout as string);
    } else if (LAYOUT_MODES.includes(savedLayout as LayoutMode)) {
      setLayoutState(savedLayout as LayoutMode);
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const r = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      setResolved(r);
      // 同时设置 theme、colorScheme 和 layout
      document.documentElement.setAttribute('data-theme', r);
      document.documentElement.setAttribute('data-color-scheme', colorScheme);
      document.documentElement.setAttribute('data-layout', layout);
      document.documentElement.style.colorScheme = r;
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [theme, colorScheme, layout]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
  }, []);

  const setColorScheme = useCallback((c: ColorScheme) => {
    setColorSchemeState(c);
    localStorage.setItem('colorScheme', c);
    document.documentElement.setAttribute('data-color-scheme', c);
  }, []);

  const setLayout = useCallback((l: LayoutMode) => {
    setLayoutState(l);
    localStorage.setItem(LAYOUT_STORAGE_KEY, l);
    document.documentElement.setAttribute('data-layout', l);
  }, []);

  const toggle = useCallback(() => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    localStorage.setItem('theme', next);
  }, [resolved]);

  const value = useMemo(() => ({
    theme,
    resolved,
    setTheme,
    toggle,
    colorScheme,
    setColorScheme,
    layout,
    setLayout,
  }), [theme, resolved, setTheme, toggle, colorScheme, setColorScheme, layout, setLayout]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
