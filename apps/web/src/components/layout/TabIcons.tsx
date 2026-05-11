'use client';

// SF Symbols 风格图标组件

interface IconProps {
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function TrayIcon({ size = 24, strokeWidth = 1.5, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 托盘底部 */}
      <rect x="3" y="6" width="18" height="15" rx="2" />
      {/* 顶部两条横线表示内容 */}
      <line x1="7" y1="10" x2="17" y2="10" />
      <line x1="7" y1="14" x2="17" y2="14" />
    </svg>
  );
}

export function HeartIcon({ size = 24, strokeWidth = 1.5, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* iOS 心形轮廓 */}
      <path d="M12 21C12 21 3 14 3 8.5C3 5.5 5.5 3 8.5 3C10.5 3 12 4.5 12 4.5C12 4.5 13.5 3 15.5 3C18.5 3 21 5.5 21 8.5C21 14 12 21 12 21Z" />
    </svg>
  );
}

export function ArchiveBoxIcon({ size = 24, strokeWidth = 1.5, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 箱子主体 */}
      <rect x="3" y="7" width="18" height="14" rx="2" />
      {/* 盖板 */}
      <path d="M3 7L5 3H19L21 7" />
      {/* 盖板横线 */}
      <line x1="12" y1="3" x2="12" y2="7" />
      {/* 内部箭头（归档动作） */}
      <polyline points="8 11 12 15 16 11" />
    </svg>
  );
}