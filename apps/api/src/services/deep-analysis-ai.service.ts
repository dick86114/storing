export const DEEP_ANALYSIS_INPUT_CHAR_LIMIT = 24000;
const DEEP_ANALYSIS_MAX_TOKENS = 4800;

export type DeepAnalysisStance = 'support' | 'oppose' | 'conditional';
export type DeepAnalysisFactBasis = 'source' | 'inference';
export type DeepAnalysisAiWritingLeaning = 'ai' | 'human' | 'neutral';

export type DeepAnalysisAiWritingSignal = {
  label: string;
  detail: string;
  leaning: DeepAnalysisAiWritingLeaning;
};

export type DeepAnalysisAiWriting = {
  score: number;
  summary: string;
  signals: DeepAnalysisAiWritingSignal[];
};

export type DeepAnalysisReport = {
  executiveSummary: string;
  coreArguments: Array<{ claim: string; evidence: string; quoteAnchor: string | null }>;
  reasoningChain: string[];
  keyFacts: Array<{ fact: string; basis: DeepAnalysisFactBasis; quoteAnchor: string | null }>;
  viewpoints: Array<{ stance: DeepAnalysisStance; summary: string; reasoning: string }>;
  risks: string[];
  actions: Array<{ action: string; condition: string }>;
  questions: string[];
  readingPath: string[];
  aiWriting: DeepAnalysisAiWriting;
};

type DeepAnalysisPrompt = {
  system: string;
  user: string;
  maxTokens: number;
  contentTruncated: boolean;
};

function truncateText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength).trim();
}

function truncateAnchor(value: unknown): string | null {
  const anchor = truncateText(value, 160);
  return anchor || null;
}

function truncateList(value: unknown, maxLength: number, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => truncateText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`AI_OUTPUT_INVALID: ${label}必须为数组`);
  }
  return value;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const text = (fenced?.[1] ?? trimmed).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('AI_OUTPUT_INVALID: 模型输出不是有效 JSON 对象');
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not-object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('AI_OUTPUT_INVALID: 模型输出不是有效 JSON 对象');
  }
}

function parseCoreArguments(value: unknown) {
  return requireArray(value, '核心论点').slice(0, 8).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`AI_OUTPUT_INVALID: 核心论点第 ${index + 1} 项无效`);
    }
    const record = item as Record<string, unknown>;
    const claim = truncateText(record.claim, 300);
    const evidence = truncateText(record.evidence, 500);
    if (!claim || !evidence) {
      throw new Error(`AI_OUTPUT_INVALID: 核心论点第 ${index + 1} 项缺少主张或依据`);
    }
    return { claim, evidence, quoteAnchor: truncateAnchor(record.quoteAnchor) };
  });
}

function parseKeyFacts(value: unknown) {
  return requireArray(value, '关键信息').slice(0, 12).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`AI_OUTPUT_INVALID: 关键信息第 ${index + 1} 项无效`);
    }
    const record = item as Record<string, unknown>;
    const fact = truncateText(record.fact, 400);
    const basis = record.basis;
    const validBasis: DeepAnalysisFactBasis | null = basis === 'source' || basis === 'inference'
      ? basis
      : null;
    if (!fact || !validBasis) {
      throw new Error(`AI_OUTPUT_INVALID: 关键信息第 ${index + 1} 项缺少事实或有效依据类型`);
    }
    return { fact, basis: validBasis, quoteAnchor: truncateAnchor(record.quoteAnchor) };
  });
}

function parseViewpoints(value: unknown) {
  return requireArray(value, '不同观点').slice(0, 8).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`AI_OUTPUT_INVALID: 不同观点第 ${index + 1} 项无效`);
    }
    const record = item as Record<string, unknown>;
    const stance = record.stance;
    const summary = truncateText(record.summary, 120);
    const reasoning = truncateText(record.reasoning, 400);
    if (stance !== 'support' && stance !== 'oppose' && stance !== 'conditional') {
      throw new Error(`AI_OUTPUT_INVALID: 不同观点第 ${index + 1} 项立场无效`);
    }
    const typedStance: DeepAnalysisStance = stance;
    if (!summary || !reasoning) {
      throw new Error(`AI_OUTPUT_INVALID: 不同观点第 ${index + 1} 项缺少摘要或理由`);
    }
    return { stance: typedStance, summary, reasoning };
  });
}

