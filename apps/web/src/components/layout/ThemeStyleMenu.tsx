'use client';

import { useTheme, type ColorScheme } from '@/components/providers/ThemeProvider';

const styleOptions: Array<{ key: ColorScheme; label: string; description: string; icon: 'wechat' | 'glass' | 'magazine' }> = [
  { key: 'wechat', label: '微信', description: '清爽实用', icon: 'wechat' },
  { key: 'glass', label: '玻璃', description: '通透柔和', icon: 'glass' },
  { key: 'magazine', label: '杂志', description: '纸感阅读', icon: 'magazine' },
];

interface ThemeStyleMenuProps {
  onSelect?: () => void;
}

export function ThemeStyleMenu({ onSelect }: ThemeStyleMenuProps) {
  const { colorScheme, setColorScheme } = useTheme();

  return (
    <div className="theme-style-menu" role="group" aria-label="主题风格">
      <div className="theme-menu-label">风格</div>
      {styleOptions.map((option) => {
        const active = colorScheme === option.key;
        return (
          <button
            key={option.key}
            className="theme-style-option"
            type="button"
            aria-pressed={active}
            onClick={() => {
              setColorScheme(option.key);
              onSelect?.();
            }}
          >
            <ThemeStyleIcon type={option.icon} active={active} />
            <span className="theme-style-copy">
              <span className="theme-style-title">{option.label}</span>
              <span className="theme-style-desc">{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ThemeStyleIcon({ type, active }: { type: 'wechat' | 'glass' | 'magazine'; active: boolean }) {
  if (type === 'wechat') {
    return (
      <svg className="theme-style-icon theme-style-icon--wechat" data-active={active} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M13.4 9.2c-5 0-8.9 3.1-8.9 7 0 2.2 1.3 4.1 3.3 5.4l-.8 2.9 3.2-1.6c1 .3 2 .4 3.2.4 5 0 8.9-3.1 8.9-7s-4-7.1-8.9-7.1Z" />
        <path d="M20.2 13.1c4.2 0 7.4 2.6 7.4 5.8 0 1.8-1 3.4-2.7 4.5l.7 2.4-2.7-1.3c-.8.2-1.7.4-2.7.4-4.2 0-7.4-2.6-7.4-5.9 0-3.2 3.3-5.9 7.4-5.9Z" />
        <circle cx="10.8" cy="15.8" r="1" />
        <circle cx="16" cy="15.8" r="1" />
      </svg>
    );
  }

  if (type === 'glass') {
    return (
      <svg className="theme-style-icon theme-style-icon--glass" data-active={active} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="7" y="7" width="18" height="18" rx="6" />
        <path d="M11 9.5h10" />
        <path d="M10 22 22 10" />
        <path d="M15 25 25 15" />
      </svg>
    );
  }

  return (
    <svg className="theme-style-icon theme-style-icon--magazine" data-active={active} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="6" width="18" height="20" rx="2" />
      <path d="M11 11h10" />
      <path d="M11 15h7" />
      <path d="M11 19h10" />
      <path d="M11 22h6" />
      <path d="M22 6v20" />
    </svg>
  );
}
