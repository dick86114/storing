import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const detailPanel = read('../src/components/article/WechatDetailPanel.tsx');
const css = read('../src/app/globals.css');

test('手动重新生成会等待任务离开队列并报告失败原因', () => {
  assert.match(detailPanel, /const AI_POLL_INTERVAL_MS = 1000;/);
  assert.match(detailPanel, /const AI_POLL_TIMEOUT_MS = 90_000;/);
  assert.match(detailPanel, /async function waitForArticleAiCompletion\(/);
  assert.match(detailPanel, /\(latest\.aiStatus === 'queued' \|\| latest\.aiStatus === 'running'\)/);

  const handle = detailPanel.match(/async function handleRegenerateAI\(\)[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.ok(handle, 'handleRegenerateAI implementation should be present');
  assert.match(handle, /const settled = await waitForArticleAiCompletion\(article\.id, htmlVariant\)/);
  assert.match(handle, /if \(settled\.aiStatus === 'failed'\)/);
  assert.match(handle, /settled\.aiErrorMessage \|\| settled\.aiErrorCode \|\| '重新生成摘要失败'/);
  assert.match(handle, /AI 生成仍在后台执行/);
});

test('详情 AI 状态使用紧凑状态条，失败原因可读', () => {
  const aiStatusRule = css.match(/\.detail-panel-ai-status\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(aiStatusRule, /display: inline-flex;/);
  assert.match(aiStatusRule, /width: fit-content;/);
  assert.match(aiStatusRule, /padding: 6px 8px;/);
  assert.match(aiStatusRule, /max-width: 100%;/);

  const reasonRule = css.match(/\.detail-panel-category-review-reason\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(reasonRule, /white-space: normal;/);
  assert.match(reasonRule, /word-break: break-word;/);
  assert.match(reasonRule, /line-height: 1\.45;/);
  assert.doesNotMatch(reasonRule, /white-space: nowrap|text-overflow: ellipsis/);
});

test('AI 分类依据通过图标入口和浮层展示', () => {
  assert.match(detailPanel, /InfoCircleOutlined/);
  assert.match(detailPanel, /categoryReasonOpen/);
  assert.match(detailPanel, /detail-panel-category-reason-trigger/);
  assert.match(detailPanel, /aria-expanded=\{categoryReasonOpen\}/);
  assert.match(detailPanel, /detail-panel-category-review-popover/);
  assert.match(detailPanel, /AI 分类依据/);
  assert.match(detailPanel, /\{article\.categoryResult\.reason\}/);

  const statusRule = css.match(/\.detail-panel-category-status\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(statusRule, /position: relative;/);

  const triggerRule = css.match(/\.detail-panel-category-reason-trigger\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(triggerRule, /width: 20px;/);
  assert.match(triggerRule, /height: 20px;/);

  const popoverRule = css.match(/\.detail-panel-category-review-popover\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(popoverRule, /position: absolute;/);
  assert.match(popoverRule, /max-width: min\(520px, calc\(100vw - 80px\)\);/);
});

test('桌面详情操作栏固定在面板底部', () => {
  const footerStyle = detailPanel.match(
    /className="detail-panel-footer"[\s\S]*?position: 'fixed',[\s\S]*?bottom: 0,[\s\S]*?width: 'inherit',/,
  );
  assert.ok(footerStyle, 'footer should be fixed to the viewport bottom');

  const desktopFooter = css.match(
    /body\.detail-panel-open \.detail-panel\.wechat-detail-panel:not\(\.mobile-detail-panel\) \.detail-panel-footer\s*\{[^}]*\}/,
  )?.[0] ?? '';
  assert.match(desktopFooter, /right: 0 !important;/);
  assert.match(desktopFooter, /left: auto !important;/);
  assert.match(desktopFooter, /width: inherit !important;/);

  const panelRule = css.match(
    /body\.detail-panel-open \.detail-panel\.wechat-detail-panel:not\(\.mobile-detail-panel\)\s*\{[^}]*\}/,
  )?.[0] ?? '';
  assert.match(panelRule, /padding-bottom: 66px;/);
  assert.match(panelRule, /box-sizing: border-box;/);
});
