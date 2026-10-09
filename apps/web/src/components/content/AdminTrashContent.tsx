'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DeleteOutlined, ExclamationCircleOutlined, InboxOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import {
  api,
  type AdminTrashBulkResult,
  type AdminTrashItem,
  type AdminTrashOrphanItem,
} from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';

function deletedAtText(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}

export function AdminTrashContent() {
  const { isAuthenticated, user } = useAuth();
  const [items, setItems] = useState<AdminTrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isBulkPurging, setIsBulkPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<{ article_id: number; title: string | null } | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminTrashItem | null>(null);
  const [orphans, setOrphans] = useState<AdminTrashOrphanItem[]>([]);
  const [section, setSection] = useState<'deleted' | 'orphans'>('deleted');
  const [detailOrphan, setDetailOrphan] = useState<AdminTrashOrphanItem | null>(null);
  const [bulkPurgeSection, setBulkPurgeSection] = useState<'deleted' | 'orphans' | null>(null);
  const [bulkPurgeResult, setBulkPurgeResult] = useState<AdminTrashBulkResult | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.getAdminTrash();
      setItems(res.items);
      const orphansRes = await api.getAdminTrashOrphans();
      setOrphans(orphansRes.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载回收站失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') void refresh();
  }, [isAuthenticated, user?.role, refresh]);

  const restore = useCallback(async (item: AdminTrashItem) => {
    setBusyId(item.article_id);
    setError(null);
    try {
      await api.restoreAdminTrashArticle(item.article_id);
      setItems((prev) => prev.filter((entry) => entry.article_id !== item.article_id));
      setNotice(`「${item.title ?? '未命名文章'}」已恢复到原用户的资料库。`);
      void refresh();
    } catch (e) {
      if (e instanceof Error && e.message.includes('不存在')) {
        setItems((prev) => prev.filter((entry) => entry.article_id !== item.article_id));
        setNotice(`「${item.title ?? '未命名文章'}」已在资料库中。`);
        void refresh();
      } else {
        setError(e instanceof Error ? e.message : '恢复失败');
      }
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const adoptOrphan = useCallback(async (articleId: number) => {
    setBusyId(articleId);
    setError(null);
    try {
      await api.adoptAdminTrashOrphan(articleId);
      setOrphans((prev) => prev.filter((entry) => entry.article_id !== articleId));
      setNotice('孤儿文章已领养到你的资料库。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '领养失败');
    } finally {
      setBusyId(null);
    }
  }, []);

  const purge = useCallback(async (item: { article_id: number; title: string | null }) => {
    setBusyId(item.article_id);
    setError(null);
    try {
      await api.purgeAdminTrashArticle(item.article_id);
      setItems((prev) => prev.filter((entry) => entry.article_id !== item.article_id));
      setNotice(`「${item.title ?? '未命名文章'}」已从服务器彻底删除。`);
      void refresh();
    } catch (e) {
      if (e instanceof Error && e.message.includes('不存在')) {
        setItems((prev) => prev.filter((entry) => entry.article_id !== item.article_id));
        setNotice(`「${item.title ?? '未命名文章'}」已从服务器删除。`);
        void refresh();
      } else {
        setError(e instanceof Error ? e.message : '彻底删除失败');
      }
    } finally {
      setBusyId(null);
      setPurgeTarget(null);
    }
  }, [refresh]);

  const bulkPurge = useCallback(async (target: 'deleted' | 'orphans') => {
    setIsBulkPurging(true);
    setError(null);
    try {
      const result = target === 'deleted'
        ? await api.purgeAdminTrash()
        : await api.purgeAdminTrashOrphans();
      setBulkPurgeResult(result);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '清空失败');
    } finally {
      setIsBulkPurging(false);
      setBulkPurgeSection(null);
    }
  }, [refresh]);

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="admin-library-shell">
        <div className="mcp-empty-state">
          <UserOutlined />
          <h2>需要管理员权限</h2>
          <p>回收站只对管理员开放，用于查看、恢复和彻底删除被用户删除的文章。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-library-shell">
      <header className="admin-library-header">
        <div>
          <p className="mcp-kicker">系统管理 / 内容治理</p>
          <h1>回收站</h1>
          <p>用户删除的文章会集中在这里：可以恢复回原用户的资料库，也可以从服务器彻底清除。</p>
        </div>
        <div className="mcp-header-actions">
          <Link href="/admin/users" className="mcp-btn mcp-btn-quiet"><UserOutlined /> 用户管理</Link>
          <button type="button" className="mcp-btn mcp-btn-quiet" onClick={refresh}><ReloadOutlined /> 刷新</button>
          {section === 'deleted' ? (
            <button
              type="button"
              className="mcp-btn mcp-btn-danger"
              disabled={isLoading || isBulkPurging || items.length === 0}
              onClick={() => setBulkPurgeSection('deleted')}
            >
              <DeleteOutlined /> {isBulkPurging ? '清空中…' : '清空已删除'}
            </button>
          ) : (
            <button
              type="button"
              className="mcp-btn mcp-btn-danger"
              disabled={isLoading || isBulkPurging || orphans.length === 0}
              onClick={() => setBulkPurgeSection('orphans')}
            >
              <DeleteOutlined /> {isBulkPurging ? '清空中…' : '清空孤儿文章'}
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button type="button" className="mcp-btn" style={{ opacity: section === 'deleted' ? 1 : 0.55 }} onClick={() => setSection('deleted')}>
          已删除（{items.length}）
        </button>
        <button type="button" className="mcp-btn" style={{ opacity: section === 'orphans' ? 1 : 0.55 }} onClick={() => setSection('orphans')}>
          孤儿文章（{orphans.length}）
        </button>
      </div>

      {error && <div className="mcp-inline-alert is-error">{error}</div>}
      {notice && <div className="mcp-inline-alert is-ok">{notice}</div>}
      {isLoading ? (
        <div className="admin-library-loading">正在打开回收站…</div>
      ) : section === 'orphans' ? (
        orphans.length === 0 ? (
          <div className="mcp-empty-state">
            <InboxOutlined />
            <h2>没有孤儿文章</h2>
            <p>导入时元数据写入失败的文章会出现在这里，可以领养到你的资料库或彻底删除。</p>
          </div>
        ) : (
          <div className="admin-trash-list">
            {orphans.map((item) => (
              <article key={item.article_id} className="admin-trash-card">
                <div className="admin-trash-card-main">
                  <p className="admin-trash-title">{item.title ?? '未命名文章'}</p>
                  <p className="admin-trash-meta">
                    <span>{item.source ?? '乾坤戒'}</span>
                    <span>创建于 {deletedAtText(item.created_at)}</span>
                  </p>
                </div>
                <div className="admin-trash-card-actions">
                  <button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setDetailOrphan(item)}>
                    <InboxOutlined /> 详情
                  </button>
                  <button type="button" className="mcp-btn mcp-btn-quiet" disabled={busyId === item.article_id} onClick={() => adoptOrphan(item.article_id)}>
                    <UserOutlined /> 领养
                  </button>
                  <button type="button" className="mcp-btn mcp-btn-danger" disabled={busyId === item.article_id} onClick={() => setPurgeTarget(item)}>
                    <DeleteOutlined /> 彻底删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        <div className="mcp-empty-state">
          <InboxOutlined />
          <h2>回收站是空的</h2>
          <p>用户删除的文章会进入这里，可以恢复或彻底删除。</p>
        </div>
      ) : (
        <div className="admin-trash-list">
          {items.map((item) => (
            <article key={`${item.article_id}-${item.user_id}`} className="admin-trash-card">
              <div className="admin-trash-card-main">
                <p className="admin-trash-title">{item.title ?? '未命名文章'}</p>
                <p className="admin-trash-meta">
                  <span>{item.source ?? '乾坤戒'}</span>
                  <span>用户：{item.username ?? `#${item.user_id}`}</span>
                  <span>删除于 {deletedAtText(item.deleted_at)}</span>
                </p>
              </div>
              <div className="admin-trash-card-actions">
                <button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setDetailTarget(item)}>
                  <InboxOutlined /> 详情
                </button>
                <button type="button" className="mcp-btn mcp-btn-quiet" disabled={busyId === item.article_id} onClick={() => restore(item)}>
                  <ReloadOutlined /> 恢复
                </button>
                <button type="button" className="mcp-btn mcp-btn-danger" disabled={busyId === item.article_id} onClick={() => setPurgeTarget(item)}>
                  <DeleteOutlined /> 彻底删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {purgeTarget && (
        <div className="mcp-modal-overlay" role="presentation">
          <div className="mcp-modal-panel" role="dialog" aria-modal="true">
            <div className="mcp-panel-heading">
              <ExclamationCircleOutlined style={{ fontSize: 26, color: '#d48806' }} />
              <div>
                <h2>彻底删除「{purgeTarget.title ?? '未命名文章'}」？</h2>
                <p className="mcp-muted">正文、媒体引用和所有用户的记录都会从服务器清除，此操作无法恢复。</p>
              </div>
            </div>
            <div className="mcp-form-actions">
              <button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setPurgeTarget(null)}>取消</button>
              <button type="button" className="mcp-btn mcp-btn-danger" disabled={busyId === purgeTarget.article_id} onClick={() => purge(purgeTarget)}>
                <DeleteOutlined /> {busyId === purgeTarget.article_id ? '删除中…' : '确认彻底删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkPurgeSection && (
        <div className="mcp-modal-overlay" role="presentation">
          <div className="mcp-modal-panel" role="dialog" aria-modal="true">
            <div className="mcp-panel-heading">
              <ExclamationCircleOutlined style={{ fontSize: 26, color: '#d48806' }} />
              <div>
                <h2>{bulkPurgeSection === 'deleted' ? '确认清空已删除文章' : '确认清空孤儿文章'}</h2>
                <p className="mcp-muted">
                  {bulkPurgeSection === 'deleted'
                    ? `将处理 ${items.length} 条已删除记录。仍被其他用户保留的文章只清除删除记录；没有任何保留者的文章会物理删除全局内容。`
                    : `将处理 ${orphans.length} 篇孤儿文章。这些文章没有任何用户记录，原始内容会从服务器物理删除。`}
                </p>
                <p className="mcp-muted">操作无法恢复，完成后会展示成功、失败和失败原因。</p>
              </div>
            </div>
            <div className="mcp-form-actions">
              <button type="button" className="mcp-btn mcp-btn-quiet" disabled={isBulkPurging} onClick={() => setBulkPurgeSection(null)}>取消</button>
              <button
                type="button"
                className="mcp-btn mcp-btn-danger"
                disabled={isBulkPurging}
                onClick={() => void bulkPurge(bulkPurgeSection)}
              >
                <DeleteOutlined /> {isBulkPurging ? '清空中…' : '确认清空'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkPurgeResult && (
        <div className="mcp-modal-overlay" role="presentation">
          <div className="mcp-modal-panel" role="dialog" aria-modal="true">
            <div className="mcp-panel-heading">
              <ExclamationCircleOutlined style={{ fontSize: 26, color: bulkPurgeResult.failed > 0 ? '#d48806' : '#52c41a' }} />
              <div>
                <h2>清空结果</h2>
                <p className="mcp-muted">
                  成功清理 {bulkPurgeResult.succeeded} 项，失败 {bulkPurgeResult.failed} 项；
                  物理删除全局文章 {bulkPurgeResult.deleted_articles} 篇。
                </p>
              </div>
            </div>
            {bulkPurgeResult.failures.length > 0 && (
              <div className="admin-trash-result-list">
                {bulkPurgeResult.failures.map((failure) => (
                  <p key={`${failure.article_id}-${failure.user_id ?? 'orphan'}`}>
                    {failure.title ?? `#${failure.article_id}`}
                    {failure.user_id ? `（用户 #${failure.user_id}）` : ''}：{failure.reason}
                  </p>
                ))}
              </div>
            )}
            <div className="mcp-form-actions">
              <button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setBulkPurgeResult(null)}>知道了</button>
            </div>
          </div>
        </div>
      )}

      {detailTarget && (
        <div className="mcp-modal-overlay" role="presentation" onClick={() => setDetailTarget(null)}>
          <div className="mcp-modal-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="mcp-kicker">回收站详情</p>
              <h2 style={{ margin: '4px 0 8px' }}>{detailTarget.title ?? '未命名文章'}</h2>
              <p className="mcp-muted">
                {[detailTarget.source ?? '乾坤戒', detailTarget.author, `用户：${detailTarget.username ?? `#${detailTarget.user_id}`}`, `删除于 ${deletedAtText(detailTarget.deleted_at)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {detailTarget.ai_summary && (
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 600 }}>AI 摘要</p>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detailTarget.ai_summary}</p>
              </div>
            )}
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>正文预览</p>
              <pre style={{ margin: 0, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>
                {detailTarget.content_preview?.trim() || '（无正文）'}
              </pre>
            </div>
            <div className="mcp-form-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setDetailTarget(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {detailOrphan && (
        <div className="mcp-modal-overlay" role="presentation" onClick={() => setDetailOrphan(null)}>
          <div className="mcp-modal-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="mcp-kicker">孤儿文章详情</p>
              <h2 style={{ margin: '4px 0 8px' }}>{detailOrphan.title ?? '未命名文章'}</h2>
              <p className="mcp-muted">
                {[detailOrphan.source ?? '乾坤戒', detailOrphan.author, `创建于 ${deletedAtText(detailOrphan.created_at)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>正文预览</p>
              <pre style={{ margin: 0, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>
                {detailOrphan.content_preview?.trim() || '（无正文）'}
              </pre>
            </div>
            <div className="mcp-form-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setDetailOrphan(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
