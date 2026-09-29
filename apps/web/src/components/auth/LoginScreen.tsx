'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { useToast } from '@/components/ui/Toast';

/** 只接受站内相对路径，避免 ?next= 被当成开放重定向 */
function safeNext(raw: string | null): string {
  if (!raw) return '/inbox';
  if (!raw.startsWith('/')) return '/inbox';
  if (raw.startsWith('//')) return '/inbox';
  return raw;
}

const FEATURES = [
  { title: 'AI 摘要', desc: '长文自动提炼要点，读之前就知道值不值得读' },
  { title: '智能分类', desc: '自动归入对应分类，不用手动整理' },
  { title: '自动标签', desc: '生成主题标签，检索时自然想得起来' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  const next = safeNext(searchParams.get('next'));

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  // 已经登录还停在 /login 的情况（比如手动输地址），直接送回去
  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace(next);
  }, [authLoading, isAuthenticated, router, next]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!username.trim() || !password.trim()) {
        setError('请输入用户名和密码');
        return;
      }

      setLoading(true);
      try {
        await login(username.trim(), password.trim());
        showToast('登录成功');
        router.replace(next);
      } catch (err: any) {
        setError(err?.message || '登录失败');
      } finally {
        setLoading(false);
      }
    },
    [username, password, login, router, next, showToast]
  );

  return (
    <div className="auth-page">
      <div className="auth-page-card">
        <aside className="auth-page-brand">
          <div className="auth-page-brand-mark">
            <span className="app-brand-title">乾坤戒</span>
          </div>
          <p className="auth-page-tagline">AI 驱动的个人稍后阅读平台</p>
          <ul className="auth-page-features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <strong>{f.title}</strong>
                <span>{f.desc}</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="auth-page-form">
          <h1 className="auth-page-title">登录乾坤戒</h1>
          <p className="auth-page-subtitle">收藏的文章由 AI 自动摘要、分类与打标签</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-page-field">
              <label htmlFor="auth-username">用户名</label>
              <input
                id="auth-username"
                ref={usernameRef}
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="auth-modal-input"
              />
            </div>

            <div className="auth-page-field">
              <label htmlFor="auth-password">密码</label>
              <div className="auth-page-password">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="auth-modal-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  className="auth-page-eye"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M17.94 17.94A10.97 10.97 0 0112 21c-5.12 0-9.45-3.52-11-8 1.2-3.38 3.76-6.06 7-7.48M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7ZM7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="auth-page-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="auth-page-submit">
              {loading ? '登录中…' : '登录'}
            </button>
          </form>

          <button type="button" onClick={() => router.back()} className="auth-page-guest">
            先随便逛逛
          </button>
        </div>
      </div>
    </div>
  );
}

export function LoginScreen() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
