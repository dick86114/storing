'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeftOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  FileMarkdownOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  LinkOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  ShareAltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  REPORT_SECTIONS,
  aiWritingBand,
  aiWritingLeaningLabel,
  buildReportMarkdown,
  evidenceMix,
  formatUsageDuration,
  formatReportDate,
  reportFileStem,
  sectionThoughts,
  stanceLabel,
  stanceMix,
  type DeepAnalysisReport,
  type DeepAnalysisReportRecord,
  type ReportSectionId,
} from '@/lib/deepAnalysisReport';

type ArticleMeta = {
  id: number;
  title?: string | null;
  source?: string | null;
  author?: string | null;
  coverImage?: string | null;
  publishTime?: string | null;
  isArchived?: boolean;
  isFavorited?: boolean;
};

type DeepAnalysisResponse = {
  report: DeepAnalysisReportRecord | null;
  summary: {
    hasDeepAnalysis: boolean;
    status: string;
    version: number | null;
    generatedAt: string | null;
    stale: boolean;
    errorCode: string | null;
  } | null;
};

const POLL_INTERVAL_MS = 2500;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function renderPdf(element: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  await document.fonts.ready;

  const canvas = await html2canvas(element, {
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    useCORS: true,
    allowTaint: false,
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
    logging: false,
    windowWidth: element.scrollWidth,
    ignoreElements: (node) => node.classList?.contains('deep-report-cover'),
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const imageHeight = canvas.height * contentWidth / canvas.width;
  const image = canvas.toDataURL('image/jpeg', 0.92);
  let remainingHeight = imageHeight;
  let offset = 0;

  while (remainingHeight > 0) {
    if (offset > 0) pdf.addPage();
    pdf.addImage(image, 'JPEG', margin, margin - offset, contentWidth, imageHeight, undefined, 'FAST');
    remainingHeight -= contentHeight;
    offset += contentHeight;
  }

  return pdf.output('blob');
}

function Section({
  id,
  title,
  idea,
  children,
}: {
  id: ReportSectionId;
  title: string;
  idea: string;
  children: ReactNode;
}) {
  const hint = REPORT_SECTIONS.find((section) => section.id === id)?.hint ?? '';
  return (
    <section className="deep-report-section" id={`report-${id}`}>
      <div className="deep-report-section-head">
        <div className="deep-report-section-title">
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        <div className="deep-report-main-idea">
          <span>本段主旨</span>
          <p>{idea}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="deep-report-metric">
      <span className="deep-report-metric-icon">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function EvidenceChart({ report }: { report: DeepAnalysisReport }) {
  const mix = evidenceMix(report);
  const sourceAngle = `${mix.sourcePercent * 3.6}deg`;
  const style = {
    background: `conic-gradient(var(--accent) 0 ${sourceAngle}, var(--border) ${sourceAngle} 360deg)`,
  } as CSSProperties;

  return (
    <div className="deep-report-evidence-chart">
      <div className="deep-report-donut" style={style}>
        <span>{mix.sourcePercent}%</span>
        <small>来自原文</small>
      </div>
      <div className="deep-report-chart-legend">
        <div><i className="is-source" /><span>原文有依据</span><strong>{mix.source}</strong></div>
        <div><i className="is-inference" /><span>AI 推测</span><strong>{mix.inference}</strong></div>
      </div>
    </div>
  );
}

function StanceChart({ report }: { report: DeepAnalysisReport }) {
  const mix = stanceMix(report);
  return (
    <div className="deep-report-stance-chart">
      <div className="deep-report-stance-bar" aria-label="观点立场分布">
        {mix.support > 0 && <span className="is-support" style={{ width: `${mix.supportPercent}%` }} />}
        {mix.conditional > 0 && <span className="is-conditional" style={{ width: `${mix.conditionalPercent}%` }} />}
        {mix.oppose > 0 && <span className="is-oppose" style={{ width: `${mix.opposePercent}%` }} />}
      </div>
      <div className="deep-report-stance-legend">
        <span><i className="is-support" />支持 {mix.support}</span>
        <span><i className="is-conditional" />有条件 {mix.conditional}</span>
        <span><i className="is-oppose" />反驳 {mix.oppose}</span>
      </div>
    </div>
  );
}

function AiWritingCard({
  report,
  onRegenerate,
  disabled,
}: {
  report: DeepAnalysisReport;
  onRegenerate: () => void;
  disabled: boolean;
}) {
  const aiWriting = report.aiWriting;
  const band = aiWritingBand(aiWriting?.score);

  if (!aiWriting || !band) {
    return (
      <article className="deep-report-ai-writing is-empty" id="report-ai-writing">
        <div className="deep-report-ai-writing-head">
          <div>
            <div className="deep-report-kicker"><RobotOutlined /> 写作倾向</div>
            <h2>这篇文章像 AI 写的吗？</h2>
            <p>根据用词、结构、细节和引用方式做一个倾向判断，不是作者身份鉴定。</p>
          </div>
        </div>
        <div className="deep-report-ai-writing-empty">
          <p>这份报告生成较早，暂无文章 AI 写作判断。重新生成后可查看判断依据。</p>
          <button type="button" onClick={onRegenerate} disabled={disabled}>
            {disabled ? <LoadingOutlined spin /> : <ReloadOutlined />}
            {disabled ? '生成中' : '重新生成报告'}
          </button>
        </div>
      </article>
    );
  }

  const score = Math.max(0, Math.min(100, Math.round(aiWriting.score)));

  return (
    <article className="deep-report-ai-writing" id="report-ai-writing">
      <div className="deep-report-ai-writing-head">
        <div>
          <div className="deep-report-kicker"><RobotOutlined /> 写作倾向</div>
          <h2>这篇文章像 AI 写的吗？</h2>
          <p>根据用词、结构、细节和引用方式做一个倾向判断，不是作者身份鉴定。</p>
        </div>
        <div className={`deep-report-ai-score is-${band.key}`}>
          <div><strong>{score}</strong><span>/100</span></div>
          <small>{band.label}</small>
        </div>
      </div>

      <div className="deep-report-ai-meter" aria-label={`AI 写作倾向 ${score} 分，${band.label}`}>
        <div className="deep-report-ai-meter-track">
          <span className="is-human" />
          <span className="is-mixed" />
          <span className="is-ai" />
          <i style={{ left: `${score}%` }} />
        </div>
        <div className="deep-report-ai-meter-labels">
          <span>更像人工<small>0</small></span>
          <span>混合 / 不明显<small>50</small></span>
          <span>更像 AI<small>100</small></span>
        </div>
      </div>

      <p className="deep-report-ai-writing-summary">{aiWriting.summary}</p>

      <div className="deep-report-ai-signals">
        <div className="deep-report-ai-signals-head">
          <strong>判断依据</strong>
          <span>{aiWriting.signals.length} 条文本线索</span>
        </div>
        <div className="deep-report-ai-signal-grid">
          {aiWriting.signals.map((signal, index) => (
            <div className={`deep-report-ai-signal is-${signal.leaning}`} key={`${signal.label}-${index}`}>
              <span>{aiWritingLeaningLabel(signal.leaning)}</span>
              <strong>{signal.label}</strong>
              <p>{signal.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="deep-report-ai-writing-note">
        <InfoCircleOutlined />
        <p>这是基于文本特征的倾向判断，不是作者身份鉴定。改写、模板化写作和人机协作都可能造成误判。</p>
      </div>
    </article>
  );
}

export function DeepAnalysisReportPage({ articleId }: { articleId: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'md' | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const { data: article } = useSWR<ArticleMeta>(
    Number.isFinite(articleId) ? `article-meta:${articleId}` : null,
    () => api.getArticleMeta(articleId),
    { revalidateOnFocus: false },
  );
  const { data, error, isLoading, mutate } = useSWR<DeepAnalysisResponse>(
    Number.isFinite(articleId) ? `deep-analysis-report:${articleId}` : null,
    () => api.getDeepAnalysis(articleId),
    { revalidateOnFocus: false },
  );

  const report = data?.report?.reportJson ?? null;
  const status = data?.summary?.status ?? null;
  const pending = status === 'queued' || status === 'running';
  const thoughts = useMemo(() => (report ? sectionThoughts(report) : null), [report]);
  const evidence = useMemo(() => (report ? evidenceMix(report) : null), [report]);
  const stances = useMemo(() => (report ? stanceMix(report) : null), [report]);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void mutate();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pending, mutate, status]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  const goBack = () => {
    const view = article?.isArchived ? 'archive' : article?.isFavorited ? 'favorites' : 'inbox';
    router.push(`/${view}?article=${articleId}`);
  };

  const regenerate = async () => {
    if (regenerating || pending) return;
    setRegenerating(true);
    try {
      await api.submitDeepAnalysis(articleId);
      await mutate();
      showToast('已提交重新生成，完成后会自动刷新报告');
    } catch (submitError) {
      showToast(submitError instanceof Error ? submitError.message : '重新生成失败');
    } finally {
      setRegenerating(false);
    }
  };

  const deleteReport = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.deleteDeepAnalysis(articleId);
      setConfirmDelete(false);
      goBack();
      showToast('深度报告已删除');
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : '删除深度报告失败');
    } finally {
      setDeleting(false);
    }
  };

  const markdown = () => report
    ? data?.report?.reportMarkdown || buildReportMarkdown(report, article?.title, data?.report?.generatedAt)
    : '';

  const saveMarkdown = () => {
    if (!report) return;
    downloadBlob(
      new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }),
      `${reportFileStem(article?.title)}.md`,
    );
    showToast('Markdown 已保存到本地');
  };

  const savePdf = async () => {
    if (!reportRef.current || exporting) return;
    setExporting('pdf');
    try {
      const blob = await renderPdf(reportRef.current);
      downloadBlob(blob, `${reportFileStem(article?.title)}.pdf`);
      showToast('PDF 已保存到本地');
    } catch {
      showToast('PDF 生成失败，请稍后重试');
    } finally {
      setExporting(null);
    }
  };

  const shareFile = async (format: 'md' | 'pdf') => {
    if (!report || exporting) return;
    setExporting(format);
    try {
      const filename = `${reportFileStem(article?.title)}.${format}`;
      const blob = format === 'md'
        ? new Blob([markdown()], { type: 'text/markdown;charset=utf-8' })
        : await renderPdf(reportRef.current!);
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: article?.title || '深度报告', files: [file] });
      } else {
        downloadBlob(blob, filename);
        showToast('当前浏览器不支持文件分享，已保存到本地');
      }
    } catch (shareError) {
      if (!(shareError instanceof DOMException && shareError.name === 'AbortError')) {
        showToast('文件分享失败，请重试');
      }
    } finally {
      setExporting(null);
    }
  };

  const toolbar = (
    <div className="deep-report-toolbar">
      <button type="button" className="deep-report-back" onClick={goBack}>
        <ArrowLeftOutlined />
        返回文章
      </button>
      <div className="deep-report-toolbar-actions">
        <button
          type="button"
          className="deep-report-action-btn"
          onClick={() => setConfirmRegenerate(true)}
          disabled={regenerating || pending}
        >
          {regenerating || pending ? <LoadingOutlined spin /> : <ReloadOutlined />}
          {pending ? '生成中' : '重新生成'}
        </button>
        <div className="deep-report-export-wrap">
          <button
            type="button"
            className="deep-report-action-btn is-primary"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((open) => !open);
            }}
            disabled={!report || exporting !== null}
            aria-expanded={menuOpen}
          >
            {exporting ? <LoadingOutlined spin /> : <DownloadOutlined />}
            {exporting ? '生成文件中' : '导出与分享'}
            <DownOutlined className="deep-report-export-chevron" />
          </button>
          {menuOpen && report && (
            <div className="deep-report-export-menu" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => { setMenuOpen(false); saveMarkdown(); }}>
                <FileMarkdownOutlined />
                <span><strong>保存 Markdown</strong><small>下载可编辑的 .md 文件</small></span>
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); void savePdf(); }}>
                <FilePdfOutlined />
                <span><strong>保存 PDF</strong><small>生成适合归档的 .pdf 文件</small></span>
              </button>
              <div />
              <button type="button" onClick={() => { setMenuOpen(false); void shareFile('md'); }}>
                <ShareAltOutlined />
                <span><strong>分享 Markdown</strong><small>调用系统文件分享</small></span>
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); void shareFile('pdf'); }}>
                <ShareAltOutlined />
                <span><strong>分享 PDF</strong><small>调用系统文件分享</small></span>
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="deep-report-action-btn is-danger"
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
        >
          {deleting ? <LoadingOutlined spin /> : <DeleteOutlined />}
          {deleting ? '删除中' : '删除报告'}
        </button>
      </div>
      {confirmRegenerate && (
        <div className="deep-report-confirm-mask">
          <div className="deep-report-confirm" role="dialog" aria-modal="true" aria-label="重新生成深度报告">
            <h2>重新生成深度报告？</h2>
            <p>AI 会基于当前正文创建新一版报告。生成完成前仍可阅读当前内容。</p>
            <div className="deep-report-confirm-actions">
              <button type="button" onClick={() => setConfirmRegenerate(false)}>取消</button>
              <button
                type="button"
                className="is-primary"
                onClick={() => {
                  setConfirmRegenerate(false);
                  void regenerate();
                }}
                disabled={regenerating || pending}
              >
                重新生成
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="deep-report-confirm-mask">
          <div className="deep-report-confirm is-destructive" role="dialog" aria-modal="true" aria-label="删除深度报告">
            <h2>删除深度报告？</h2>
            <p>这篇文章的全部历史版本都会删除。删除后需要重新生成才能恢复。</p>
            <div className="deep-report-confirm-actions">
              <button type="button" onClick={() => setConfirmDelete(false)}>取消</button>
              <button
                type="button"
                className="is-danger"
                onClick={() => void deleteReport()}
                disabled={deleting}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="deep-report-page">
        {toolbar}
        <div className="deep-report-empty">
          <WarningOutlined />
          <h1>报告暂时无法打开</h1>
          <p>{error instanceof Error ? error.message : '请稍后重试'}</p>
          <button type="button" onClick={() => void mutate()}>重新加载</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="deep-report-page">
        {toolbar}
        <div className="deep-report-loading">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="deep-report-page">
        {toolbar}
        <div className="deep-report-empty">
          {pending ? <LoadingOutlined spin /> : <BulbOutlined />}
          <h1>{pending ? '深度报告正在生成' : status === 'failed' ? '深度报告生成失败' : '还没有深度报告'}</h1>
          <p>
            {pending
              ? '完成后页面会自动刷新，你可以先返回文章继续阅读。'
              : status === 'failed'
                ? '可以重新生成一份报告，旧内容不会受影响。'
                : '生成后会在这里呈现论点、证据、不同观点和行动建议。'}
          </p>
          {!pending && (
            <button type="button" onClick={regenerate} disabled={regenerating}>
              {regenerating ? <LoadingOutlined spin /> : <ReloadOutlined />}
              {status === 'failed' ? '重新生成' : '生成深度报告'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!thoughts || !evidence || !stances) return null;

  const sourceFacts = evidence.source;
  const inferenceFacts = evidence.inference;
  const title = article?.title || '深度报告';
  const generatedAt = formatReportDate(data?.report?.generatedAt);

  return (
    <div className="deep-report-page">
      {toolbar}
      {pending && (
        <div className="deep-report-generating-banner" role="status">
          <LoadingOutlined spin />
          新一版报告正在生成，当前仍可阅读已有内容。
        </div>
      )}

      <div className="deep-report-layout">
        <aside className="deep-report-toc">
          <strong>报告目录</strong>
          <nav>
            <a href="#report-ai-writing">AI 写作倾向</a>
            {REPORT_SECTIONS.map((section) => (
              <a key={section.id} href={`#report-${section.id}`}>{section.title}</a>
            ))}
          </nav>
          <div className="deep-report-toc-note">
            <span>版本 {data?.report?.version ?? data?.summary?.version ?? 1}</span>
            {generatedAt && <span>{generatedAt}</span>}
            {data?.summary?.stale && <span>正文已更新，当前报告基于旧版正文</span>}
          </div>
        </aside>

        <div className="deep-report-document" ref={reportRef}>
          <header className="deep-report-hero">
            <div className="deep-report-hero-copy">
              <div className="deep-report-kicker"><LineChartOutlined /> AI 增强阅读</div>
              <h1>{title}</h1>
              <div className="deep-report-meta">
                {article?.source && <span>{article.source}</span>}
                {article?.author && <span>{article.author}</span>}
                {article?.publishTime && <span>{formatReportDate(article.publishTime)}</span>}
              </div>
              <div className="deep-report-thesis">
                <span>一段看懂</span>
                <p>{report.executiveSummary}</p>
              </div>
            </div>
            {article?.coverImage && (
              <div className="deep-report-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article.coverImage} alt="" />
              </div>
            )}
          </header>

          <section className="deep-report-overview">
            <div className="deep-report-metrics">
              <Metric label="核心论点" value={report.coreArguments.length} detail="文章的主要主张" icon={<BulbOutlined />} />
              <Metric label="关键事实" value={report.keyFacts.length} detail={`${sourceFacts} 条有原文依据`} icon={<CheckCircleOutlined />} />
              <Metric label="不同观点" value={report.viewpoints.length} detail={`${stances.total} 个判断角度`} icon={<CompassOutlined />} />
              <Metric label="行动建议" value={report.actions.length} detail="附适用条件" icon={<LineChartOutlined />} />
            </div>
            <div className="deep-report-overview-grid">
              <div className="deep-report-insight-card">
                <div className="deep-report-card-title"><strong>信息依据</strong><span>关键信息从哪里来</span></div>
                <EvidenceChart report={report} />
                <p>圆环只统计关键信息来自原文还是由 AI 补充，不代表报告准确率。引用前先核对“原文有依据”的条目。</p>
              </div>
              <div className="deep-report-insight-card">
                <div className="deep-report-card-title"><strong>观点分布</strong><span>同一件事的不同看法</span></div>
                <StanceChart report={report} />
                <p>这个条只表示报告整理出的观点数量，不代表文章作者持哪种立场。</p>
              </div>
            </div>
            <AiWritingCard report={report} onRegenerate={regenerate} disabled={regenerating || pending} />
          </section>

          <Section id="arguments" title="核心论点" idea={thoughts.arguments}>
            <div className="deep-report-argument-list">
              {report.coreArguments.map((item, index) => (
                <article className="deep-report-argument" key={`${item.claim}-${index}`}>
                  <span className="deep-report-argument-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{item.claim}</h3>
                    <p>{item.evidence}</p>
                    {item.quoteAnchor && <small>原文位置：{item.quoteAnchor}</small>}
                  </div>
                </article>
              ))}
            </div>
          </Section>

          <Section id="reasoning" title="论证链路" idea={thoughts.reasoning}>
            <ol className="deep-report-reasoning">
              {report.reasoningChain.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <span>{index + 1}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="facts" title="关键信息与数据" idea={thoughts.facts}>
            <div className="deep-report-facts-layout">
              <EvidenceChart report={report} />
              <div className="deep-report-fact-list">
                {report.keyFacts.map((item, index) => (
                  <div className="deep-report-fact" key={`${item.fact}-${index}`}>
                    <span className={item.basis === 'source' ? 'is-source' : 'is-inference'}>
                      {item.basis === 'source' ? '原文有依据' : 'AI 推测'}
                    </span>
                    <p>{item.fact}</p>
                    {item.quoteAnchor && <small>{item.quoteAnchor}</small>}
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section id="viewpoints" title="不同观点" idea={thoughts.viewpoints}>
            <StanceChart report={report} />
            <div className="deep-report-viewpoint-grid">
              {report.viewpoints.map((item, index) => (
                <article className={`deep-report-viewpoint is-${item.stance}`} key={`${item.summary}-${index}`}>
                  <span>{stanceLabel(item.stance)}</span>
                  <h3>{item.summary}</h3>
                  <p>{item.reasoning}</p>
                </article>
              ))}
            </div>
          </Section>

          <Section id="risks" title="风险与局限" idea={thoughts.risks}>
            <div className="deep-report-risk-list">
              {report.risks.map((item, index) => (
                <div key={`${item}-${index}`}>
                  <WarningOutlined />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="actions" title="行动指引" idea={thoughts.actions}>
            <div className="deep-report-action-grid">
              {report.actions.map((item, index) => (
                <article key={`${item.action}-${index}`}>
                  <CheckCircleOutlined />
                  <span>建议 {index + 1}</span>
                  <h3>{item.action}</h3>
                  <p>{item.condition}</p>
                </article>
              ))}
            </div>
          </Section>

          <Section id="questions" title="延伸问题" idea={thoughts.questions}>
            <div className="deep-report-question-list">
              {report.questions.map((item, index) => (
                <div key={`${item}-${index}`}>
                  <QuestionCircleOutlined />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="readingPath" title="阅读路径" idea={thoughts.readingPath}>
            <ol className="deep-report-reading-path">
              {report.readingPath.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <span><LinkOutlined /></span>
                  <div><small>节点 {index + 1}</small><p>{item}</p></div>
                </li>
              ))}
            </ol>
          </Section>

          <footer className="deep-report-footer">
            <div><ClockCircleOutlined /> {generatedAt || '生成时间未记录'}</div>
            <div>模型：{data?.report?.modelSnapshot || '未记录'} · 版本 {data?.report?.version ?? 1}</div>
            <div className="deep-report-usage">
              <span>报告生成耗时：{formatUsageDuration(data?.report?.durationMs) ?? '未记录'}</span>
              <span>调用工具：{data?.report?.providerSnapshot || '未记录'}{data?.report?.attempts ? ` · 第 ${data?.report?.attempts} 次尝试` : ''}</span>
              <span>输入/输出 Token：{data?.report?.promptTokens ?? 0} / {data?.report?.completionTokens ?? 0}</span>
              <span>总消耗：{data?.report?.totalTokens ?? 0} Tokens</span>
              <span>费用以你的模型服务商账单为准，系统仅记录 Token 用量。</span>
            </div>
            <div>本报告由 AI 生成，关键事实请回到原文核对。</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
