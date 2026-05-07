'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              bottom: 28,
              left: '50%',
              transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
              padding: '10px 20px',
              background: 'var(--fg)',
              color: 'var(--bg)',
              borderRadius: 'var(--radius)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              boxShadow: 'var(--shadow-lg)',
              opacity: visible ? 1 : 0,
              pointerEvents: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 400,
            }}
          >
            {message}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
