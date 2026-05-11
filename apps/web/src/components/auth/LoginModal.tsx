'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/components/providers/AuthContext';
import { useToast } from '@/components/ui/Toast';

export function LoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
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
      onClose();
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in oklch, var(--bg) 60%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 380,
          maxWidth: 'calc(100vw - 48px)',
          background: 'var(--glass)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: '1px solid var(--glass-border)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          padding: 32,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 18, height: 18 }}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* 标题 */}
        <h2 style={{ fontSize: 22, fontWeight: 600, textAlign: 'center', marginBottom: 24, color: 'var(--fg)' }}>
          管理员登录
        </h2>

        <form onSubmit={handleSubmit}>
          {/* 用户名 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, color: 'var(--muted)', marginBottom: 6 }}>
              用户名
            </label>
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                height: 44,
                padding: '0 14px',
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--bg)',
                color: 'var(--fg)',
                fontSize: 15,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="admin"
            />
          </div>

          {/* 密码 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, color: 'var(--muted)', marginBottom: 6 }}>
              密码
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 14px',
                  paddingRight: 44,
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  background: 'var(--bg)',
                  color: 'var(--fg)',
                  fontSize: 15,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 11,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
                  {showPassword
                    ? <path d="M17.94 17.94A10.97 10.97 0 0112 21c-5.12 0-9.45-3.52-11-8 1.2-3.38 3.76-6.06 7-7.48M1 1l22 22" />
                    : <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7ZM7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" />
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
              {error}
            </p>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 44,
              background: loading ? 'var(--muted)' : 'var(--accent)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 15,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}