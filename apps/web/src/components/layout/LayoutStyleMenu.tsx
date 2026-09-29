'use client';

import { useTheme, type LayoutMode } from '@/components/providers/ThemeProvider';

const layoutOptions: Array<{ key: LayoutMode; label: string; description: string }> = [
  { key: 'grid', label: '网格', description: '卡片瀑布' },
  { key: 'list', label: '列表', description: '左栏导航' },
];

interface LayoutStyleMenuProps {
  onSelect?: () => void;
}

export function LayoutStyleMenu({ onSelect }: LayoutStyleMenuProps) {
  const { layout, setLayout } = useTheme();

  return (
    <div className="theme-style-menu user-menu-option-grid" role="group" aria-label="排版样式">
      <div className="theme-menu-label">排版</div>
      {layoutOptions.map((option) => {
        const active = layout === option.key;
        return (
          <button
            key={option.key}
            className={`theme-style-option layout-style-option layout-style-option--${option.key}`}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setLayout(option.key);
              onSelect?.();
            }}
          >
            <LayoutStyleIcon type={option.key} />
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

function LayoutStyleIcon({ type }: { type: LayoutMode }) {
  if (type === 'list') {
    return (
      <svg className="theme-style-icon layout-style-icon layout-style-icon--list" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="5" y="7" width="8" height="18" rx="2" />
        <path d="M8 11h2" />
        <path d="M8 15h2" />
        <path d="M8 19h2" />
        <rect x="17" y="8" width="11" height="5" rx="1.4" />
        <rect x="17" y="14" width="11" height="5" rx="1.4" />
        <rect x="17" y="20" width="11" height="4" rx="1.4" />
      </svg>
    );
  }

  return (
    <svg className="theme-style-icon layout-style-icon layout-style-icon--grid" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="6" y="6" width="9" height="9" rx="2" />
      <rect x="17" y="6" width="9" height="9" rx="2" />
      <rect x="6" y="17" width="9" height="9" rx="2" />
      <rect x="17" y="17" width="9" height="9" rx="2" />
    </svg>
  );
}
