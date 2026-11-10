import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const reader = readFileSync(new URL('../src/services/reader.service.ts', import.meta.url), 'utf8');
const singleFile = readFileSync(new URL('../src/services/singlefile.service.ts', import.meta.url), 'utf8');

test('WeChat JSON fallback parses structured data embedded in the public page when Reader returns no JSON', () => {
  assert.match(reader, /export function extractWechatEmbeddedDataFromHtml/);
  assert.match(reader, /async function fetchWechatEmbeddedData/);
  assert.match(reader, /picture_page_info_list/);
  assert.match(reader, /window\.cgiDataNew/);
  assert.match(reader, /return embeddedData;/);
});

test('picture-only WeChat articles preserve ordered image pages and their dimensions', () => {
  assert.match(reader, /className = 'wechat-picture-article'/);
  assert.match(reader, /data-seq/);
  assert.match(reader, /picture\.width/);
  assert.match(reader, /picture\.height/);
  assert.match(reader, /wechat-picture-page/);
});

test('SingleFile carousel validation and upload use the WeChat item data-src when img is still a placeholder', () => {
  assert.match(singleFile, /微信图片文章仅抓到/);
  assert.match(singleFile, /usableImageCount < expectedItemCount/);
  assert.match(singleFile, /image\.closest<HTMLElement>\('\.swiper_item'\)/);
  assert.match(singleFile, /Prefer that ancestor URL/);
});

test('WeChat inline images are hydrated before deciding to append a picture gallery', () => {
  assert.match(reader, /hydrateInlinePictureImages/);
  assert.match(reader, /image\.setAttribute\('src', picture\.cdn_url\)/);
  assert.match(reader, /usedPictureIndexes\.has\(pictureIndex\)/);
  assert.match(reader, /image\.setAttribute\('loading', 'lazy'\)/);
});

test('legacy duplicated WeChat picture galleries are rebuilt from source', () => {
  assert.match(reader, /hasLegacyWechatPictureGallery/);
  assert.match(reader, /data-storing-wechat-picture-style="true"/);
  assert.match(reader, /!hasLegacyWechatPictureGallery\(rebuilt\)/);
});

test('WeChat markdown fallback converts SingleFile HTML to text instead of storing HTML as markdown', () => {
  assert.match(reader, /format === 'html'\s*\? await fetchSingleFileCaptureContent/);
  assert.match(reader, /: await fetchSingleFileMarkdownContent/);
});
