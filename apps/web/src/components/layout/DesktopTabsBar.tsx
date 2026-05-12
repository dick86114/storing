'use client';

import { useRouter } from 'next/navigation';
import { AppstoreOutlined, HeartOutlined, FolderOutlined } from '@ant-design/icons';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: AppstoreOutlined },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartOutlined },
  { key: 'archive', label: '归档', href: '/archive', Icon: FolderOutlined },
];

interface DesktopTabsBarProps {
  counts: { inbox: number; favorites: number; archive: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
}

export function DesktopTabsBar({ counts, activeIndex, onTabChange }: DesktopTabsBarProps) {
  const router = useRouter();

  const handleTabClick = (index: number, href: string) => {
    onTabChange(index);
    router.push(href, { scroll: false });
  };

  return (
    <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        {tabs.map((tab, index) => {
          const isActive = activeIndex === index;
          const count = counts[tab.key as keyof typeof counts] ?? 0;

          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(index, tab.href)}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '14px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              <tab.Icon
                style={{
                  fontSize: '18px',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              />
              <span
                style={{
                  fontSize: '14px',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {tab.label}
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  background: isActive ? 'var(--accent-soft)' : 'var(--tag-bg)',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '12px',
                  borderRadius: '10px',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}