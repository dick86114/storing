'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { LeftOutlined, MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, FolderFilled, ShareAltOutlined, LinkOutlined, ReloadOutlined, RobotOutlined, CopyOutlined, ExportOutlined, DeleteOutlined, UpOutlined, DownOutlined, ExclamationCircleOutlined, CloseOutlined, BookOutlined } from '@ant-design/icons';
import { useArticle, useArticleMeta } from '@/hooks/useArticle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthContext';
import { DateText } from '@/lib/formatDate';
import { api } from '@/lib/api';
import { useBookmark } from '@/hooks/useBookmark';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { useTheme, type ColorScheme } from '@/components/providers/ThemeProvider';

const DETAIL_PANEL_DEFAULT_WIDTH = 750;
const DETAIL_PANEL_MIN_WIDTH = 560;
const DETAIL_PANEL_WIDTH_STORAGE_KEY = 'storing:detail-panel-width';

interface WechatDetailPanelProps {
  articleId: number | null;
  onClose: () => void;
  onMutate: () => void;
  isDesktop?: boolean;
}

function findCachedArticleListItem(cache: unknown, articleId: number | null) {
  if (!articleId || !cache || typeof (cache as any).keys !== 'function' || typeof (cache as any).get !== 'function') {
    return null;
  }

  for (const key of (cache as any).keys()) {
    if (typeof key !== 'string' || !key.startsWith('articles:')) continue;
    const data = (cache as any).get(key);
    const article = data?.articles?.find?.((item: any) => item?.id === articleId);
    if (article) return article;
  }

  return null;
}

function isMeaningfulContentElement(element: Element) {
  const text = element.textContent?.replace(/\s+/g, '').trim() || '';
  if (text.length > 0) return true;

  return Array.from(element.querySelectorAll('img')).some((image) => {
    const src = image.getAttribute('src') || image.getAttribute('data-src') || '';
    const alt = image.getAttribute('alt') || '';
    return Boolean(src && !/cover_image|avatar/i.test(alt));
  });
}

function isLeadingCoverBlock(element: Element) {
  const text = element.textContent?.replace(/\s+/g, '').trim() || '';
  const images = Array.from(element.querySelectorAll('img'));
  if (text || images.length !== 1) return false;

  const image = images[0];
  const imageClass = image.getAttribute('class') || '';
  const alt = image.getAttribute('alt') || '';
  return (
    /cover_image|avatar/i.test(alt) ||
    image.hasAttribute('data-cropselx2') ||
    imageClass.includes('rich_pages') ||
    imageClass.includes('wxw-img')
  );
}

function isLeadingPromoBlock(element: Element) {
  const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
  return /飞书云文档|更多玩法应用案例|复制：?https?:\/\//.test(text);
}

function removeCapturedPageChrome(root: Document | Element) {
  root
    .querySelectorAll(
      [
        '#header',
        '#footer',
        '#masthead',
        '#colophon',
        '.site-header',
        '.site-footer',
        '.primary-navigation',
        '.secondary-navigation',
        '.main-navigation',
        '.mobile-navigation',
        '.navigation',
        '.navbar',
        '.nav-menu',
        '.fixed-header',
        '.fixed-footer',
        '.fixed-bottom',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="contentinfo"]',
      ].join(',')
    )
    .forEach((node) => node.remove());
}

function scopeCapturedCss(css: string) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@(?:font-face|keyframes|-webkit-keyframes)[\s\S]*?\}\s*/g, '')
    .replace(/([^{}@]+)\{([^{}]*)\}/g, (match, selectorText: string, body: string) => {
      const scopedSelectors = selectorText
        .split(',')
        .map((selector) => selector.trim())
        .filter(Boolean)
        .map((selector) => {
          if (/^(html|body|:root)(?:\b|[\s.#[:>+~])/.test(selector)) {
            return selector.replace(/^(html|body|:root)/, '.manual-capture-page');
          }
          if (selector.startsWith('.manual-capture-page')) return selector;
          return `.manual-capture-page ${selector}`;
        });

      if (scopedSelectors.length === 0) return match;

      const safeBody = body
        .replace(/position\s*:\s*(fixed|sticky)\s*!?/gi, 'position: static !')
        .replace(/overflow(?:-y)?\s*:\s*(auto|scroll)\s*!?/gi, 'overflow: visible !')
        .replace(/height\s*:\s*100vh\s*!?/gi, 'height: auto !')
        .replace(/min-height\s*:\s*100vh\s*!?/gi, 'min-height: 0 !');

      return `${scopedSelectors.join(', ')} {${safeBody}}`;
    });
}

function getReadableArticleHtml(html: string) {
  if (typeof document === 'undefined' || !html.trim()) return html;

  if (html.includes('data-storing-capture="singlefile"') || html.includes("data-storing-capture='singlefile'")) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script,noscript').forEach((node) => node.remove());
    removeCapturedPageChrome(parsed);
    parsed.querySelectorAll('a[href]').forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });

    const styles = Array.from(parsed.head.querySelectorAll('style'))
      .map((style) => `<style data-manual-capture-style="true">${scopeCapturedCss(style.textContent || '')}</style>`)
      .join('\n');
    const body = parsed.body;
    const wrapper = document.createElement('div');
    wrapper.className = 'manual-capture-page';
    wrapper.setAttribute('data-capture-source', parsed.documentElement.getAttribute('data-capture-source') || '');
    wrapper.innerHTML = body.innerHTML;

    return [styles, wrapper.outerHTML].filter(Boolean).join('\n').trim() || html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  if (container.querySelector('.manual-capture-page')) {
    container.querySelectorAll('script,noscript').forEach((node) => node.remove());
    removeCapturedPageChrome(container);
    return container.innerHTML.trim() || html;
  }
  const contentRoot = container.querySelector<HTMLElement>('#js_content') ?? container;

  contentRoot
    .querySelectorAll(
      [
        'script',
        'style',
        'iframe',
        '#js_row_immersive_stream_wrap',
        '.wx_row_immersive_stream_wrap',
        '#js_novel_card',
        '.novel-card',
        '.rich_media_tool',
        '.rich_media_extra',
        '.qr_code_pc_outer',
      ].join(',')
    )
    .forEach((node) => node.remove());

  if (contentRoot.firstElementChild && isLeadingCoverBlock(contentRoot.firstElementChild)) {
    contentRoot.firstElementChild.remove();
  }

  while (contentRoot.firstElementChild && isLeadingPromoBlock(contentRoot.firstElementChild)) {
    contentRoot.firstElementChild.remove();
  }

  while (contentRoot.firstElementChild && !isMeaningfulContentElement(contentRoot.firstElementChild)) {
    contentRoot.firstElementChild.remove();
  }

  return contentRoot.innerHTML.trim() || html;
}

