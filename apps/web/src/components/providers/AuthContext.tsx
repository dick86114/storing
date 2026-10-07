'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { api, ApiRequestError } from '@/lib/api';

interface User {
  id: number;
  username: string;
  role?: string;
  status?: string;
}

export type AuthBootState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }
  | { status: 'bootFailed'; retry: () => void };

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bootState: AuthBootState;
  retryBoot: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootFailed, setBootFailed] = useState(false);
  const [bootRetryAttempt, setBootRetryAttempt] = useState(0);

  const retryBoot = useCallback(() => {
    setBootFailed(false);
    setIsLoading(true);
    setBootRetryAttempt((attempt) => attempt + 1);
  }, []);

  // 初始化时从 HttpOnly Cookie 验证会话；网络失败不能当成未登录。
  useEffect(() => {
    let cancelled = false;

    api.verifyToken()
      .then((data) => {
        if (cancelled) return;
        setUser(data.valid && data.user ? data.user : null);
        setBootFailed(false);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setUser(null);
        const explicitUnauthenticated = error instanceof ApiRequestError
          && (error.status === 401 || error.status === 403);
        setBootFailed(!explicitUnauthenticated);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [bootRetryAttempt]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.login(username, password);
    setUser(data.user);
    setBootFailed(false);
    setIsLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setBootFailed(false);
  }, []);

  const bootState = useMemo<AuthBootState>(() => {
    if (isLoading) return { status: 'loading' };
    if (bootFailed) return { status: 'bootFailed', retry: retryBoot };
    if (user) return { status: 'authenticated', user };
    return { status: 'unauthenticated' };
  }, [bootFailed, isLoading, retryBoot, user]);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    bootState,
    retryBoot,
    login,
    logout,
  }), [bootState, isLoading, retryBoot, user, login, logout]);

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
