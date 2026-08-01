import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const read = (path) => readFileSync(resolve(workspaceRoot, path), 'utf8');
const exists = (path) => existsSync(resolve(workspaceRoot, path));

const activeSources = [
  'apps/api/src/index.ts',
  'apps/api/src/db/schema.ts',
  'apps/api/src/routes/articles.ts',
  'apps/api/src/services/ai.service.ts',
  'apps/api/src/services/collect.service.ts',
  'apps/api/src/services/metadata-scope.service.ts',
  'apps/web/src/app/(main)/layout.tsx',
  'apps/web/src/app/globals.css',
  'apps/web/src/components/article/WechatDetailPanel.tsx',
  'apps/web/src/components/layout/DesktopTopNav.tsx',
  'apps/web/src/components/layout/MobileBottomTab.tsx',
  'apps/web/src/hooks/useCounts.ts',
  'apps/web/src/lib/api.ts',
  'apps/web/src/lib/navigation.ts',
];

test('the retired Wiki feature has no active routes, workers, UI, or article hooks', () => {
  for (const path of activeSources) {
    assert.doesNotMatch(read(path), /wiki/i, `${path} still references the retired Wiki feature`);
  }

  for (const path of [
    'apps/api/src/routes/wiki.ts',
    'apps/api/src/services/wiki.service.ts',
    'apps/api/src/services/wiki.worker.ts',
    'apps/web/src/components/content/WikiContent.tsx',
    'apps/web/src/app/(main)/wiki',
  ]) {
    assert.equal(exists(path), false, `${path} should be removed with the retired Wiki feature`);
  }
});

test('API 构建前会清理旧 dist，避免已删除的 Wiki 编译文件残留', () => {
  const packageJson = JSON.parse(read('apps/api/package.json'));
  assert.match(packageJson.scripts.build, /rmSync\('dist'/);
  assert.match(packageJson.scripts.build, /tsc$/);
});
