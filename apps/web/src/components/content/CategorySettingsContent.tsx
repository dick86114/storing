'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, type ArchiveCategory } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';
import { useToast } from '@/components/ui/Toast';

type CategoryDraft = Pick<ArchiveCategory, 'name' | 'description' | 'includeExamples' | 'excludeExamples' | 'color'>;

const EMPTY_DRAFT: CategoryDraft = { name: '', description: '', includeExamples: [], excludeExamples: [], color: '#4F8A8B' };

function examplesToText(examples: string[]) { return examples.join('\n'); }
function textToExamples(value: string) { return value.split('\n').map((item) => item.trim()).filter(Boolean); }

export function CategorySettingsContent() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { data, mutate, isLoading } = useSWR(isAuthenticated ? 'categories:settings' : null, () => api.getCategories(true), { revalidateOnFocus: false });
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const categories = data?.categories ?? [];
  const activeTargets = categories.filter((category) => category.isActive && !category.isSystem);

  const reset = () => { setDraft(EMPTY_DRAFT); setEditingId(null); };
  const edit = (category: ArchiveCategory) => {
    setEditingId(category.id);
    setDraft({ name: category.name, description: category.description ?? '', includeExamples: category.includeExamples, excludeExamples: category.excludeExamples, color: category.color ?? '#4F8A8B' });
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
      reset();
      showToast(editingId ? '分类已更新' : '分类已创建');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存分类失败');
    } finally { setSaving(false); }
  };
  const deactivate = async (category: ArchiveCategory) => {
    if (!window.confirm(`停用“${category.name}”后，AI 不再选择该分类。`)) return;
    setSaving(true);
    try { await api.updateCategory(category.id, { isActive: false }); await mutate(); showToast('分类已停用'); }
    catch (error) { showToast(error instanceof Error ? error.message : '停用分类失败'); }
    finally { setSaving(false); }
  };
  const merge = async (category: ArchiveCategory) => {
    const candidates = activeTargets.filter((target) => target.id !== category.id);
    const targetId = Number(window.prompt(`将“${category.name}”中的文章迁移到哪个分类？\n${candidates.map((target) => `${target.id}: ${target.name}`).join('\n')}`));
    if (!targetId) return;
    setSaving(true);
    try { await api.mergeCategories(category.id, targetId); await mutate(); showToast('分类已合并'); }
    catch (error) { showToast(error instanceof Error ? error.message : '合并分类失败'); }
    finally { setSaving(false); }
  };
  const move = async (category: ArchiveCategory, offset: -1 | 1) => {
    const index = categories.findIndex((item) => item.id === category.id);
    const targetIndex = index + offset;
    if (index < 0 || targetIndex < 0 || targetIndex >= categories.length) return;
    const categoryIds = categories.map((item) => item.id);
    [categoryIds[index], categoryIds[targetIndex]] = [categoryIds[targetIndex], categoryIds[index]];
    setSaving(true);
    try { await api.reorderCategories(categoryIds); await mutate(); }
    catch (error) { showToast(error instanceof Error ? error.message : '调整排序失败'); }
    finally { setSaving(false); }
  };

  if (!isAuthenticated) return null;
  return <section className="category-settings-shell">
    <header className="category-settings-header"><div><h1>分类管理</h1><p>分类决定归档文章的长期归属，AI 只会从这里选择。</p></div></header>
    <div className="category-settings-layout">
      <form className="category-editor" onSubmit={save}>
        <h2>{editingId ? '编辑分类' : '新建分类'}</h2>
        <label><span>名称</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={40} /></label>
        <label><span>说明</span><textarea value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} maxLength={500} /></label>
        <label><span>适合收录的内容</span><textarea value={examplesToText(draft.includeExamples)} onChange={(event) => setDraft({ ...draft, includeExamples: textToExamples(event.target.value) })} rows={3} /></label>
        <label><span>不适合收录的内容</span><textarea value={examplesToText(draft.excludeExamples)} onChange={(event) => setDraft({ ...draft, excludeExamples: textToExamples(event.target.value) })} rows={3} /></label>
        <label><span>显示颜色</span><input type="color" value={draft.color ?? '#4F8A8B'} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label>
        <div className="category-editor-actions"><button type="submit" disabled={saving}>{saving ? '保存中…' : '保存'}</button>{editingId && <button type="button" onClick={reset}>取消</button>}</div>
      </form>
      <div className="category-settings-list" aria-busy={isLoading}>
        {categories.map((category) => <article key={category.id} className={`category-settings-item${category.isActive ? '' : ' is-inactive'}`}>
          <div className="category-settings-item-main"><span className="category-settings-swatch" style={{ background: category.color ?? 'var(--text-muted)' }} /><div><h2>{category.name}{category.isSystem && <small>系统</small>}</h2><p>{category.description || '未填写分类说明'}</p><span>{data?.counts[String(category.id)] ?? 0} 篇归档文章</span></div></div>
          <div className="category-settings-item-actions"><button type="button" onClick={() => move(category, -1)} disabled={saving || categories[0]?.id === category.id} aria-label={`上移 ${category.name}`}>上移</button><button type="button" onClick={() => move(category, 1)} disabled={saving || categories[categories.length - 1]?.id === category.id} aria-label={`下移 ${category.name}`}>下移</button>{!category.isSystem && <><button type="button" onClick={() => edit(category)}>编辑</button>{category.isActive && <button type="button" onClick={() => deactivate(category)} disabled={saving}>停用</button>}<button type="button" onClick={() => merge(category)} disabled={saving || activeTargets.length < 2}>合并</button></>}</div>
        </article>)}
      </div>
    </div>
  </section>;
}
