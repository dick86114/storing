export const DEEP_ANALYSIS_INPUT_CHAR_LIMIT = 24000;
const DEEP_ANALYSIS_MAX_TOKENS = 6000;

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

function repairJsonText(value: string): string {
  let escapedNewlines = '';
  let inString = false;
  let escaped = false;
  for (const character of value) {
    if (inString) {
      if (escaped) {
        escapedNewlines += character;
        escaped = false;
      } else if (character === '\\') {
        escapedNewlines += character;
        escaped = true;
      } else if (character === '"') {
        escapedNewlines += character;
        inString = false;
      } else if (character === '\n') {
        escapedNewlines += '\\n';
      } else if (character === '\r') {
        escapedNewlines += '\\r';
      } else if (character === '\t') {
        escapedNewlines += '\\t';
      } else {
        escapedNewlines += character;
      }
    } else {
      if (character === '"') inString = true;
      escapedNewlines += character;
    }
  }

  let repaired = '';
  inString = false;
  escaped = false;
  for (let index = 0; index < escapedNewlines.length; index += 1) {
    const character = escapedNewlines[index];
    if (inString) {
      repaired += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      repaired += character;
      continue;
    }
    if (character === ',') {
      let next = index + 1;
      while (next < escapedNewlines.length && /\s/.test(escapedNewlines[next])) next += 1;
      if (escapedNewlines[next] === '}' || escapedNewlines[next] === ']') continue;
    }
    repaired += character;
  }
  return repaired;
}

function parseJsonCandidate(value: string): Record<string, unknown> | null {
  for (const candidate of [value, repairJsonText(value)]) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // 继续尝试修复后的版本。
    }
  }
  return null;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const text = raw.replace(/^\uFEFF/, '').trim();
  if (!text.includes('{')) {
    throw new Error('AI_OUTPUT_INVALID: 模型没有返回 JSON 报告');
  }

  const candidates: string[] = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }
      if (character === '"') {
        inString = true;
      } else if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          candidates.push(text.slice(start, index + 1));
          start = index;
          break;
        }
      }
    }
  }

  const parsedObjects: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);
    if (parsed) parsedObjects.push(parsed);
  }
  if (parsedObjects.length > 0) {
    const reportObjects = parsedObjects.filter((item) => 'executiveSummary' in item);
    if (reportObjects.length > 0) {
      return reportObjects.sort((left, right) => Object.keys(right).length - Object.keys(left).length)[0];
    }
    const largestObject = parsedObjects.sort((left, right) => Object.keys(right).length - Object.keys(left).length)[0];
    if (Object.keys(largestObject).length >= 5) {
      return largestObject;
    }
  }

  throw new Error('AI_OUTPUT_INVALID: 模型返回的 JSON 报告不完整或格式异常，可能被输出长度限制截断；请重新生成，若仍失败请换用输出能力更强的模型');
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
      '你是专业文章深度解析助手。使用中文输出，仅输出 JSON 对象且必须完整，不得输出 Markdown、代码围栏、注释、前后说明或尾随逗号。',
      '只依据原文分析，不得编造外部数据；区分原文事实与模型推断，关键结论尽量提供原文位置。',
      '输出结构：{"executiveSummary":"","coreArguments":[{"claim":"","evidence":"","quoteAnchor":""}],',
      '"reasoningChain":[""],"keyFacts":[{"fact":"","basis":"source 或 inference","quoteAnchor":""}],',
      '"viewpoints":[{"stance":"support 或 oppose 或 conditional","summary":"","reasoning":""}],',
      '"risks":[""],"actions":[{"action":"","condition":""}],"questions":[""],"readingPath":[""],',
      '"aiWriting":{"score":0,"summary":"","signals":[{"label":"","detail":"","leaning":"ai 或 human 或 neutral"}]}}。',
      '严格控制输出长度：executiveSummary 不超过 300 字；coreArguments 3-4 项，claim 不超过 60 字、evidence 不超过 100 字；reasoningChain 3-5 项，每项不超过 60 字。',
      'keyFacts 4-6 项，每项 fact 不超过 80 字；viewpoints 3 项，summary 不超过 40 字、reasoning 不超过 80 字；risks 3-4 项，每项不超过 60 字。',
      'actions 3-4 项，action 不超过 60 字、condition 不超过 40 字；questions 3-4 项，每项不超过 50 字；readingPath 3-4 项，每项不超过 50 字。',
      '不同观点应覆盖支持、反对或条件适用。',
      'AI 写作判断只依据文本特征：score 为 0-100，0 更像人工、100 更像 AI；summary 不超过 120 字；signals 恰好 3 条，label 不超过 12 字、detail 不超过 60 字。',
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
