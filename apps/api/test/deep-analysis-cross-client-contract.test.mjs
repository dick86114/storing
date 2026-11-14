import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const apiRoute = read('../src/routes/deep-analysis.ts');
const sharedTypes = read('../../../packages/shared/src/types.ts');
const androidModels = read('../../../apps/android/app/src/main/java/com/idickies/storing/library/ArticleModels.kt');
const androidApi = read('../../../apps/android/app/src/main/java/com/idickies/storing/network/ArticleApi.kt');
const macModels = read('../../../apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Models/DeepAnalysisModels.swift');
const macArticleModels = read('../../../apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Models/ArticleModels.swift');
const webApi = read('../../../apps/web/src/lib/api.ts');

test('三端状态枚举保持一致', () => {
  for (const source of [sharedTypes, androidModels, macModels]) {
    for (const status of ['not_generated', 'queued', 'running', 'succeeded', 'failed']) {
      assert.ok(source.includes(status), status);
    }
  }
});

test('三端 API 路径保持一致', () => {
  assert.match(apiRoute, /\/articles\/:id\/deep-analysis/);
  assert.match(apiRoute, /\/articles\/:id\/deep-analysis\/versions/);
  assert.match(apiRoute, /\/articles\/:id\/deep-analysis\/:version\/restore/);
  assert.match(webApi, /\/articles\/\$\{id\}\/deep-analysis/);
  assert.match(webApi, /\/articles\/\$\{id\}\/deep-analysis\/\$\{version\}\/restore/);
  assert.match(androidApi, /articles\/\{id\}\/deep-analysis/);
  assert.match(androidApi, /articles\/\{id\}\/deep-analysis\/\{version\}\/restore/);
});

test('三端模型暴露统一的列表状态字段', () => {
  assert.match(sharedTypes, /deepAnalysis\?: ArticleDeepAnalysisSummary \| null/);
  assert.match(androidModels, /@SerialName\("deepAnalysis"\) val deepAnalysis: DeepAnalysisSummary\? = null/);
  assert.match(macArticleModels, /public let deepAnalysis: DeepAnalysisSummary\?/);
});

test('客户端不直接写普通摘要状态', () => {
  for (const source of [sharedTypes, androidModels, macModels, webApi]) {
    assert.ok(!source.includes('aiStatus ='), source);
  }
});
