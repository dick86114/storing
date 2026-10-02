export interface WeChatTranscriptRecord {
  sender: string;
  /** 解析失败时为 null，正文仍完整保留在 Markdown 里。 */
  date: Date | null;
  dateText: string;
  text: string;
}

export type WeChatMediaKind = 'image' | 'video' | 'audio' | 'file';

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

/** 聊天记录渲染为 Markdown；媒体统一追加到文末，图床 URL 失败时保留原文件名标注。 */
export function renderWeChatTranscriptMarkdown(input: {
  records: WeChatTranscriptRecord[];
  media: Array<{ name: string; url: string | null; kind: WeChatMediaKind }>;
}): string {
  const lines: string[] = [];
  for (const record of input.records) {
    lines.push(`**${record.sender}** · ${record.dateText}`);
    if (record.text) lines.push(record.text);
    lines.push('');
  }
  if (input.media.length > 0) {
    lines.push('---', '', '### 媒体附件', '');
    for (const item of input.media) {
      if (item.url) {
        if (item.kind === 'image') lines.push(`![${item.name}](${item.url})`);
        else if (item.kind === 'video') lines.push(`[视频：${item.name}](${item.url})`);
        else if (item.kind === 'audio') lines.push(`[语音：${item.name}](${item.url})`);
        else lines.push(`[文件：${item.name}](${item.url})`);
      } else {
        lines.push(`- ${item.name}（未能上传到图床）`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trim();
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

/**
 * 聊天记录渲染为阅读器可直接使用的 HTML。
 * 与 Markdown 渲染保持同一结构：消息列表 + 媒体附件，方便两种格式互相对应。
 */
export function renderWeChatTranscriptHtml(input: {
  records: WeChatTranscriptRecord[];
  media: Array<{ name: string; url: string | null; kind: WeChatMediaKind }>;
}): string {
  const messages = input.records.map((record) => {
    const meta = `<p class="wechat-message-meta"><strong>${renderInline(record.sender)}</strong> · ${escapeHtml(record.dateText)}</p>`;
    const body = record.text
      .split('\n')
      .map((line) => renderInline(line))
      .join('<br>');
    return `<div class="wechat-message">${meta}${body ? `<p>${body}</p>` : ''}</div>`;
  });

  const mediaBlocks = input.media.map((item) => {
    if (item.kind === 'image' && item.url) {
      return `<p><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}" /></p>`;
    }
    const label = item.kind === 'video' ? '视频' : item.kind === 'audio' ? '语音' : '文件';
    if (item.url) {
      return `<p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${label}：${escapeHtml(item.name)}</a></p>`;
    }
    return `<p>${escapeHtml(item.name)}（未能上传到图床）</p>`;
  });

  const mediaSection =
    input.media.length > 0
      ? `<hr /><h3>媒体附件</h3>${mediaBlocks.join('')}`
      : '';

  return `<div class="wechat-chat">${messages.join('')}${mediaSection}</div>`;
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