export function WechatDetailPanel({ articleId, onClose, onMutate, isDesktop }: WechatDetailPanelProps) {
  const { data: article, error: articleError, isLoading, mutate: mutateArticle } = useArticle(articleId);
  const { data: articleMeta } = useArticleMeta(articleId);
  const { mutate: globalMutate, cache } = useSWRConfig();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const { saveBookmark } = useBookmark();

  // 滚动位置追踪
  const scrollPositionRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const appliedSharedScrollRef = useRef<string | null>(null);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [detailPanelWidth, setDetailPanelWidth] = useState(DETAIL_PANEL_DEFAULT_WIDTH);
  const [isDetailPanelFullscreen, setIsDetailPanelFullscreen] = useState(false);
  const [isResizingDetailPanel, setIsResizingDetailPanel] = useState(false);
  const readableContentHtml = useMemo(
    () => (article?.contentHtml ? getReadableArticleHtml(article.contentHtml) : ''),
    [article?.contentHtml]
  );
  const cachedArticle = useMemo(() => findCachedArticleListItem(cache, articleId), [cache, articleId]);
  const fallbackArticle = articleMeta || cachedArticle;

  // 监听滚动位置
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !articleId) return;

    const handleScroll = () => {
      scrollPositionRef.current = content.scrollTop;
    };

    content.addEventListener('scroll', handleScroll, { passive: true });
    return () => content.removeEventListener('scroll', handleScroll);
  }, [articleId]);

  useEffect(() => {
    if (!articleId || isLoading || !readableContentHtml) return;

    const params = new URLSearchParams(window.location.search);
    const articleParam = params.get('article');
    const scrollParam = params.get('scroll');
    const sharedArticleId = articleParam ? Number(articleParam) : NaN;
    const scrollPosition = scrollParam ? Number(scrollParam) : NaN;

    if (
      sharedArticleId !== articleId ||
      !Number.isFinite(scrollPosition) ||
      scrollPosition <= 0
    ) {
      return;
    }

    const scrollKey = `${articleId}:${Math.round(scrollPosition)}`;
    if (appliedSharedScrollRef.current === scrollKey) return;
    appliedSharedScrollRef.current = scrollKey;

    const content = contentRef.current;
    if (!content) return;

    let stopped = false;
    const startedAt = Date.now();
    const maxDuration = 9000;

    const applyScroll = () => {
      if (stopped) return;

      const maxScrollTop = Math.max(0, content.scrollHeight - content.clientHeight);
      content.scrollTop = Math.min(scrollPosition, maxScrollTop);

      const reachedTarget = Math.abs(content.scrollTop - scrollPosition) <= 4;
      const canScrollThatFar = maxScrollTop >= scrollPosition - 4;
      const timedOut = Date.now() - startedAt > maxDuration;

      if ((!reachedTarget || !canScrollThatFar) && !timedOut) {
        window.requestAnimationFrame(applyScroll);
      }
    };

    window.requestAnimationFrame(applyScroll);

    const articleBody = content.querySelector('.article-body');
    const images = Array.from(articleBody?.querySelectorAll('img') ?? []);
    images.forEach((img) => {
      if (!img.complete) img.addEventListener('load', applyScroll, { once: true });
    });

    return () => {
      stopped = true;
      images.forEach((img) => img.removeEventListener('load', applyScroll));
    };
  }, [articleId, readableContentHtml, isLoading]);

  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
  }

  useEffect(() => {
    if (articleId) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const previousHtmlOverflow = document.documentElement.style.overflow;
      const previousHtmlPaddingRight = document.documentElement.style.paddingRight;
      const previousBodyOverflow = document.body.style.overflow;
      const previousBodyPaddingRight = document.body.style.paddingRight;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.classList.add('detail-panel-open');
      return () => {
        document.documentElement.style.overflow = previousHtmlOverflow;
        document.documentElement.style.paddingRight = previousHtmlPaddingRight;
        document.body.style.overflow = previousBodyOverflow;
        document.body.style.paddingRight = previousBodyPaddingRight;
        document.body.classList.remove('detail-panel-open');
      };
    }
  }, [articleId]);

  const getScrollPosition = () => scrollPositionRef.current;

  useEffect(() => {
    if (typeof window === 'undefined' || !isDesktop) return;

    const savedWidth = Number(window.localStorage.getItem(DETAIL_PANEL_WIDTH_STORAGE_KEY));
    const maxWidth = Math.max(DETAIL_PANEL_MIN_WIDTH, window.innerWidth - 96);
    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      setDetailPanelWidth(Math.min(Math.max(savedWidth, DETAIL_PANEL_MIN_WIDTH), maxWidth));
    }
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop) return;

    const handleResize = () => {
      setDetailPanelWidth((width) => Math.min(width, Math.max(DETAIL_PANEL_MIN_WIDTH, window.innerWidth - 96)));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDesktop]);

  const currentDetailPanelWidth = isDetailPanelFullscreen
    ? (typeof window === 'undefined' ? '100vw' : `${window.innerWidth}px`)
    : `${detailPanelWidth}px`;

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isDesktop) return;
    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      startX: event.clientX,
      startWidth: isDetailPanelFullscreen ? window.innerWidth : detailPanelWidth,
    };
    setIsResizingDetailPanel(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;

      const maxWidth = Math.max(DETAIL_PANEL_MIN_WIDTH, window.innerWidth - 96);
      const nextWidth = state.startWidth + (state.startX - moveEvent.clientX);
      if (isDetailPanelFullscreen) setIsDetailPanelFullscreen(false);
      setDetailPanelWidth(Math.min(Math.max(nextWidth, DETAIL_PANEL_MIN_WIDTH), maxWidth));
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setIsResizingDetailPanel(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      setDetailPanelWidth((width) => {
        window.localStorage.setItem(DETAIL_PANEL_WIDTH_STORAGE_KEY, String(Math.round(width)));
        return width;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleResizeDoubleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!isDesktop) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDetailPanelFullscreen((value) => !value);
  };

  const openImageGallery = (img: HTMLImageElement) => {
    const container = contentRef.current?.querySelector('.article-body');
    if (!container) return;

    const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    const imageUrls = imgs.map((img) => img.currentSrc || img.src).filter(Boolean);
    const index = Math.max(0, imgs.indexOf(img));
    setGalleryImages(imageUrls);
    setGalleryIndex(index);
  };

  if (!articleId) return null;

  // 桌面端：右侧面板样式
  if (isDesktop) {
    return (
      <>
        {/* 遮罩层 */}
        <div
          className="detail-panel-overlay"
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: currentDetailPanelWidth,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(2px)',
            zIndex: 1400,
          }}
        />
        {/* 详情面板 */}
        <div
          ref={contentRef}
          className={`detail-panel wechat-detail-panel${isDetailPanelFullscreen ? ' detail-panel--fullscreen' : ''}${isResizingDetailPanel ? ' detail-panel--resizing' : ''}`}
          data-scroll-container="detail"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: currentDetailPanelWidth,
            ['--detail-panel-current-width' as string]: currentDetailPanelWidth,
            height: '100vh',
            background: 'var(--card-bg)',
            borderLeft: '1px solid var(--divider)',
            zIndex: 1500,
            overflowY: 'auto',
          }}
        >
          <button
            type="button"
            className="detail-panel-resize-handle"
            aria-label={isDetailPanelFullscreen ? '双击恢复详情页宽度，拖动调整宽度' : '拖动调整详情页宽度，双击全屏'}
            title={isDetailPanelFullscreen ? '双击恢复，拖动调整宽度' : '拖动调宽，双击全屏'}
            onPointerDown={handleResizePointerDown}
            onDoubleClick={handleResizeDoubleClick}
          />
          <DetailContent
            article={article}
            fallbackArticle={fallbackArticle}
            readableContentHtml={readableContentHtml}
            articleError={articleError}
            isLoading={isLoading}
            onClose={onClose}
            onMutate={onMutate}
            mutateArticle={mutateArticle}
            showToast={showToast}
            isAuthenticated={isAuthenticated}
            refreshCounts={refreshCounts}
            getScrollPosition={getScrollPosition}
            saveBookmark={saveBookmark}
            onOpenImageGallery={openImageGallery}
            contentRef={contentRef}
          />
        </div>
        {galleryIndex !== null && (
          <ImageGalleryLightbox
            images={galleryImages}
            index={galleryIndex}
            onIndexChange={setGalleryIndex}
            onClose={() => setGalleryIndex(null)}
          />
        )}
      </>
    );
  }

  // 移动端：全屏面板样式
  return (
    <div
      ref={contentRef}
      className="detail-panel wechat-detail-panel mobile-detail-panel"
      data-scroll-container="detail"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--card-bg)',
        zIndex: 1500,
        overflowY: 'auto',
      }}
    >
      <DetailContent
        article={article}
        fallbackArticle={fallbackArticle}
        readableContentHtml={readableContentHtml}
        articleError={articleError}
        isLoading={isLoading}
        onClose={onClose}
        onMutate={onMutate}
        mutateArticle={mutateArticle}
        showToast={showToast}
        isAuthenticated={isAuthenticated}
        refreshCounts={refreshCounts}
        getScrollPosition={getScrollPosition}
        saveBookmark={saveBookmark}
        onOpenImageGallery={openImageGallery}
        contentRef={contentRef}
      />
      {galleryIndex !== null && (
        <ImageGalleryLightbox
          images={galleryImages}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </div>
  );
}

function ImageGalleryLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const ignoreNextClickRef = useRef(false);
  const lastImageTapAtRef = useRef(0);
  const gestureRef = useRef<{
    mode: 'idle' | 'swipe' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    startDistance: number;
    startScale: number;
  }>({
    mode: 'idle',
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startDistance: 0,
    startScale: 1,
  });
  const hasPrevious = index > 0;
  const hasNext = index < images.length - 1;
  const imageUrl = images[index];

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    gestureRef.current.mode = 'idle';
  }, [index]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasPrevious) onIndexChange(index - 1);
      if (event.key === 'ArrowRight' && hasNext) onIndexChange(index + 1);
      if ((event.key === '+' || event.key === '=') && scale < 4) setScale((value) => Math.min(4, value + 0.25));
      if (event.key === '-' && scale > 0.5) setScale((value) => {
        const nextScale = Math.max(0.5, value - 0.25);
        if (nextScale <= 1) setOffset({ x: 0, y: 0 });
        return nextScale;
      });
      if (event.key === '0') {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrevious, index, onClose, onIndexChange, scale]);

  if (!imageUrl) return null;

  const goPrevious = () => {
    if (hasPrevious) onIndexChange(index - 1);
  };
  const goNext = () => {
    if (hasNext) onIndexChange(index + 1);
  };

  const toggleZoom = () => {
    setScale((value) => {
      const nextScale = value > 1 ? 1 : 2;
      if (nextScale === 1) setOffset({ x: 0, y: 0 });
      return nextScale;
    });
  };

  const resetGesture = () => {
    gestureRef.current.mode = 'idle';
    gestureRef.current.startDistance = 0;
  };

  const clampOffset = (x: number, y: number, nextScale = scale) => {
    if (nextScale <= 1) return { x: 0, y: 0 };
    const maxX = window.innerWidth * Math.min(0.72, (nextScale - 1) * 0.48);
    const maxY = window.innerHeight * Math.min(0.72, (nextScale - 1) * 0.48);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const getTouchDistance = (touches: React.TouchList) => {
    const first = touches[0];
    const second = touches[1];
    if (!first || !second) return 0;
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };

  const lightbox = (
    <div
      className="image-gallery-lightbox"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (ignoreNextClickRef.current) {
          ignoreNextClickRef.current = false;
          return;
        }
        if (event.target !== event.currentTarget) return;
        const clickX = event.clientX;
        const edgeWidth = window.innerWidth * 0.28;
        if (clickX < edgeWidth && hasPrevious) {
          goPrevious();
          return;
        }
        if (clickX > window.innerWidth - edgeWidth && hasNext) {
          goNext();
          return;
        }
        onClose();
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        toggleZoom();
      }}
      onWheel={(event) => {
        event.preventDefault();
        setScale((value) => {
          const nextScale = Math.min(4, Math.max(0.5, value + (event.deltaY < 0 ? 0.12 : -0.12)));
          if (nextScale <= 1) setOffset({ x: 0, y: 0 });
          return nextScale;
        });
      }}
      onTouchStart={(event) => {
        if (event.touches.length >= 2) {
          event.preventDefault();
          gestureRef.current = {
            mode: 'pinch',
            startX: 0,
            startY: 0,
            startOffsetX: offset.x,
            startOffsetY: offset.y,
            startDistance: getTouchDistance(event.touches),
            startScale: scale,
          };
          return;
        }

        const touch = event.touches[0];
        if (!touch) return;
        gestureRef.current = {
          mode: scale > 1 ? 'pan' : 'swipe',
          startX: touch.clientX,
          startY: touch.clientY,
          startOffsetX: offset.x,
          startOffsetY: offset.y,
          startDistance: 0,
          startScale: scale,
        };
      }}
      onTouchMove={(event) => {
        const gesture = gestureRef.current;
        if (gesture.mode === 'pinch' && event.touches.length >= 2) {
          event.preventDefault();
          ignoreNextClickRef.current = true;
          const distance = getTouchDistance(event.touches);
          if (!gesture.startDistance) return;
          const nextScale = Math.min(4, Math.max(1, gesture.startScale * (distance / gesture.startDistance)));
          setScale(nextScale);
          setOffset((value) => clampOffset(value.x, value.y, nextScale));
          return;
        }

        if (gesture.mode !== 'pan' || event.touches.length !== 1) return;
        event.preventDefault();
        ignoreNextClickRef.current = true;
        const touch = event.touches[0];
        if (!touch) return;
        const nextOffset = clampOffset(
          gesture.startOffsetX + touch.clientX - gesture.startX,
          gesture.startOffsetY + touch.clientY - gesture.startY
        );
        setOffset(nextOffset);
      }}
      onTouchEnd={(event) => {
        const gesture = gestureRef.current;
        if (gesture.mode === 'swipe') {
          const touch = event.changedTouches[0];
          const deltaX = (touch?.clientX ?? gesture.startX) - gesture.startX;
          const deltaY = (touch?.clientY ?? gesture.startY) - gesture.startY;
          if (Math.abs(deltaX) > 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
            ignoreNextClickRef.current = true;
            if (deltaX > 0) goPrevious();
            else goNext();
          } else if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12 && event.target instanceof HTMLImageElement) {
            const now = Date.now();
            if (now - lastImageTapAtRef.current < 280) {
              event.preventDefault();
              ignoreNextClickRef.current = true;
              toggleZoom();
              lastImageTapAtRef.current = 0;
            } else {
              lastImageTapAtRef.current = now;
            }
          }
        }
        resetGesture();
      }}
      onTouchCancel={() => {
        resetGesture();
      }}
    >
      <button className="image-gallery-close" type="button" aria-label="关闭图片预览" onClick={onClose}>
        <CloseOutlined />
      </button>
      <div className="image-gallery-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleZoom();
          }}
          style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
        />
      </div>
    </div>
  );

  return createPortal(lightbox, document.body);
}

