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

// 撒花效果组件
function ConfettiEffect() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i * 30) + Math.random() * 20,
    delay: Math.random() * 0.2,
    color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][Math.floor(Math.random() * 5)],
  }));

  return (
    <div
      style={{
        position: 'absolute',
        top: '-10px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '40px',
        height: '40px',
        pointerEvents: 'none',
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: p.color,
            animation: `confetti-burst 0.8s ease-out ${p.delay}s forwards`,
            transform: `rotate(${p.angle}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-burst {
          0% {
            opacity: 1;
            transform: rotate(var(--angle, 0deg)) translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: rotate(var(--angle, 0deg)) translateY(-25px) scale(0.3);
          }
        }
      `}</style>
    </div>
  );
}