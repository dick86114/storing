'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type DeepAnalysisSummary = {
  hasDeepAnalysis?: boolean;
  status?: string;
  version?: number | null;
  stale?: boolean;
  errorCode?: string | null;
};

type DeepAnalysisReport = {
  executiveSummary: string;
  coreArguments: Array<{ claim: string; evidence: string; quoteAnchor?: string | null }>;
  reasoningChain: string[];
  keyFacts: Array<{ fact: string; basis: string; quoteAnchor?: string | null }>;
  viewpoints: Array<{ stance: string; summary: string; reasoning: string }>;
  risks: string[];
  actions: Array<{ action: string; condition: string }>;
  questions: string[];
  readingPath: string[];
};

type DeepAnalysisVersions = Array<{
  id: number;
  version: number;
  status: string;
  isCurrent: boolean;
  contentTruncated: boolean;
  generatedAt: string | null;
}>;

const reportSections = [
  { title: '一段看懂', render: (report: DeepAnalysisReport) => <p>{report.executiveSummary}</p> },
  {
    title: '核心论点',
    render: (report: DeepAnalysisReport) => (
      <ul>{report.coreArguments.map((item, index) => <li key={index}><strong>{item.claim}</strong>{item.evidence}{item.quoteAnchor && <small>{item.quoteAnchor}</small>}</li>)}</ul>
    ),
  },
  { title: '论证链路', render: (report: DeepAnalysisReport) => <ul>{report.reasoningChain.map((item, index) => <li key={index}>{item}</li>)}</ul> },
  {
    title: '关键信息与数据',
    render: (report: DeepAnalysisReport) => (
      <ul>{report.keyFacts.map((item, index) => <li key={index}>{item.fact}（{item.basis === 'source' ? '原文事实' : '模型推断'}）</li>)}</ul>
    ),
  },
  {
    title: '不同观点',
    render: (report: DeepAnalysisReport) => (
      <ul>{report.viewpoints.map((item, index) => <li key={index}><strong>{item.summary}</strong>{item.reasoning}</li>)}</ul>
    ),
  },
  { title: '风险与局限', render: (report: DeepAnalysisReport) => <ul>{report.risks.map((item, index) => <li key={index}>{item}</li>)}</ul> },
  { title: '行动指引', render: (report: DeepAnalysisReport) => <ul>{report.actions.map((item, index) => <li key={index}>{item.action}（{item.condition}）</li>)}</ul> },
  { title: '延伸问题', render: (report: DeepAnalysisReport) => <ul>{report.questions.map((item, index) => <li key={index}>{item}</li>)}</ul> },
  { title: '阅读路径', render: (report: DeepAnalysisReport) => <ul>{report.readingPath.map((item, index) => <li key={index}>{item}</li>)}</ul> },
];

export function DeepAnalysisPanel({ articleId, articleTitle }: { articleId: number; articleTitle?: string | null }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<DeepAnalysisSummary | null>(null);
  const [report, setReport] = useState<DeepAnalysisReport | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [versions, setVersions] = useState<DeepAnalysisVersions>([]);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const offline = online === false;
  const [notice, setNotice] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getDeepAnalysis(articleId);
      setSummary(result.summary ?? null);
      setReport(result.report?.reportJson ?? null);
      setReportMarkdown(result.report?.reportMarkdown ?? '');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '深度报告加载失败');
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    return () => {
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
    };
  }, []);

  const notifyInApp = () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      setNotice('浏览器通知未授权，已使用应用内提醒');
      return;
    }
    new Notification('深度报告已生成', { body: `《${articleTitle || '文章'}》深度报告已就绪` });
  };

  const submit = async () => {
    if (offline) {
      setNotice('当前离线，已显示缓存报告；重新生成需要网络连接');
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      await api.submitDeepAnalysis(articleId);
      setSummary((current) => ({ ...(current ?? {}), status: 'queued' }));
      notifyInApp();
      await loadReport();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '深度解析提交失败');
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    const result = await api.getDeepAnalysisVersions(articleId);
    setVersions(result.versions ?? []);
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(reportMarkdown);
    setNotice('Markdown 已复制');
  };

  const running = summary?.status === 'queued' || summary?.status === 'running';
  const failed = summary?.status === 'failed';
  const hasReport = Boolean(report);

  return (
    <>
      <section className="deep-analysis-entry" aria-label="深度报告">
        <div className="deep-analysis-entry-head">
          <strong>深度解析</strong>
          <span className={`deep-analysis-state is-${running ? 'running' : failed ? 'failed' : summary?.hasDeepAnalysis ? 'done' : 'idle'}`}>
            {running ? '解析中' : failed ? '解析失败' : summary?.hasDeepAnalysis ? '已有报告' : '未生成'}
          </span>
        </div>
        <p>{hasReport ? '查看核心论点、不同观点、行动指引和原文依据。' : '用 AI 生成结构化深度报告，帮助理解文章论证与风险。'}</p>
        <div className="deep-analysis-entry-actions">
          {hasReport && <button type="button" onClick={() => setOpen(true)}>查看报告</button>}
          <button type="button" onClick={submit} disabled={loading || offline}>
            {running ? '生成中…' : failed ? '重试' : hasReport ? '重新生成' : '深度解析'}
          </button>
        </div>
        {(summary?.stale || offline || notice) && (
          <small role="status">
            {summary?.stale ? '正文已更新，当前报告基于旧版正文。' : ''}
            {offline ? '当前离线，已显示缓存报告；重新生成需要网络连接。' : ''}
            {notice}
          </small>
        )}
      </section>

      {open && (
        <aside className="deep-analysis-drawer" role="dialog" aria-label="深度报告">
          <header className="deep-analysis-drawer-head">
            <strong>深度报告</strong>
            <div>
              <button type="button" onClick={copyMarkdown}>复制 Markdown</button>
              <button type="button" onClick={loadVersions}>历史版本</button>
              <button type="button" onClick={() => setOpen(false)}>关闭</button>
            </div>
          </header>
          {loading && <div className="deep-analysis-loading">正在加载…</div>}
          {!loading && report && reportSections.map((section) => (
            <section className="deep-analysis-section" key={section.title}>
              <h3>{section.title}</h3>
              {section.render(report)}
            </section>
          ))}
          {!loading && !report && <p className="deep-analysis-empty">当前还没有成功生成的报告。</p>}
          {versions.length > 0 && (
            <section className="deep-analysis-section" aria-label="历史版本">
              <h3>历史版本</h3>
              <ul>
                {versions.map((item) => (
                  <li key={item.id}>
                    <span>版本 {item.version}{item.isCurrent ? ' · 当前' : ''}{item.status === 'failed' ? ' · 失败' : ''}</span>
                    {!item.isCurrent && item.status === 'succeeded' && (
                      <button type="button" onClick={async () => { await api.restoreDeepAnalysisVersion(articleId, item.version); await loadReport(); }}>
                        恢复
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      )}
    </>
  );
}
