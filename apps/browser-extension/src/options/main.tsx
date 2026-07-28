import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { requiresInsecureHttpConfirmation, resolveApiBase } from '../lib/config';
import type { ExtensionState } from '../lib/messages';
import { removeServerPermission, requestServerPermission } from '../lib/permissions';
import { sendExtensionMessage } from '../lib/runtime';
import { getOrCreateExtensionDevice } from '../lib/storage';
import '../ui.css';
import './options.css';

type Message = { kind: 'idle' | 'error' | 'success'; text: string };

function Brand() {
  return <div className="brand"><img src="/icons/logo-48.png" alt="乾坤戒" /><span>乾坤戒浏览器采集</span></div>;
}

function App() {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [apiOverride, setApiOverride] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmedHttp, setConfirmedHttp] = useState(false);
  const [tested, setTested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>({ kind: 'idle', text: '' });

  useEffect(() => {
    void sendExtensionMessage({ type: 'get-state' }).then((result) => {
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.error.message });
        return;
      }
      const next = result.state ?? null;
      setState(next);
      setServerUrl(next?.settings?.serverUrl ?? '');
      setApiOverride(next?.settings?.apiOverride ?? '');
    });
  }, []);

  const apiBase = useMemo(() => {
    try { return resolveApiBase(serverUrl, apiOverride); } catch { return ''; }
  }, [serverUrl, apiOverride]);
  const connected = Boolean(state?.session && state?.settings);
  const needsHttpWarning = apiBase ? requiresInsecureHttpConfirmation(apiBase) : false;

  async function testConnection() {
    try {
      if (!apiBase) throw new Error('请输入有效的乾坤戒网页地址');
      if (needsHttpWarning && !confirmedHttp) throw new Error('请确认非本机 HTTP 连接的明文传输风险');
      setBusy(true);
      setMessage({ kind: 'idle', text: '' });
      const granted = await requestServerPermission(apiBase);
      if (!granted) throw new Error('需要授权访问此服务器后才能连接');
      const result = await sendExtensionMessage({ type: 'test-connection', apiBase });
      if (!result.ok) throw new Error(result.error.message);
      setTested(true);
      setMessage({ kind: 'success', text: '服务器可连接，请登录以完成绑定。' });
    } catch (error) {
      setTested(false);
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '连接测试失败' });
    } finally {
      setBusy(false);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    try {
      if (!tested || !apiBase) throw new Error('请先测试服务器连接');
      setBusy(true);
      const result = await sendExtensionMessage({
        type: 'login',
        apiBase,
        settings: { serverUrl: serverUrl.trim(), apiOverride: apiOverride.trim() || undefined },
        username: username.trim(),
        password,
        device: await getOrCreateExtensionDevice(),
      });
      if (!result.ok) throw new Error(result.error.message);
      setState(result.state ?? null);
      setPassword('');
      setMessage({ kind: 'success', text: '已连接乾坤戒，可以开始采集网页。' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '登录失败' });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    const result = await sendExtensionMessage({ type: 'logout' });
    if (result.ok && result.releasedApiBase) await removeServerPermission(result.releasedApiBase);
    if (result.ok) {
      setState(null);
      setTested(false);
      setMessage({ kind: 'success', text: '已退出并清除该服务器的插件访问权限。' });
    } else {
      setMessage({ kind: 'error', text: result.error.message });
    }
    setBusy(false);
  }

  return <main className="options-shell">
    <header><Brand /><p>把喜欢的网页一键采集到乾坤戒收件箱。</p></header>
    {connected ? <section className="connected card">
      <div><span className="eyebrow">已连接</span><strong>{state?.session?.user.username}</strong><p>{state?.settings?.serverUrl}</p></div>
      <button className="secondary" type="button" disabled={busy} onClick={() => void logout()}>退出并更换服务器</button>
    </section> : <section className="settings-card card">
      <h1>连接乾坤戒服务器</h1>
      <label>乾坤戒网页地址<input value={serverUrl} onChange={(event) => { setServerUrl(event.target.value); setTested(false); }} placeholder="https://storing.example.com" inputMode="url" /></label>
      <button className="advanced-toggle" type="button" onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? '收起高级设置' : '高级设置：指定完整 API 地址'}</button>
      {showAdvanced && <label>API 地址<input value={apiOverride} onChange={(event) => { setApiOverride(event.target.value); setTested(false); }} placeholder="http://192.168.1.10:1052/api/v1" inputMode="url" /></label>}
      {apiBase && <p className="api-preview">将连接：{apiBase}</p>}
      {needsHttpWarning && <label className="warning"><input type="checkbox" checked={confirmedHttp} onChange={(event) => setConfirmedHttp(event.target.checked)} /> 我了解非本机 HTTP 会以明文传输账号密码和会话。</label>}
      <button className="primary" type="button" disabled={busy} onClick={() => void testConnection()}>{busy ? '正在连接…' : '测试并授权此服务器'}</button>
      {tested && <form onSubmit={login} className="login-form">
        <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
        <label>密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? '正在登录…' : '登录并连接'}</button>
      </form>}
    </section>}
    {message.kind === 'error' && <p className="error feedback">{message.text}</p>}
    {message.kind === 'success' && <p className="success feedback">{message.text}</p>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
