'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BgColorsOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { api, type ArchiveCategory } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';
import { useToast } from '@/components/ui/Toast';

type CategoryDraft = Pick<ArchiveCategory, 'name' | 'description' | 'includeExamples' | 'excludeExamples' | 'color'>;

const CATEGORY_COLORS = [
  '#2F6A4F', '#3E7C83', '#536CCB', '#8A5A9E', '#B36A45', '#A67C38',
  '#647B4D', '#2F7780', '#6675B7', '#A16078', '#9B7250', '#6B7088',
];
const EMPTY_DRAFT: CategoryDraft = { name: '', description: '', includeExamples: [], excludeExamples: [], color: CATEGORY_COLORS[0] };

function examplesToText(examples: string[]) { return examples.join('\n'); }
function textToExamples(value: string) { return value.split('\n').map((item) => item.trim()).filter(Boolean); }

function CategoryIconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className="category-card-icon-button" type="button" aria-label={label} title={label} {...props}>{children}</button>;
}

export function CategorySettingsContent() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { data, mutate, isLoading } = useSWR(isAuthenticated ? 'categories:settings' : null, () => api.getCategories(true), { revalidateOnFocus: false });
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [actionCategory, setActionCategory] = useState<ArchiveCategory | null>(null);
  const [actionKind, setActionKind] = useState<'activate' | 'deactivate' | 'delete' | null>(null);
  const [actionTargetId, setActionTargetId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const categories = data?.categories ?? [];
  const activeTargets = categories.filter((category) => category.isActive && !category.isSystem);

  const closeForm = (force = false) => {
    if (!force && (saving || optimizing)) return;
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setFormOpen(false);
  };

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (category: ArchiveCategory) => {
    setEditingId(category.id);
    setDraft({
      name: category.name,
      description: category.description ?? '',
      includeExamples: category.includeExamples,
      excludeExamples: category.excludeExamples,
      color: category.color ?? CATEGORY_COLORS[0],
    });
    setFormOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return showToast('请输入分类名称');
    setSaving(true);
    try {
      const payload = { ...draft, name: draft.name.trim(), description: draft.description?.trim() || null };
      if (editingId) await api.updateCategory(editingId, payload);
      else await api.createCategory(payload);
      await mutate();
      closeForm(true);
      showToast(editingId ? '分类已更新' : '分类已创建');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存分类失败');
    } finally {
      setSaving(false);
    }
  };

  const optimizeDraft = async () => {
    if (!draft.name.trim()) return showToast('请先填写分类名称');
    setOptimizing(true);
    try {
      const { draft: optimized } = await api.optimizeCategoryDescription({
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        includeExamples: draft.includeExamples,
        excludeExamples: draft.excludeExamples,
      });
      setDraft((current) => ({
        ...current,
        description: optimized.description || current.description,
        includeExamples: optimized.includeExamples?.length ? optimized.includeExamples : current.includeExamples,
        excludeExamples: optimized.excludeExamples?.length ? optimized.excludeExamples : current.excludeExamples,
      }));
      showToast('已生成分类规则草案，请按需调整');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'AI 优化失败，请稍后重试');
    } finally {
      setOptimizing(false);
    }
  };

  const openDeactivate = (category: ArchiveCategory) => {
    setActionCategory(category);
    setActionKind('deactivate');
    setActionTargetId(null);
  };

  const openActivate = (category: ArchiveCategory) => {
    setActionCategory(category);
    setActionKind('activate');
    setActionTargetId(null);
  };

  const openDelete = (category: ArchiveCategory) => {
    const firstTarget = activeTargets.find((target) => target.id !== category.id) ?? null;
    setActionCategory(category);
    setActionKind('delete');
    setActionTargetId(firstTarget?.id ?? null);
  };

  const closeAction = (force = false) => {
    if (!force && saving) return;
    setActionCategory(null);
    setActionKind(null);
    setActionTargetId(null);
  };

  const confirmDeactivate = async () => {
    if (!actionCategory) return;
    setSaving(true);
    try {
      await api.updateCategory(actionCategory.id, { isActive: false });
      await mutate();
      closeAction(true);
      showToast('分类已停用');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '停用分类失败');
    } finally {
      setSaving(false);
    }
  };

  const confirmActivate = async () => {
    if (!actionCategory) return;
    setSaving(true);
    try {
      await api.updateCategory(actionCategory.id, { isActive: true });
      await mutate();
      closeAction(true);
      showToast('分类已重新启用');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '重新启用分类失败');
    } finally {
      setSaving(false);
    }
  };

  const move = async (category: ArchiveCategory, offset: -1 | 1) => {
    const index = categories.findIndex((item) => item.id === category.id);
    const targetIndex = index + offset;
    if (index < 0 || targetIndex < 0 || targetIndex >= categories.length) return;
    const categoryIds = categories.map((item) => item.id);
    [categoryIds[index], categoryIds[targetIndex]] = [categoryIds[targetIndex], categoryIds[index]];
    setSaving(true);
    try {
      await api.reorderCategories(categoryIds);
      await mutate();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '调整排序失败');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!actionCategory || !actionTargetId) return;
    setSaving(true);
    try {
      const result = await api.deleteCategory(actionCategory.id, actionTargetId);
      await mutate();
      closeAction(true);
      showToast(`分类已删除，已迁移 ${result.movedArticleCount} 篇文章`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除分类失败');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;

  return <section className="category-settings-shell">
    <header className="category-settings-header">
      <div>
        <span className="category-settings-eyebrow">归档组织</span>
        <h1>分类管理</h1>
        <p>分类决定归档文章的长期归属，AI 只会从这里选择，不会自行创建分类。</p>
      </div>
      <button className="category-settings-create-button" type="button" onClick={openCreate}>
        <PlusOutlined aria-hidden="true" />
        新增分类
      </button>
    </header>

    <div className="category-settings-guide" role="note">
      <RobotOutlined aria-hidden="true" />
      <p><strong>收录边界怎么写？</strong>“适合收录”填写该分类典型文章主题或场景；“不适合收录”填写容易混淆、但应归入其他分类的内容。每行一个例子，越具体越有助于 AI 判断。</p>
    </div>

    <div className="category-workbench-grid" aria-busy={isLoading}>
      {categories.map((category, index) => {
        const articleCount = data?.counts[String(category.id)] ?? 0;
        const canDelete = activeTargets.some((target) => target.id !== category.id);
        return <article key={category.id} className={`category-workbench-card${category.isActive ? '' : ' is-inactive'}${category.isSystem ? ' is-system' : ''}`}>
          <div className="category-workbench-card-accent" style={{ background: category.color ?? 'var(--text-muted)' }} aria-hidden="true" />
          <div className="category-workbench-card-topline">
            <span className="category-workbench-card-order">{String(index + 1).padStart(2, '0')}</span>
            <div className="category-workbench-card-actions">
              {index > 0 && <CategoryIconButton label={`上移 ${category.name}`} onClick={() => move(category, -1)} disabled={saving}><ArrowUpOutlined /></CategoryIconButton>}
              {index < categories.length - 1 && <CategoryIconButton label={`下移 ${category.name}`} onClick={() => move(category, 1)} disabled={saving}><ArrowDownOutlined /></CategoryIconButton>}
              {!category.isSystem && <>
                <CategoryIconButton label={`编辑 ${category.name}`} onClick={() => openEdit(category)} disabled={saving}><EditOutlined /></CategoryIconButton>
                {category.isActive && <CategoryIconButton label={`停用 ${category.name}`} onClick={() => openDeactivate(category)} disabled={saving}><PauseCircleOutlined /></CategoryIconButton>}
                {!category.isActive && <CategoryIconButton label={`重新启用 ${category.name}`} onClick={() => openActivate(category)} disabled={saving}><PlayCircleOutlined /></CategoryIconButton>}
                <CategoryIconButton label={`删除 ${category.name}`} onClick={() => openDelete(category)} disabled={saving || !canDelete}><DeleteOutlined /></CategoryIconButton>
              </>}
            </div>
          </div>
          <div className="category-workbench-card-heading">
            <span className="category-workbench-card-color" style={{ background: category.color ?? 'var(--text-muted)' }} aria-hidden="true" />
            <h2>{category.name}</h2>
            {category.isSystem && <span className="category-workbench-card-badge">系统</span>}
            {!category.isActive && <span className="category-workbench-card-badge is-paused">已停用</span>}
          </div>
          <p className="category-workbench-card-description">{category.description || '尚未设置分类说明，AI 会优先将不明确的文章归入待整理。'}</p>
          <div className="category-workbench-card-rules">
            <div><span>适合</span><p>{category.includeExamples.length ? category.includeExamples.slice(0, 2).join('、') : '尚未定义'}</p></div>
            <div><span>排除</span><p>{category.excludeExamples.length ? category.excludeExamples.slice(0, 2).join('、') : '尚未定义'}</p></div>
          </div>
          <footer className="category-workbench-card-footer">
            <span><FolderOpenOutlined aria-hidden="true" />{articleCount} 篇归档文章</span>
            {category.isSystem && <span>不可停用</span>}
          </footer>
        </article>;
      })}
      {!isLoading && categories.length === 0 && <div className="category-workbench-empty"><FolderOpenOutlined aria-hidden="true" /><p>还没有分类，先建立一个让 AI 可以遵循的归档边界。</p><button type="button" onClick={openCreate}>新增分类</button></div>}
    </div>

    {formOpen && <div className="category-form-overlay" role="presentation" onMouseDown={() => closeForm()}>
      <form className="category-form-modal" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="category-form-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="category-form-header">
          <div><span>{editingId ? '调整规则' : '建立归档边界'}</span><h2 id="category-form-title">{editingId ? '编辑分类' : '新增分类'}</h2></div>
          <button type="button" className="category-form-close" onClick={() => closeForm()} disabled={saving || optimizing} aria-label="关闭分类表单"><CloseOutlined /></button>
        </header>
        <label className="category-form-field"><span>分类名称</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：编程开发" maxLength={40} autoFocus /></label>
        <div className="category-form-field category-form-field--description">
          <div className="category-form-field-label"><span>分类说明</span><button type="button" onClick={optimizeDraft} disabled={optimizing || saving}><RobotOutlined aria-hidden="true" />{optimizing ? '正在优化…' : 'AI 优化'}</button></div>
          <textarea value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="用一句话说明这个分类的长期归属边界。" rows={3} maxLength={500} />
        </div>
        <div className="category-form-rule-grid">
          <label className="category-form-field"><span>适合收录</span><small>写典型主题、文章类型或问题场景，每行一个。</small><textarea value={examplesToText(draft.includeExamples)} onChange={(event) => setDraft({ ...draft, includeExamples: textToExamples(event.target.value) })} placeholder={'Docker 部署与运维\n容器网络与镜像\nKubernetes 实践'} rows={4} /></label>
          <label className="category-form-field"><span>不适合收录</span><small>写容易混淆但应归到其他分类的内容，每行一个。</small><textarea value={examplesToText(draft.excludeExamples)} onChange={(event) => setDraft({ ...draft, excludeExamples: textToExamples(event.target.value) })} placeholder={'纯产品新闻\n非技术效率工具\n个人生活随笔'} rows={4} /></label>
        </div>
        <div className="category-form-color">
          <div><span>显示颜色</span><small>用于归档导航和文章分类标识。</small></div>
          <div className="category-form-color-controls">
            <div className="category-form-color-swatches" aria-label="预设颜色">
              {CATEGORY_COLORS.map((color) => <button key={color} className={draft.color === color ? 'is-selected' : ''} type="button" onClick={() => setDraft({ ...draft, color })} style={{ '--swatch-color': color } as React.CSSProperties} aria-label={`选择颜色 ${color}`} title={color}>{draft.color === color && <CheckOutlined aria-hidden="true" />}</button>)}
            </div>
            <label className="category-form-custom-color" title="自定义颜色">
              <BgColorsOutlined aria-hidden="true" />
              <span>调色盘</span>
              <input type="color" value={draft.color ?? CATEGORY_COLORS[0]} onChange={(event) => setDraft({ ...draft, color: event.target.value })} aria-label="自定义分类颜色" />
            </label>
          </div>
        </div>
        <footer className="category-form-footer"><button type="button" onClick={() => closeForm()} disabled={saving || optimizing}>取消</button><button className="category-form-save" type="submit" disabled={saving || optimizing}>{saving ? '保存中…' : editingId ? '保存修改' : '创建分类'}</button></footer>
      </form>
    </div>}

    {actionCategory && actionKind && <div className="category-form-overlay" role="presentation" onMouseDown={() => closeAction()}>
      <section className={`category-action-modal category-action-modal--${actionKind}`} role="dialog" aria-modal="true" aria-labelledby="category-action-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          {actionKind === 'delete' ? <DeleteOutlined aria-hidden="true" /> : actionKind === 'activate' ? <PlayCircleOutlined aria-hidden="true" /> : <PauseCircleOutlined aria-hidden="true" />}
          <div><span>{actionKind === 'delete' ? '不可撤销' : actionKind === 'activate' ? '恢复 AI 自动归类' : '可随时重新启用'}</span><h2 id="category-action-title">{actionKind === 'delete' ? `删除“${actionCategory.name}”` : actionKind === 'activate' ? `重新启用“${actionCategory.name}”` : `停用“${actionCategory.name}”`}</h2></div>
        </header>
        {actionKind === 'delete' ? <>
          <p>删除前，请选择一个分类接收现有归档文章。迁移完成后，这个分类会从分类管理中移除。</p>
          <label>文章迁移到<select value={actionTargetId ?? ''} onChange={(event) => setActionTargetId(event.target.value ? Number(event.target.value) : null)} disabled={saving}><option value="">请选择目标分类</option>{activeTargets.filter((target) => target.id !== actionCategory.id).map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
          <footer><button type="button" onClick={() => closeAction()} disabled={saving}>取消</button><button type="button" onClick={confirmDelete} disabled={!actionTargetId || saving}>{saving ? '正在删除…' : '迁移并删除'}</button></footer>
        </> : actionKind === 'activate' ? <>
          <p>重新启用后，AI 会再次将符合规则的新归档文章分到这个分类；已有文章保持原样。</p>
          <footer><button type="button" onClick={() => closeAction()} disabled={saving}>取消</button><button type="button" onClick={confirmActivate} disabled={saving}>{saving ? '正在启用…' : '确认启用'}</button></footer>
        </> : <>
          <p>停用后，AI 不会再将新归档文章分到这个分类；已有文章保持原分类不变。需要时可在编辑分类中重新启用。</p>
          <footer><button type="button" onClick={() => closeAction()} disabled={saving}>取消</button><button type="button" onClick={confirmDeactivate} disabled={saving}>{saving ? '正在停用…' : '确认停用'}</button></footer>
        </>}
      </section>
    </div>}
  </section>;
}
