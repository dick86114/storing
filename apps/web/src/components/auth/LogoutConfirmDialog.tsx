'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogoutOutlined } from '@ant-design/icons';

interface LogoutConfirmDialogProps {
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmDialog({ loading, onCancel, onConfirm }: LogoutConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel]);

  return createPortal(
    <div
      className="confirm-dialog-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <section
        className="confirm-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        aria-describedby="logout-confirm-copy"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-icon confirm-dialog-icon--danger" aria-hidden="true">
          <LogoutOutlined />
        </div>
        <div className="confirm-dialog-content">
          <h2 id="logout-confirm-title" className="confirm-dialog-title">确认退出登录？</h2>
          <p id="logout-confirm-copy" className="confirm-dialog-copy">
            退出后需要重新登录，才能继续访问收件箱、收藏和归档内容。
          </p>
        </div>
        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-button confirm-dialog-button--secondary"
            type="button"
            onClick={onCancel}
            disabled={loading}
            autoFocus
          >
            取消
          </button>
          <button
            className="confirm-dialog-button confirm-dialog-button--danger"
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '正在退出…' : '退出登录'}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
