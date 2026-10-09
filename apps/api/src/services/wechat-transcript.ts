export interface WeChatTranscriptRecord {
  sender: string;
  /** 解析失败时为 null，正文仍完整保留在 Markdown 里。 */
  date: Date | null;
  dateText: string;
  text: string;
}

export type WeChatMediaKind = 'image' | 'video' | 'audio' | 'file';

export interface WeChatMediaAttachment {
  url: string | null;
  kind: WeChatMediaKind;
}

/** 文件名 → 附件；微信 TXT 里媒体消息以「[图片] 文件名」形式引用。 */
export type WeChatMediaMap = Map<string, WeChatMediaAttachment>;

/**
 * 解析 macOS 微信合并转发导出的「聊天记录.txt」。
 * 每条消息的固定格式：
 *   ·昵称
 *   2024年1月1日 12:34
 *   正文（可多行）
 */
export function parseWeChatTranscript(body: string): WeChatTranscriptRecord[] {
  const normalized = body.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const pattern = /^·([^\n]+)\n(\d{4}年\d{1,2}月\d{1,2}日 \d{2}:\d{2})\n/gm;
  const matches = [...normalized.matchAll(pattern)];
  if (matches.length === 0) return [];

  const records: WeChatTranscriptRecord[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    const dateText = match[2];
    const dateMatch = /^(\d{4})年(\d{1,2})月(\d{1,2})日 (\d{2}):(\d{2})$/.exec(dateText);
    const date = dateMatch
      ? new Date(
          Number(dateMatch[1]),
          Number(dateMatch[2]) - 1,
          Number(dateMatch[3]),
          Number(dateMatch[4]),
          Number(dateMatch[5]),
        )
      : null;
    records.push({
      sender: match[1].trim(),
      date,
      dateText,
      text: normalized.slice(start, end).trim(),
    });
  }
  return records;
}

/**
 * 解析微信「逐条转发」导出的消息列表。
 * 该格式只有「·消息内容」段落，不包含发送人和时间，因此用序号保留消息边界。
 */
export function parseWeChatIndividualTranscript(body: string): WeChatTranscriptRecord[] {
  const normalized = body.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.startsWith('·'))
    .map((block, index) => ({
      sender: `消息 ${index + 1}`,
      date: null,
      dateText: '时间未提供',
      text: block.replace(/^·/, '').trim(),
    }));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 行内加粗与转义；聊天正文不包含更复杂的 Markdown 结构。 */