function parseActions(value: unknown) {
  return requireArray(value, '行动指引').slice(0, 8).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`AI_OUTPUT_INVALID: 行动指引第 ${index + 1} 项无效`);
    }
    const record = item as Record<string, unknown>;
    const action = truncateText(record.action, 300);
    const condition = truncateText(record.condition, 200);
    if (!action || !condition) {
      throw new Error(`AI_OUTPUT_INVALID: 行动指引第 ${index + 1} 项缺少动作或条件`);
    }
    return { action, condition };
  });
}

function parseAiWriting(value: unknown): DeepAnalysisAiWriting {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI_OUTPUT_INVALID: AI 写作判断无效');
  }
  const record = value as Record<string, unknown>;
  const rawScore = typeof record.score === 'number'
    ? record.score
    : typeof record.score === 'string' && record.score.trim()
      ? Number(record.score)
      : Number.NaN;
  if (!Number.isFinite(rawScore)) {
    throw new Error('AI_OUTPUT_INVALID: AI 写作判断缺少有效分数');
  }
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const summary = truncateText(record.summary, 300);
  if (!summary) {
    throw new Error('AI_OUTPUT_INVALID: AI 写作判断缺少说明');
  }
  const rawSignals = requireArray(record.signals, 'AI 写作判断依据');
  const signals = rawSignals.slice(0, 6).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`AI_OUTPUT_INVALID: AI 写作判断依据第 ${index + 1} 项无效`);
    }
    const signal = item as Record<string, unknown>;
    const label = truncateText(signal.label, 24);
    const detail = truncateText(signal.detail, 160);
    if (!label || !detail) {
      throw new Error(`AI_OUTPUT_INVALID: AI 写作判断依据第 ${index + 1} 项缺少标题或说明`);
    }
    const leaning: DeepAnalysisAiWritingLeaning = signal.leaning === 'ai' || signal.leaning === 'human'
      ? signal.leaning
      : 'neutral';
    return { label, detail, leaning };
  });
  if (signals.length === 0) {
    throw new Error('AI_OUTPUT_INVALID: AI 写作判断至少需要一条依据');
  }
  return { score, summary, signals };
}

export function buildDeepAnalysisPrompt(input: {
  title: string;
  summary: string;
  content: string;
}): DeepAnalysisPrompt {
  const contentTruncated = input.content.length > DEEP_ANALYSIS_INPUT_CHAR_LIMIT;
  const content = contentTruncated
    ? `${input.content.slice(0, DEEP_ANALYSIS_INPUT_CHAR_LIMIT)}（已截断到 24000 个字符）`
    : input.content;

  return {
    system: [
      '你是专业文章深度解析助手。使用中文输出，仅输出 JSON，不得输出解释或 Markdown。',
      '只依据原文分析，不得编造外部数据；区分原文事实与模型推断，关键结论尽量提供原文位置。',
      '输出结构：{"executiveSummary":"不超过 1000 字","coreArguments":[{"claim":"","evidence":"","quoteAnchor":""}],',
      '"reasoningChain":[""],"keyFacts":[{"fact":"","basis":"source 或 inference","quoteAnchor":""}],',
      '"viewpoints":[{"stance":"support 或 oppose 或 conditional","summary":"","reasoning":""}],',
      '"risks":[""],"actions":[{"action":"","condition":""}],"questions":[""],"readingPath":[""],',
      '"aiWriting":{"score":0,"summary":"","signals":[{"label":"","detail":"","leaning":"ai 或 human 或 neutral"}]}}。',
      '不同观点应尽量覆盖支持、反对或条件适用。',
      'AI 写作判断只依据文本特征：score 为 0-100，0 更像人工、100 更像 AI；signals 至少 3 条、最多 6 条。',
      '判断依据要具体到用词、句式、段落结构、细节密度、引用方式和情绪表达，不得编造文本中不存在的特征。',
      '不要断言作者身份，不要使用“AI 检测器”“抄袭”或确定性结论；证据不足时 score 放在 40-60 并说明不确定。',
      '仅为“写得规范”“结构工整”时不要直接判为 AI，学术写作、编辑润色和人机协作都可能造成相似特征。',
    ].join(''),
    user: JSON.stringify({
      title: input.title,
      summary: input.summary,
      content,
    }),
    maxTokens: DEEP_ANALYSIS_MAX_TOKENS,
    contentTruncated,
  };
}

