'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DeleteOutlined, ExclamationCircleOutlined, InboxOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { api, type AdminTrashItem } from '@/lib/api';
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<AdminTrashItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminTrashItem | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.getAdminTrash();
      setItems(res.items);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : '恢复失败');
    } finally {
      setBusyId(null);
    }
  }, []);

  const purge = useCallback(async (item: AdminTrashItem) => {
    setBusyId(item.article_id);
    setError(null);
    try {
      await api.purgeAdminTrashArticle(item.article_id);
      setItems((prev) => prev.filter((entry) => entry.article_id !== item.article_id));
      setNotice(`「${item.title ?? '未命名文章'}」已从服务器彻底删除。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '彻底删除失败');
    } finally {
      setBusyId(null);
      setPurgeTarget(null);
    }
  }, []);

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
        </div>
      </header>

      {error && <div className="mcp-inline-alert is-error">{error}</div>}
      {notice && <div className="mcp-inline-alert is-ok">{notice}</div>}
      {isLoading ? (
        <div className="admin-library-loading">正在打开回收站…</div>
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
    </div>
  );
}
