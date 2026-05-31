'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useSWRConfig } from 'swr';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { LeftOutlined, MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, FolderFilled, ShareAltOutlined, LinkOutlined, ReloadOutlined, RobotOutlined, CopyOutlined, ExportOutlined, DeleteOutlined, UpOutlined, DownOutlined, ExclamationCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { useArticle } from '@/hooks/useArticle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthContext';
import { DateText } from '@/lib/formatDate';
import { api } from '@/lib/api';
import { useBookmark } from '@/hooks/useBookmark';
import { BookmarkButton } from '@/components/ui/BookmarkButton';

interface WechatDetailPanelProps {
  articleId: number | null;
  onClose: () => void;
  onMutate: () => void;
  isDesktop?: boolean;
}

export function WechatDetailPanel({ articleId, onClose, onMutate, isDesktop }: WechatDetailPanelProps) {
  const { data: article, isLoading, mutate: mutateArticle } = useArticle(articleId);
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const { saveBookmark } = useBookmark();

  // 滚动位置追踪
  const scrollPositionRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const appliedSharedScrollRef = useRef<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

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
    if (!articleId || isLoading || !article?.contentHtml) return;

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
  }, [articleId, article?.contentHtml, isLoading]);

  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
  }

  useEffect(() => {
    if (articleId) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.classList.add('detail-panel-open');
      return () => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.classList.remove('detail-panel-open');
      };
    }
  }, [articleId]);

  const getScrollPosition = () => scrollPositionRef.current;

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
            right: '750px',
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(2px)',
            zIndex: 1400,
          }}
        />
        {/* 详情面板 */}
        <div
          ref={contentRef}
          className="detail-panel wechat-detail-panel"
          data-scroll-container="detail"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '750px',
            height: '100vh',
            background: 'var(--card-bg)',
            borderLeft: '1px solid var(--divider)',
            zIndex: 1500,
            overflowY: 'auto',
          }}
        >
          <DetailContent
            article={article}
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
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const hasPrevious = index > 0;
  const hasNext = index < images.length - 1;
  const imageUrl = images[index];

  useEffect(() => {
    setScale(1);
  }, [index]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasPrevious) onIndexChange(index - 1);
      if (event.key === 'ArrowRight' && hasNext) onIndexChange(index + 1);
      if ((event.key === '+' || event.key === '=') && scale < 4) setScale((value) => Math.min(4, value + 0.25));
      if (event.key === '-' && scale > 0.5) setScale((value) => Math.max(0.5, value - 0.25));
      if (event.key === '0') setScale(1);
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

  return (
    <div
      className="image-gallery-lightbox"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
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
        setScale((value) => (value > 1 ? 1 : 2));
      }}
      onWheel={(event) => {
        event.preventDefault();
        setScale((value) => Math.min(4, Math.max(0.5, value + (event.deltaY < 0 ? 0.12 : -0.12))));
      }}
      onTouchStart={(event) => {
        setDragStartX(event.touches[0]?.clientX ?? null);
      }}
      onTouchEnd={(event) => {
        if (dragStartX === null) return;
        const endX = event.changedTouches[0]?.clientX ?? dragStartX;
        const deltaX = endX - dragStartX;
        if (Math.abs(deltaX) > 44) {
          if (deltaX > 0) goPrevious();
          else goNext();
        }
        setDragStartX(null);
      }}
    >
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
            setScale((value) => (value > 1 ? 1 : 2));
          }}
          style={{ transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}

type DeleteConfirmMode = 'metadata' | 'permanent';

type SharePosterState = {
  imageUrl: string;
  shareUrl: string;
  blob: Blob;
};

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

function buildArticleShareUrl(article: any, scrollPosition: number) {
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
  url.hash = 'reading-position';
  return url.toString();
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

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
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

function applyCaptureStyles(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();
  element.removeAttribute('class');
  element.removeAttribute('style');
  element.style.boxSizing = 'border-box';
  element.style.color = '#1f2933';
  element.style.borderColor = '#e5e7eb';
  element.style.boxShadow = 'none';
  element.style.textShadow = 'none';
  element.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
    element.style.margin = '18px 0 10px';
    element.style.fontWeight = '650';
    element.style.lineHeight = '1.42';
    element.style.color = '#111827';
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
    element.style.color = '#338a55';
    element.style.textDecoration = 'none';
  }
  if (tagName === 'blockquote') {
    element.style.margin = '14px 0';
    element.style.padding = '8px 14px';
    element.style.borderLeft = '3px solid #48a868';
    element.style.background = '#f3f6f4';
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
    element.style.background = '#f3f6f4';
    element.style.overflow = 'hidden';
  }
  if (tagName === 'code') {
    element.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
    element.style.background = '#f3f6f4';
    element.style.borderRadius = '4px';
    element.style.padding = '1px 4px';
  }
  if (tagName === 'button') {
    element.style.border = '0';
    element.style.background = '#f3f6f4';
  }
  if (tagName === 'img') {
    element.style.display = 'block';
    element.style.maxWidth = '100%';
    element.style.height = 'auto';
    element.style.margin = '12px 0';
    element.style.borderRadius = '10px';
    element.style.background = '#ffffff';
  }
  if (tagName === 'table') {
    element.style.width = '100%';
    element.style.borderCollapse = 'collapse';
    element.style.margin = '14px 0';
  }
  if (tagName === 'td' || tagName === 'th') {
    element.style.border = '1px solid #e5e7eb';
    element.style.padding = '8px';
  }
}

async function waitForCaptureImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(images.map((image) => new Promise<void>((resolve) => {
    if (!image.src || image.complete) {
      resolve();
      return;
    }
    const finish = () => resolve();
    image.onload = finish;
    image.onerror = finish;
  })));
}