function renderInline(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** 从「[图片] 文件名」格式的正文行提取媒体引用。 */
function matchMediaPlaceholder(line: string): { label: string; filename: string } | null {
  const match = /^\[(图片|视频|语音|文件)\]\s*(.+?)\s*$/.exec(line.trim());
  if (!match) return null;
  return { label: match[1], filename: match[2] };
}

function messageTime(dateText: string): string {
  return dateText.split(' ').pop() ?? dateText;
}

function headDate(records: WeChatTranscriptRecord[]): string | undefined {
  return records[0] ? /^\d{4}年\d{1,2}月\d{1,2}日/.exec(records[0].dateText)?.[0] : undefined;
}

/** 聊天记录渲染为 Markdown：微信时间线排版，媒体按消息顺序内联。 */
export function renderWeChatTranscriptMarkdown(input: {
  records: WeChatTranscriptRecord[];
  mediaMap: WeChatMediaMap;
}): string {
  const used = new Set<string>();
  const lines: string[] = [];

  if (input.records.length > 0) {
    lines.push('# 聊天记录');
    const date = headDate(input.records);
    if (date) lines.push(date);
    lines.push('');
  }

  for (const record of input.records) {
    lines.push(`**${record.sender}** · ${messageTime(record.dateText)}`);
    for (const line of record.text.split('\n')) {
      const placeholder = matchMediaPlaceholder(line);
      const attachment = placeholder ? input.mediaMap.get(placeholder.filename) : undefined;
      if (placeholder && attachment) {
        used.add(placeholder.filename);
        if (attachment.url) {
          lines.push(
            attachment.kind === 'image'
              ? `![${placeholder.filename}](${attachment.url})`
              : `[${placeholder.label}：${placeholder.filename}](${attachment.url})`,
          );
        } else {
          lines.push(`> ${placeholder.label} ${placeholder.filename}（未能上传到图床）`);
        }
      } else if (placeholder) {
        // 微信导出时过期媒体不会打进 ZIP，只留下占位符。
        lines.push(`> ${placeholder.label}（未随聊天记录导出）`);
      } else if (line.trim()) {
        lines.push(line);
      }
    }
    lines.push('', '---', '');
  }

  const leftovers = [...input.mediaMap.entries()].filter(([name]) => !used.has(name));
  if (leftovers.length > 0) {
    lines.push('### 其他附件', '');
    for (const [name, attachment] of leftovers) {
      if (attachment.url) {
        lines.push(attachment.kind === 'image' ? `![${name}](${attachment.url})` : `[${name}](${attachment.url})`);
      } else {
        lines.push(`- ${name}（未能上传到图床）`);
      }
    }
  }
  return lines.join('\n').trim();
}

/**
 * 聊天记录渲染为阅读器可直接使用的 HTML。
 * 微信「聊天记录」样式：发送人 + 时间头部、正文按消息顺序内联媒体、消息间分隔线。
 */
export function renderWeChatTranscriptHtml(input: {
  records: WeChatTranscriptRecord[];
  mediaMap: WeChatMediaMap;
}): string {
  const used = new Set<string>();

  const renderMediaHtml = (filename: string, attachment: WeChatMediaAttachment, label: string): string => {
    used.add(filename);
    if (!attachment.url) {
      return `<p class="wechat-missing">${escapeHtml(`${label} ${filename}（未能上传到图床）`)}</p>`;
    }
    if (attachment.kind === 'image') {
      return `<p><img src="${escapeHtml(attachment.url)}" alt="${escapeHtml(filename)}" /></p>`;
    }
    return `<p><a href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(`${label}：${filename}`)}</a></p>`;
  };

  const messages = input.records.map((record) => {
    const body = record.text
      .split('\n')
      .map((line) => {
        const placeholder = matchMediaPlaceholder(line);
        const attachment = placeholder ? input.mediaMap.get(placeholder.filename) : undefined;
        if (placeholder && attachment) {
          return renderMediaHtml(placeholder.filename, attachment, placeholder.label);
        }
        if (placeholder) {
          return `<p class="wechat-missing">（${escapeHtml(placeholder.label)}未随聊天记录导出）</p>`;
        }
        return line.trim() ? `<p>${renderInline(line)}</p>` : '';
      })
      .join('');
    return [
      '<div class="wechat-msg">',
      `<div class="wechat-msg-head"><span class="wechat-msg-sender">${renderInline(record.sender)}</span><span class="wechat-msg-time">${escapeHtml(messageTime(record.dateText))}</span></div>`,
      `<div class="wechat-msg-body">${body}</div>`,
      '</div>',
    ].join('');
  });

  const leftovers = [...input.mediaMap.entries()].filter(([name]) => !used.has(name));
  const leftoverSection =
    leftovers.length > 0
      ? [
          '<hr />',
          '<h3>其他附件</h3>',
          ...leftovers.map(([name, attachment]) => renderMediaHtml(name, attachment, '附件')),
        ].join('')
      : '';

  const date = headDate(input.records);
  const head =
    input.records.length > 0
      ? `<div class="wechat-chat-head"><p class="wechat-chat-title">聊天记录</p>${date ? `<p class="wechat-chat-date">${escapeHtml(date)}</p>` : ''}</div>`
      : '';

  return [
    '<style>',
    '.wechat-chat{max-width:100%;min-width:0;}',
    '.wechat-chat, .wechat-chat *{overflow-wrap:anywhere;word-break:break-word;}',
    '.wechat-chat-head{text-align:center;padding:8px 0 4px;}',
    '.wechat-chat-title{font-size:15px;font-weight:600;margin:0;}',
    '.wechat-chat-date{font-size:12px;opacity:.6;margin:4px 0 12px;}',
    '.wechat-msg{padding:12px 0;border-bottom:1px solid rgba(128,128,128,.18);}',
    '.wechat-msg-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;}',
    '.wechat-msg-sender{font-size:13px;font-weight:600;}',
    '.wechat-msg-time{font-size:12px;opacity:.55;}',
    '.wechat-msg-body{font-size:15px;line-height:1.6;}',
    '.wechat-msg-body{min-width:0;}',
    '.wechat-msg-body p a{overflow-wrap:anywhere;}',
    '.wechat-msg-body p{margin:0 0 8px;}',
    '.wechat-msg-body img{max-width:100%;border-radius:8px;}',
    '.wechat-missing{opacity:.65;}',
    '</style>',
    `<div class="wechat-chat">${head}${messages.join('')}${leftoverSection}</div>`,
  ].join('');
}

/** 非聊天记录格式的纯文本分享：保留原文段落结构，套用同一套阅读样式。 */
export function renderWeChatPlainTextHtml(text: string): string {
  const paragraphs = text
    .replace(/^\uFEFF/, '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const body = escapeHtml(paragraph).replace(/\n/g, '<br>');
      return `<p>${body}</p>`;
    });

  return [
    '<style>',
    '.wechat-chat{max-width:100%;min-width:0;}',
    '.wechat-chat, .wechat-chat *{overflow-wrap:anywhere;word-break:break-word;}',
    '.wechat-plain-text p{font-size:15px;line-height:1.7;margin:0 0 14px;}',
    '</style>',
    `<div class="wechat-chat wechat-plain-text">${paragraphs.join('') || '<p>（无正文）</p>'}</div>`,
  ].join('');
}

export function detectWeChatMediaKind(filename: string): WeChatMediaKind {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'm4v', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'm4a', 'aac', 'wav', 'amr', 'silk'].includes(ext)) return 'audio';
  return 'file';
}

export function guessWeChatMime(filename: string, fallback: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    gif: 'image/gif', avif: 'image/avif', heic: 'image/heic',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
    txt: 'text/plain; charset=utf-8', html: 'text/html; charset=utf-8',
  };
  return map[ext] || (fallback && fallback !== 'application/octet-stream' ? fallback : 'application/octet-stream');
}

/** 校验 ZIP entry 名称，拒绝路径穿越与控制字符；返回安全的最末文件名。 */
export function safeZipEntryName(rawName: string): string | null {
  if (!rawName || rawName.endsWith('/')) return null;
  if (rawName.includes('\\') || /[\u0000-\u001f]/.test(rawName)) return null;
  const parts = rawName.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return parts[parts.length - 1];
}
