import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const panel = read('../src/components/article/DeepAnalysisPanel.tsx');
const api = read('../src/lib/api.ts');
const css = read('../src/app/globals.css');

test('深度报告 API 覆盖提交、读取、版本和恢复', () => {
  assert.match(api, /submitDeepAnalysis: \(id: number\) =>/);
  assert.match(api, /getDeepAnalysis: \(id: number\) =>/);
  assert.match(api, /getDeepAnalysisVersions: \(id: number\) =>/);
  assert.match(api, /restoreDeepAnalysisVersion: \(id: number, version: number\) =>/);
});

test('面板渲染九个报告分区与状态提示', () => {
  for (const heading of ['一段看懂', '核心论点', '论证链路', '关键信息与数据', '不同观点', '风险与局限', '行动指引', '延伸问题', '阅读路径']) {
    assert.ok(panel.includes(heading), heading);
  }
  assert.match(panel, /解析中|排队中/);
  assert.match(panel, /重新生成/);
  assert.match(panel, /重试/);
  assert.match(panel, /历史版本/);
});

test('面板处理离线、通知授权降级和复制 Markdown', () => {
  assert.match(panel, /const offline = online === false/);
  assert.match(panel, /当前离线，已显示缓存报告；重新生成需要网络连接/);
  assert.match(panel, /Notification\.permission/);
  assert.match(panel, /浏览器通知未授权，已使用应用内提醒/);
  assert.match(panel, /复制 Markdown/);
});

test('抽屉样式保持现有主题变量并支持窄屏', () => {
  assert.match(css, /\.deep-analysis-drawer/);
  assert.match(css.match(/\.deep-analysis-drawer\s*\{[^}]*\}/)?.[0] ?? '', /var\(--surface\)/);
  assert.match(css.match(/\.deep-analysis-section\s*\{[^}]*\}/)?.[0] ?? '', /var\(--border\)/);
});

test('报告抽屉通过 Portal 脱离菜单裁切并位于操作菜单之上', () => {
  assert.match(panel, /import \{ createPortal \} from 'react-dom'/);
  assert.match(panel, /document\.body/);
  assert.match(panel, /deep-analysis-drawer-backdrop/);

  const drawerStyle = css.match(/\.deep-analysis-drawer\s*\{[^}]*\}/)?.[0] ?? '';
  const backdropStyle = css.match(/\.deep-analysis-drawer-backdrop\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(drawerStyle, /z-index:\s*2000/);
  assert.match(backdropStyle, /z-index:\s*1900/);
});
