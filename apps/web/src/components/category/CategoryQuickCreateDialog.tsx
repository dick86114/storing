'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BgColorsOutlined, CloseOutlined, RobotOutlined } from '@ant-design/icons';

import { api, type ArchiveCategory } from '@/lib/api';
import { CATEGORY_COLORS, stableCategoryColor } from '@/lib/category-presets';

export type CategoryQuickCreateInput = {
  name: string;
  description: string | null;
  includeExamples: string[];
  excludeExamples: string[];
  color: string | null;
};

type CategoryQuickCreateDialogProps = {
  categories?: ArchiveCategory[];
  title?: string;
  onClose: () => void;
  onCreate: (input: CategoryQuickCreateInput) => Promise<{ category: ArchiveCategory }>;
  onCreated: (category: ArchiveCategory, meta: { reusedExisting: boolean }) => void;
};

function 转示例(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

export function CategoryQuickCreateDialog({
  categories = [],
  title = '新建分类',
  onClose,
  onCreate,
  onCreated,
}: CategoryQuickCreateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includeExamples, setIncludeExamples] = useState('');
  const [excludeExamples, setExcludeExamples] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const duplicate = useMemo(() => categories.find((category) => (
    category.isActive && category.name.toLocaleLowerCase('zh-CN') === name.trim().toLocaleLowerCase('zh-CN')
  )), [categories, name]);

  useEffect(() => {
    const returnFocus = returnFocusRef.current;
    inputRef.current?.focus();
    return () => {
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    };
  }, []);

  const close = () => {
    if (saving || optimizing) return;
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving || duplicate) return;
    setSaving(true);
    setError(null);
    try {
      const result = await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        includeExamples: 转示例(includeExamples),
        excludeExamples: 转示例(excludeExamples),
        color,
      });
      onCreated(result.category, { reusedExisting: false });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : '创建分类失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const optimize = async () => {
    if (!name.trim() || optimizing) return;
    setOptimizing(true);
    setError(null);
    try {
      const result = await api.optimizeCategoryDescription({
        name: name.trim(),
        description: description.trim() || null,
        includeExamples: 转示例(includeExamples),
        excludeExamples: 转示例(excludeExamples),
      });
      if (result.draft.description) setDescription(result.draft.description);
      if (result.draft.includeExamples?.length) setIncludeExamples(result.draft.includeExamples.join('\n'));
      if (result.draft.excludeExamples?.length) setExcludeExamples(result.draft.excludeExamples.join('\n'));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'AI 优化失败，请稍后重试');
    } finally {
      setOptimizing(false);
    }
  };

  return createPortal(
    <div className="category-form-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <form
        className="category-quick-create"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-quick-create-title"
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving && !optimizing) close();
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="category-quick-create-header">
          <div>
            <h2 id="category-quick-create-title">{title}</h2>
            <p>名称是唯一必填项；规则可以稍后再补。</p>
          </div>
          <button type="button" onClick={close} disabled={saving || optimizing} aria-label="关闭新建分类">
            <CloseOutlined />
          </button>
        </header>

        <div className="category-quick-create-body">
          <label className="category-form-field">
            <span>分类名称</span>
            <input
              ref={inputRef}
              value={name}
              onInput={(event) => {
                const nextName = event.currentTarget.value;
                setName(nextName);
                setColor(stableCategoryColor(nextName));
                setError(null);
              }}
              placeholder="例如：产品设计"
              maxLength={40}
              disabled={saving || optimizing}
            />
          </label>

          {duplicate && (
            <div className="category-quick-create-duplicate" role="status">
              <span>已有同名分类“{duplicate.name}”。</span>
              <button type="button" onClick={() => onCreated(duplicate, { reusedExisting: true })} disabled={saving || optimizing}>使用现有分类</button>
            </div>
          )}

          <details className="category-quick-create-details">
            <summary>详细规则（可选）</summary>
            <p>未填写说明时，AI 会更倾向于把不明确文章放入待整理。</p>
            <label className="category-form-field">
              <span>分类说明</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="说明这个分类适合收录哪些文章"
                maxLength={500}
                rows={3}
                disabled={saving || optimizing}
              />
            </label>
            <div className="category-quick-create-rule-grid">
              <label className="category-form-field">
                <span>适合收录</span>
                <textarea
                  value={includeExamples}
                  onChange={(event) => setIncludeExamples(event.target.value)}
                  placeholder={'每行一个示例\n例如：产品设计方法'}
                  rows={3}
                  disabled={saving || optimizing}
                />
              </label>
              <label className="category-form-field">
                <span>不适合收录</span>
                <textarea
                  value={excludeExamples}
                  onChange={(event) => setExcludeExamples(event.target.value)}
                  placeholder={'每行一个示例\n例如：纯行业新闻'}
                  rows={3}
                  disabled={saving || optimizing}
                />
              </label>
            </div>
            <div className="category-quick-create-color">
              <span>显示颜色</span>
              <div className="category-form-color-swatches" aria-label="预设颜色">
                {CATEGORY_COLORS.map((item) => (
                  <button
                    key={item}
                    className={color === item ? 'is-selected' : ''}
                    type="button"
                    onClick={() => setColor(item)}
                    style={{ '--swatch-color': item } as React.CSSProperties}
                    aria-label={`选择颜色 ${item}`}
                  />
                ))}
              </div>
              <label className="category-form-custom-color" title="自定义颜色">
                <BgColorsOutlined aria-hidden="true" />
                <span>调色盘</span>
                <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="自定义分类颜色" />
              </label>
            </div>
            <button className="category-quick-create-optimize" type="button" onClick={optimize} disabled={saving || optimizing || !name.trim()}>
              <RobotOutlined /> {optimizing ? '正在生成…' : 'AI 优化分类说明'}
            </button>
          </details>

          {error && <p className="category-isolate-error" role="alert">{error}</p>}
        </div>

        <footer className="category-quick-create-footer">
          <button type="button" onClick={close} disabled={saving || optimizing}>取消</button>
          <button type="submit" disabled={!name.trim() || Boolean(duplicate) || saving || optimizing}>
            {saving ? '创建中…' : '创建分类'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
