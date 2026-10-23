'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseOutlined, PlusOutlined, ReloadOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons';

import type { ArchiveCategory } from '@/lib/api';
import {
  assignmentFailure,
  buildCategoryPickerSections,
  nextPickerIndex,
  type CategoryAssignmentOutcome,
} from '@/lib/category-picker';

type CategoryPickerOption =
  | { key: 'ai'; kind: 'ai' }
  | { key: string; kind: 'category'; category: ArchiveCategory }
  | { key: 'create'; kind: 'create'; name: string };

type CategoryPickerProps = {
  categories: ArchiveCategory[];
  recentCategoryIds?: number[];
  currentCategoryId: number | null;
  loading?: boolean;
  catalogError?: string | null;
  title?: string;
  subtitle?: string;
  targetCount?: number;
  onClose: () => void;
  onSelect: (categoryId: number) => Promise<CategoryAssignmentOutcome>;
  onSelectAi?: () => Promise<CategoryAssignmentOutcome>;
  onCreateCategory?: (name: string) => Promise<{ category: ArchiveCategory }>;
  onRememberCategory?: (categoryId: number) => void;
  onCatalogRefresh?: () => Promise<unknown> | void;
  onNotify?: (message: string) => void;
};

type PickerFeedback = { tone: 'error' | 'info'; text: string } | null;

function 错误码(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('errorCode' in error)) return null;
  return typeof error.errorCode === 'string' ? error.errorCode : null;
}

function 结果说明(result: CategoryAssignmentOutcome, created: boolean): PickerFeedback | null {
  if (result.status === 'partial') {
    const prefix = created ? '分类已创建；' : '';
    return {
      tone: 'error',
      text: `${prefix}文章尚未全部分类：成功 ${result.succeededCount}，跳过 ${result.skippedCount}，失败 ${result.failedCount}。请重试剩余文章。`,
    };
  }
  if (result.status === 'failure') {
    if (created) return { tone: 'error', text: '分类已创建，但文章尚未分类，请重试' };
    const counts = result.succeededCount !== undefined
      ? `（成功 ${result.succeededCount}，跳过 ${result.skippedCount ?? 0}，失败 ${result.failedCount ?? 0}）`
      : '';
    return { tone: 'error', text: `${result.message}${counts}` };
  }
  return null;
}

