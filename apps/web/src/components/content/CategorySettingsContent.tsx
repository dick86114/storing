'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BgColorsOutlined,
  CheckOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
} from '@ant-design/icons';

import { CategoryManagementRow } from '@/components/category/CategoryManagementRow';
import { CategoryQuickCreateDialog, type CategoryQuickCreateInput } from '@/components/category/CategoryQuickCreateDialog';
import { useAuth } from '@/components/providers/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useCategoryCatalog, useRefreshCategoryCatalog } from '@/hooks/useCategoryCatalog';
import { api, type ArchiveCategory } from '@/lib/api';
import { filterManagementCategories, moveUserCategory, reorderUserCategoryByOffset, resolveSelectedCategoryId } from '@/lib/category-management';
import {
  createCategoryMutationGate,
  runCommittedCategoryMutation,
  snapshotCategoryActionSource,
  type CategoryMutationKind,
} from '@/lib/category-mutation';
import { CATEGORY_COLORS } from '@/lib/category-presets';

type CategoryDraft = Pick<ArchiveCategory, 'name' | 'description' | 'includeExamples' | 'excludeExamples' | 'color'>;
type ActionKind = 'merge' | 'delete' | 'activate' | 'deactivate';

const EMPTY_DRAFT: CategoryDraft = {
  name: '',
  description: '',
  includeExamples: [],
  excludeExamples: [],
  color: CATEGORY_COLORS[0],
};

function 示例转文本(examples: string[]) {
  return examples.join('\n');
}