type DeleteConfirmMode = 'metadata' | 'permanent';

type SharePosterState = {
  imageUrl: string;
  shareUrl: string;
  blob: Blob;
};

type ShareThemeSnapshot = {
  mode: 'light' | 'dark';
  scheme: ColorScheme;
  colors?: ShareThemeColors;
};

type ShareThemeColors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  cardBg: string;
  readingBg: string;
  fgTitle: string;
  fg: string;
  muted: string;
  border: string;
  glassBorder: string;
  accent: string;
  accentAlt: string;
};

type SharePosterPalette = {
  backgroundStops: [number, string][];
  aurora?: Array<{ x: number; y: number; radius: number; color: string }>;
  title: string;
  muted: string;
  body: string;
  border: string;
  card: string;
  cardInner: string;
  screenshotBackground: string;
  accent: string;
  qrDark: string;
  qrLight: string;
  shadow: string;
  label: string;
};

function resolveCssColor(value: string, fallback: string) {
  if (!value) return fallback;
  const probe = document.createElement('span');
  probe.style.position = 'fixed';
  probe.style.left = '-10000px';
  probe.style.top = '0';
  probe.style.color = fallback;
  probe.style.color = value;
  document.body.appendChild(probe);
  const color = normalizeCanvasColor(getComputedStyle(probe).color || fallback);
  probe.remove();
  return color;
}

function normalizeCanvasColor(color: string) {
  const trimmed = color.trim();
  if (!trimmed.startsWith('oklch(')) return trimmed;

  const match = trimmed.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/i);
  if (!match) return trimmed;

  const l = match[1].endsWith('%') ? Number(match[1].slice(0, -1)) / 100 : Number(match[1]);
  const c = Number(match[2]);
  const h = Number(match[3]) * Math.PI / 180;
  const alphaRaw = match[4];
  const alpha = alphaRaw
    ? alphaRaw.endsWith('%')
      ? Number(alphaRaw.slice(0, -1)) / 100
      : Number(alphaRaw)
    : 1;

  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = lPrime ** 3;
  const m3 = mPrime ** 3;
  const s3 = sPrime ** 3;
  const linearR = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const linearG = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const linearB = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  const toSrgb = (value: number) => {
    const encoded = value <= 0.0031308 ? 12.92 * value : 1.055 * (value ** (1 / 2.4)) - 0.055;
    return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
  };
  const r = toSrgb(linearR);
  const g = toSrgb(linearG);
  const blue = toSrgb(linearB);
  const safeAlpha = Math.min(1, Math.max(0, Number.isFinite(alpha) ? alpha : 1));

  return safeAlpha < 1 ? `rgba(${r}, ${g}, ${blue}, ${safeAlpha})` : `rgb(${r}, ${g}, ${blue})`;
}

function readCurrentShareTheme(mode: 'light' | 'dark', scheme: ColorScheme): ShareThemeSnapshot {
  const styles = getComputedStyle(document.documentElement);
  const cssVar = (name: string, fallback: string) => resolveCssColor(styles.getPropertyValue(name).trim(), fallback);

  return {
    mode,
    scheme,
    colors: {
      bg: cssVar('--bg', mode === 'dark' ? '#172033' : '#f7faf7'),
      surface: cssVar('--surface', mode === 'dark' ? '#1f2937' : '#ffffff'),
      surfaceAlt: cssVar('--surface-alt', mode === 'dark' ? '#263446' : '#eef5f1'),
      cardBg: cssVar('--card-bg', mode === 'dark' ? '#1f2937' : '#ffffff'),
      readingBg: cssVar('--reading-bg', mode === 'dark' ? '#182333' : '#ffffff'),
      fgTitle: cssVar('--fg-title', mode === 'dark' ? '#f8fafc' : '#111827'),
      fg: cssVar('--fg', mode === 'dark' ? '#e5e7eb' : '#1f2937'),
      muted: cssVar('--muted', mode === 'dark' ? '#a8b3c2' : '#667085'),
      border: cssVar('--border', mode === 'dark' ? '#475569' : '#d0d7de'),
      glassBorder: cssVar('--glass-border', mode === 'dark' ? 'rgba(255, 255, 255, 0.24)' : 'rgba(255, 255, 255, 0.72)'),
      accent: cssVar('--accent', mode === 'dark' ? '#5eead4' : '#14b8a6'),
      accentAlt: cssVar('--accent-alt', mode === 'dark' ? '#a78bfa' : '#8b5cf6'),
    },
  };
}

const deleteConfirmCopy: Record<DeleteConfirmMode, {
  title: string;
  body: string;
  note: string;
  confirmLabel: string;
  loadingLabel: string;
}> = {
  metadata: {
    title: '删除文章记录',
    body: '这会删除乾坤戒里的归档、收藏、AI 摘要、标签和重新抓取的正文缓存。',
    note: '原始 articles 表中的文章仍会保留，之后仍可从原始数据重新进入列表。',
    confirmLabel: '删除记录',
    loadingLabel: '删除中…',
  },
  permanent: {
    title: '彻底删除文章',
    body: '这会同时删除 article_metadata 和 articles 两张表中的数据。',
    note: '原始文章、链接、正文和所有平台记录都会消失，此操作不可撤销，请确认已经不再需要这篇文章。',
    confirmLabel: '彻底删除',
    loadingLabel: '彻底删除中…',
  },
};

function buildArticleShareUrl(article: any, scrollPosition: number, theme: ShareThemeSnapshot) {
  const currentPath = window.location.pathname;
  const viewPath = currentPath.includes('/archive')
    ? '/archive'
    : currentPath.includes('/favorites')
      ? '/favorites'
      : currentPath.includes('/inbox')
        ? '/inbox'
        : article.isArchived
          ? '/archive'
          : article.isFavorited
            ? '/favorites'
            : '/inbox';
  const url = new URL(viewPath, window.location.origin);
  url.searchParams.set('article', String(article.id));
  url.searchParams.set('scroll', String(Math.round(scrollPosition)));
  url.searchParams.set('theme', theme.mode);
  url.searchParams.set('scheme', theme.scheme);
  url.hash = 'reading-position';
  return url.toString();
}

