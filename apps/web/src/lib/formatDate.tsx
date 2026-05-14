import { useState, useEffect } from 'react';

/**
 * 确定性日期格式 — 服务端和客户端输出完全一致
 * 仅用正则解析 ISO 字符串，不依赖运行时环境
 */
export function formatDateStatic(dateStr: string | null): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${parseInt(match[2], 10)}月${parseInt(match[3], 10)}日`;
}

/** 客户端挂载后替换为相对时间 */
function useRelativeDate(dateStr: string | null): string {
  const [text, setText] = useState(() => formatDateStatic(dateStr));

  useEffect(() => {
    if (!dateStr) { setText(''); return; }
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
    // 未来日期或当天（diff <= 0）显示具体日期或"今天"
    if (diff <= 0) {
      // 判断是否是同一天（忽略时区偏差）
      const today = new Date();
      const articleDate = new Date(dateStr);
      if (today.getFullYear() === articleDate.getFullYear() &&
          today.getMonth() === articleDate.getMonth() &&
          today.getDate() === articleDate.getDate()) {
        setText('今天');
      } else {
        setText(formatDateStatic(dateStr));
      }
    }
    else if (diff === 1) setText('昨天');
    else if (diff < 7) setText(`${diff} 天前`);
    else setText(formatDateStatic(dateStr));
  }, [dateStr]);

  return text;
}

/** 可在 map 回调中使用的日期文本组件 */
export function DateText({ dateStr, className, style }: { dateStr: string | null; className?: string; style?: React.CSSProperties }) {
  const text = useRelativeDate(dateStr);
  return <span className={className} style={style}>{text}</span>;
}
