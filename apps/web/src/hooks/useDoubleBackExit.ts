'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';

/**
 * 移动端双击返回退出功能
 * 第一次按返回显示提示，第二次（2秒内）退出页面
 * 只在列表页（无文章详情页）时生效
 */
export function useDoubleBackExit() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const { selectedId } = useArticleContext();
  const lastBackTime = useRef(0);
  const exitTimeout = useRef<NodeJS.Timeout | null>(null);

  // 是否为移动端
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  useEffect(() => {
    if (!isMobile) return;

    const handlePopState = (e: PopStateEvent) => {
      // 如果有文章详情页打开，不拦截返回，让 ArticleContext 处理
      if (selectedId) return;

      const now = Date.now();
      const timeDiff = now - lastBackTime.current;

      // 如果在 2 秒内连续按返回
      if (timeDiff < 2000 && lastBackTime.current > 0) {
        // 清除提示定时器
        if (exitTimeout.current) {
          clearTimeout(exitTimeout.current);
          exitTimeout.current = null;
        }
        // 退出
        showToast('正在退出...');
        setTimeout(() => {
          window.close();
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

    // 只在列表页（无文章详情页）时推历史记录
    if (!selectedId) {
      window.history.pushState(null, '', pathname);
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimeout.current) {
        clearTimeout(exitTimeout.current);
      }
    };
  }, [isMobile, pathname, showToast, selectedId]);
}