function getSharePosterPalette(theme: ShareThemeSnapshot): SharePosterPalette {
  const dark = theme.mode === 'dark';
  const palettes: Record<ColorScheme, SharePosterPalette> = {
    wechat: dark ? {
      backgroundStops: [[0, '#15231d'], [0.55, '#203529'], [1, '#12201a']],
      title: '#f2fbf5',
      muted: 'rgba(226, 244, 234, 0.68)',
      body: '#e7f4ec',
      border: 'rgba(210, 239, 223, 0.24)',
      card: 'rgba(24, 42, 34, 0.88)',
      cardInner: '#172820',
      screenshotBackground: '#172820',
      accent: '#4fd184',
      qrDark: '#163323',
      qrLight: '#f4fff8',
      shadow: 'rgba(0, 0, 0, 0.32)',
      label: '微信绿意',
    } : {
      backgroundStops: [[0, '#f7f1e5'], [0.52, '#eef5f1'], [1, '#f3f7ed']],
      title: '#1f2933',
      muted: 'rgba(31, 41, 51, 0.58)',
      body: '#24352d',
      border: '#dbe7df',
      card: '#ffffff',
      cardInner: '#ffffff',
      screenshotBackground: '#ffffff',
      accent: '#338a55',
      qrDark: '#1f2933',
      qrLight: '#ffffff',
      shadow: 'rgba(31, 41, 51, 0.16)',
      label: '微信绿意',
    },
    glass: dark ? {
      backgroundStops: [[0, '#111827'], [0.5, '#223144'], [1, '#151b2a']],
      aurora: [{ x: 160, y: 160, radius: 360, color: 'rgba(125, 211, 252, 0.22)' }],
      title: '#f8fbff',
      muted: 'rgba(226, 232, 240, 0.68)',
      body: '#e7eef8',
      border: 'rgba(255, 255, 255, 0.22)',
      card: 'rgba(255, 255, 255, 0.12)',
      cardInner: 'rgba(20, 30, 44, 0.78)',
      screenshotBackground: '#172033',
      accent: '#93c5fd',
      qrDark: '#172033',
      qrLight: '#ffffff',
      shadow: 'rgba(0, 0, 0, 0.34)',
      label: '玻璃拟态',
    } : {
      backgroundStops: [[0, '#f8fbff'], [0.52, '#edf6ff'], [1, '#f6f2ff']],
      aurora: [{ x: 180, y: 150, radius: 360, color: 'rgba(147, 197, 253, 0.28)' }],
      title: '#162033',
      muted: 'rgba(22, 32, 51, 0.58)',
      body: '#243248',
      border: 'rgba(140, 156, 180, 0.42)',
      card: 'rgba(255, 255, 255, 0.72)',
      cardInner: '#ffffff',
      screenshotBackground: '#ffffff',
      accent: '#3b82f6',
      qrDark: '#172033',
      qrLight: '#ffffff',
      shadow: 'rgba(39, 71, 112, 0.16)',
      label: '玻璃拟态',
    },
    aurora: dark ? {
      backgroundStops: [[0, '#17233f'], [0.38, '#1f3e49'], [0.72, '#2a2447'], [1, '#17253b']],
      aurora: [
        { x: 150, y: 190, radius: 420, color: 'rgba(45, 212, 191, 0.32)' },
        { x: 940, y: 210, radius: 420, color: 'rgba(196, 181, 253, 0.30)' },
        { x: 680, y: 900, radius: 520, color: 'rgba(96, 165, 250, 0.22)' },
      ],
      title: '#f8fbff',
      muted: 'rgba(229, 241, 250, 0.72)',
      body: '#eaf6fb',
      border: 'rgba(255, 255, 255, 0.28)',
      card: 'rgba(220, 245, 255, 0.16)',
      cardInner: 'rgba(28, 49, 62, 0.78)',
      screenshotBackground: '#1e3440',
      accent: '#5eead4',
      qrDark: '#17323b',
      qrLight: '#f8feff',
      shadow: 'rgba(7, 20, 35, 0.34)',
      label: '极光夜色',
    } : {
      backgroundStops: [[0, '#edf5ff'], [0.36, '#e9fbf7'], [0.72, '#f4efff'], [1, '#eef8f5']],
      aurora: [
        { x: 130, y: 160, radius: 420, color: 'rgba(45, 212, 191, 0.28)' },
        { x: 960, y: 230, radius: 420, color: 'rgba(196, 181, 253, 0.30)' },
      ],
      title: '#10222f',
      muted: 'rgba(16, 34, 47, 0.58)',
      body: '#233a44',
      border: 'rgba(255, 255, 255, 0.78)',
      card: 'rgba(255, 255, 255, 0.66)',
      cardInner: '#f9fffd',
      screenshotBackground: '#f9fffd',
      accent: '#14b8a6',
      qrDark: '#10222f',
      qrLight: '#ffffff',
      shadow: 'rgba(24, 62, 86, 0.16)',
      label: '极光晨雾',
    },
    magazine: dark ? {
      backgroundStops: [[0, '#171717'], [0.55, '#27211d'], [1, '#141414']],
      title: '#faf7f0',
      muted: 'rgba(244, 235, 220, 0.66)',
      body: '#f1e8da',
      border: 'rgba(238, 224, 200, 0.25)',
      card: '#24211d',
      cardInner: '#1e1c19',
      screenshotBackground: '#1e1c19',
      accent: '#d6a85d',
      qrDark: '#211d18',
      qrLight: '#fffaf0',
      shadow: 'rgba(0, 0, 0, 0.38)',
      label: '杂志纸感',
    } : {
      backgroundStops: [[0, '#fbf7ed'], [0.55, '#f3eadb'], [1, '#fffaf0']],
      title: '#241f18',
      muted: 'rgba(36, 31, 24, 0.58)',
      body: '#342a1f',
      border: '#ded0b8',
      card: '#fffaf0',
      cardInner: '#fffdf7',
      screenshotBackground: '#fffdf7',
      accent: '#a46a2a',
      qrDark: '#241f18',
      qrLight: '#fffaf0',
      shadow: 'rgba(75, 55, 35, 0.16)',
      label: '杂志纸感',
    },
    xianxia: dark ? {
      backgroundStops: [[0, '#071916'], [0.52, '#102b27'], [1, '#071312']],
      aurora: [{ x: 900, y: 170, radius: 420, color: 'rgba(126, 211, 190, 0.18)' }],
      title: '#f4fff9',
      muted: 'rgba(218, 239, 231, 0.68)',
      body: '#d9eee6',
      border: 'rgba(174, 219, 202, 0.26)',
      card: '#10231f',
      cardInner: '#0b1b18',
      screenshotBackground: '#0b1b18',
      accent: '#9edeca',
      qrDark: '#071916',
      qrLight: '#f3fff9',
      shadow: 'rgba(0, 0, 0, 0.34)',
      label: '仙府玉简',
    } : {
      backgroundStops: [[0, '#f7fffb'], [0.52, '#e9f6f0'], [1, '#f8fbf4']],
      aurora: [{ x: 920, y: 180, radius: 420, color: 'rgba(97, 171, 151, 0.18)' }],
      title: '#19322f',
      muted: 'rgba(25, 50, 47, 0.58)',
      body: '#274541',
      border: '#c9ddd5',
      card: '#fbfffb',
      cardInner: '#ffffff',
      screenshotBackground: '#ffffff',
      accent: '#2f8b7b',
      qrDark: '#19322f',
      qrLight: '#f7fffb',
      shadow: 'rgba(35, 78, 70, 0.16)',
      label: '仙府玉简',
    },
  };

  const palette = palettes[theme.scheme];
  if (!theme.colors) return palette;

  const { colors } = theme;
  return {
    ...palette,
    backgroundStops: [
      [0, colors.bg],
      [0.48, colors.surfaceAlt],
      [1, colors.surface],
    ],
    aurora: [
      { x: 150, y: 190, radius: 420, color: colorWithAlpha(colors.accent, dark ? 0.26 : 0.20) },
      { x: 930, y: 220, radius: 420, color: colorWithAlpha(colors.accentAlt, dark ? 0.24 : 0.18) },
    ],
    title: colors.fgTitle,
    muted: colorWithAlpha(colors.muted, dark ? 0.78 : 0.64),
    body: colors.fg,
    border: colors.glassBorder || colors.border,
    card: colorWithAlpha(colors.cardBg, dark ? 0.86 : 0.78),
    cardInner: colors.readingBg,
    screenshotBackground: colors.readingBg,
    accent: colors.accent,
    qrDark: dark ? '#111827' : toHexColor(colors.fgTitle, '#111827'),
    qrLight: dark ? '#f8fafc' : toHexColor(colors.surface, '#ffffff'),
    shadow: dark ? 'rgba(0, 0, 0, 0.34)' : colorWithAlpha(colors.fgTitle, 0.14),
  };
}

function toHexColor(color: string, fallback: string) {
  const normalized = normalizeCanvasColor(color);
  const match = normalized.match(/rgba?\(([^)]+)\)/);
  if (!match) return normalized.startsWith('#') ? normalized : fallback;

  const [r, g, b] = match[1].split(',').slice(0, 3).map((part) => Number(part.trim()));
  if (![r, g, b].every(Number.isFinite)) return fallback;
  const hex = (value: number) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function colorWithAlpha(color: string, alpha: number) {
  const probe = document.createElement('span');
  probe.style.position = 'fixed';
  probe.style.left = '-10000px';
  probe.style.top = '0';
  probe.style.color = color;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();

  const match = resolved.match(/rgba?\(([^)]+)\)/);
  if (!match) return color;
  const [r, g, b] = match[1].split(',').slice(0, 3).map((part) => Number(part.trim()));
  if (![r, g, b].every(Number.isFinite)) return color;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setCanvasSafeThemeVars(element: HTMLElement, palette: SharePosterPalette) {
  const safeSurface = palette.cardInner || palette.screenshotBackground;
  element.style.setProperty('--bg', palette.screenshotBackground);
  element.style.setProperty('--card-bg', safeSurface);
  element.style.setProperty('--surface', safeSurface);
  element.style.setProperty('--surface-alt', palette.card);
  element.style.setProperty('--nav-bg', palette.card);
  element.style.setProperty('--reading-bg', palette.screenshotBackground);
  element.style.setProperty('--fg', palette.body);
  element.style.setProperty('--fg-title', palette.title);
  element.style.setProperty('--text', palette.body);
  element.style.setProperty('--text-secondary', palette.body);
  element.style.setProperty('--text-muted', palette.muted);
  element.style.setProperty('--muted', palette.muted);
  element.style.setProperty('--border', palette.border);
  element.style.setProperty('--divider', palette.border);
  element.style.setProperty('--accent', palette.accent);
  element.style.setProperty('--accent-alt', palette.accent);
  element.style.setProperty('--accent-soft', colorWithAlpha(palette.accent, 0.16));
  element.style.setProperty('--tag-bg', palette.card);
  element.style.setProperty('--fg-soft', colorWithAlpha(palette.body, 0.08));
  element.style.setProperty('--glass', palette.card);
  element.style.setProperty('--glass-border', palette.border);
  element.style.setProperty('--glass-glow', colorWithAlpha(palette.accent, 0.18));
  element.style.setProperty('--shadow-sm', 'none');
  element.style.setProperty('--shadow-md', 'none');
  element.style.setProperty('--shadow-lg', 'none');
}

