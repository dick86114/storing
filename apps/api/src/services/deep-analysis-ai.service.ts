export const DEEP_ANALYSIS_INPUT_CHAR_LIMIT = 24000;
const DEEP_ANALYSIS_MAX_TOKENS = 4096;

export type DeepAnalysisStance = 'support' | 'oppose' | 'conditional';
export type DeepAnalysisFactBasis = 'source' | 'inference';

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
      '"risks":[""],"actions":[{"action":"","condition":""}],"questions":[""],"readingPath":[""]}。',
      '不同观点应尽量覆盖支持、反对或条件适用。',
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
  };
}

export function renderDeepAnalysisMarkdown(report: DeepAnalysisReport): string {
  const sections: string[] = [`## 一段看懂\n\n${report.executiveSummary}`];
  if (report.coreArguments.length > 0) {
    sections.push(`## 核心论点\n\n${report.coreArguments.map((item) => `- **${item.claim}**：${item.evidence}${item.quoteAnchor ? `（${item.quoteAnchor}）` : ''}`).join('\n')}`);
  }
  if (report.reasoningChain.length > 0) {
    sections.push(`## 论证链路\n\n${report.reasoningChain.map((item) => `- ${item}`).join('\n')}`);
  }
  if (report.keyFacts.length > 0) {
    sections.push(`## 关键信息与数据\n\n${report.keyFacts.map((item) => `- ${item.fact}（${item.basis === 'source' ? '原文事实' : '模型推断'}${item.quoteAnchor ? `；${item.quoteAnchor}` : ''}）`).join('\n')}`);
  }
  if (report.viewpoints.length > 0) {
    const stanceText = { support: '支持', oppose: '反对', conditional: '条件适用' };
    sections.push(`## 不同观点\n\n${report.viewpoints.map((item) => `- **${stanceText[item.stance]}：${item.summary}** ${item.reasoning}`).join('\n')}`);
  }
  if (report.risks.length > 0) {
    sections.push(`## 风险与局限\n\n${report.risks.map((item) => `- ${item}`).join('\n')}`);
  }
  if (report.actions.length > 0) {
    sections.push(`## 行动指引\n\n${report.actions.map((item) => `- ${item.action}（${item.condition}）`).join('\n')}`);
  }
  if (report.questions.length > 0) {
    sections.push(`## 延伸问题\n\n${report.questions.map((item) => `- ${item}`).join('\n')}`);
  }
  if (report.readingPath.length > 0) {
    sections.push(`## 阅读路径\n\n${report.readingPath.map((item) => `- ${item}`).join('\n')}`);
  }
  return `${sections.join('\n\n')}\n`;
}
