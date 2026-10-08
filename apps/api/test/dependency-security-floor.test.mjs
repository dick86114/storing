import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspaceRoot = new URL('../../../', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, workspaceRoot), 'utf8'));
const readWorkspace = (path) => readFileSync(new URL(path, workspaceRoot), 'utf8');

test('direct runtime dependencies meet the patched security floors', () => {
  const api = readJson('apps/api/package.json');
  const web = readJson('apps/web/package.json');
  const mcp = readJson('apps/mcp/package.json');

  assert.equal(api.dependencies['drizzle-orm'], '^0.45.2');
  assert.equal(api.dependencies.hono, '^4.12.31');
  assert.equal(api.dependencies['@hono/node-server'], '^2.0.11');
  assert.equal(web.dependencies.next, '^15.5.18');
  assert.equal(mcp.dependencies.hono, '^4.12.31');
  assert.equal(mcp.dependencies['@hono/node-server'], '^2.0.11');
});

test('transitive runtime fixes are pinned through pnpm overrides', () => {
  const root = readJson('package.json');
  assert.equal(root.pnpm?.overrides?.['fast-uri'], '3.1.4');
  assert.equal(root.pnpm?.overrides?.undici, '7.28.0');
  assert.equal(root.pnpm?.overrides?.sharp, '0.35.3');
  assert.equal(root.pnpm?.overrides?.['@hono/node-server'], '2.0.11');
  assert.equal(root.pnpm?.overrides?.postcss, '8.5.10');
  assert.equal(root.pnpm?.overrides?.['brace-expansion'], '1.1.16');
  assert.equal(root.pnpm?.overrides?.['js-yaml'], '4.3.0');
  assert.equal(root.pnpm?.overrides?.esbuild, '0.28.1');
  assert.equal(root.devDependencies.turbo, '^2.10.5');
});

test('account-level AI configuration replaces public model credentials and documentation states the trigger', () => {
  const env = readWorkspace('.env.example');
  const aiService = readWorkspace('apps/api/src/services/ai.service.ts');
  const readme = readWorkspace('README.md');
  const docker = readWorkspace('DOCKER.md');
  const functionalSpec = readWorkspace('docs/PROJECT-FUNCTIONAL-SPEC-FOR-UI.md');
  const prd = readWorkspace('docs/PRD-Readwise-Later.md');
  const categories = readWorkspace('docs/PRD-Archive-Categories.md');

  assert.match(env, /USER_AI_ENCRYPTION_KEY=/);
  for (const forbidden of [
    'AI_PROVIDER=',
    'AI_MODEL=',
    'ANTHROPIC_API_KEY=',
    'DEEPSEEK_API_KEY=',
    'ZHIPU_API_KEY=',
    'MINIMAX_API_KEY=',
    'KIMI_API_KEY=',
    'DOUBAO_API_KEY=',
    'OPENROUTER_API_KEY=',
    'NVIDIA_API_KEY=',
    'ALIYUN_API_KEY=',
    'SILICONFLOW_API_KEY=',
    'CUSTOM_AI_API_KEY=',
    'CUSTOM_AI_MODEL=',
  ]) {
    assert.doesNotMatch(env, new RegExp(`^\\s*${forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'));
  }

  assert.doesNotMatch(
    aiService,
    /process\.env\.(AI_PROVIDER|AI_MODEL|ANTHROPIC_API_KEY|DEEPSEEK_API_KEY|ZHIPU_API_KEY|MINIMAX_API_KEY|KIMI_API_KEY|DOUBAO_API_KEY|OPENROUTER_API_KEY|NVIDIA_API_KEY|ALIYUN_API_KEY|SILICONFLOW_API_KEY|CUSTOM_AI_API_KEY|CUSTOM_AI_BASE_URL|CUSTOM_AI_MODEL)/,
  );
  assert.doesNotMatch(readme, /AI_PROVIDER|DEEPSEEK_API_KEY/);
  assert.doesNotMatch(docker, /AI_PROVIDER|DEEPSEEK_API_KEY/);
  assert.match(docker, /主加密密钥丢失后需要重新录入用户 API Key/);
  assert.match(functionalSpec, /采集不生成 AI，归档按用户设置生成/);
  assert.match(prd, /采集不生成 AI，归档按用户设置生成/);
  assert.match(categories, /归档时按当前用户 AI 设置触发摘要、标签和分类/);
});
