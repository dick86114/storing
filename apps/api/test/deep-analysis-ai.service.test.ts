import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDeepAnalysisPrompt,
  parseDeepAnalysisReport,
  renderDeepAnalysisMarkdown,
} from '../src/services/deep-analysis-ai.service.ts';

const validReport = {
  executiveSummary: '文章主张知识库必须服务复用。',
  coreArguments: [{
    claim: '收集速度过高会降低调用率',
    evidence: '收藏后缺少处理与出口',
    quoteAnchor: '第 1 段',
  }],
  reasoningChain: ['收藏过载', '检索成本升高', '内容失去价值'],
  keyFacts: [
    { fact: '模型包含四层', basis: 'source', quoteAnchor: '第 2 段' },
    { fact: '该模型可能适合个人工作流', basis: 'inference', quoteAnchor: null },
  ],
  viewpoints: [
    { stance: 'support', summary: '支持', reasoning: '有明确复用出口时成立。' },
    { stance: 'oppose', summary: '反对', reasoning: '流程过重会增加维护成本。' },
    { stance: 'conditional', summary: '条件适用', reasoning: '只适合长期知识工作者。' },
  ],
  risks: ['分类过细', '捕获速度下降'],
  actions: [{ action: '为每类内容指定出口', condition: '长期保存前' }],
  questions: ['哪些文章在 90 天内被复用？'],
  readingPath: ['先读处理层', '再看案例'],
  aiWriting: {
    score: 72,
    summary: '结构均衡、抽象词较多，但没有直接证据说明作者使用了 AI。',
    signals: [
      { label: '段落长度过于均衡', detail: '各段长度接近，转折方式重复。', leaning: 'ai' },
      { label: '有个人经历细节', detail: '文中出现了具体时间、地点和操作过程。', leaning: 'human' },
      { label: '引用方式较泛化', detail: '多次使用“研究表明”但没有给出具体来源。', leaning: 'neutral' },
    ],
  },
};

test('深度报告提示词限制 24000 字符并强制中文 JSON', () => {
  const longText = '长'.repeat(24001);
  const prompt = buildDeepAnalysisPrompt({ title: '标题', summary: '摘要', content: longText });
  assert.equal(prompt.contentTruncated, true);
  assert.equal(prompt.maxTokens, 4800);
  assert.match(prompt.system, /中文/);
  assert.match(prompt.system, /仅输出 JSON/);
  assert.match(prompt.system, /原文/);
  assert.match(prompt.system, /不得编造外部数据/);
  assert.match(prompt.system, /aiWriting/);
  assert.match(prompt.system, /0 更像人工、100 更像 AI/);
  assert.match(prompt.user, /已截断到 24000 个字符/);
  assert.ok(prompt.user.length < 25200);
});

test('解析合法报告并保留原文事实与推断区分', () => {
  const report = parseDeepAnalysisReport(JSON.stringify(validReport));
  assert.equal(report.executiveSummary, validReport.executiveSummary);
  assert.equal(report.keyFacts[0].basis, 'source');
  assert.equal(report.keyFacts[1].basis, 'inference');
  assert.equal(report.viewpoints.length, 3);
  assert.equal(report.aiWriting.score, 72);
  assert.equal(report.aiWriting.signals[0].leaning, 'ai');
});

test('解析支持代码块包裹的 JSON', () => {
  const report = parseDeepAnalysisReport('```json\n' + JSON.stringify(validReport) + '\n```');
  assert.equal(report.coreArguments.length, 1);
});

test('非法 JSON、缺失字段、无效观点和事实依据都会失败', () => {
  assert.throws(() => parseDeepAnalysisReport('not json'), /AI_OUTPUT_INVALID/);
  for (const key of Object.keys(validReport)) {
    const missing = { ...validReport };
    delete missing[key];
    assert.throws(() => parseDeepAnalysisReport(JSON.stringify(missing)), /AI_OUTPUT_INVALID/, key);
  }
  assert.throws(() => parseDeepAnalysisReport(JSON.stringify({
    ...validReport,
    viewpoints: [{ stance: 'wrong', summary: 'a', reasoning: 'b' }],
  })), /AI_OUTPUT_INVALID/);
  assert.throws(() => parseDeepAnalysisReport(JSON.stringify({
    ...validReport,
    keyFacts: [{ fact: '无依据', basis: 'external', quoteAnchor: null }],
  })), /AI_OUTPUT_INVALID/);
});

test('关键文本字段按固定上限裁剪', () => {
  const report = parseDeepAnalysisReport(JSON.stringify({
    ...validReport,
    executiveSummary: '长'.repeat(1200),
    reasoningChain: ['长'.repeat(600)],
  }));
  assert.equal(report.executiveSummary.length, 1000);
  assert.equal(report.reasoningChain[0].length, 500);
});

test('AI 写作判断会限制分数和依据数量', () => {
  const report = parseDeepAnalysisReport(JSON.stringify({
    ...validReport,
    aiWriting: {
      score: 140,
      summary: '测试',
      signals: Array.from({ length: 8 }, (_, index) => ({
        label: `线索 ${index + 1}`,
        detail: '长'.repeat(200),
        leaning: index === 0 ? 'wrong' : 'ai',
      })),
    },
  }));
  assert.equal(report.aiWriting.score, 100);
  assert.equal(report.aiWriting.signals.length, 6);
  assert.equal(report.aiWriting.signals[0].leaning, 'neutral');
  assert.equal(report.aiWriting.signals[1].detail.length, 160);
});

test('空数组不视为结构缺失但至少保留一个执行摘要句', () => {
  const report = parseDeepAnalysisReport(JSON.stringify({
    ...validReport,
    coreArguments: [],
    viewpoints: [],
    risks: [],
    actions: [],
    questions: [],
    readingPath: [],
  }));
  assert.deepEqual(report.coreArguments, []);
  assert.deepEqual(report.viewpoints, []);
});

test('渲染 Markdown 使用固定分区且不插入原始 HTML', () => {
  const markdown = renderDeepAnalysisMarkdown(validReport);
  for (const heading of ['一段看懂', '核心论点', '论证链路', '关键信息与数据', '不同观点', '风险与局限', '行动指引', '延伸问题', '阅读路径']) {
    assert.ok(markdown.includes(heading));
  }
  assert.ok(markdown.includes('AI 写作倾向'));
  assert.ok(markdown.includes('72/100'));
  assert.ok(markdown.includes('支持 AI'));
  assert.ok(markdown.includes('不是作者身份鉴定'));
  assert.ok(!markdown.includes('<script>'));
  assert.ok(markdown.includes('第 1 段'));
});