export function parseDeepAnalysisReport(raw: string): DeepAnalysisReport {
  const parsed = parseJsonObject(raw);
  const executiveSummary = truncateText(parsed.executiveSummary, 1000);
  if (!executiveSummary) {
    throw new Error('AI_OUTPUT_INVALID: 执行摘要不能为空');
  }
  const coreArguments = parseCoreArguments(parsed.coreArguments);
  const reasoningChain = requireArray(parsed.reasoningChain, '论证链路')
    .map((item) => truncateText(item, 500))
    .filter(Boolean)
    .slice(0, 12);
  const keyFacts = parseKeyFacts(parsed.keyFacts);
  const viewpoints = parseViewpoints(parsed.viewpoints);
  const risks = requireArray(parsed.risks, '风险与局限')
    .map((item) => truncateText(item, 400))
    .filter(Boolean)
    .slice(0, 8);
  const actions = parseActions(parsed.actions);
  const questions = requireArray(parsed.questions, '延伸问题')
    .map((item) => truncateText(item, 300))
    .filter(Boolean)
    .slice(0, 10);
  const readingPath = requireArray(parsed.readingPath, '阅读路径')
    .map((item) => truncateText(item, 300))
    .filter(Boolean)
    .slice(0, 10);
  const aiWriting = parseAiWriting(parsed.aiWriting);

  return {
    executiveSummary,
    coreArguments,
    reasoningChain,
    keyFacts,
    viewpoints,
    risks,
    actions,
    questions,
    readingPath,
    aiWriting,
  };
}

export function renderDeepAnalysisMarkdown(report: DeepAnalysisReport): string {
  const sections: string[] = [`## 一段看懂\n\n${report.executiveSummary}`];
  if (report.coreArguments.length > 0) {
    sections.push(`## 核心论点\n\n> 文章最想让你相信什么\n\n${report.coreArguments.map((item) => `- **${item.claim}**：${item.evidence}${item.quoteAnchor ? `（${item.quoteAnchor}）` : ''}`).join('\n')}`);
  }
  if (report.reasoningChain.length > 0) {
    sections.push(`## 论证链路\n\n> 作者怎样一步步推出结论\n\n${report.reasoningChain.map((item) => `- ${item}`).join('\n')}`);
  }
  if (report.keyFacts.length > 0) {
    sections.push(`## 关键信息与数据\n\n> 哪些信息有原文依据，哪些是 AI 推测\n\n${report.keyFacts.map((item) => `- ${item.fact}（${item.basis === 'source' ? '原文有依据' : 'AI 推测'}${item.quoteAnchor ? `；${item.quoteAnchor}` : ''}）`).join('\n')}`);
  }
  if (report.viewpoints.length > 0) {
    const stanceText = { support: '支持', oppose: '反对', conditional: '条件适用' };
    sections.push(`## 不同观点\n\n> 支持、反对和条件性看法分别是什么\n\n${report.viewpoints.map((item) => `- **${stanceText[item.stance]}：${item.summary}** ${item.reasoning}`).join('\n')}`);
  }
  if (report.risks.length > 0) {
    sections.push(`## 风险与局限\n\n> 哪些地方可能不成立\n\n${report.risks.map((item) => `- ${item}`).join('\n')}`);
  }
  if (report.actions.length > 0) {
    sections.push(`## 行动指引\n\n> 你可以据此做什么\n\n${report.actions.map((item) => `- ${item.action}（${item.condition}）`).join('\n')}`);
  }
  if (report.questions.length > 0) {
    sections.push(`## 延伸问题\n\n> 读完后还值得追问什么\n\n${report.questions.map((item) => `- ${item}`).join('\n')}`);
  }
  if (report.readingPath.length > 0) {
    sections.push(`## 阅读路径\n\n> 建议按什么顺序重读原文\n\n${report.readingPath.map((item) => `- ${item}`).join('\n')}`);
  }
  if (report.aiWriting) {
    const band = report.aiWriting.score >= 60
      ? '更像 AI 写作'
      : report.aiWriting.score >= 30
        ? '人机混合或特征不明显'
        : '更像人工写作';
    const leaningText = { ai: '支持 AI', human: '支持人工', neutral: '中性线索' };
    sections.push([
      '## AI 写作倾向',
      '',
      `**${band}（${report.aiWriting.score}/100，0 = 更像人工，100 = 更像 AI）**`,
      '',
      report.aiWriting.summary,
      '',
      report.aiWriting.signals.map((item) => `- **${item.label}（${leaningText[item.leaning]}）**：${item.detail}`).join('\n'),
      '',
      '> 这是基于文本特征的倾向判断，不是作者身份鉴定；改写、模板化写作和人机协作都可能造成误判。',
    ].join('\n'));
  }
  return `${sections.join('\n\n')}\n`;
}