async function tryCopyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn('Clipboard write failed', error);
    return false;
  }
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function loadCanvasImage(src: string, timeoutMs = 6000) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Image load timed out: ${src}`));
    }, timeoutMs);
    image.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(image);
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(new Error(`Image load failed: ${src}`));
    };
    image.src = src;
  });
}

function getProxiedImageUrl(src: string) {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src;

  try {
    const url = new URL(src, window.location.origin);
    if (url.origin === window.location.origin) return url.toString();
    const requestedWidth = Math.min(Math.max(Math.ceil(window.innerWidth * (window.devicePixelRatio || 1)), 640), 1920);
    const allowedWidths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
    const width = allowedWidths.find((value) => value >= requestedWidth) ?? 1920;
    return `${window.location.origin}/_next/image?url=${encodeURIComponent(url.toString())}&w=${width}&q=85`;
  } catch {
    return src;
  }
}

function getPosterFontFamily(scheme: ColorScheme) {
  if (scheme === 'magazine') return '"Iowan Old Style", "Newsreader", Georgia, "Times New Roman", serif';
  if (scheme === 'xianxia') return '"PingFang SC", "Songti SC", "Microsoft YaHei", sans-serif';
  return '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", "PingFang SC", sans-serif';
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = '';

  for (const char of chars) {
    const nextLine = `${line}${char}`;
    if (line && ctx.measureText(nextLine).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = nextLine;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawWrappedText({
  ctx,
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  maxLines,
}: {
  ctx: CanvasRenderingContext2D;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  maxLines: number;
}) {
  const lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);
  if (lines.length === maxLines && wrapCanvasText(ctx, text, maxWidth).length > maxLines) {
    let lastLine = lines[maxLines - 1];
    while (lastLine && ctx.measureText(`${lastLine}...`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    lines[maxLines - 1] = `${lastLine}...`;
  }

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return lines.length * lineHeight;
}

function getTextFromHtml(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return Array.from(container.querySelectorAll('p, div, li'))
    .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() || '')
    .filter((text) => text.length > 12)
    .join('\n');
}

function getImagesFromHtml(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return Array.from(container.querySelectorAll<HTMLImageElement>('img'))
    .map((image) => image.getAttribute('src') || '')
    .filter(Boolean)
    .slice(0, 4);
}

function drawContainedImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius: number) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.save();
  drawRoundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.64)';
  ctx.fillRect(x, y, width, height);
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

async function createFallbackShareScreenshot(article: any, palette: SharePosterPalette, scheme: ColorScheme, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.clearRect(0, 0, width, height);
  const inset = 34;
  let cursorY = 30;

  const imageSources = getImagesFromHtml(article?.contentHtml || '');
  for (const source of imageSources) {
    if (cursorY > height - 220) break;
    try {
      const image = await loadCanvasImage(getProxiedImageUrl(source));
      const imageHeight = Math.min(300, Math.max(168, Math.round((width - inset * 2) * 0.48)));
      drawContainedImage(ctx, image, inset, cursorY, width - inset * 2, imageHeight, 12);
      cursorY += imageHeight + 30;
    } catch {
      // Ignore individual image failures so poster sharing still succeeds.
    }
  }

  const text = getTextFromHtml(article?.contentHtml || '') || article?.aiSummary || article?.summary || article?.title || '';
  ctx.fillStyle = palette.body;
  ctx.font = `400 24px ${getPosterFontFamily(scheme)}`;
  const paragraphs = text.split('\n').filter(Boolean).slice(0, 10);
  for (const paragraph of paragraphs) {
    if (cursorY > height - 80) break;
    cursorY += drawWrappedText({
      ctx,
      text: paragraph,
      x: inset,
      y: cursorY,
      maxWidth: width - inset * 2,
      lineHeight: 38,
      maxLines: 3,
    }) + 18;
  }

  return canvas;
}

function applyCaptureStyles(element: HTMLElement, palette: SharePosterPalette) {
  const tagName = element.tagName.toLowerCase();
  element.removeAttribute('class');
  element.removeAttribute('style');
  element.style.boxSizing = 'border-box';
  element.style.color = palette.body;
  element.style.borderColor = palette.border;
  element.style.boxShadow = 'none';
  element.style.textShadow = 'none';
  element.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
    element.style.margin = '18px 0 10px';
    element.style.fontWeight = '650';
    element.style.lineHeight = '1.42';
    element.style.color = palette.title;
  }
  if (tagName === 'h1') element.style.fontSize = '24px';
  if (tagName === 'h2') element.style.fontSize = '21px';
  if (tagName === 'h3') element.style.fontSize = '19px';

  if (tagName === 'p' || tagName === 'div') {
    element.style.lineHeight = '1.75';
  }
  if (tagName === 'p') {
    element.style.margin = '0 0 14px';
  }
  if (tagName === 'a') {
    element.style.color = palette.accent;
    element.style.textDecoration = 'none';
  }
  if (tagName === 'blockquote') {
    element.style.margin = '14px 0';
    element.style.padding = '8px 14px';
    element.style.borderLeft = `3px solid ${palette.accent}`;
    element.style.background = palette.card;
  }
  if (tagName === 'ul' || tagName === 'ol') {
    element.style.margin = '0 0 14px';
    element.style.paddingLeft = '24px';
  }
  if (tagName === 'li') {
    element.style.margin = '6px 0';
    element.style.lineHeight = '1.65';
  }
  if (tagName === 'pre') {
    element.style.margin = '14px 0';
    element.style.padding = '12px';
    element.style.borderRadius = '8px';
    element.style.background = palette.card;
    element.style.overflow = 'hidden';
  }
  if (tagName === 'code') {
    element.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
    element.style.background = palette.card;
    element.style.borderRadius = '4px';
    element.style.padding = '1px 4px';
  }
  if (tagName === 'button') {
    element.style.border = '0';
    element.style.background = palette.card;
  }
  if (tagName === 'img') {
    element.style.display = 'block';
    element.style.maxWidth = '100%';
    element.style.height = 'auto';
    element.style.margin = '12px 0';
    element.style.borderRadius = '10px';
    element.style.background = palette.cardInner;
  }
  if (tagName === 'table') {
    element.style.width = '100%';
    element.style.borderCollapse = 'collapse';
    element.style.margin = '14px 0';
  }
  if (tagName === 'td' || tagName === 'th') {
    element.style.border = `1px solid ${palette.border}`;
    element.style.padding = '8px';
  }
}

async function waitForCaptureImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(images.map((image) => withTimeout(
    new Promise<void>((resolve) => {
      if (!image.src || image.complete) {
        resolve();
        return;
      }

      const finish = () => {
        image.removeEventListener('load', finish);
        image.removeEventListener('error', finish);
        resolve();
      };
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
    }),
    4000,
    `Share capture image timed out: ${image.src}`
  ).catch(() => undefined)));
}

async function createShareCaptureTarget(panel: HTMLDivElement, screenshotHeight: number, palette: SharePosterPalette, article: any) {
  const captureHeight = Math.max(1, screenshotHeight);
  const sourceRoot = panel.querySelector<HTMLElement>('.article-content-wrap') ?? panel;
  const panelRect = panel.getBoundingClientRect();
  const sourceRect = sourceRoot.getBoundingClientRect();
  const captureWidth = Math.round(sourceRect.width || panel.clientWidth);
  const sourceTop = Math.round(sourceRect.top - panelRect.top + panel.scrollTop);
  const sourceScrollTop = Math.max(0, panel.scrollTop - sourceTop);
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = `${captureWidth}px`;
  wrapper.style.height = `${captureHeight}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.background = 'transparent';
  wrapper.style.color = palette.body;
  wrapper.style.font = '17px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  wrapper.style.pointerEvents = 'none';
  setCanvasSafeThemeVars(wrapper, palette);

  const capturePanel = document.createElement('div');
  capturePanel.style.position = 'absolute';
  capturePanel.style.left = '0';
  capturePanel.style.top = `-${sourceScrollTop}px`;
  capturePanel.style.width = `${captureWidth}px`;
  capturePanel.style.minHeight = `${Math.max(sourceRoot.scrollHeight, captureHeight)}px`;
  capturePanel.style.padding = '30px 34px';
  capturePanel.style.boxSizing = 'border-box';
  capturePanel.style.background = 'transparent';
  capturePanel.style.overflow = 'visible';
  capturePanel.style.color = palette.body;
  capturePanel.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  setCanvasSafeThemeVars(capturePanel, palette);

  const articleBody = document.createElement('div');
  articleBody.style.fontSize = '17px';
  articleBody.style.lineHeight = '1.8';
  articleBody.style.color = palette.body;
  articleBody.innerHTML = article?.contentHtml || `<p>${article?.aiSummary || article?.summary || article?.title || ''}</p>`;
  capturePanel.appendChild(articleBody);

  capturePanel.querySelectorAll<HTMLElement>('*').forEach((element) => applyCaptureStyles(element, palette));
  applyCaptureStyles(articleBody, palette);
  articleBody.style.fontSize = '17px';
  articleBody.style.lineHeight = '1.8';
  articleBody.style.color = palette.body;
  articleBody.style.background = 'transparent';

  capturePanel.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const source = image.getAttribute('src') || image.currentSrc || '';
    if (!source) {
      image.remove();
      return;
    }
    const proxiedSource = getProxiedImageUrl(source);
    image.removeAttribute('src');
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.removeAttribute('crossorigin');
    image.srcset = '';
    image.sizes = '';
    image.crossOrigin = 'anonymous';
    image.src = proxiedSource;
  });

  wrapper.appendChild(capturePanel);
  document.body.appendChild(wrapper);
  await waitForCaptureImages(wrapper);

  return {
    element: wrapper,
    cleanup: () => wrapper.remove(),
  };
}

