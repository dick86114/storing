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
  coreArguments: Array<{ claim: string; evidence: string; quoteAnchor?: string | null }>;
  reasoningChain: string[];
  keyFacts: Array<{ fact: string; basis: string; quoteAnchor?: string | null }>;
  viewpoints: Array<{ stance: string; summary: string; reasoning: string }>;
  risks: string[];
  actions: Array<{ action: string; condition: string }>;
  questions: string[];
  readingPath: string[];
  aiWriting?: DeepAnalysisAiWriting | null;
};

export type DeepAnalysisReportRecord = {
  version: number;
  reportJson: DeepAnalysisReport | null;
  reportMarkdown?: string | null;
  modelSnapshot?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  contentTruncated?: boolean;
  providerSnapshot?: string | null;
  attempts?: number | null;
  durationMs?: number | null;
  generatedAt?: string | null;
};

export function formatUsageDuration(durationMs?: number | null) {
  if (!Number.isFinite(durationMs) || (durationMs ?? 0) < 0) return null;
  const seconds = Math.round((durationMs ?? 0) / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} 分 ${remainder} 秒`;
}

export type ReportSectionId =
  | 'arguments'
  | 'reasoning'
  | 'facts'
  | 'viewpoints'
  | 'risks'
  | 'actions'
  | 'questions'
  | 'readingPath';

export const REPORT_SECTIONS: Array<{ id: ReportSectionId; title: string; hint: string }> = [
  { id: 'arguments', title: '核心论点', hint: '文章最想让你相信什么' },
  { id: 'reasoning', title: '论证链路', hint: '作者怎样一步步推出结论' },
  { id: 'facts', title: '关键信息与数据', hint: '哪些信息有原文依据，哪些是 AI 推测' },
  { id: 'viewpoints', title: '不同观点', hint: '支持、反对和条件性看法分别是什么' },
  { id: 'risks', title: '风险与局限', hint: '哪些地方可能不成立' },
  { id: 'actions', title: '行动指引', hint: '你可以据此做什么' },
  { id: 'questions', title: '延伸问题', hint: '读完后还值得追问什么' },
  { id: 'readingPath', title: '阅读路径', hint: '建议按什么顺序重读原文' },
];

const SECTION_HINTS = Object.fromEntries(
  REPORT_SECTIONS.map((section) => [section.id, section.hint]),
) as Record<ReportSectionId, string>;

function compact(text: string, maxLength = 88) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

export function evidenceMix(report: DeepAnalysisReport) {
  const source = report.keyFacts.filter((item) => item.basis === 'source').length;
  const inference = Math.max(0, report.keyFacts.length - source);
  const total = source + inference;
  return {
    source,
    inference,
    total,
    sourcePercent: total > 0 ? Math.round((source / total) * 100) : 0,
    inferencePercent: total > 0 ? 100 - Math.round((source / total) * 100) : 0,
  };
}

export function stanceMix(report: DeepAnalysisReport) {
  const counts = { support: 0, oppose: 0, conditional: 0 };
  for (const viewpoint of report.viewpoints) {
    if (viewpoint.stance === 'support' || viewpoint.stance === 'oppose' || viewpoint.stance === 'conditional') {
      counts[viewpoint.stance] += 1;
    }
  }
  const total = counts.support + counts.oppose + counts.conditional;
  return {
    ...counts,
    total,
    supportPercent: total > 0 ? Math.round((counts.support / total) * 100) : 0,
    opposePercent: total > 0 ? Math.round((counts.oppose / total) * 100) : 0,
    conditionalPercent: total > 0 ? 100 - Math.round((counts.support / total) * 100) - Math.round((counts.oppose / total) * 100) : 0,
  };
}

export function stanceLabel(stance: string) {
  if (stance === 'support') return '支持';
  if (stance === 'oppose') return '反驳';
  if (stance === 'conditional') return '有条件';
  return '观点';
}

export function aiWritingBand(score?: number | null) {
  if (!Number.isFinite(score)) return null;
  const normalized = Math.max(0, Math.min(100, Math.round(score as number)));
  if (normalized < 30) {
    return {
      key: 'human' as const,
      label: '更像人工写作',
      description: '语言和细节更像个人表达，但仍可能经过 AI 润色或辅助。',
    };
  }
  if (normalized < 60) {
    return {
      key: 'mixed' as const,
      label: '人机混合或特征不明显',
      description: '既有人工表达，也有模板化或 AI 辅助的迹象，单靠文本很难判断。',
    };
  }
  return {
    key: 'ai' as const,
    label: '更像 AI 写作',
    description: '存在较多模板化或均衡化特征，建议结合来源、作者信息和原文细节核实。',
  };
}

export function aiWritingLeaningLabel(leaning: DeepAnalysisAiWritingLeaning) {
  if (leaning === 'ai') return '支持 AI';
  if (leaning === 'human') return '支持人工';
  return '中性线索';
}

export function sectionThoughts(report: DeepAnalysisReport): Record<ReportSectionId, string> {
  const evidence = evidenceMix(report);
  const stances = stanceMix(report);
  return {
    arguments: report.coreArguments[0]
      ? `文章的主判断是：${compact(report.coreArguments[0].claim, 96)}`
      : '报告没有提取出稳定的核心论点。',
    reasoning: report.reasoningChain.length > 0
      ? `作者用 ${report.reasoningChain.length} 个步骤完成论证，起点是：${compact(report.reasoningChain[0], 78)}`
      : '报告没有形成可追溯的论证链路。',
    facts: evidence.total > 0
      ? `共整理 ${evidence.total} 条关键信息，其中 ${evidence.source} 条能在原文找到依据，${evidence.inference} 条是 AI 补充的推测。`
      : '报告没有补充可核实的关键信息。',
    viewpoints: stances.total > 0
      ? `报告补充了 ${stances.total} 个观点视角，其中支持 ${stances.support} 个、反驳 ${stances.oppose} 个、有条件判断 ${stances.conditional} 个。`
      : '报告没有提取到明显的对立观点。',
    risks: report.risks[0]
      ? `最需要警惕的是：${compact(report.risks[0], 92)}`
      : '报告没有额外标注风险与局限。',
    actions: report.actions.length > 0
      ? `报告给出 ${report.actions.length} 条行动建议，优先关注：${compact(report.actions[0].action, 82)}`
      : '报告没有给出具体行动建议。',
    questions: report.questions.length > 0
      ? `还有 ${report.questions.length} 个问题值得继续追踪，首先是：${compact(report.questions[0], 80)}`
      : '报告没有留下延伸问题。',
    readingPath: report.readingPath.length > 0
      ? `建议按 ${report.readingPath.length} 个节点重读原文，从“${compact(report.readingPath[0], 56)}”开始。`
      : '报告没有生成阅读路径。',
  };
}

export function formatReportDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function reportFileStem(title?: string | null) {
  const normalized = (title || '深度报告')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${normalized || '深度报告'}-深度报告`;
}

