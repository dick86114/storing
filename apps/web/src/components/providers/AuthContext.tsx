'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  id: number;
  username: string;
  role?: string;
  status?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_BOOT_TIMEOUT_MS = 3000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化时从 HttpOnly Cookie 验证会话。
  useEffect(() => {
    let cancelled = false;
    const finishLoading = () => {
      if (!cancelled) setIsLoading(false);
    };
    const bootTimeout = window.setTimeout(finishLoading, AUTH_BOOT_TIMEOUT_MS);

    api.verifyToken()
      .then((data) => {
        if (!cancelled && data.valid && data.user) setUser(data.user);
      })
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(bootTimeout);
        finishLoading();
      });

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.login(username, password);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    void api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  }), [user, isLoading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