async function createSharePoster({
  article,
  shareUrl,
  panel,
  theme,
}: {
  article: any;
  shareUrl: string;
  panel: HTMLDivElement;
  theme: ShareThemeSnapshot;
}) {
  const palette = getSharePosterPalette(theme);
  const screenshotHeight = Math.min(Math.max(panel.clientHeight * 1.45, 1080), 1500, panel.scrollHeight || 1500);
  const captureTarget = await createShareCaptureTarget(panel, screenshotHeight, palette, article);
  let screenshot: HTMLCanvasElement;
  try {
    try {
      screenshot = await html2canvas(captureTarget.element, {
        backgroundColor: null,
        height: captureTarget.element.clientHeight,
        width: captureTarget.element.clientWidth,
        windowWidth: captureTarget.element.clientWidth,
        windowHeight: captureTarget.element.clientHeight,
        logging: false,
        useCORS: true,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        onclone: (clonedDocument) => {
          clonedDocument.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove());
          clonedDocument.documentElement.removeAttribute('data-theme');
          clonedDocument.documentElement.removeAttribute('data-color-scheme');
          clonedDocument.documentElement.style.background = 'transparent';
          clonedDocument.documentElement.style.color = palette.body;
          clonedDocument.body.style.background = 'transparent';
          clonedDocument.body.style.color = palette.body;
          setCanvasSafeThemeVars(clonedDocument.documentElement, palette);
          setCanvasSafeThemeVars(clonedDocument.body, palette);
          clonedDocument.body.querySelectorAll<HTMLElement>('*').forEach((element) => {
            setCanvasSafeThemeVars(element, palette);
            element.style.boxShadow = 'none';
            element.style.textShadow = 'none';
          });
        },
      });
    } catch (error) {
      console.warn('html2canvas share capture failed, using canvas fallback', error);
      screenshot = await createFallbackShareScreenshot(article, palette, theme.scheme, captureTarget.element.clientWidth, captureTarget.element.clientHeight);
    }
  } finally {
    captureTarget.cleanup();
  }

  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    width: 220,
    margin: 1,
    color: {
      dark: palette.qrDark,
      light: palette.qrLight,
    },
  });
  const qrImage = await loadCanvasImage(qrDataUrl);

  const posterWidth = 1080;
  const padding = 76;
  const titleFontSize = 46;
  const titleLineHeight = 60;
  const titleText = String(article.title || '未命名文章');
  const titleFont = `${theme.scheme === 'magazine' ? '700' : '680'} ${titleFontSize}px ${getPosterFontFamily(theme.scheme)}`;
  const screenshotWidth = posterWidth - padding * 2;
  const screenshotInset = 0;
  const screenshotContentWidth = screenshotWidth;
  const screenshotScaledHeight = Math.round(screenshot.height * (screenshotContentWidth / screenshot.width));
  const qrSize = 168;
  const footerHeight = 206;
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) throw new Error('Canvas context unavailable');
  measureCtx.font = titleFont;
  const titleLineCount = Math.min(wrapCanvasText(measureCtx, titleText, posterWidth - padding * 2).length || 1, 2);
  const titleVisualHeight = titleFontSize + (titleLineCount - 1) * titleLineHeight;
  const titleBaseline = padding + titleFontSize;
  const screenshotTop = padding + titleVisualHeight + padding;
  const screenshotFooterGap = padding;
  const posterHeight = screenshotTop + screenshotScaledHeight + screenshotFooterGap + footerHeight + padding;

  const canvas = document.createElement('canvas');
  canvas.width = posterWidth;
  canvas.height = posterHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const gradient = ctx.createLinearGradient(0, 0, posterWidth, posterHeight);
  palette.backgroundStops.forEach(([stop, color]) => gradient.addColorStop(stop, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, posterWidth, posterHeight);

  palette.aurora?.forEach((spot) => {
    const glow = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.radius);
    glow.addColorStop(0, spot.color);
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, posterWidth, posterHeight);
  });

  ctx.fillStyle = palette.title;
  ctx.font = titleFont;
  drawWrappedText({
    ctx,
    text: titleText,
    x: padding,
    y: titleBaseline,
    maxWidth: posterWidth - padding * 2,
    lineHeight: titleLineHeight,
    maxLines: 2,
  });

  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 16;
  drawRoundRect(ctx, padding, screenshotTop, screenshotWidth, screenshotScaledHeight, 24);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.border;
  ctx.stroke();
  ctx.clip();
  ctx.drawImage(screenshot, padding + screenshotInset, screenshotTop, screenshotContentWidth, screenshotScaledHeight);
  ctx.restore();

  const footerTop = screenshotTop + screenshotScaledHeight + screenshotFooterGap;
  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  drawRoundRect(ctx, padding, footerTop, screenshotWidth, 206, 28);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.border;
  ctx.stroke();
  ctx.restore();

  const footerPaddingX = 34;
  const footerTextX = padding + footerPaddingX;
  const footerTextY = footerTop + 50;
  ctx.fillStyle = palette.title;
  ctx.font = `680 32px ${getPosterFontFamily(theme.scheme)}`;
  ctx.fillText('今天藏什么', footerTextX, footerTextY);

  ctx.fillStyle = palette.muted;
  ctx.font = `400 23px ${getPosterFontFamily(theme.scheme)}`;
  ctx.fillText('扫码跳转到这篇文章的当前位置', footerTextX, footerTextY + 42);

  ctx.fillStyle = palette.body;
  ctx.font = `520 25px ${getPosterFontFamily(theme.scheme)}`;
  const source = String(article.source || article.author || '未知来源');
  const clippedSource = source.length > 24 ? `${source.slice(0, 24)}...` : source;
  ctx.fillText(clippedSource, footerTextX, footerTextY + 94, screenshotWidth - qrSize - footerPaddingX * 3);

  const qrX = posterWidth - padding - footerPaddingX - qrSize;
  const qrY = footerTop + 19;
  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 7;
  drawRoundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 22);
  ctx.fillStyle = palette.qrLight;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.border;
  ctx.stroke();
  ctx.restore();
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Poster export failed'));
    }, 'image/png', 0.96);
  });

  return {
    blob,
    imageUrl: URL.createObjectURL(blob),
  };
}

