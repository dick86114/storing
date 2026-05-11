'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
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

    if (!currentPassword.trim() || !newPassword.trim()) {
      setError('请填写所有字段');
      return;
    }

    if (newPassword.length < 4) {
      setError('新密码至少需要 4 个字符');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword.trim(), newPassword.trim());
      showToast('密码已更新');
      onClose();
    } catch (err: any) {
      setError(err.message || '修改密码失败');
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
          修改密码
        </h2>

        <form onSubmit={handleSubmit}>
          {/* 当前密码 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, color: 'var(--muted)', marginBottom: 6 }}>
              当前密码
            </label>
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
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
                placeholder="请输入当前密码"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
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
                  {showCurrentPassword
                    ? <path d="M17.94 17.94A10.97 10.97 0 0112 21c-5.12 0-9.45-3.52-11-8 1.2-3.38 3.76-6.06 7-7.48M1 1l22 22" />
                    : <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7ZM7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" />
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* 新密码 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, color: 'var(--muted)', marginBottom: 6 }}>
              新密码
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
                placeholder="请输入新密码"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
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
                  {showNewPassword
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

          {/* 按钮 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                height: 44,
                background: 'var(--fg-soft)',
                border: 'none',
                borderRadius: 10,
                color: 'var(--fg)',
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
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
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}