export function CategoryPicker({
  categories,
  recentCategoryIds = [],
  currentCategoryId,
  loading = false,
  catalogError = null,
  title = '设置分类',
  subtitle,
  targetCount,
  onClose,
  onSelect,
  onSelectAi,
  onCreateCategory,
  onRememberCategory,
  onCatalogRefresh,
  onNotify,
}: CategoryPickerProps) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<PickerFeedback>(null);
  const [conflictName, setConflictName] = useState<string | null>(null);
  const [highlightedKey, setHighlightedKey] = useState('ai');
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  const sections = useMemo(
    () => buildCategoryPickerSections(categories, recentCategoryIds, query),
    [categories, recentCategoryIds, query],
  );
  const normalizedQuery = query.trim();
  const options = useMemo<CategoryPickerOption[]>(() => {
    const next: CategoryPickerOption[] = [];
    if (onSelectAi) next.push({ key: 'ai', kind: 'ai' });
    for (const category of sections.recent) next.push({ key: `recent:${category.id}`, kind: 'category', category });
    for (const category of sections.filtered) next.push({ key: `all:${category.id}`, kind: 'category', category });
    if (onCreateCategory && sections.canCreate) next.push({ key: 'create', kind: 'create', name: normalizedQuery });
    return next;
  }, [normalizedQuery, onCreateCategory, onSelectAi, sections]);

  const highlightedIndex = options.findIndex((option) => option.key === highlightedKey);

  useEffect(() => {
    const returnFocus = returnFocusRef.current;
    inputRef.current?.focus();
    return () => {
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (normalizedQuery) {
      const targetKey = sections.exactCategory
        ? `all:${sections.exactCategory.id}`
        : sections.filtered[0]
          ? `all:${sections.filtered[0].id}`
          : sections.canCreate && onCreateCategory
            ? 'create'
            : options[0]?.key;
      if (targetKey) setHighlightedKey(targetKey);
      return;
    }
    setHighlightedKey(options[0]?.key ?? 'ai');
  }, [normalizedQuery, onCreateCategory, options, sections.canCreate, sections.exactCategory, sections.filtered]);

  useEffect(() => {
    if (!conflictName) return;
    const existing = categories.find((category) => (
      category.isActive && category.name.toLocaleLowerCase('zh-CN') === conflictName.toLocaleLowerCase('zh-CN')
    ));
    if (!existing) return;
    setHighlightedKey(`all:${existing.id}`);
    setFeedback({ tone: 'info', text: `已存在同名分类“${existing.name}”，已为你定位，可直接使用现有分类。` });
    setConflictName(null);
  }, [categories, conflictName]);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const finishOutcome = (result: CategoryAssignmentOutcome, categoryId: number | null, created: boolean) => {
    const issue = 结果说明(result, created);
    if (issue) setFeedback(issue);
    if (categoryId !== null && (result.status === 'success' || (result.status === 'partial' && result.succeededCount > 0))) {
      onRememberCategory?.(categoryId);
    }
    if (issue) return;
    if (result.status === 'success' && result.message) onNotify?.(result.message);
    onClose();
  };

  const executeOption = async (option: CategoryPickerOption | undefined) => {
    if (!option || busy || loading) return;
    if (option.kind === 'category' && option.category.id === currentCategoryId) return;

    if (option.kind === 'create') {
      if (!onCreateCategory || !option.name) return;
      setBusy(true);
      setFeedback(null);
      let createdCategory: ArchiveCategory | null = null;
      try {
        const created = await onCreateCategory(option.name);
        createdCategory = created.category;
        try {
          await onCatalogRefresh?.();
        } catch (error) {
          console.error('刷新分类目录失败:', error);
        }
      } catch (error) {
        if (错误码(error) === 'CATEGORY_NAME_CONFLICT') {
          setConflictName(option.name);
          setFeedback({ tone: 'info', text: '已存在同名分类，正在刷新分类列表…' });
          try {
            await onCatalogRefresh?.();
          } catch (refreshError) {
            console.error('刷新分类目录失败:', refreshError);
          }
        } else {
          setFeedback({
            tone: 'error',
            text: error instanceof Error && error.message ? error.message : '创建分类失败，请重试',
          });
        }
        setBusy(false);
        return;
      }

      try {
        const result = await onSelect(createdCategory.id);
        finishOutcome(result, createdCategory.id, true);
      } catch (error) {
        finishOutcome(assignmentFailure(error), createdCategory.id, true);
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const result = option.kind === 'ai'
        ? onSelectAi
          ? await onSelectAi()
          : { status: 'failure' as const, message: 'AI 分类暂不可用' }
        : await onSelect(option.category.id);
      finishOutcome(result, option.kind === 'category' ? option.category.id : null, false);
    } catch (error) {
      finishOutcome(assignmentFailure(error), option.kind === 'category' ? option.category.id : null, false);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = nextPickerIndex(highlightedIndex, event.key === 'ArrowDown' ? 1 : -1, options.length);
      if (nextIndex >= 0) setHighlightedKey(options[nextIndex].key);
      return;
    }
    if (event.key === 'Enter' && event.target === inputRef.current) {
      event.preventDefault();
      void executeOption(options[highlightedIndex]);
    }
  };

  const renderCategoryButton = (category: ArchiveCategory, key: string) => {
    const selected = category.id === currentCategoryId;
    const highlighted = key === highlightedKey;
    return (
      <button
        id={`category-picker-${key.replace(':', '-')}`}
        key={key}
        className={`category-assignment-item${selected ? ' is-selected' : ''}${highlighted ? ' is-highlighted' : ''}`}
        type="button"
        role="option"
        aria-selected={selected || highlighted}
        onClick={() => void executeOption({ key, kind: 'category', category })}
        disabled={busy || loading || selected}
        onMouseEnter={() => setHighlightedKey(key)}
      >
        <span className="category-assignment-dot" style={{ background: category.color || 'var(--accent)' }} aria-hidden="true" />
        <span>{category.name}</span>
        {selected && <span className="category-assignment-current">当前</span>}
      </button>
    );
  };

  const description = subtitle ?? (targetCount
    ? `为已选 ${targetCount} 篇文章选择分类，也可以让 AI 判断。`
    : '分类只用于归档文章。');

  return createPortal(
    <div
      className="category-assignment-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="category-assignment-panel category-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-assignment-title"
        onKeyDown={handleKeyDown}
      >
        <div className="category-assignment-header">
          <div>
            <h2 id="category-assignment-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button className="category-assignment-close" type="button" onClick={close} disabled={busy} aria-label="关闭分类选择">
            <CloseOutlined />
          </button>
        </div>

        <div className="category-picker-search">
          <SearchOutlined aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="搜索或创建分类"
            aria-expanded="true"
            aria-controls="category-picker-options"
            aria-activedescendant={highlightedKey ? `category-picker-${highlightedKey.replace(':', '-')}` : undefined}
            value={query}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setFeedback(null);
            }}
            placeholder="搜索分类，或输入新分类名称"
            maxLength={40}
            disabled={busy}
            autoComplete="off"
          />
        </div>

        {feedback && (
          <p className={`category-picker-feedback is-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>
            {feedback.text}
          </p>
        )}
        {catalogError && (
          <div className="category-picker-status" role="alert">
            <span>{catalogError}</span>
            {onCatalogRefresh && <button type="button" onClick={() => void onCatalogRefresh()} disabled={busy}><ReloadOutlined /> 重试</button>}
          </div>
        )}
        {loading && <p className="category-picker-status">正在加载分类…</p>}

        <div className="category-assignment-list category-picker-options" id="category-picker-options" role="listbox" aria-label="分类选项">
          {onSelectAi && (
            <button
              id="category-picker-ai"
              className={`category-assignment-item category-assignment-item--ai${highlightedKey === 'ai' ? ' is-highlighted' : ''}`}
              type="button"
              role="option"
              aria-selected={highlightedKey === 'ai'}
              onClick={() => void executeOption({ key: 'ai', kind: 'ai' })}
              disabled={busy || loading}
              onMouseEnter={() => setHighlightedKey('ai')}
            >
              <RobotOutlined aria-hidden="true" />
              <span>由 AI 判断</span>
              <small>低置信度进入待整理</small>
            </button>
          )}

          {sections.recent.length > 0 && (
            <div className="category-picker-section" role="group" aria-label="最近使用">
              <span className="category-picker-section-title">最近使用</span>
              {sections.recent.map((category) => renderCategoryButton(category, `recent:${category.id}`))}
            </div>
          )}

          {sections.filtered.length > 0 && (
            <div className="category-picker-section" role="group" aria-label="全部分类">
              <span className="category-picker-section-title">全部分类</span>
              {sections.filtered.map((category) => renderCategoryButton(category, `all:${category.id}`))}
            </div>
          )}

          {!loading && sections.filtered.length === 0 && !sections.canCreate && (
            <div className="category-picker-empty">
              <p>{normalizedQuery ? '没有匹配的分类' : '还没有分类。输入名称即可创建第一个分类。'}</p>
              {!normalizedQuery && <button type="button" onClick={() => inputRef.current?.focus()}>创建第一个分类</button>}
            </div>
          )}

          {onCreateCategory && sections.canCreate && (
            <button
              id="category-picker-create"
              className={`category-assignment-create${highlightedKey === 'create' ? ' is-highlighted' : ''}`}
              type="button"
              role="option"
              aria-selected={highlightedKey === 'create'}
              onClick={() => void executeOption({ key: 'create', kind: 'create', name: normalizedQuery })}
              disabled={busy || loading}
              onMouseEnter={() => setHighlightedKey('create')}
            >
              <PlusOutlined aria-hidden="true" />
              {busy ? '处理中…' : `创建“${normalizedQuery}”并分类`}
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