function DeleteConfirmDialog({
  mode,
  articleTitle,
  loading,
  onCancel,
  onConfirm,
}: {
  mode: DeleteConfirmMode;
  articleTitle: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = deleteConfirmCopy[mode];

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [loading, onCancel]);

  return createPortal(
    <div
      className="confirm-dialog-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <section
        className={`confirm-dialog-panel${mode === 'permanent' ? ' confirm-dialog-panel--permanent' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-icon confirm-dialog-icon--danger" aria-hidden="true">
          <ExclamationCircleOutlined />
        </div>
        <div className="confirm-dialog-content">
          <h2 id="delete-confirm-title" className="confirm-dialog-title">{copy.title}</h2>
          <p className="confirm-dialog-copy">
            确定要处理《{articleTitle}》吗？
          </p>
          <p className="confirm-dialog-copy">
            {copy.body}
          </p>
          <p className="confirm-dialog-note">
            {copy.note}
          </p>
        </div>
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-button confirm-dialog-button--secondary" type="button" onClick={onCancel} disabled={loading}>
            取消
          </button>
          <button className="confirm-dialog-button confirm-dialog-button--danger" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? copy.loadingLabel : copy.confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

function SharePosterDialog({
  imageUrl,
  onClose,
  onDownload,
  onCopyLink,
  onSystemShare,
}: {
  imageUrl: string;
  onClose: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
  onSystemShare: () => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="share-poster-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="share-poster-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-poster-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-poster-header">
          <div>
            <h2 id="share-poster-title" className="share-poster-title">分享海报</h2>
          </div>
          <button className="share-poster-close" type="button" onClick={onClose} aria-label="关闭分享海报">
            <CloseOutlined />
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="share-poster-preview" src={imageUrl} alt="文章分享海报预览" />

        <div className="share-poster-actions">
          <button className="share-poster-button share-poster-button--primary" type="button" onClick={onDownload}>
            保存图片
          </button>
          <button className="share-poster-button" type="button" onClick={onSystemShare}>
            系统分享
          </button>
          <button className="share-poster-button" type="button" onClick={onCopyLink}>
            复制链接
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

// 详情内容组件
function DetailContent({
  article,
  fallbackArticle,
  readableContentHtml,
  articleError,
  isLoading,
  onClose,
  onMutate,
  mutateArticle,
  showToast,
  isAuthenticated,
  refreshCounts,
  getScrollPosition,
  saveBookmark,
  onOpenImageGallery,
  contentRef,
}: {
  article: any;
  fallbackArticle: any;
  readableContentHtml: string;
  articleError?: Error;
  isLoading: boolean;
  onClose: () => void;
  onMutate: () => void;
  mutateArticle: () => void;
  showToast: (msg: string) => void;
  isAuthenticated: boolean;
  refreshCounts: () => void;
  getScrollPosition: () => number;
  saveBookmark: (bookmark: { view: 'inbox' | 'archive' | 'favorites'; articleId: number; scrollPosition: number; listScrollPosition?: number; articleTitle?: string; timestamp: number }) => void;
  onOpenImageGallery: (img: HTMLImageElement) => void;
  contentRef: RefObject<HTMLDivElement | null>;
}) {
  const { resolved, colorScheme } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<DeleteConfirmMode | null>(null);
  const [sharePoster, setSharePoster] = useState<SharePosterState | null>(null);
  const originalUrl = article?.originalUrl || fallbackArticle?.originalUrl || '';
  const originalLinkStatus = articleError ? '原文链接暂时不可用' : '原文链接加载中';
  const { data: wikiStatus, mutate: mutateWikiStatus } = useSWR(
    article?.id && article?.isArchived ? `wiki:article:${article.id}` : null,
    () => api.getWikiArticleStatus(article.id),
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    return () => {
      if (sharePoster?.imageUrl) URL.revokeObjectURL(sharePoster.imageUrl);
    };
  }, [sharePoster?.imageUrl]);

  // 保存书签
  const handleSaveBookmark = () => {
    if (!article) return;

    // 从 URL 获取当前视图
    const path = window.location.pathname;
    const view: 'inbox' | 'archive' | 'favorites' = path.includes('inbox') ? 'inbox'
      : path.includes('favorites') ? 'favorites'
      : 'archive';

    // 获取文章列表的滚动位置（main 元素的滚动）
    const mainElement = document.querySelector('main');
    const listScrollPosition = mainElement?.scrollTop || 0;

    saveBookmark({
      view,
      articleId: article.id,
      scrollPosition: getScrollPosition(),
      listScrollPosition,
      articleTitle: article.title,
      timestamp: Date.now(),
    });
  };
  // 分享功能
  async function handleShare() {
    if (!article) return;
    const panel = contentRef.current;
    const shareTheme = readCurrentShareTheme(resolved, colorScheme);
    const shareUrl = buildArticleShareUrl(article, getScrollPosition(), shareTheme);

    if (!panel) {
      const copied = await tryCopyText(shareUrl);
      showToast(copied ? '分享链接已复制' : '暂时无法复制链接，请稍后再试');
      return;
    }

    setPendingAction('share');
    try {
      const poster = await createSharePoster({
        article: { ...article, contentHtml: readableContentHtml || article.contentHtml },
        shareUrl,
        panel,
        theme: shareTheme,
      });
      setSharePoster((current) => {
        if (current?.imageUrl) URL.revokeObjectURL(current.imageUrl);
        return {
          imageUrl: poster.imageUrl,
          blob: poster.blob,
          shareUrl,
        };
      });
      showToast('分享海报已生成');
    } catch (error) {
      console.error(error);
      const copied = await tryCopyText(shareUrl);
      showToast(copied ? '生成海报失败，分享链接已复制' : '生成海报失败，且当前浏览器不允许复制链接');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSystemSharePoster() {
    if (!article || !sharePoster) return;
    const file = new File([sharePoster.blob], `storing-${article.id}-share.png`, { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: '扫码跳转到这篇文章的当前位置',
          url: sharePoster.shareUrl,
          files: [file],
        });
      } catch (error) {
        if ((error as DOMException)?.name !== 'AbortError') {
          const copied = await tryCopyText(sharePoster.shareUrl);
          showToast(copied ? '系统分享失败，链接已复制' : '系统分享失败，且当前浏览器不允许复制链接');
        }
      }
    } else {
      const copied = await tryCopyText(sharePoster.shareUrl);
      showToast(copied ? '当前浏览器不支持图片分享，链接已复制' : '当前浏览器不支持图片分享，也暂时不允许复制链接');
    }
  }

  async function handleCopyShareUrl() {
    if (!sharePoster) return;
    const copied = await tryCopyText(sharePoster.shareUrl);
    showToast(copied ? '分享链接已复制' : '当前浏览器不允许复制链接');
  }

  function handleDownloadPoster() {
    if (!article || !sharePoster) return;
    const link = document.createElement('a');
    link.href = sharePoster.imageUrl;
    link.download = `storing-${article.id}-share.png`;
    link.click();
  }

  async function runArticleAction(action: string, task: () => Promise<void>, failureMessage: string) {
    if (pendingAction) return;
    setMoreOpen(false);
    setPendingAction(action);
    try {
      await task();
    } catch (error) {
      console.error(error);
      showToast(failureMessage);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRefetchContent() {
    if (!article) return;
    await runArticleAction('refetch', async () => {
      await api.refetchArticle(article.id);
      await mutateArticle();
      onMutate();
      showToast('正文已重新抓取');
    }, '重新抓取正文失败');
  }

  async function handleRegenerateAI() {
    if (!article) return;
    await runArticleAction('ai', async () => {
      await api.regenerateArticleAI(article.id);
      await mutateArticle();
      onMutate();
      showToast('摘要和标签已重新生成');
    }, '重新生成摘要失败');
  }

  async function handleReindexWiki() {
    if (!article) return;
    await runArticleAction('wiki', async () => {
      await api.reindexWikiArticle(article.id);
      await mutateWikiStatus();
      showToast('已更新知识库关联');
    }, '重新编译到 Wiki 失败');
  }

  const showArticleSkeleton = isLoading || pendingAction === 'refetch';
  const showAISkeleton = pendingAction === 'ai';

  async function handleCopyOriginalUrl() {
    const url = originalUrl || window.location.href;
    const copied = await tryCopyText(url);
    setMoreOpen(false);
    showToast(copied ? '链接已复制' : '当前浏览器不允许复制链接');
  }

  function handleOpenOriginalUrl() {
    if (!originalUrl) return;
    setMoreOpen(false);
    window.open(originalUrl, '_blank', 'noopener,noreferrer');
  }

  async function confirmDeleteArticle() {
    if (!article) return;
    const mode = deleteConfirmMode;
    if (!mode) return;
    setDeleteConfirmMode(null);

    await runArticleAction(mode === 'permanent' ? 'permanent-delete' : 'delete', async () => {
      if (mode === 'permanent') {
        await api.permanentlyDeleteArticle(article.id);
      } else {
        await api.deleteArticle(article.id);
      }
      onMutate();
      refreshCounts();
      showToast(mode === 'permanent' ? '文章已彻底删除' : '文章记录已删除');
      onClose();
    }, mode === 'permanent' ? '彻底删除失败' : '删除文章记录失败');
  }

  // 收藏功能
  async function handleFavorite() {
    if (!article) return;
    await runArticleAction('favorite', async () => {
      await api.toggleFavorite(article.id);
      mutateArticle();
      onMutate();
      refreshCounts();
      showToast(article.isFavorited ? '已取消收藏' : '已收藏');
    }, article.isFavorited ? '取消收藏失败' : '收藏失败');
  }

  // 归档功能
  async function handleArchive() {
    if (!article) return;
    const wasArchived = article.isArchived;
    await runArticleAction('archive', async () => {
      if (wasArchived) {
        await api.unarchive(article.id);
        showToast('已移回收件箱');
      } else {
        await api.archive(article.id);
        showToast('已归档');
      }
      onMutate();
      refreshCounts();
      onClose();
    }, wasArchived ? '移回收件箱失败' : '归档失败');
  }

  return (
    <>
      {/* 顶部导航 */}
      <header
        className="detail-panel-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '44px',
          padding: '0 16px',
          background: 'var(--card-bg)',
          borderBottom: '0.5px solid var(--divider)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button className="detail-panel-close-btn" onClick={onClose} type="button" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}>
          <LeftOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
        </button>
        <div style={{ position: 'relative' }}>
          <button
            className={`detail-panel-action-btn${moreOpen ? ' active' : ''}`}
            type="button"
            aria-expanded={moreOpen}
            onClick={(event) => {
              event.stopPropagation();
              setMoreOpen((open) => !open);
            }}
            style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}
          >
            <MoreOutlined style={{ fontSize: '22px', color: 'var(--text)', transform: 'rotate(90deg)' }} />
          </button>

          {moreOpen && (
            <>
              <div
                className="detail-more-menu-backdrop"
                onClick={() => setMoreOpen(false)}
              />
              <div className="app-menu detail-more-menu" onClick={(event) => event.stopPropagation()}>
                {isAuthenticated ? (
                  <>
                    <button className="app-menu-item detail-more-menu-item" type="button" onClick={handleRefetchContent} disabled={!!pendingAction}>
                      <ReloadOutlined />
                      <span>{pendingAction === 'refetch' ? '正在抓取…' : '重新抓取正文'}</span>
                    </button>
                    <button className="app-menu-item detail-more-menu-item" type="button" onClick={handleRegenerateAI} disabled={!!pendingAction}>
                      <RobotOutlined />
                      <span>{pendingAction === 'ai' ? '正在生成…' : '重新生成摘要和标签'}</span>
                    </button>
                    {article?.isArchived && (
                      <button className="app-menu-item detail-more-menu-item" type="button" onClick={handleReindexWiki} disabled={!!pendingAction}>
                        <BookOutlined />
                        <span>{pendingAction === 'wiki' ? '正在编译…' : '重新编译到 Wiki'}</span>
                      </button>
                    )}
                    <div className="detail-more-menu-divider" />
                    <button className="app-menu-item detail-more-menu-item" type="button" onClick={handleCopyOriginalUrl}>
                      <CopyOutlined />
                      <span>复制原文链接</span>
                    </button>
                    {originalUrl && (
                      <button className="app-menu-item detail-more-menu-item" type="button" onClick={handleOpenOriginalUrl}>
                        <ExportOutlined />
                        <span>打开原文</span>
                      </button>
                    )}
                    <div className="detail-more-menu-divider" />
                    <button className="app-menu-item detail-more-menu-item detail-more-menu-item--danger" type="button" onClick={() => { setMoreOpen(false); setDeleteConfirmMode('metadata'); }} disabled={!!pendingAction}>
                      <DeleteOutlined />
                      <span>{pendingAction === 'delete' ? '正在删除…' : '删除文章记录'}</span>
                    </button>
                    <button className="app-menu-item detail-more-menu-item detail-more-menu-item--danger detail-more-menu-item--permanent" type="button" onClick={() => { setMoreOpen(false); setDeleteConfirmMode('permanent'); }} disabled={!!pendingAction}>
                      <DeleteOutlined />
                      <span>{pendingAction === 'permanent-delete' ? '正在彻底删除…' : '彻底删除文章'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button className="app-menu-item detail-more-menu-item" type="button" onClick={handleCopyOriginalUrl}>
                      <CopyOutlined />
                      <span>复制链接</span>
                    </button>
                    {originalUrl && (
                      <button className="app-menu-item detail-more-menu-item" type="button" onClick={handleOpenOriginalUrl}>
                        <ExportOutlined />
                        <span>打开正文</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {deleteConfirmMode && article && (
        <DeleteConfirmDialog
          mode={deleteConfirmMode}
          articleTitle={article.title}
          loading={pendingAction === 'delete' || pendingAction === 'permanent-delete'}
          onCancel={() => setDeleteConfirmMode(null)}
          onConfirm={confirmDeleteArticle}
        />
      )}

      {sharePoster && article && (
        <SharePosterDialog
          imageUrl={sharePoster.imageUrl}
          onClose={() => setSharePoster(null)}
          onDownload={handleDownloadPoster}
          onCopyLink={handleCopyShareUrl}
          onSystemShare={handleSystemSharePoster}
        />
      )}

      {/* 文章内容 */}
      {showArticleSkeleton ? (
        <div style={{ padding: '16px' }}>
          {/* 标题骨架 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
            <div className="skeleton-line" style={{ width: '85%', height: 24, borderRadius: '6px' }} />
            <div className="skeleton-line" style={{ width: '55%', height: 24, borderRadius: '6px' }} />
          </div>
          {/* 来源/作者/日期骨架 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div className="skeleton-line" style={{ width: 48, height: 14 }} />
            <div className="skeleton-line" style={{ width: 1, height: 14 }} />
            <div className="skeleton-line" style={{ width: 40, height: 14 }} />
            <div className="skeleton-line" style={{ width: 1, height: 14 }} />
            <div className="skeleton-line" style={{ width: 64, height: 14 }} />
          </div>
          {/* AI标签骨架 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div className="skeleton-line" style={{ width: 56, height: 24, borderRadius: '4px' }} />
            <div className="skeleton-line" style={{ width: 72, height: 24, borderRadius: '4px' }} />
            <div className="skeleton-line" style={{ width: 48, height: 24, borderRadius: '4px' }} />
          </div>
          {/* AI摘要骨架 */}
          <div style={{ padding: '14px 16px', margin: '8px 0', borderRadius: '8px', background: 'var(--tag-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div className="skeleton-line" style={{ width: 16, height: 16, borderRadius: '50%' }} />
              <div className="skeleton-line" style={{ width: 64, height: 14 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
              <div className="skeleton-line" style={{ width: '90%', height: 14 }} />
              <div className="skeleton-line" style={{ width: '75%', height: 14 }} />
            </div>
          </div>
          {/* 正文骨架 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '95%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '80%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '92%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '60%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '88%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
            <div className="skeleton-line" style={{ width: '70%', height: 14 }} />
          </div>
        </div>
      ) : article ? (
        <>
          {/* 文章头部 */}
          <div className="detail-panel-content" style={{ padding: '16px' }}>
            <h1 className="detail-panel-title" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.5, marginBottom: '8px' }}>
              {article.title}
            </h1>
            <div className="detail-panel-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              <span>{article.source}</span>
              <span style={{ color: 'var(--divider)' }}>·</span>
              {article.author && (
                <>
                  <span>{article.author}</span>
                  <span style={{ color: 'var(--divider)' }}>·</span>
                </>
              )}
              <DateText dateStr={article.publishTime} />
            </div>
            {/* AI标签 */}
            {showAISkeleton ? (
              <div className="detail-panel-tags" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div className="skeleton-line" style={{ width: 56, height: 24, borderRadius: '4px' }} />
                <div className="skeleton-line" style={{ width: 72, height: 24, borderRadius: '4px' }} />
                <div className="skeleton-line" style={{ width: 48, height: 24, borderRadius: '4px' }} />
              </div>
            ) : article.aiTags?.length > 0 && (
              <div className="detail-panel-tags" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {article.aiTags.map((tag: string) => (
                  <span className="article-card-tag" key={tag} style={{ padding: '4px 10px', background: 'var(--tag-bg)', color: 'var(--text-muted)', fontSize: '12px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

	          {/* AI摘要 */}
	          {showAISkeleton ? (
	            <div className="ai-summary-block" style={{ background: 'var(--tag-bg)', margin: '8px 16px', borderRadius: '8px' }}>
	              <div className="ai-summary-row" aria-hidden="true">
	                <div className="skeleton-line" style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0 }} />
	                <div className="skeleton-line" style={{ width: 72, height: 14 }} />
	              </div>
	              <div className="ai-summary-text" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
	                <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
	                <div className="skeleton-line" style={{ width: '90%', height: 14 }} />
	                <div className="skeleton-line" style={{ width: '75%', height: 14 }} />
	              </div>
	            </div>
	          ) : article.aiSummary && (
	            <div className={`ai-summary-block${summaryCollapsed ? ' collapsed' : ''}`} style={{ background: 'var(--tag-bg)', margin: '8px 16px', borderRadius: '8px' }}>
	              <button
	                className="ai-summary-row"
	                type="button"
	                onClick={() => setSummaryCollapsed((collapsed) => !collapsed)}
	                aria-expanded={!summaryCollapsed}
	              >
	                <div className="ai-summary-dot" aria-hidden="true" />
	                <span className="ai-summary-title" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', flex: 1 }}>
	                  智能摘要
	                </span>
	                <span className="ai-summary-toggle" aria-hidden="true">
	                  {summaryCollapsed ? <DownOutlined /> : <UpOutlined />}
	                </span>
	              </button>
	              {!summaryCollapsed && (
	                <p className="ai-summary-text" style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{article.aiSummary}</p>
	              )}
	            </div>
	          )}

          {article.isArchived && (
            <div className="wiki-article-status-card">
              <div className="wiki-article-status-head">
                <span><BookOutlined /> Wiki 知识库</span>
                <button type="button" onClick={handleReindexWiki} disabled={!!pendingAction}>
                  {pendingAction === 'wiki' ? '编译中' : '重新编译'}
                </button>
              </div>
              <p>
                {wikiStatus?.status === 'indexed'
                  ? `已加入 Wiki${wikiStatus.pages?.length ? `，贡献到 ${wikiStatus.pages.length} 个页面。` : '。'}`
                  : wikiStatus?.status === 'failed'
                    ? '编译失败，可重新编译。'
                    : wikiStatus?.status === 'pending' || wikiStatus?.status === 'extracting'
                      ? '正在等待或执行 Wiki 编译。'
                      : '尚未加入 Wiki，可手动编译。'}
              </p>
              {wikiStatus?.pages?.length > 0 && (
                <div className="wiki-article-page-links">
                  {wikiStatus.pages.map((page: any) => (
                    <a key={page.id} href={`/wiki/${encodeURIComponent(page.slug)}`}>{page.title}</a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 正文 */}
          <div
            className="article-content-wrap"
            style={{ padding: '16px' }}
            onClickCapture={(event) => {
              const target = event.target as HTMLElement;
              const img = target.closest('img');
              if (!img || !event.currentTarget.contains(img)) return;

              event.preventDefault();
              event.stopPropagation();
              onOpenImageGallery(img as HTMLImageElement);
            }}
          >
            {readableContentHtml ? (
              <div 
                className="article-body"
                style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.8 }}
            dangerouslySetInnerHTML={{ __html: readableContentHtml }}
          />
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>正在加载正文...</div>
            )}
          </div>
        </>
      ) : (
        <div className="article-content-wrap" style={{ padding: '24px 16px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          {articleError ? '正文暂时无法加载，可以先通过底部入口阅读原文。' : '正在加载正文...'}
        </div>
      )}

      {/* 底部操作栏 */}
      <footer
        className="detail-panel-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '66px',
          padding: '12px 16px',
          background: 'var(--nav-bg)',
          borderTop: '0.5px solid var(--divider)',
          position: 'sticky',
          bottom: 0,
          zIndex: 40,
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: '-1px',
        }}
      >
        {/* 左侧：阅读原文 */}
        {originalUrl ? (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--accent)',
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            <LinkOutlined style={{ fontSize: '18px' }} />
            阅读原文
          </a>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{originalLinkStatus}</span>
        )}

        {/* 右侧：操作按钮 —— 游客只显示分享 */}
        <div className="detail-panel-footer-actions">
          {/* 书签按钮 —— 所有用户可用 */}
          {article && <BookmarkButton onClick={handleSaveBookmark} />}
          {article && isAuthenticated && (
            <>
              <button className="detail-panel-action-btn" onClick={handleArchive} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {article.isArchived ? (
                  <FolderFilled style={{ fontSize: '20px', color: 'var(--accent)' }} />
                ) : (
                  <FolderOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                )}
                <span className="detail-panel-action-label" style={{ fontSize: '11px', color: article.isArchived ? 'var(--accent)' : 'var(--text-muted)' }}>{article.isArchived ? '取消归档' : '归档'}</span>
              </button>
              <button className={`detail-panel-action-btn${article.isFavorited ? ' favorited' : ''}`} onClick={handleFavorite} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {article.isFavorited ? (
                  <HeartFilled style={{ fontSize: '20px', color: 'var(--accent)' }} />
                ) : (
                  <HeartOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                )}
                <span className="detail-panel-action-label" style={{ fontSize: '11px', color: article.isFavorited ? 'var(--accent)' : 'var(--text-muted)' }}>收藏</span>
              </button>
            </>
          )}
          {article && (
            <button className="detail-panel-action-btn" onClick={handleShare} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <ShareAltOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
              <span className="detail-panel-action-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pendingAction === 'share' ? '生成中' : '分享'}</span>
            </button>
          )}
        </div>
      </footer>
    </>
  );
}
