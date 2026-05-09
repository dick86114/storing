'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';

/**
 * 移动端双击返回退出功能
 * 第一次按返回显示提示，第二次（2秒内）退出页面
 */
export function useDoubleBackExit() {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const lastBackTime = useRef(0);
  const exitTimeout = useRef<NodeJS.Timeout | null>(null);

  // 是否为移动端
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  useEffect(() => {
    if (!isMobile) return;

    const handlePopState = (e: PopStateEvent) => {
      const now = Date.now();
      const timeDiff = now - lastBackTime.current;

      // 如果在 2 秒内连续按返回
      if (timeDiff < 2000 && lastBackTime.current > 0) {
        // 清除提示定时器
        if (exitTimeout.current) {
          clearTimeout(exitTimeout.current);
          exitTimeout.current = null;
        }
        // 退出：关闭页面或跳转到首页
        showToast('正在退出...');
        // 延迟一点点让 toast 显示
        setTimeout(() => {
          window.close();
          // 如果 window.close 不生效（大部分浏览器会阻止），跳转到空白页
          if (!window.closed) {
            window.location.href = 'about:blank';
          }
        }, 300);
      } else {
        // 第一次按返回，显示提示
        lastBackTime.current = now;
        showToast('再按一次退出');

        // 2 秒后重置状态
        exitTimeout.current = setTimeout(() => {
          lastBackTime.current = 0;
        }, 2000);

        // 阻止这次返回，让用户留在当前页
        e.preventDefault();
        // 推一个历史记录，让用户可以再次触发 popstate
        window.history.pushState(null, '', pathname);
      }
    };

    // 初始化：推一个历史记录，确保 popstate 能触发
    window.history.pushState(null, '', pathname);

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimeout.current) {
        clearTimeout(exitTimeout.current);
      }
    };
  }, [isMobile, pathname, showToast]);
}