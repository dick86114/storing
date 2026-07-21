import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const detailPanel = readFileSync(new URL('../src/components/article/WechatDetailPanel.tsx', import.meta.url), 'utf8');

test('captured WeChat carousels replace the removed source script with safe thumbnail switching', () => {
  assert.match(detailPanel, /function initializeCapturedCarousels\(/);
  assert.match(detailPanel, /root\.querySelectorAll<HTMLElement>\('\.swiper_indicator_item_pc'\)/);
  assert.match(detailPanel, /stageImage\.setAttribute\('src', imageSources\[index\]\);/);
  assert.match(detailPanel, /indicator\.addEventListener\('click', \(event\) =>/);
  assert.ok(detailPanel.includes("image.closest<HTMLElement>('[data-src]')?.getAttribute('data-src')"));
  assert.match(detailPanel, /initializeCapturedCarousels\(doc, updateHeight\);/);
});

test('captured carousel handles clicks that land on the source page overlay instead of the indicator node', () => {
  assert.match(detailPanel, /root\.addEventListener\('click', \(event\) =>/);
  assert.match(detailPanel, /const indicatorBounds = indicatorWrap\.getBoundingClientRect\(\);/);
  assert.match(detailPanel, /const index = Math\.min\(items\.length - 1, Math\.max\(0, Math\.floor\(/);
  assert.match(detailPanel, /indicatorWrap\.style\.pointerEvents = 'auto';/);
});

test('carousel initialization supports current WeChat captures without the legacy img_list wrapper', () => {
  assert.match(detailPanel, /root\.querySelectorAll<HTMLElement>\('\.share_media \.swiper_item'\)/);
});

test('carousel replaces the captured source track with one local image stage to prevent the first slide from overlaying later slides', () => {
  assert.match(detailPanel, /const media = root\.querySelector<HTMLElement>\('\.share_media'\);/);
  assert.match(detailPanel, /media\.replaceChildren\(stage\);/);
  assert.match(detailPanel, /stageImage\.setAttribute\('src', imageSources\[index\]\);/);
});

test('a multi-image carousel hides the sibling SingleFile placeholder carousel that otherwise overlays the active stage', () => {
  assert.match(detailPanel, /const placeholderCarousels = Array\.from\(root\.parentElement\?\.querySelectorAll<HTMLElement>\('\.share_media_swiper_wrp'\) \?\? \[\]\)/);
  assert.match(detailPanel, /placeholder\.style\.display = 'none';/);
});