function 文本转示例(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function 分类计数(counts: Record<number, number>, id: number) {
  return counts[id] ?? 0;
}

export function CategorySettingsContent() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const catalog = useCategoryCatalog();
  const refreshCategoryCatalog = useRefreshCategoryCatalog();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const pendingSelectedIdRef = useRef<number | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT);
  const [activeMutation, setActiveMutation] = useState<CategoryMutationKind | null>(null);
  const mutationGateRef = useRef(createCategoryMutationGate());
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionKind, setActionKind] = useState<ActionKind | null>(null);
  const [actionSource, setActionSource] = useState<ArchiveCategory | null>(null);
  const [actionTargetId, setActionTargetId] = useState<number | null>(null);
  const [catalogRefreshWarning, setCatalogRefreshWarning] = useState(false);

  const orderedCategories = useMemo(
    () => [...catalog.categories].sort((left, right) => (
      left.sortOrder - right.sortOrder || (left.createdAt ?? '').localeCompare(right.createdAt ?? '')
    )),
    [catalog.categories],
  );
  const filteredCategories = useMemo(
    () => filterManagementCategories(orderedCategories, query),
    [orderedCategories, query],
  );
  const selected = orderedCategories.find((category) => category.id === selectedId) ?? null;
  const userCategories = orderedCategories.filter((category) => !category.isSystem);
  const activeTargets = orderedCategories.filter((category) => category.isActive);

  useEffect(() => {
    const nextId = resolveSelectedCategoryId(orderedCategories, selectedId, pendingSelectedIdRef.current);
    if (nextId === selectedId) {
      if (selectedId !== null && orderedCategories.some((category) => category.id === selectedId)) {
        pendingSelectedIdRef.current = null;
      }
      return;
    }
    setSelectedId(nextId);
  }, [orderedCategories, selectedId]);

  useEffect(() => {
    if (!selected) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    setDraft({
      name: selected.name,
      description: selected.description ?? '',
      includeExamples: selected.includeExamples,
      excludeExamples: selected.excludeExamples,
      color: selected.color ?? CATEGORY_COLORS[0],
    });
  }, [selected]);


  const warnRefresh = useCallback((error: unknown) => {
    console.warn('分类操作已提交，但刷新目录失败:', error);
    setCatalogRefreshWarning(true);
    showToast('操作已提交，分类目录刷新失败，请稍后重试');
  }, [showToast]);

  const refreshCatalogAfterMutation = useCallback(async () => {
    await refreshCategoryCatalog();
    setCatalogRefreshWarning(false);
  }, [refreshCategoryCatalog]);

  const retryCatalogRefresh = useCallback(async () => {
    try {
      await refreshCategoryCatalog();
      setCatalogRefreshWarning(false);
    } catch (error) {
      warnRefresh(error);
    }
  }, [refreshCategoryCatalog, warnRefresh]);

  const runLockedMutation = useCallback(async <T,>(
    kind: CategoryMutationKind,
    task: () => Promise<T>,
  ): Promise<{ status: 'completed'; value: T } | { status: 'locked' }> => {
    const gate = mutationGateRef.current;
    if (!gate.tryAcquire(kind)) return { status: 'locked' };
    setActiveMutation(kind);
    try {
      return { status: 'completed', value: await task() };
    } finally {
      gate.release(kind);
      setActiveMutation(null);
    }
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || selected.isSystem || !draft.name.trim()) return;
    const source = selected;
    await runLockedMutation('save', () => runCommittedCategoryMutation({
      commit: () => api.updateCategory(source.id, {
        ...draft,
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
      }),
      refresh: refreshCatalogAfterMutation,
      onCommitted: () => showToast('分类已保存'),
      onFailure: (error) => showToast(error instanceof Error ? error.message : '保存分类失败'),
      onRefreshWarning: warnRefresh,
    }));
  };

  const optimizeDraft = async () => {
    if (!draft.name.trim()) return;
    await runLockedMutation('optimize', () => runCommittedCategoryMutation({
      commit: () => api.optimizeCategoryDescription({
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        includeExamples: draft.includeExamples,
        excludeExamples: draft.excludeExamples,
      }),
      onCommitted: (result) => {
        setDraft((current) => ({
          ...current,
          description: result.draft.description || current.description,
          includeExamples: result.draft.includeExamples?.length ? result.draft.includeExamples : current.includeExamples,
          excludeExamples: result.draft.excludeExamples?.length ? result.draft.excludeExamples : current.excludeExamples,
        }));
        showToast('已生成分类规则草案');
      },
      onFailure: (error) => showToast(error instanceof Error ? error.message : 'AI 优化失败，请稍后重试'),
    }));
  };

  const persistOrder = useCallback(async (nextCategories: ArchiveCategory[]) => {
    if (nextCategories === orderedCategories) return;
    await runLockedMutation('reorder', () => runCommittedCategoryMutation({
      commit: () => api.reorderCategories(nextCategories.filter((category) => !category.isSystem).map((category) => category.id)),
      refresh: refreshCatalogAfterMutation,
      onCommitted: () => {},
      onFailure: (error) => {
        showToast(error instanceof Error ? error.message : '保存分类顺序失败');
        void refreshCategoryCatalog().catch(warnRefresh);
      },
      onRefreshWarning: warnRefresh,
    }));
  }, [orderedCategories, refreshCatalogAfterMutation, refreshCategoryCatalog, runLockedMutation, showToast, warnRefresh]);

  const moveByKeyboard = (categoryId: number, offset: -1 | 1) => {
    const next = reorderUserCategoryByOffset(orderedCategories, categoryId, offset);
    if (next !== orderedCategories) void persistOrder(next);
  };

  const handleDrop = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return;
    const next = moveUserCategory(orderedCategories, draggedId, targetId);
    setDraggedId(null);
    if (next !== orderedCategories) void persistOrder(next);
  };

  const createCategory = async (input: CategoryQuickCreateInput) => {
    const lockedResult = await runLockedMutation('create', () => runCommittedCategoryMutation({
      commit: () => api.createCategory(input),
      refresh: refreshCatalogAfterMutation,
      onCommitted: () => {},
      onFailure: (error) => console.warn('创建分类失败:', error),
      onRefreshWarning: warnRefresh,
    }));
    if (lockedResult.status === 'locked') throw new Error('正在处理其他分类操作，请稍后再试');
    if (lockedResult.value.status === 'failure') {
      throw lockedResult.value.error instanceof Error
        ? lockedResult.value.error
        : new Error('创建分类失败，请重试');
    }
    return lockedResult.value.value;
  };

  const openAction = (kind: ActionKind) => {
    if (!selected || selected.isSystem || mutationGateRef.current.active !== null) return;
    setActionKind(kind);
    setActionSource(snapshotCategoryActionSource(selected));
    setActionTargetId(null);
  };

  const closeAction = () => {
    if (mutationGateRef.current.active !== null) return;
    setActionKind(null);
    setActionSource(null);
    setActionTargetId(null);
  };

  const confirmAction = async () => {
    const source = actionSource;
    const kind = actionKind;
    const targetId = actionTargetId;
    if (!source || !kind || (kind === 'merge' || kind === 'delete') && !targetId) return;

    const lockedResult = await runLockedMutation(kind, () => runCommittedCategoryMutation({
      commit: async (): Promise<unknown> => {
        if (kind === 'merge' && targetId) return api.mergeCategories(source.id, targetId);
        if (kind === 'delete' && targetId) return api.deleteCategory(source.id, targetId);
        return api.updateCategory(source.id, { isActive: kind === 'activate' });
      },
      refresh: refreshCatalogAfterMutation,
      onCommitted: () => {
        if ((kind === 'merge' || kind === 'delete') && targetId) {
          pendingSelectedIdRef.current = null;
          setSelectedId(targetId);
        }
        showToast(kind === 'merge'
          ? '分类已合并'
          : kind === 'delete'
            ? '分类已迁移并删除'
            : kind === 'activate'
              ? '分类已启用'
              : '分类已停用');
      },
      onFailure: (error) => showToast(error instanceof Error ? error.message : '分类操作失败'),
      onRefreshWarning: warnRefresh,
    }));

    if (lockedResult.status === 'completed' && lockedResult.value.status === 'success') {
      setActionKind(null);
      setActionSource(null);
      setActionTargetId(null);
    }
  };

  const mutationLocked = activeMutation !== null;
  const actionCopy = actionKind === 'merge'
    ? { title: '合并分类', description: '目标分类会保留，当前分类下的文章会迁移过去。', confirm: '确认合并' }
    : actionKind === 'delete'
      ? { title: '删除分类', description: '先选择接收文章的分类；迁移完成后当前分类会被删除。', confirm: '迁移并删除' }
      : actionKind === 'activate'
        ? { title: '启用分类', description: '启用后，AI 会再次将符合规则的新归档文章分到这个分类。', confirm: '确认启用' }
        : { title: '停用分类', description: '停用后，AI 不再新增文章到这个分类；已有文章保持原分类。', confirm: '确认停用' };

  if (!isAuthenticated) {
    return <div className="category-management-empty">请登录后管理分类。</div>;
  }

  return (
    <section className="category-management-shell" aria-busy={catalog.isLoading || mutationLocked}>
      <header className="category-management-header">
        <div>
          <span>分类设置</span>
          <h1>管理分类</h1>
          <p>系统分类保持固定；用户分类可排序、编辑、合并或迁移删除。</p>
        </div>
        <button className="category-management-create" type="button" disabled={mutationLocked} onClick={() => setCreateOpen(true)}>
          <PlusOutlined aria-hidden="true" />新建分类
        </button>
      </header>

      {catalog.error && (
        <div className="category-management-error" role="alert">
          <span>{catalog.error instanceof Error ? catalog.error.message : '分类目录加载失败'}</span>
          <button type="button" onClick={() => void refreshCategoryCatalog()}>重试</button>
        </div>
      )}

      {catalogRefreshWarning && (
        <div className="category-management-refresh-warning" role="status">
          <span>分类目录刷新失败，当前展示可能不是最新。</span>
          <button type="button" disabled={mutationLocked} onClick={() => void retryCatalogRefresh()}>重试刷新</button>
        </div>
      )}

      <div className="category-management-layout">
        <aside className="category-management-list-panel" aria-label="分类列表">
          <label className="category-management-search">
            <SearchOutlined aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索分类" aria-label="搜索分类" />
          </label>

          <div className="category-management-list" role="listbox" aria-label="分类">
            {filteredCategories.map((category) => {
              const active = category.id === selectedId;
              const indexInUsers = userCategories.findIndex((item) => item.id === category.id);
              return (
                <CategoryManagementRow
                  key={category.id}
                  category={category}
                  count={分类计数(catalog.counts, category.id)}
                  selected={active}
                  first={indexInUsers === 0}
                  last={indexInUsers === userCategories.length - 1}
                  locked={mutationLocked}
                  draggedId={draggedId}
                  onSelect={() => {
                    pendingSelectedIdRef.current = null;
                    setSelectedId(category.id);
                  }}
                  onMove={(offset) => moveByKeyboard(category.id, offset)}
                  onDragStart={(categoryId) => setDraggedId(categoryId)}
                  onDragEnd={() => setDraggedId(null)}
                  onDrop={handleDrop}
                />
              );
            })}
            {!catalog.isLoading && filteredCategories.length === 0 && (
              <div className="category-management-list-empty">
                <FolderOpenOutlined aria-hidden="true" />
                <p>{query ? '没有匹配的分类' : '还没有用户分类'}</p>
                {!query && <button type="button" disabled={mutationLocked} onClick={() => setCreateOpen(true)}>创建第一个分类</button>}
              </div>
            )}
          </div>
        </aside>

        <div className="category-management-detail-panel">
          {!selected ? (
            <div className="category-management-detail-empty">选择一个分类查看详情</div>
          ) : selected.isSystem ? (
            <article className="category-management-system-detail">
              <header>
                <span className="category-management-color" style={{ background: selected.color ?? 'var(--text-muted)' }} aria-hidden="true" />
                <div><span>系统分类</span><h2>{selected.name}</h2></div>
              </header>
              <p>{selected.description || '系统会在这里收拢暂时无法明确归类的归档文章。'}</p>
              <dl>
                <div><dt>文章数</dt><dd>{分类计数(catalog.counts, selected.id)} 篇</dd></div>
                <div><dt>规则</dt><dd>固定分类，不可重命名、停用、删除或排序。</dd></div>
              </dl>
            </article>
          ) : (
            <form className="category-management-form" onSubmit={save}>
              <header className="category-management-detail-header">
                <div>
                  <span>{selected.isActive ? '用户分类' : '已停用分类'}</span>
                  <h2>{selected.name}</h2>
                </div>
                <div className="category-management-detail-actions">
                  <button type="button" disabled={mutationLocked} onClick={() => openAction('merge')}><MergeCellsOutlined />合并分类</button>
                  <button type="button" className="is-danger" disabled={mutationLocked} onClick={() => openAction('delete')}><DeleteOutlined />删除分类</button>
                  <button type="button" disabled={mutationLocked} onClick={() => openAction(selected.isActive ? 'deactivate' : 'activate')}>
                    {selected.isActive ? '停用分类' : '启用分类'}
                  </button>
                </div>
              </header>

              <label className="category-form-field">
                <span>分类名称</span>
                <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={40} />
              </label>
              <label className="category-form-field">
                <span>分类说明</span>
                <textarea value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} rows={3} />
                {!draft.description?.trim() && <small>未填写说明时，AI 会更倾向于把不明确文章放入待整理。</small>}
              </label>
              <div className="category-form-rule-grid">
                <label className="category-form-field">
                  <span>适合收录</span>
                  <textarea value={示例转文本(draft.includeExamples)} onChange={(event) => setDraft({ ...draft, includeExamples: 文本转示例(event.target.value) })} rows={4} />
                </label>
                <label className="category-form-field">
                  <span>不适合收录</span>
                  <textarea value={示例转文本(draft.excludeExamples)} onChange={(event) => setDraft({ ...draft, excludeExamples: 文本转示例(event.target.value) })} rows={4} />
                </label>
              </div>
              <div className="category-form-color">
                <div><span>显示颜色</span><small>用于归档导航和文章分类标识。</small></div>
                <div className="category-form-color-controls">
                  <div className="category-form-color-swatches" aria-label="预设颜色">
                    {CATEGORY_COLORS.map((color) => (
                      <button
                        key={color}
                        className={draft.color === color ? 'is-selected' : ''}
                        type="button"
                        onClick={() => setDraft({ ...draft, color })}
                        style={{ '--swatch-color': color } as React.CSSProperties}
                        aria-label={`选择颜色 ${color}`}
                        title={color}
                      >
                        {draft.color === color && <CheckOutlined aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                  <label className="category-form-custom-color" title="自定义颜色">
                    <BgColorsOutlined aria-hidden="true" />
                    <span>调色盘</span>
                    <input type="color" value={draft.color ?? CATEGORY_COLORS[0]} onChange={(event) => setDraft({ ...draft, color: event.target.value })} aria-label="自定义分类颜色" />
                  </label>
                </div>
              </div>

              <footer className="category-management-form-footer">
                <button type="button" className="category-management-optimize" onClick={optimizeDraft} disabled={mutationLocked || !draft.name.trim()}>
                  <RobotOutlined /> {activeMutation === 'optimize' ? '正在生成…' : 'AI 优化分类说明'}
                </button>
                <button type="submit" disabled={mutationLocked || !draft.name.trim()}>{activeMutation === 'save' ? '保存中…' : '保存修改'}</button>
              </footer>
            </form>
          )}
        </div>
      </div>

      {createOpen && (
        <CategoryQuickCreateDialog
          categories={orderedCategories}
          onClose={() => setCreateOpen(false)}
          onCreate={createCategory}
          onCreated={(category, meta) => {
            setCreateOpen(false);
            setQuery('');
            pendingSelectedIdRef.current = category.id;
            setSelectedId(category.id);
            showToast(meta.reusedExisting ? `已定位现有分类「${category.name}」` : `已创建分类「${category.name}」`);
          }}
        />
      )}

      {actionKind && actionSource && (
        <div className="category-form-overlay" role="presentation" onMouseDown={closeAction}>
          <section className="category-action-modal" role="dialog" aria-modal="true" aria-labelledby="category-action-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <span>{actionCopy.title}</span>
              <h2 id="category-action-title">{actionSource.name}</h2>
            </header>
            <p>{actionCopy.description}</p>
            {(actionKind === 'merge' || actionKind === 'delete') && (
              <label>
                目标分类
                <select value={actionTargetId ?? ''} onChange={(event) => setActionTargetId(event.target.value ? Number(event.target.value) : null)} disabled={mutationLocked}>
                  <option value="">请选择目标分类</option>
                  {activeTargets.filter((category) => category.id !== actionSource.id).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
            )}
            <footer>
              <button type="button" onClick={closeAction} disabled={mutationLocked}>取消</button>
              <button type="button" onClick={confirmAction} disabled={mutationLocked || ((actionKind === 'merge' || actionKind === 'delete') && !actionTargetId)}>
                {mutationLocked ? '处理中…' : actionCopy.confirm}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
