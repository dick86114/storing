import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isCollectablePage } from '../lib/config';
import type { ExtensionState } from '../lib/messages';
import { sendExtensionMessage } from '../lib/runtime';
import '../ui.css';
import './popup.css';

type TabPreview = { url?: string; title?: string; favIconUrl?: string };

type PopupStatus =
  | { kind: 'loading'; message: string }
  | { kind: 'ready' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

function Brand() {
  return <div className="brand"><img src="/icons/logo-48.png" alt="乾坤戒" /><span>乾坤戒</span></div>;
}

function App() {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [tab, setTab] = useState<TabPreview | null>(null);
  const [status, setStatus] = useState<PopupStatus>({ kind: 'loading', message: '正在读取当前网页…' });

  useEffect(() => {
    void (async () => {
      const [message, tabs] = await Promise.all([
        sendExtensionMessage({ type: 'get-state' }),
        chrome.tabs.query({ active: true, lastFocusedWindow: true }),
      ]);
      if (!message.ok) {
        setStatus({ kind: 'error', message: message.error.message });
        return;
      }
      setState(message.state ?? null);
      const current = tabs[0];
      setTab(current ? { url: current.url, title: current.title, favIconUrl: current.favIconUrl } : null);
      setStatus({ kind: 'ready' });
    })().catch((error: unknown) => {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : '无法读取当前网页' });
    });
  }, []);

  const connected = Boolean(state?.session && state?.settings);
  const collectable = isCollectablePage(tab?.url);

  async function collect() {
    if (!tab?.url) return;
    setStatus({ kind: 'loading', message: '正在加入采集队列…' });
    const result = await sendExtensionMessage({ type: 'collect', url: tab.url });
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error.message });
      return;
    }
    setStatus({ kind: 'success', message: '已加入采集队列，稍后会自动保存到收件箱。' });
  }

  return <main className="popup-shell">
    <header className="popup-header">
      <Brand />
      <button className="settings-link" type="button" onClick={() => void chrome.runtime.openOptionsPage()} aria-label="打开设置">设置</button>
    </header>

    {!connected && status.kind !== 'loading' ? <section className="connection-card card">
      <strong>尚未连接服务器</strong>
      <p className="muted">先配置乾坤戒服务器并登录，之后即可一键采集当前网页。</p>
      <button className="primary" type="button" onClick={() => void chrome.runtime.openOptionsPage()}>前往设置</button>
    </section> : <>
      <section className="page-card card">
        {tab?.favIconUrl ? <img className="favicon" src={tab.favIconUrl} alt="" /> : <div className="favicon-placeholder">⌘</div>}
        <div className="page-copy">
          <div className="page-domain">{tab?.url ? new URL(tab.url).hostname : '当前标签页'}</div>
          <div className="page-title">{tab?.title || '未命名网页'}</div>
          <div className="page-url">{tab?.url || '正在读取链接…'}</div>
        </div>
      </section>

      <section className="destination"><span>保存位置</span><strong>收件箱</strong></section>

      {status.kind === 'loading' && <p className="muted status-line">{status.message}</p>}
      {status.kind === 'error' && <p className="error status-line">{status.message}</p>}
      {status.kind === 'success' && <p className="success status-line">{status.message}</p>}

      {status.kind !== 'success' && <button className="primary collect-button" type="button" disabled={!collectable || status.kind === 'loading'} onClick={() => void collect()}>
        {collectable ? '采集到收件箱' : '当前页面无法采集'}
      </button>}
      {!collectable && status.kind !== 'loading' && <p className="muted">仅支持普通 HTTP 或 HTTPS 网页。</p>}
      {status.kind === 'success' && <button className="secondary collect-button" type="button" onClick={() => void sendExtensionMessage({ type: 'open-inbox' })}>打开收件箱</button>}
    </>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
