'use client';

import { useState, useEffect } from 'react';

interface BookmarkButtonProps {
  onClick: () => void;
}

export function BookmarkButton({ onClick }: BookmarkButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    onClick();
    setIsAnimating(true);
  };

  useEffect(() => {
    if (isAnimating) {
      // 动画持续 1.5 秒后恢复
      const timer = setTimeout(() => setIsAnimating(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  return (
    <button
      className="bookmark-button"
      onClick={handleClick}
      type="button"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* 撒花效果 */}
      {isAnimating && <ConfettiEffect />}

      {/* Icon */}
      <div
        className="bookmark-icon"
        style={{
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.3s ease',
          transform: isAnimating ? 'scale(1.2)' : 'scale(1)',
        }}
      >
        {isAnimating ? (
          // 打钩图标
          <svg
            viewBox="0 0 24 24"
            fill="var(--accent)"
            style={{ width: '20px', height: '20px' }}
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        ) : (
          // 书签图标 - 使用书签/旗帜样式
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: '20px', height: '20px' }}
          >
            <path d="M4 19.5v-15A2 2 0 0 1 6 2.5h12a2 2 0 0 1 2 2v15" />
            <path d="M4 19.5l8-6 8 6" />
          </svg>
        )}
      </div>

      <span
        style={{
          fontSize: '11px',
          color: isAnimating ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'color 0.3s ease',
        }}
      >
        {isAnimating ? '已保存' : '书签'}
      </span>
    </button>
  );
}

// 撒花效果组件 - 四周飞溅特效
function ConfettiEffect() {
  const particles = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    angle: i * 22.5 + Math.random() * 10 - 5, // 均匀分布在360度，加一点随机偏差
    speed: 30 + Math.random() * 20, // 随机速度
    size: 4 + Math.random() * 3, // 随机大小
    color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9'][Math.floor(Math.random() * 7)],
    rotation: Math.random() * 360,
    shape: Math.random() > 0.5 ? 'circle' : 'square', // 随机形状
  }));

  return (
    <div
      style={{
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            background: p.color,
            transform: 'translate(-50%, -50%)',
            animation: `confetti-splash-${p.id} 0.6s ease-out forwards`,
            opacity: 0.9,
          }}
        />
      ))}
      <style>{`
        ${particles.map((p) => `
          @keyframes confetti-splash-${p.id} {
            0% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(0.5);
            }
            50% {
              opacity: 1;
              transform: translate(
                calc(-50% + ${Math.cos(p.angle * Math.PI / 180) * p.speed}px),
                calc(-50% + ${Math.sin(p.angle * Math.PI / 180) * p.speed}px)
              ) scale(1) rotate(${p.rotation}deg);
            }
            100% {
              opacity: 0;
              transform: translate(
                calc(-50% + ${Math.cos(p.angle * Math.PI / 180) * p.speed * 1.5}px),
                calc(-50% + ${Math.sin(p.angle * Math.PI / 180) * p.speed * 1.5}px)
              ) scale(0.3) rotate(${p.rotation + 180}deg);
            }
          }
        `).join('\n')}
      `}</style>
    </div>
  );
}
