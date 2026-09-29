'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { NAV_ICONS } from '@/components/layout/navIcons';
import { APP_NAV_ITEMS, SIDE_NAV_KEYS, type AppNavKey } from '@/lib/navigation';

interface AppSideNavProps {
  counts: { inbox: number; favorites: number; archive: number; published?: number };
  activeKey: AppNavKey | null;
  onNavigate: (key: AppNavKey) => void;
  /** 二级筛选区（归档的分类/来源等）由页面通过 SideNavPortal 注入 */
  slotRef?: (el: HTMLDivElement | null) => void;
}

export function AppSideNav({ counts, activeKey, onNavigate, slotRef }: AppSideNavProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const keys = isAuthenticated ? SIDE_NAV_KEYS : (['published'] as const);

  const navigateTo = (key: AppNavKey) => {
    onNavigate(key);
    router.push(APP_NAV_ITEMS[key].href, { scroll: false });
  };

  return (
    <nav className="app-side-nav" aria-label="主导航">
      <div className="app-side-nav-scroll">
        <div className="app-side-nav-group">
          {keys.map((key) => {
            const item = APP_NAV_ITEMS[key];
            const Icon = NAV_ICONS[key];
            const isActive = activeKey === key;
            const count = counts[key] ?? 0;

            return (
              <button
                key={key}
                className={`app-side-nav-item${isActive ? ' is-active' : ''}`}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
                onClick={() => navigateTo(key)}
              >
                <Icon className="app-side-nav-icon" aria-hidden="true" />
                <span className="app-side-nav-label">{item.label}</span>
                <span className="app-side-nav-count">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="app-side-nav-slot" ref={slotRef} />
      </div>
    </nav>
  );
}
