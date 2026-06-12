'use client';

import { type ReactNode, useRef, useState } from 'react';
import { CheckOutlined, DownOutlined, LoadingOutlined } from '@ant-design/icons';

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'done';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<unknown> | unknown;
  disabled?: boolean;
  className?: string;
}

const TRIGGER_DISTANCE = 82;
const MAX_DISTANCE = 118;

function getMainScrollTop() {
  const main = document.querySelector('main');
  return Math.max(main?.scrollTop ?? 0, window.scrollY);
}

export function PullToRefresh({ children, onRefresh, disabled = false, className }: PullToRefreshProps) {
  const startYRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  const refreshingRef = useRef(false);
  const [distance, setDistance] = useState(0);
  const [state, setState] = useState<PullState>('idle');

  const reset = (delay = 0) => {
    window.setTimeout(() => {
      setDistance(0);
      setState('idle');
      trackingRef.current = false;
      startYRef.current = null;
    }, delay);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || refreshingRef.current || getMainScrollTop() > 0) return;
    startYRef.current = event.touches[0]?.clientY ?? null;
    trackingRef.current = true;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!trackingRef.current || startYRef.current === null || disabled || refreshingRef.current) return;

    const currentY = event.touches[0]?.clientY ?? startYRef.current;
    const delta = currentY - startYRef.current;
    if (delta <= 0) {
      setDistance(0);
      setState('idle');
      return;
    }

    if (getMainScrollTop() > 0) {
      trackingRef.current = false;
      setDistance(0);
      setState('idle');
      return;
    }

    if (event.cancelable) event.preventDefault();

    const easedDistance = Math.min(MAX_DISTANCE, Math.round(delta * 0.48));
    setDistance(easedDistance);
    setState(easedDistance >= TRIGGER_DISTANCE ? 'ready' : 'pulling');
  };

  const handleTouchEnd = async () => {
    if (!trackingRef.current || disabled || refreshingRef.current) {
      reset();
      return;
    }

    if (distance < TRIGGER_DISTANCE) {
      reset();
      return;
    }

    refreshingRef.current = true;
    setDistance(64);
    setState('refreshing');

    try {
      await onRefresh();
      setState('done');
      reset(520);
    } finally {
      refreshingRef.current = false;
    }
  };

  const label = state === 'ready'
    ? '松开刷新'
    : state === 'refreshing'
      ? '刷新中'
      : state === 'done'
        ? '已刷新'
        : '下拉刷新';

  const icon = state === 'refreshing'
    ? <LoadingOutlined />
    : state === 'done'
      ? <CheckOutlined />
      : <DownOutlined />;

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchCancel={() => reset()}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        transform: distance ? `translateY(${distance}px)` : 'translateY(0)',
        transition: state === 'pulling' || state === 'ready' ? 'none' : 'transform 220ms ease',
        willChange: distance ? 'transform' : 'auto',
      }}
    >
      <div
        className={`pull-refresh-indicator ${state}`}
        aria-hidden={state === 'idle'}
        style={{
          opacity: distance > 0 || state === 'refreshing' || state === 'done' ? 1 : 0,
          transform: `translate(-50%, ${Math.max(-42, distance * -1 - 6)}px)`,
        }}
      >
        <span className="pull-refresh-status-icon">{icon}</span>
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}
