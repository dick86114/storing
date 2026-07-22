export const APP_NAV_ITEMS = {
  inbox: { label: '收件箱', href: '/inbox' },
  favorites: { label: '收藏', href: '/favorites' },
  archive: { label: '归档', href: '/archive' },
  published: { label: '发布', href: '/published' },
  collect: { label: '采集', href: '/collect' },
} as const;

export type AppNavKey = keyof typeof APP_NAV_ITEMS;

export const MOBILE_NAV_BREAKPOINT = 810;

export const PRIMARY_NAV_KEYS = ['inbox', 'favorites', 'archive'] as const satisfies readonly AppNavKey[];
export const SECONDARY_NAV_KEYS = ['published'] as const satisfies readonly AppNavKey[];

export function getAppNavKey(pathname: string): AppNavKey | null {
  const key = (Object.keys(APP_NAV_ITEMS) as AppNavKey[]).find(
    (candidate) => pathname === APP_NAV_ITEMS[candidate].href || pathname.startsWith(`${APP_NAV_ITEMS[candidate].href}/`),
  );
  return key ?? null;
}

export function isSecondaryNavKey(key: AppNavKey | null): boolean {
  return key !== null && (SECONDARY_NAV_KEYS as readonly AppNavKey[]).includes(key);
}
