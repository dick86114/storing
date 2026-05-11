'use client';

// 玻璃主题风格图标 - 使用主题变量颜色

interface IconProps {
  size?: number;
  color?: string;
  filled?: boolean;
}

// 收件箱 - 托盘样式
export function InboxIcon({ size = 24, color, filled = false }: IconProps) {
  const strokeColor = color || 'var(--muted)';
  const fillColor = color || 'var(--accent)';

  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
        {/* 填充托盘 */}
        <rect x="3" y="6" width="18" height="15" rx="2" fill={fillColor} />
        {/* 顶部内容线 */}
        <path d="M7 10H17" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 14H17" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
        {/* 收取箭头 */}
        <path d="M12 16L12 6" stroke={fillColor} strokeWidth="2" strokeLinecap="round" />
        <path d="M8 10L12 6L16 10" stroke={fillColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
      {/* 托盘轮廓 */}
      <rect x="3" y="6" width="18" height="15" rx="2" stroke={strokeColor} strokeWidth="1.5" />
      {/* 顶部内容线 */}
      <path d="M7 10H17" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M7 14H17" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      {/* 收取箭头 */}
      <path d="M12 16L12 6" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <path d="M8 10L12 6L16 10" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

// 收藏 - 心形
export function HeartIcon({ size = 24, color, filled = false }: IconProps) {
  const strokeColor = color || 'var(--muted)';
  const fillColor = color || 'var(--accent)';

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {/* 心形 */}
      <path
        d="M12 21C12 21 4 14.5 4 8.5C4 5.42 6.42 3 9 3C10.24 3 11.09 4.19 12 5C12.91 4.19 13.76 3 15 3C17.58 3 20 5.42 20 8.5C20 14.5 12 21 12 21Z"
        fill={filled ? fillColor : 'none'}
        stroke={filled ? fillColor : strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 归档 - 箱子样式
export function ArchiveIcon({ size = 24, color, filled = false }: IconProps) {
  const strokeColor = color || 'var(--muted)';
  const fillColor = color || 'var(--accent)';

  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
        {/* 箱子填充 */}
        <rect x="3" y="7" width="18" height="14" rx="2" fill={fillColor} />
        {/* 盖板 */}
        <path d="M3 7L5 3H19L21 7" fill={fillColor} />
        {/* 盖板中线 */}
        <line x1="12" y1="3" x2="12" y2="7" stroke={fillColor} strokeWidth="2" />
        {/* 存入箭头 */}
        <path d="M12 11V17" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 15L12 19L16 15" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
      {/* 箱子轮廓 */}
      <rect x="3" y="7" width="18" height="14" rx="2" stroke={strokeColor} strokeWidth="1.5" />
      {/* 盖板 */}
      <path d="M3 7L5 3H19L21 7" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 盖板中线 */}
      <line x1="12" y1="3" x2="12" y2="7" stroke={strokeColor} strokeWidth="1.5" />
      {/* 存入箭头 */}
      <path d="M12 11V17" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <path d="M8 15L12 19L16 15" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}