async function createShareCaptureTarget(panel: HTMLDivElement, screenshotHeight: number) {
  const headerHeight = panel.querySelector('.detail-panel-header')?.getBoundingClientRect().height ?? 0;
  const captureHeight = Math.max(1, screenshotHeight - headerHeight);
  const imageSources = Array.from(panel.querySelectorAll<HTMLImageElement>('img')).map((image) => image.currentSrc || image.src);
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = `${panel.clientWidth}px`;
  wrapper.style.height = `${captureHeight}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.background = '#ffffff';
  wrapper.style.color = '#1f2933';
  wrapper.style.font = '17px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  wrapper.style.pointerEvents = 'none';

  const clonedPanel = panel.cloneNode(true) as HTMLElement;
  clonedPanel.querySelectorAll('.detail-panel-header, .detail-panel-footer, .share-poster-overlay, .confirm-dialog-overlay, .detail-more-menu, .detail-more-menu-backdrop').forEach((node) => node.remove());
  clonedPanel.querySelectorAll<HTMLElement>('*').forEach(applyCaptureStyles);
  applyCaptureStyles(clonedPanel);

  clonedPanel.style.position = 'absolute';
  clonedPanel.style.left = '0';
  clonedPanel.style.top = `-${panel.scrollTop}px`;
  clonedPanel.style.width = `${panel.clientWidth}px`;
  clonedPanel.style.minHeight = `${panel.scrollHeight}px`;
  clonedPanel.style.padding = '0';
  clonedPanel.style.background = '#ffffff';
  clonedPanel.style.overflow = 'visible';

  clonedPanel.querySelectorAll<HTMLImageElement>('img').forEach((image, index) => {
    const source = imageSources[index] || image.getAttribute('src') || '';
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

  wrapper.appendChild(clonedPanel);
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
}: {
  article: any;
  shareUrl: string;
  panel: HTMLDivElement;
}) {
  const screenshotHeight = Math.min(panel.clientHeight, 760);
  const captureTarget = await createShareCaptureTarget(panel, screenshotHeight);
  let screenshot: HTMLCanvasElement;
  try {
    screenshot = await html2canvas(captureTarget.element, {
      backgroundColor: '#ffffff',
      height: captureTarget.element.clientHeight,
      width: captureTarget.element.clientWidth,
      windowWidth: captureTarget.element.clientWidth,
      windowHeight: captureTarget.element.clientHeight,
      logging: false,
      useCORS: true,
      scale: Math.min(window.devicePixelRatio || 1, 2),
    });
  } finally {
    captureTarget.cleanup();
  }

  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    width: 220,
    margin: 1,
    color: {
      dark: '#1f2933',
      light: '#ffffff',
    },
  });
  const qrImage = await loadCanvasImage(qrDataUrl);

  const posterWidth = 1080;
  const padding = 64;
  const titleTop = padding;
  const screenshotWidth = posterWidth - padding * 2;
  const screenshotInset = 28;
  const screenshotContentWidth = screenshotWidth - screenshotInset * 2;
  const screenshotScaledHeight = Math.round(screenshot.height * (screenshotContentWidth / screenshot.width));
  const qrSize = 188;
  const footerHeight = 276;
  const titleBlockHeight = 150;
  const screenshotTop = titleTop + titleBlockHeight;
  const posterHeight = screenshotTop + screenshotScaledHeight + footerHeight + padding;

  const canvas = document.createElement('canvas');
  canvas.width = posterWidth;
  canvas.height = posterHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const gradient = ctx.createLinearGradient(0, 0, posterWidth, posterHeight);
  gradient.addColorStop(0, '#f7f1e5');
  gradient.addColorStop(0.52, '#eef5f1');
  gradient.addColorStop(1, '#f4f0fb');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, posterWidth, posterHeight);

  ctx.fillStyle = '#1f2933';
  ctx.font = '650 42px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  drawWrappedText({
    ctx,
    text: String(article.title || '未命名文章'),
    x: padding,
    y: titleTop + 12,
    maxWidth: posterWidth - padding * 2,
    lineHeight: 54,
    maxLines: 2,
  });

  ctx.fillStyle = 'rgba(31, 41, 51, 0.54)';
  ctx.font = '400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('当前阅读位置截图', padding, titleTop + 128);

  ctx.save();
  ctx.shadowColor = 'rgba(31, 41, 51, 0.16)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 18;
  drawRoundRect(ctx, padding, screenshotTop, screenshotWidth, screenshotScaledHeight, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  ctx.drawImage(screenshot, padding + screenshotInset, screenshotTop, screenshotContentWidth, screenshotScaledHeight);
  ctx.restore();

  const footerTop = screenshotTop + screenshotScaledHeight + 42;
  ctx.fillStyle = '#1f2933';
  ctx.font = '600 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('今天藏什么', padding, footerTop + 42);

  ctx.fillStyle = 'rgba(31, 41, 51, 0.68)';
  ctx.font = '400 26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('扫码跳转到这篇文章的当前位置', padding, footerTop + 86);

  ctx.fillStyle = 'rgba(31, 41, 51, 0.82)';
  ctx.font = '500 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const source = String(article.source || article.author || '未知来源');
  const clippedSource = source.length > 30 ? `${source.slice(0, 30)}...` : source;
  ctx.fillText(clippedSource, padding, footerTop + 142, posterWidth - padding * 2 - qrSize - 34);

  const qrX = posterWidth - padding - qrSize;
  const qrY = footerTop;
  ctx.save();
  ctx.shadowColor = 'rgba(31, 41, 51, 0.12)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  drawRoundRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 24);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<DeleteConfirmMode | null>(null);
  const [sharePoster, setSharePoster] = useState<SharePosterState | null>(null);

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
    const shareUrl = buildArticleShareUrl(article, getScrollPosition());

    if (!panel) {
      await navigator.clipboard.writeText(shareUrl);
      showToast('分享链接已复制');
      return;
    }

    setPendingAction('share');
    try {
      const poster = await createSharePoster({ article, shareUrl, panel });
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
      await navigator.clipboard.writeText(shareUrl);
      showToast('生成海报失败，分享链接已复制');
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
          await navigator.clipboard.writeText(sharePoster.shareUrl);
          showToast('系统分享失败，链接已复制');
        }
      }
    } else {
      await navigator.clipboard.writeText(sharePoster.shareUrl);
      showToast('当前浏览器不支持图片分享，链接已复制');
    }
  }

  async function handleCopyShareUrl() {
    if (!sharePoster) return;
    await navigator.clipboard.writeText(sharePoster.shareUrl);
    showToast('分享链接已复制');
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

  const showArticleSkeleton = isLoading || pendingAction === 'refetch';
  const showAISkeleton = pendingAction === 'ai';

  async function handleCopyOriginalUrl() {
    if (!article) return;
    const url = article.originalUrl || window.location.href;
    await navigator.clipboard.writeText(url);
    setMoreOpen(false);
    showToast('链接已复制');
  }

  function handleOpenOriginalUrl() {
    if (!article?.originalUrl) return;
    setMoreOpen(false);
    window.open(article.originalUrl, '_blank', 'noopener,noreferrer');
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
                    <div className="detail-more-menu-divider" />
                    <button className="app-menu-item detail-more-menu-item" type="button" onClick={handleCopyOriginalUrl}>
                      <CopyOutlined />
                      <span>复制原文链接</span>
                    </button>
                    {article?.originalUrl && (
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
                    {article?.originalUrl && (
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
            {article.contentHtml ? (
              <div 
                className="article-body"
                style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.8 }}
                dangerouslySetInnerHTML={{ __html: article.contentHtml }}
              />
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>正在加载正文...</div>
            )}
          </div>

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
            }}
          >
            {/* 左侧：阅读原文 */}
            {article.originalUrl && (
              <a
                href={article.originalUrl}
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
            )}

            {/* 右侧：操作按钮 —— 游客只显示分享 */}
            <div className="detail-panel-footer-actions">
              {/* 书签按钮 —— 所有用户可用 */}
              <BookmarkButton onClick={handleSaveBookmark} />
              {isAuthenticated && (
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
              <button className="detail-panel-action-btn" onClick={handleShare} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <ShareAltOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                <span className="detail-panel-action-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pendingAction === 'share' ? '生成中' : '分享'}</span>
              </button>
            </div>
          </footer>
        </>
      ) : null}
    </>
  );
}
