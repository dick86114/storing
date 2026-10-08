'use client';

import { useCallback, useEffect, useState } from 'react';
import { DeleteOutlined, RobotOutlined, SyncOutlined } from '@ant-design/icons';
import { api, type AiJobsResponse, type SaveUserAiSettingsInput, type UserAiSettings } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';
import { useToast } from '@/components/ui/Toast';

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'zhipu', label: '智谱 AI' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'doubao', label: '豆包' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'nvidia', label: 'NVIDIA' },
  { value: 'aliyun', label: '阿里云' },
  { value: 'siliconflow', label: 'SiliconFlow' },
  { value: 'custom', label: '自定义' },
];

const emptyForm: SaveUserAiSettingsInput = {
  provider: 'deepseek',
  model: '',
  baseUrl: null,
  apiKey: '',
  autoTriggerOnArchive: false,
};

export function AiSettingsContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<UserAiSettings | null>(null);
  const [form, setForm] = useState<SaveUserAiSettingsInput>(emptyForm);
  const [models, setModels] = useState<Array<{ id: string; name: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [jobs, setJobs] = useState<AiJobsResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setApiKey = (value: string) => {
    setForm((current) => ({ ...current, apiKey: value }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsResult, jobsResult] = await Promise.all([
        api.getAiSettings(),
        api.getAiJobs(1, 10).catch(() => null),
      ]);
      const nextSettings = settingsResult.settings;
      setSettings(nextSettings);
      setForm(nextSettings ? {
        provider: nextSettings.provider,
        model: nextSettings.model,
        baseUrl: nextSettings.baseUrl,
        apiKey: '',
        autoTriggerOnArchive: nextSettings.autoTriggerOnArchive,
      } : emptyForm);
      setJobs(jobsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 AI 配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.saveAiSettings(form);
      setSettings(result.settings);
      setApiKey('');
      setNotice('AI 配置已保存');
      showToast('AI 配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const discover = async () => {
    setDiscovering(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.discoverAiModels({
        provider: form.provider,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey || undefined,
      });
      setModels(result.models);
      setNotice(result.cached ? '已显示缓存的模型列表' : '模型列表已更新');
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取模型列表失败，可手动输入');
      setModels([]);
    } finally {
      setDiscovering(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.testAiSettings();
      setNotice(`AI 连接正常，耗时 ${result.latencyMs}ms`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('确定删除 AI 配置？删除后归档将不再自动生成。')) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await api.deleteAiSettings();
      setSettings(null);
      setForm(emptyForm);
      setNotice('AI 配置已删除');
      showToast('AI 配置已删除');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const retryJob = async (jobId: number) => {
    try {
      await api.retryAiJob(jobId);
      showToast('AI 任务已重新排队');
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试失败');
    }
  };

  return (
    <div className="page-shell" style={{ maxWidth: 680, margin: '0 auto', padding: 16 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 22, margin: 0 }}>
          <RobotOutlined /> AI 模型
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>按账号配置模型，归档时按设置触发生成。</p>
      </header>

      {user?.role === 'service' && (
        <p className="ai-settings-service-hint">服务账号由管理员代配置 AI 模型。</p>
      )}
      {notice && <p className="ai-settings-notice">{notice}</p>}
      {error && <p className="ai-settings-error">{error}</p>}

      <section className="ai-settings-card" data-busy={loading} aria-busy={loading}>
        <label className="ai-settings-field">
          模型提供商
          <select
            value={form.provider}
            onChange={(e) => setForm((s) => ({ ...s, provider: e.target.value }))}
          >
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>

        <label className="ai-settings-field">
          Base URL
          <input
            value={form.baseUrl ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, baseUrl: e.target.value || null }))}
            placeholder="自定义服务时填写 HTTPS 地址"
          />
        </label>

        <label className="ai-settings-field">
          API Key
          <input
            type="password"
            value={form.apiKey ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, apiKey: e.target.value }))}
            placeholder={settings?.apiKeyConfigured ? `已配置 ${settings.apiKeyLast4 || ''}` : '输入 API Key'}
          />
        </label>

        <label className="ai-settings-field">
          模型
          <input
            list="ai-model-options"
            value={form.model}
            onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))}
            placeholder="选择或手动输入模型名"
          />
          <datalist id="ai-model-options">
            {models.map((m) => <option key={m.id} value={m.id} label={m.name || m.id} />)}
          </datalist>
        </label>

        <button type="button" className="ai-settings-secondary" onClick={discover} disabled={discovering}>
          <SyncOutlined spin={discovering} /> 获取模型
        </button>

        <label className="ai-settings-toggle">
          <input
            type="checkbox"
            checked={form.autoTriggerOnArchive}
            onChange={(e) => setForm((s) => ({ ...s, autoTriggerOnArchive: e.target.checked }))}
          />
          自动触发
        </label>

        <div className="ai-settings-actions">
          <button type="button" className="ai-settings-primary" onClick={save} disabled={saving || loading}>
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button type="button" className="ai-settings-secondary" onClick={test} disabled={testing || loading}>
            {testing ? '测试中...' : '测试生成'}
          </button>
          <button type="button" className="ai-settings-danger" onClick={remove} disabled={deleting || loading}>
            <DeleteOutlined /> 删除配置
          </button>
        </div>
      </section>

      <section className="ai-settings-card">
        <h2>最近任务</h2>
        {jobs && (
          <div className="ai-settings-usage">
            <span>共 {jobs.usage.totalJobs} 次</span>
            <span>成功 {jobs.usage.succeededJobs}</span>
            <span>失败 {jobs.usage.failedJobs}</span>
            <span>Token {jobs.usage.totalTokens}</span>
          </div>
        )}
        {jobs?.jobs.map((job) => (
          <div className="ai-job-row" key={job.id}>
            <span>#{job.id} · 文章 {job.articleId}</span>
            <span>{job.model || '—'}</span>
            <span>{job.status}</span>
            {job.totalTokens !== null && <span>{job.totalTokens} tokens</span>}
            {job.status === 'failed' && (
              <button type="button" onClick={() => retryJob(job.id)}>重试</button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
