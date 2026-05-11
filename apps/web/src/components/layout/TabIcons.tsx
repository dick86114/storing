'use client';

// iOS 风格图标 - 简洁线条，激活时填充

interface IconProps {
  size?: number;
  color?: string;
  filled?: boolean;
}

// 收件箱 - 托盘样式
export function InboxIcon({ size = 24, color = '#8E8E93', filled = false }: IconProps) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M4 8H20V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V8Z" />
        <path d="M12 8V4" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M8 12L12 16L16 12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8H20V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V8Z" />
      <path d="M12 8V4" />
      <path d="M8 12L12 16L16 12" opacity="0.5" />
    </svg>
  );
}

// 收藏 - 心形
export function HeartIcon({ size = 24, color = '#8E8E93', filled = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21C12 21 4 14.5 4 8.5C4 5.42 6.42 3 9 3C10.24 3 11.09 4.19 12 5C12.91 4.19 13.76 3 15 3C17.58 3 20 5.42 20 8.5C20 14.5 12 21 12 21Z" />
    </svg>
  );
}

// 归档 - 箱子样式
export function ArchiveIcon({ size = 24, color = '#8E8E93', filled = false }: IconProps) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M4 8L6 4H18L20 8" fill={color} />
        <line x1="12" y1="4" x2="12" y2="8" stroke={color} strokeWidth="1.5" />
        <path d="M8 12L12 16L16 12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M4 8L6 4H18L20 8" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <path d="M8 12L12 16L16 12" opacity="0.5" />
    </svg>
  );
}