export function buildReportMarkdown(
  report: DeepAnalysisReport,
  title?: string | null,
  generatedAt?: string | null,
) {
  const lines: string[] = [
    `# ${title || '深度报告'}`,
    '',
    `> ${report.executiveSummary}`,
    '',
  ];
  if (generatedAt) lines.push(`生成时间：${formatReportDate(generatedAt)}`, '');

  if (report.aiWriting) {
    const band = aiWritingBand(report.aiWriting.score);
    lines.push('## AI 写作倾向', '');
    lines.push(
      `**${band?.label ?? '倾向不明显'}（${report.aiWriting.score}/100，0 = 更像人工，100 = 更像 AI）**`,
      '',
      report.aiWriting.summary,
      '',
    );
    report.aiWriting.signals.forEach((item) => {
      lines.push(`- **${item.label}（${aiWritingLeaningLabel(item.leaning)}）**：${item.detail}`);
    });
    lines.push('', '> 这是基于文本特征的倾向判断，不是作者身份鉴定；改写、模板化写作和人机协作都可能造成误判。', '');
  }

  lines.push('## 核心论点', '', `> ${SECTION_HINTS.arguments}`, '');
  report.coreArguments.forEach((item) => {
    lines.push(`- **${item.claim}**：${item.evidence}`);
  });

  lines.push('', '## 论证链路', '', `> ${SECTION_HINTS.reasoning}`, '');
  report.reasoningChain.forEach((item, index) => lines.push(`${index + 1}. ${item}`));

  lines.push('', '## 关键信息与数据', '', `> ${SECTION_HINTS.facts}`, '');
  report.keyFacts.forEach((item) => {
    lines.push(`- ${item.fact}（${item.basis === 'source' ? '原文有依据' : 'AI 推测'}）`);
  });

  lines.push('', '## 不同观点', '', `> ${SECTION_HINTS.viewpoints}`, '');
  report.viewpoints.forEach((item) => {
    lines.push(`- **${stanceLabel(item.stance)}**：${item.summary}。${item.reasoning}`);
  });

  lines.push('', '## 风险与局限', '', `> ${SECTION_HINTS.risks}`, '');
  report.risks.forEach((item) => lines.push(`- ${item}`));

  lines.push('', '## 行动指引', '', `> ${SECTION_HINTS.actions}`, '');
  report.actions.forEach((item) => lines.push(`- ${item.action}（适用条件：${item.condition}）`));

  lines.push('', '## 延伸问题', '', `> ${SECTION_HINTS.questions}`, '');
  report.questions.forEach((item) => lines.push(`- ${item}`));

  lines.push('', '## 阅读路径', '', `> ${SECTION_HINTS.readingPath}`, '');
  report.readingPath.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push('', '---', '', '由乾坤戒 AI 增强阅读生成。');
  return lines.join('\n');
}
