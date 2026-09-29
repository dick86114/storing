'use client';

import { AppstoreOutlined, HeartOutlined, FolderOutlined, ExportOutlined, CloudUploadOutlined } from '@ant-design/icons';
import type { AppNavKey } from '@/lib/navigation';

/** 主导航图标表，顶部导航与左栏导航共用。 */
export const NAV_ICONS = {
  inbox: AppstoreOutlined,
  favorites: HeartOutlined,
  archive: FolderOutlined,
  published: ExportOutlined,
  collect: CloudUploadOutlined,
} satisfies Record<AppNavKey, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>;
