import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const {
  buildReportMarkdown,
  evidenceMix,
  sectionThoughts,
  stanceMix,
} = await import('../src/lib/deepAnalysisReport.ts');

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const button = read('../src/components/article/DeepAnalysisButton.tsx');
const page = read('../src/components/article/DeepAnalysisReportPage.tsx');
const route = read('../src/app/(main)/deep-analysis/[articleId]/page.tsx');
const layout = read('../src/app/(main)/layout.tsx');
const css = read('../src/app/globals.css');

const report = {
  executiveSummary: '文章讨论了一个值得验证的核心判断。',
  coreArguments: [
    { claim: '效率提升来自整理流程，而不是单一阅读功能。', evidence: '作者用去重和合集整理了数百本书。' },
  ],
  reasoningChain: ['先提出收藏混乱的痛点', '再给出整理效率的实测', '最后总结工具边界'],
  keyFacts: [
    { fact: '支持多种漫画和电子书格式', basis: 'source' },
    { fact: '作者可能同时推广自己的容器工具', basis: 'inference' },
  ],
  viewpoints: [
    { stance: 'support', summary: '整理效率是核心价值', reasoning: '去重和合集直接减少人工工作。' },
    { stance: 'conditional', summary: '价值取决于藏书类型', reasoning: '欧美漫画需要更多手填。' },
    { stance: 'oppose', summary: '性能结论缺少大规模验证', reasoning: '实测样本只有数百本。' },
  ],
  risks: ['特权容器会增加部署风险。'],
  actions: [{ action: '先在小书库验证', condition: '准备迁移现有藏书时' }],
  questions: ['去重算法依据什么？'],
  readingPath: ['先读安装方法', '再读整理功能'],
};

test('详情页按钮覆盖生成、生成中和查看报告三种文案', () => {
  assert.match(button, /'生成中'/);
  assert.match(button, /'查看深度解析报告'/);
  assert.match(button, /router\.push\(`\/deep-analysis\/\$\{articleId\}`\)/);
  assert.match(button, /useDeepAnalysisTask/);
});

test('报告独立页包含目录、主旨和两类数据图表', () => {
  assert.match(route, /DeepAnalysisReportPage/);
  assert.match(page, /REPORT_SECTIONS/);
  assert.match(page, /本段主旨/);
  assert.match(page, /function EvidenceChart/);
  assert.match(page, /function StanceChart/);
  assert.match(page, /conic-gradient/);
  assert.match(page, /deep-report-stance-bar/);
});

test('报告页支持重新生成、保存和分享 PDF 与 Markdown', () => {
  assert.match(page, /api\.submitDeepAnalysis/);
  assert.match(page, /saveMarkdown/);
  assert.match(page, /savePdf/);
  assert.match(page, /shareFile/);
  assert.match(page, /import\('jspdf'\)/);
  assert.match(page, /import\('html2canvas-pro'\)/);
  assert.match(page, /navigator\.canShare/);
});

test('报告页使用独立路由且不会叠开文章详情面板', () => {
  assert.match(layout, /!pathname\.startsWith\('\/deep-analysis\/'\)/);
  assert.match(layout, /privateRoutes = \[[^\]]*'\/deep-analysis'/);
});

test('主旨提取与图表统计来自真实报告字段', () => {
  const thoughts = sectionThoughts(report);
  assert.match(thoughts.arguments, /效率提升/);
  assert.match(thoughts.facts, /2 条关键信息/);
  assert.equal(evidenceMix(report).source, 1);
  assert.equal(evidenceMix(report).inference, 1);
  assert.equal(stanceMix(report).support, 1);
  assert.equal(stanceMix(report).conditional, 1);
  assert.equal(stanceMix(report).oppose, 1);
  assert.match(buildReportMarkdown(report, '测试文章'), /## 不同观点/);
});

test('报告页样式覆盖桌面、移动端与打印输出', () => {
  assert.match(css, /\.deep-report-hero/);
  assert.match(css, /\.deep-report-main-idea/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.deep-report-toc/);
  assert.match(css, /@media print[\s\S]*\.deep-report-toolbar/);
});
