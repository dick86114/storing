# 账号级 AI 配置与归档触发实施计划

> **给执行代理的要求：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐项执行。步骤使用 `- [ ]` 复选框跟踪。

**目标：** 将 AI 触发从采集阶段后移到归档动作，并让每个用户使用自己加密保存的大模型配置生成摘要、标签和分类。

**架构：** 先统一所有保存型采集到收件箱并移除采集阶段 AI；再引入账号级模型配置、加密 Key、模型发现和用户 AI 设置接口；随后用可恢复任务队列执行合并生成，并把归档、手动生成、分类优化和 MCP 显式摘要接到用户配置；最后补齐 Web、Android、macOS 的设置与状态界面。

**技术栈：** Hono、Drizzle、PostgreSQL、Node.js crypto、fetch、Next.js、React、SWR、Kotlin、Coroutines、Hilt、Retrofit、kotlinx.serialization、SwiftUI、Swift Concurrency。

**设计文档：** `docs/superpowers/specs/2026-10-08-user-ai-configuration-design.md`

## 全局约束

- 所有新增注释、文档和用户可见文案使用中文。
- 前端包管理必须使用 `pnpm`，禁止使用 `npm`。
- 所有采集入口只抓取和入库，不调用摘要、标签或分类模型。
- 所有保存型采集统一进入收件箱，`is_archived = false`。
- 归档是唯一自动触发 AI 的动作；显式手动生成和 MCP `summarize_url` 不受自动开关影响。
- `auto_trigger_on_archive` 默认值必须是 `false`。
- 手动选择分类归档时仍生成摘要和标签，但跳过 AI 分类。
- 发布不要求 AI 摘要或标签。
- API Key 使用 AES-256-GCM 加密存储，任何响应不得返回明文。
- 用户模型调用不得回退服务端公共模型 Key。
- Custom Base URL 只允许 HTTPS 公网地址，禁止内网、环回和保留地址。
- 归档 AI 任务每用户并发为 1，自动重试最多 2 次额外尝试。
- 正文输入截断初始值为 24,000 个字符。
- 每个任务必须先写失败测试，再实现，再运行该任务声明的验证命令。
- 每个任务完成后独立提交；不得把当前工作区已有回收站和账号隔离改动混入本计划提交。
- 执行本计划前，先确认工作区中与本计划无关的未提交改动已提交或由用户明确安排处理。

## 评审重点

- **采集误触发 AI：** API 契约测试必须断言 `collect.service.ts` 与 `wechat-import.service.ts` 不再调用 `generateSummaryAndTags` 或 `classifyStoredArticleForArchive`。
- **Web 误进归档：** 测试必须覆盖 Web、Android、macOS、浏览器扩展和 MCP 保存后的 `is_archived=false`，以及 Web 任务入口跳转 `/inbox`。
- **Key 泄露：** 设置响应测试必须断言只有 `apiKeyConfigured` 与 `apiKeyLast4`，没有 `apiKey` 或密文字段；日志与错误格式化不得包含 Key。
- **Base URL SSRF：** 单元测试必须覆盖 HTTPS、HTTP、localhost、127.0.0.1、10.x、172.16.x、192.168.x、IPv6 环回、DNS 解析内网地址和公网地址。
- **归档被 AI 失败阻断：** 集成/契约测试必须断言配置缺失、开关关闭、任务入队和任务失败时归档接口均返回成功。
- **重试浪费 token：** 测试必须覆盖 401/403/余额不足不重试，429/5xx/网络错误重试，且总尝试数不超过 3。
- **旧结果丢失：** 手动重新生成失败时必须保留旧摘要、标签和分类；成功后才允许覆盖。

---

### Task 1：统一采集落点和移除采集阶段 AI

**文件：**

- 修改：`apps/api/src/services/collect.service.ts`
- 修改：`apps/api/src/services/wechat-import.service.ts`
- 修改：`apps/api/src/routes/articles.ts`
- 修改：`apps/web/src/components/content/CollectContent.tsx`
- 修改：`apps/api/test/regression-collect-restart.test.mjs`
- 修改：`apps/api/test/wechat-import-contract.test.mjs`
- 创建：`apps/api/test/ai-trigger-policy.test.mjs`

**接口：**

- 使用：现有 `upsertArticleFromCapture`、`processCoverImage`、发布接口。
- 产出：所有保存型采集 `markArchived: false`；`finishArticleSideEffects` 不再调用 AI；发布不依赖 AI；Web 完成入口跳转收件箱。

- [ ] **步骤 1：写采集与发布触发策略失败测试**

创建 `apps/api/test/ai-trigger-policy.test.mjs`，至少包含：

- `test('所有保存型采集不得触发 AI 摘要、标签或分类')`：断言 `collect.service.ts` 不包含 `generateSummaryAndTags(`、`classifyStoredArticleForArchive(`，并断言所有 `persistMetadata: true` 分支使用 `markArchived: false`。
- `test('微信转发导入不得触发 AI')`：断言 `wechat-import.service.ts` 不包含 `generateSummaryAndTags`。
- `test('发布不依赖也不触发 AI')`：截取 `/articles/:id/publish` 实现，断言不包含 `PUBLICATION_NOT_READY`、`generateSummaryAndTags` 和 AI ready 校验。
- `test('Web 采集完成后打开收件箱')`：断言 `CollectContent.tsx` 的完成入口跳转 `/inbox`。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/api
pnpm exec node --import tsx --test test/ai-trigger-policy.test.mjs
```

期望：4 个测试均失败，失败原因是当前仍自动触发 AI、Web 自动归档或发布依赖 AI。

- [ ] **步骤 3：实现采集行为统一**

实现要求：

1. 删除 `shouldArchiveCollectedArticle`，所有保存型调用固定传 `markArchived: false`。
2. `finishArticleSideEffects` 删除摘要、标签和分类调用，保留封面处理。
3. `processWechatJob` 与 `processSingleFileJob` 保存分支不再携带 `isArchived`。
4. 删除微信导入服务中的 AI import 和后台调用。
5. 发布接口允许无 AI 发布，保留正文校验和发布状态写入。
6. `CollectContent.tsx` 完成入口改为 `/inbox`。
7. 更新受影响旧测试，明确 Web 不再保持历史归档行为。

- [ ] **步骤 4：运行定向测试**

```bash
cd apps/api
pnpm exec node --import tsx --test test/ai-trigger-policy.test.mjs test/regression-collect-restart.test.mjs test/wechat-import-contract.test.mjs
cd ../web
node --test test/*.test.mjs
```

- [ ] **步骤 5：提交**

```bash
git add apps/api/src/services/collect.service.ts apps/api/src/services/wechat-import.service.ts apps/api/src/routes/articles.ts apps/web/src/components/content/CollectContent.tsx apps/api/test/ai-trigger-policy.test.mjs apps/api/test/regression-collect-restart.test.mjs apps/api/test/wechat-import-contract.test.mjs
git commit -m "feat(api): 采集统一进入收件箱并延迟 AI 处理"
```

### Task 2：用户 AI 配置表与加密存储

**文件：**

- 修改：`apps/api/src/db/schema.ts`
- 创建：`apps/api/src/services/user-ai-settings.service.ts`
- 修改：`apps/api/src/index.ts`
- 创建：`apps/api/test/user-ai-settings.service.test.ts`

**接口：**

- 产出：

```ts
export type UserAiSettingsSummary = {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
  apiKeyUpdatedAt: Date | null;
  autoTriggerOnArchive: boolean;
  updatedAt: Date;
};

export type UserAiSettingsInput = {
  provider: string;
  model: string;
  baseUrl?: string | null;
  apiKey?: string;
  autoTriggerOnArchive: boolean;
};

export type UserAiRuntimeConfig = {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKey: string;
};

export function encryptSecret(plaintext: string): string;
export function decryptSecret(ciphertext: string): string;
export async function ensureUserAiSettingsSchema(): Promise<void>;
export async function getUserAiSettingsSummary(userId: number): Promise<UserAiSettingsSummary | null>;
export async function saveUserAiSettings(userId: number, input: UserAiSettingsInput): Promise<UserAiSettingsSummary>;
export async function deleteUserAiSettings(userId: number): Promise<void>;
export async function resolveUserAiRuntimeConfig(userId: number): Promise<UserAiRuntimeConfig | null>;
```

- [ ] **步骤 1：写加密与配置语义失败测试**

覆盖：

- `encryptSecret`/`decryptSecret` 可还原 `sk-test-1234567890`。
- 同一明文两次加密产生不同密文。
- 篡改密文解密失败。
- `USER_AI_ENCRYPTION_KEY` 缺失时抛出部署配置错误。
- 第二次保存 `apiKey` 为空时保留原 Key，仅更新模型和开关。
- Summary 不暴露 `apiKey` 与 `apiKeyCiphertext`。

- [ ] **步骤 2：写 schema 与启动初始化失败测试**

断言 schema 定义 `user_ai_settings`、必要字段、`auto_trigger_on_archive` 默认 false、用户删除级联删除配置，且启动调用 `ensureUserAiSettingsSchema()`。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/api
pnpm exec node --import tsx --test test/user-ai-settings.service.test.ts
```

- [ ] **步骤 4：实现 schema、加密和服务**

实现要求：

1. AES-256-GCM，nonce 和 auth tag 存入密文字段。
2. 主密钥只读 base64 32 字节的 `USER_AI_ENCRYPTION_KEY`。
3. 初始化 SQL 幂等，创建表和唯一 `user_id` 索引。
4. 保存时 `apiKey` 非空才更新密文、最后 4 位和更新时间。
5. `resolveUserAiRuntimeConfig` 只有 provider、model 和可解密 Key 均有效时返回配置。

- [ ] **步骤 5：运行测试与 API 构建**

```bash
cd apps/api
pnpm exec node --import tsx --test test/user-ai-settings.service.test.ts
pnpm build
```

- [ ] **步骤 6：提交**

```bash
git add apps/api/src/db/schema.ts apps/api/src/services/user-ai-settings.service.ts apps/api/src/index.ts apps/api/test/user-ai-settings.service.test.ts
git commit -m "feat(api): 增加用户级 AI 配置加密存储"
```

### Task 3：模型提供商注册、安全 Base URL 与设置接口

**文件：**

- 创建：`apps/api/src/services/ai-provider.service.ts`
- 创建：`apps/api/src/routes/ai.ts`
- 修改：`apps/api/src/index.ts`
- 测试：`apps/api/test/ai-provider.service.test.ts`
- 创建：`apps/api/test/ai-settings-route.test.mjs`

**接口：**

- 产出：

```ts
export type AiModelOption = { id: string; name: string | null };
export type AiDiscoveryConfig = { provider: string; baseUrl?: string | null; apiKey?: string };
export type AiCallResult = { content: string; promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };

export async function assertSafeAiBaseUrl(rawUrl: string): Promise<URL>;
export async function listAiModels(config: AiDiscoveryConfig): Promise<{ models: AiModelOption[]; cached: boolean }>;
export async function callUserAi(config: UserAiRuntimeConfig, system: string, user: string, maxTokens: number): Promise<AiCallResult>;
```

- API 产出：`GET /ai/settings`、`PUT /ai/settings`、`DELETE /ai/settings`、`POST /ai/models/discover`、`POST /ai/settings/test`。

- [ ] **步骤 1：写 Base URL 安全失败测试**

覆盖 HTTPS 通过；HTTP、localhost、127.0.0.1、::1、10.x、172.16.x、192.168.x、fd00::1、公网域名解析出内网地址、带凭据或 fragment 的 URL 拒绝。

- [ ] **步骤 2：写模型列表和调用失败测试**

覆盖 OpenAI-compatible `/models`、Anthropic 模型列表、401/403 具体诊断、网络失败、重定向到内网地址被拒绝、Authorization 头、usage 映射，以及 Key 不进入 URL、请求体或错误文本。

- [ ] **步骤 3：写设置路由契约失败测试**

断言路由均要求登录；GET 不返回明文 Key 或密文；PUT 支持 Key 留空保留；DELETE 清空配置；模型发现使用 provider、baseUrl、apiKey；测试生成明确会消耗少量 token。

- [ ] **步骤 4：运行测试确认失败**

```bash
cd apps/api
pnpm exec node --import tsx --test test/ai-provider.service.test.ts
node --test test/ai-settings-route.test.mjs
```

- [ ] **步骤 5：实现提供商注册、安全请求和路由**

实现要求：

1. 预设 provider 的 Base URL 与现有 `ai.service.ts` 一致。
2. 模型列表缓存 10 分钟，缓存键使用配置指纹哈希。
3. custom 必须走 `assertSafeAiBaseUrl`。
4. 设置测试使用固定极小输出，例如 `max_tokens: 16`。
5. 保存前校验 provider、model 和 custom URL。
6. 错误返回稳定错误码和中文诊断。

- [ ] **步骤 6：运行测试与构建**

```bash
cd apps/api
pnpm exec node --import tsx --test test/ai-provider.service.test.ts test/user-ai-settings.service.test.ts
node --test test/ai-settings-route.test.mjs
pnpm build
```

- [ ] **步骤 7：提交**

```bash
git add apps/api/src/services/ai-provider.service.ts apps/api/src/routes/ai.ts apps/api/src/index.ts apps/api/test/ai-provider.service.test.ts apps/api/test/ai-settings-route.test.mjs
git commit -m "feat(api): 提供用户 AI 设置与模型发现"
```

### Task 4：用户模型调用与合并生成结果

**文件：**

- 修改：`apps/api/src/services/ai.service.ts`
- 修改：`apps/api/src/services/category.service.ts` 仅在需要导出列表类型时调整
- 测试：`apps/api/test/ai-generation-prompt.test.ts`
- 修改：`apps/api/test/phase2-user-scope.test.mjs`

**接口：**

- 产出：

```ts
export const AI_INPUT_CHAR_LIMIT = 24000;

export type CombinedAiGenerationResult = {
  summary: string;
  tags: string[];
  categoryId: number | null;
  confidence: number | null;
  reason: string | null;
  modelVersion: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  contentTruncated: boolean;
};

export async function generateCombinedArticleAi(
  userId: number,
  articleId: number,
  options: { includeCategory: boolean },
  callAi?: typeof callUserAi
): Promise<CombinedAiGenerationResult>;
```

- [ ] **步骤 1：写合并输出失败测试**

覆盖：

- 未手动分类时一次 JSON 返回 summary、tags、category_id、confidence、reason。
- 手动分类时不包含分类候选，输出只要 summary 和 tags。
- 标签规范化为 3 到 5 个非空字符串。
- 分类 ID 不属于用户启用分类时结果无效。
- Markdown 代码块包裹的 JSON 可解析。
- 正文超过 24,000 字符时截断且 `contentTruncated=true`。
- 错误信息不包含 API Key。

- [ ] **步骤 2：写用户隔离与无公共回退失败测试**

断言未配置抛 `AI_NOT_CONFIGURED`；用户配置的 provider/model 进入快照；新路径不读取任何模型提供商公共 Key 环境变量。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/api
pnpm exec node --import tsx --test test/ai-generation-prompt.test.ts
```

- [ ] **步骤 4：实现合并生成**

实现要求：

1. 内容选择沿用 Markdown、HTML、原始 summary 顺序，并按用户读取正文缓存。
2. 分类候选来自当前用户非系统且启用中的分类。
3. 解析失败抛稳定 `AI_OUTPUT_INVALID`。
4. 低置信或分类不合法的兜底由调用方处理，本函数不写库。
5. 返回值不写数据库，便于任务服务原子写入。

- [ ] **步骤 5：运行测试与构建**

```bash
cd apps/api
pnpm exec node --import tsx --test test/ai-generation-prompt.test.ts test/phase2-user-scope.test.mjs
pnpm build
```

- [ ] **步骤 6：提交**

```bash
git add apps/api/src/services/ai.service.ts apps/api/src/services/category.service.ts apps/api/test/ai-generation-prompt.test.ts apps/api/test/phase2-user-scope.test.mjs
git commit -m "feat(api): 使用用户模型合并生成文章 AI 信息"
```

### Task 5：AI 任务表、队列和状态回写

**文件：**

- 修改：`apps/api/src/db/schema.ts`
- 创建：`apps/api/src/services/ai-generation.service.ts`
- 修改：`apps/api/src/routes/ai.ts`
- 修改：`apps/api/src/index.ts`
- 测试：`apps/api/test/ai-generation.service.test.ts`
- 创建：`apps/api/test/ai-jobs-route.test.mjs`

**接口：**

- 产出：

```ts
export type AiGenerationStatus =
  'not_generated' | 'disabled' | 'not_configured' | 'queued' | 'running' | 'succeeded' | 'failed';

export type AiGenerationTrigger = 'archive' | 'manual' | 'admin' | 'mcp_summary';

export type AiGenerationJobSummary = {
  id: number;
  articleId: number;
  triggerType: AiGenerationTrigger;
  status: AiGenerationStatus;
  errorCode: string | null;
  errorMessage: string | null;
  provider: string;
  model: string;
  totalTokens: number | null;
  contentTruncated: boolean;
  createdAt: Date;
  finishedAt: Date | null;
};

export type AiGenerationUsageSummary = {
  totalJobs: number;
  succeededJobs: number;
  failedJobs: number;
  totalTokens: number;
};

export async function ensureAiGenerationSchema(): Promise<void>;
export async function enqueueAiGeneration(input: {
  userId: number;
  articleId: number;
  triggerType: AiGenerationTrigger;
  includeCategory: boolean;
}): Promise<{ jobId: number; status: AiGenerationStatus }>;
export async function setAiArticleStatus(userId: number, articleId: number, status: AiGenerationStatus, errorCode?: string, errorMessage?: string): Promise<void>;
export function shouldRetryAiError(error: unknown): boolean;
export async function runAiGenerationWorkers(): Promise<void>;
export async function resumeAiGenerationJobs(): Promise<void>;
export async function retryAiGenerationJob(userId: number, jobId: number): Promise<void>;
export async function listAiGenerationJobs(userId: number, limit: number, offset: number): Promise<{ jobs: AiGenerationJobSummary[]; total: number; usage: AiGenerationUsageSummary }>;
```

- API 产出：`GET /ai/jobs`、`POST /ai/jobs/:id/retry`。

- [ ] **步骤 1：写任务重试失败测试**

覆盖 401、403、余额不足、模型不存在不重试；429、500、503、网络超时重试；同一任务总尝试数不超过 3。

- [ ] **步骤 2：写队列契约失败测试**

覆盖 schema、同用户同文章非终态任务唯一、每用户并发 1、服务重启恢复 running、成功一次性写结果、失败不改旧 AI 字段。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/api
pnpm exec node --import tsx --test test/ai-generation.service.test.ts
node --test test/ai-jobs-route.test.mjs
```

- [ ] **步骤 4：实现队列**

实现要求：

1. 数据库事务认领任务，避免并发重复执行。
2. 自动指数退避，不引入外部队列依赖。
3. 任务使用创建时的 provider/model 快照。
4. 成功结果写库与任务终态在同一事务。
5. 手动重试只允许任务 owner。
6. 启动时初始化 schema 并恢复任务。

- [ ] **步骤 5：运行测试与构建**

```bash
cd apps/api
pnpm exec node --import tsx --test test/ai-generation.service.test.ts test/ai-generation-prompt.test.ts
node --test test/ai-jobs-route.test.mjs
pnpm build
```

- [ ] **步骤 6：提交**

```bash
git add apps/api/src/db/schema.ts apps/api/src/services/ai-generation.service.ts apps/api/src/routes/ai.ts apps/api/src/index.ts apps/api/test/ai-generation.service.test.ts apps/api/test/ai-jobs-route.test.mjs
git commit -m "feat(api): 增加用户 AI 生成任务队列"
```

### Task 6：归档、手动生成与显式 AI 入口接入任务

**文件：**

- 修改：`apps/api/src/routes/articles.ts`
- 修改：`apps/api/src/routes/categories.ts`
- 修改：`apps/api/src/routes/mcp.ts`
- 修改：`apps/api/src/services/ai.service.ts`
- 修改：`apps/api/src/services/ai-generation.service.ts`
- 测试：`apps/api/test/archive-ai-trigger.test.mjs`
- 修改：`apps/api/test/phase3-mcp-collect-url.test.mjs`
- 修改：`apps/api/test/category-description-optimize-contract.test.mjs`

**接口：**

- 使用 Task 5 的 `enqueueAiGeneration` 与 `setAiArticleStatus`。
- 产出：

```ts
export async function queueArchiveAiIfNeeded(
  userId: number,
  articleId: number,
  options: { userSelectedCategory: boolean; existingAiReady: boolean }
): Promise<AiGenerationStatus>;
```

- API 行为：归档按用户设置触发；手动重新生成入队且不清空旧 AI；分类优化使用当前用户模型；MCP 摘要使用 owner 模型；MCP 采集不触发 AI。

- [ ] **步骤 1：写归档触发失败测试**

覆盖自动开关 false、自动开关 true 但未配置、配置有效、已有有效 AI 四种路径的归档响应和任务状态。

- [ ] **步骤 2：写手动分类与手动生成失败测试**

覆盖手动分类 `includeCategory=false`、未选择分类 `includeCategory=true`、手动生成仅限已归档文章、手动生成不先清空旧 AI、自动开关 false 仍可手动生成、未配置返回 `AI_NOT_CONFIGURED`。

- [ ] **步骤 3：写 MCP 与分类优化失败测试**

覆盖 `mcp/collect` 不创建 AI 任务、`mcp/summarize` 使用 owner 配置、owner 未配置返回明确错误、分类优化使用当前用户配置、任何入口不回退公共模型 Key。

- [ ] **步骤 4：运行测试确认失败**

```bash
cd apps/api
node --test test/archive-ai-trigger.test.mjs test/phase3-mcp-collect-url.test.mjs test/category-description-optimize-contract.test.mjs
```

- [ ] **步骤 5：实现触发接入**

实现要求：

1. 归档更新和 AI 状态更新在归档请求内完成，任务执行异步。
2. AI 任务失败不能让已成功的归档回滚。
3. 手动生成保留旧结果直到新任务成功。
4. MCP 摘要结果返回给调用方，不写入用户文章元数据。
5. 分类优化继续同步返回草稿，但调用用户模型。

- [ ] **步骤 6：运行定向测试与构建**

```bash
cd apps/api
node --test test/archive-ai-trigger.test.mjs test/phase3-mcp-collect-url.test.mjs test/category-description-optimize-contract.test.mjs
pnpm exec node --import tsx --test test/ai-generation.service.test.ts
pnpm build
```

- [ ] **步骤 7：提交**

```bash
git add apps/api/src/routes/articles.ts apps/api/src/routes/categories.ts apps/api/src/routes/mcp.ts apps/api/src/services/ai.service.ts apps/api/test/archive-ai-trigger.test.mjs apps/api/test/phase3-mcp-collect-url.test.mjs apps/api/test/category-description-optimize-contract.test.mjs
git commit -m "feat(api): 归档按用户配置触发 AI 任务"
```

### Task 7：Web AI 设置与状态界面

**文件：**

- 修改：`apps/web/src/lib/api.ts`
- 创建：`apps/web/src/components/content/AiSettingsContent.tsx`
- 创建：`apps/web/src/app/(main)/settings/ai/page.tsx`
- 修改：`apps/web/src/components/layout/DesktopTopNav.tsx`
- 修改：`apps/web/src/components/layout/MobileTopNav.tsx`
- 修改：`apps/web/src/components/article/WechatArticleCard.tsx`
- 修改：`apps/web/src/components/article/WechatDetailPanel.tsx`
- 修改：`apps/web/src/app/globals.css`
- 创建：`apps/web/test/ai-settings.test.mjs`
- 修改：`apps/web/test/detail-action-error-feedback.test.mjs`

**接口：**

- API client 产出：

```ts
export type SaveUserAiSettingsInput = {
  provider: string;
  model: string;
  baseUrl?: string | null;
  apiKey?: string;
  autoTriggerOnArchive: boolean;
};

export type DiscoverAiModelsInput = {
  provider: string;
  baseUrl?: string | null;
  apiKey?: string;
};

export type UserAiSettings = {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
  apiKeyUpdatedAt: string | null;
  autoTriggerOnArchive: boolean;
  updatedAt: string;
};

export type ArticleAiStatusFields = {
  aiStatus: 'not_generated' | 'disabled' | 'not_configured' | 'queued' | 'running' | 'succeeded' | 'failed';
  aiErrorCode: string | null;
  aiErrorMessage: string | null;
  aiModel: string | null;
  aiTotalTokens: number | null;
};

getAiSettings(): Promise<{ settings: UserAiSettings | null }>;
saveAiSettings(input: SaveUserAiSettingsInput): Promise<{ settings: UserAiSettings }>;
deleteAiSettings(): Promise<{ deleted: true }>;
discoverAiModels(input: DiscoverAiModelsInput): Promise<{ models: Array<{ id: string; name: string | null }>; cached: boolean }>;
testAiSettings(): Promise<{ ok: true; latencyMs: number }>;
getAiJobs(page?: number, perPage?: number): Promise<{ jobs: Array<{ id: number; articleId: number; status: string; errorCode: string | null; errorMessage: string | null; model: string; totalTokens: number | null; createdAt: string; finishedAt: string | null }>; total: number; usage: { totalJobs: number; succeededJobs: number; failedJobs: number; totalTokens: number } }>;
retryAiJob(jobId: number): Promise<{ ok: true }>;
```

- [ ] **步骤 1：写 Web 设置界面失败测试**

断言设置页包含 provider、Base URL、API Key、获取模型、模型选择/手动输入、自动触发开关、保存、测试和删除配置；自动触发默认关闭；Key 保存后只显示最后 4 位；模型列表失败可手动输入；删除配置需二次确认；桌面和移动导航均有入口。

- [ ] **步骤 2：写 AI 状态展示失败测试**

断言文章卡片与详情页支持七种 AI 状态中文文案、失败原因、重试按钮、模型名和 token 用量；手动重新生成不先清空旧结果；归档提示 AI 排队、关闭或未配置。
断言设置页展示最近 AI 任务、成功/失败次数和 token 汇总。

- [ ] **步骤 3：运行 Web 测试确认失败**

```bash
cd apps/web
node --test test/ai-settings.test.mjs test/detail-action-error-feedback.test.mjs
```

- [ ] **步骤 4：实现 Web 页面与状态**

实现要求：

1. 模型选择使用可输入 combobox，可选择获取结果或手动输入。
2. API Key 输入保存后清空。
3. 保存、获取模型、测试生成分别有 loading、失败和成功状态。
4. 状态样式复用现有 quiet/admin 设计。
5. 设置页对登录用户开放，服务账号提示由管理员配置。
6. 设置页展示最近 AI 任务、成功/失败次数和 token 汇总。
7. 删除配置必须二次确认，删除后自动触发状态回到默认关闭。

- [ ] **步骤 5：运行 Web 全量测试与生产构建**

```bash
cd apps/web
node --test test/*.test.mjs
pnpm build
```

- [ ] **步骤 6：提交**

```bash
git add apps/web/src/lib/api.ts apps/web/src/components/content/AiSettingsContent.tsx apps/web/src/app/\(main\)/settings/ai/page.tsx apps/web/src/components/layout/DesktopTopNav.tsx apps/web/src/components/layout/MobileTopNav.tsx apps/web/src/components/article/WechatArticleCard.tsx apps/web/src/components/article/WechatDetailPanel.tsx apps/web/src/app/globals.css apps/web/test/ai-settings.test.mjs apps/web/test/detail-action-error-feedback.test.mjs
git commit -m "feat(web): 增加账号 AI 模型设置与生成状态"
```

### Task 8：Android AI 设置与状态界面

**文件：**

- 创建：`apps/android/app/src/main/java/com/idickies/storing/ai/AiModels.kt`
- 创建：`apps/android/app/src/main/java/com/idickies/storing/ai/AiSettingsRepository.kt`
- 创建：`apps/android/app/src/main/java/com/idickies/storing/ai/AiSettingsViewModel.kt`
- 创建：`apps/android/app/src/main/java/com/idickies/storing/network/AiApi.kt`
- 创建：`apps/android/app/src/main/java/com/idickies/storing/ui/AiSettingsScreen.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/ui/SettingsScreen.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/library/ArticleModels.kt`
- 创建：`apps/android/app/src/test/java/com/idickies/storing/ai/AiSettingsModelsTest.kt`
- 创建：`apps/android/app/src/test/java/com/idickies/storing/ui/AiSettingsPresentationTest.kt`

**接口：**

- 产出核心模型：

```kotlin
@Serializable data class ArticleAiStatus(
  @SerialName("aiStatus") val value: String,
  @SerialName("aiErrorCode") val errorCode: String? = null,
  @SerialName("aiErrorMessage") val errorMessage: String? = null,
  @SerialName("aiModel") val model: String? = null,
  @SerialName("aiTotalTokens") val totalTokens: Int? = null,
)

@Serializable data class UserAiSettings(
  val provider: String,
  val model: String,
  val baseUrl: String? = null,
  @SerialName("apiKeyConfigured") val apiKeyConfigured: Boolean,
  @SerialName("apiKeyLast4") val apiKeyLast4: String? = null,
  @SerialName("apiKeyUpdatedAt") val apiKeyUpdatedAt: String? = null,
  @SerialName("autoTriggerOnArchive") val autoTriggerOnArchive: Boolean,
  val updatedAt: String,
)
```

- API 产出：settings、save、delete、discover、test、jobs、retryJob 七个认证 Retrofit 方法。

- [ ] **步骤 1：写序列化失败测试**

覆盖服务端响应解码、Settings 无 API Key 字段、模型名可空、AI 任务状态解码。

- [ ] **步骤 2：写界面展示失败测试**

覆盖设置页入口、默认关闭文案、Key 已配置提示、模型列表失败可手动输入、文章状态文案、重试入口、最近任务和 token 汇总、删除配置二次确认。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/android
./gradlew :app:testDebugUnitTest --tests 'com.idickies.storing.ai.AiSettingsModelsTest' --tests 'com.idickies.storing.ui.AiSettingsPresentationTest'
```

- [ ] **步骤 4：实现 Android 设置与状态**

实现要求：

1. 使用现有认证 Retrofit 边界和错误映射模式。
2. `LibraryScreen` 增加 AI 设置局部页面状态，设置页新增入口。
3. 表单支持获取模型、手动输入、保存和测试。
4. 文章卡片/阅读页展示 AI 状态。
5. 失败任务提供重试按钮。
6. 设置页展示最近任务、成功/失败次数和 token 汇总。

- [ ] **步骤 5：运行 Android 全量单测与构建**

```bash
cd apps/android
./gradlew testDebugUnitTest
./gradlew assembleDebug
./gradlew compileReleaseKotlin
./gradlew assembleRelease
```

- [ ] **步骤 6：提交**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/ai apps/android/app/src/main/java/com/idickies/storing/network/AiApi.kt apps/android/app/src/main/java/com/idickies/storing/ui/AiSettingsScreen.kt apps/android/app/src/main/java/com/idickies/storing/ui/SettingsScreen.kt apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt apps/android/app/src/main/java/com/idickies/storing/library/ArticleModels.kt apps/android/app/src/test/java/com/idickies/storing/ai/AiSettingsModelsTest.kt apps/android/app/src/test/java/com/idickies/storing/ui/AiSettingsPresentationTest.kt
git commit -m "feat(android): 增加账号 AI 模型设置与状态"
```

### Task 9：macOS AI 设置与状态界面

**文件：**

- 创建：`apps/macos/QiankunjieMac/Features/Settings/AiSettingsView.swift`
- 修改：`apps/macos/QiankunjieMac/App/AppModel.swift`
- 修改：`apps/macos/QiankunjieMac/Features/Settings/SettingsView.swift`
- 修改：`apps/macos/QiankunjieMac/Features/Settings/SettingsWindow.swift`
- 修改：`apps/macos/QiankunjieMac/Features/Library/CompactArticleListView.swift`
- 修改：`apps/macos/QiankunjieMac/Features/Reader/ReaderPaneView.swift`
- 修改：`apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Models/ArticleModels.swift`
- 创建：`apps/macos/QiankunjieMacTests/AiSettingsTests.swift`

**接口：**

- 产出：

```swift
struct UserAiSettings: Decodable, Equatable, Sendable {
    let provider: String
    let model: String
    let baseUrl: String?
    let apiKeyConfigured: Bool
    let apiKeyLast4: String?
    let apiKeyUpdatedAt: String?
    let autoTriggerOnArchive: Bool
    let updatedAt: String
}

struct ArticleAiStatus: Decodable, Equatable, Sendable {
    let aiStatus: String
    let aiErrorCode: String?
    let aiErrorMessage: String?
    let aiModel: String?
    let aiTotalTokens: Int?
}
```

- `SettingsTool` 增加 `aiModel` case，标题“AI 模型”，图标 `sparkles`。
- `AiSettingsView` 使用现有认证 `APIClient` 请求 `/ai/settings`、`/ai/models/discover`、`/ai/settings/test`。
- `AiSettingsView` 请求 `DELETE /ai/settings` 与 `GET /ai/jobs`，展示删除确认、最近任务和 token 汇总。

- [ ] **步骤 1：写解码与设置入口失败测试**

覆盖设置响应解码、模型列表解码、AI 任务与用量解码、七种 AI 状态解码与文案、设置工具入口、删除确认。

- [ ] **步骤 2：运行 macOS 定向测试确认失败**

```bash
cd apps/macos
xcodegen_bin="$(bash scripts/verify-xcode.sh --print-xcodegen-bin)" && "$xcodegen_bin" generate
xcodebuild -project Qiankunjie.xcodeproj -scheme QiankunjieMac -configuration Debug -destination 'platform=macOS,arch=arm64' -derivedDataPath .derivedData CODE_SIGNING_ALLOWED=NO test -only-testing:QiankunjieMacTests/AiSettingsTests
```

- [ ] **步骤 3：实现 macOS 设置与状态**

实现要求：

1. 设置工具列表增加 AI 模型。
2. 表单包含 provider、Base URL、API Key、获取模型、模型选择/手动输入、自动开关、保存、测试。
3. API Key 保存后清空并显示最后 4 位。
4. 阅读页显示 AI 状态、失败原因、模型和 token。
5. 失败任务提供重试。
6. 设置页展示最近任务、成功/失败次数和 token 汇总。

- [ ] **步骤 4：运行 macOS 完整测试**

```bash
cd apps/macos
bash scripts/test.sh
```

- [ ] **步骤 5：提交**

```bash
git add apps/macos/QiankunjieMac/Features/Settings/AiSettingsView.swift apps/macos/QiankunjieMac/App/AppModel.swift apps/macos/QiankunjieMac/Features/Settings/SettingsView.swift apps/macos/QiankunjieMac/Features/Settings/SettingsWindow.swift apps/macos/QiankunjieMac/Features/Library/CompactArticleListView.swift apps/macos/QiankunjieMac/Features/Reader/ReaderPaneView.swift apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Models/ArticleModels.swift apps/macos/QiankunjieMacTests/AiSettingsTests.swift
git commit -m "feat(macos): 增加账号 AI 模型设置与状态"
```

### Task 10：管理员代配置与 MCP 显式摘要

**文件：**

- 修改：`apps/api/src/routes/ai.ts`
- 修改：`apps/api/src/routes/mcp.ts`
- 修改：`apps/api/src/services/ai-generation.service.ts`
- 修改：`apps/web/src/components/content/UserManagementContent.tsx`
- 修改：`apps/web/src/lib/api.ts`
- 创建：`apps/api/test/admin-ai-settings.test.mjs`
- 创建：`apps/web/test/admin-ai-settings.test.mjs`

**接口：**

- API 产出：
  - `GET /ai/admin/users/:userId/settings`
  - `PUT /ai/admin/users/:userId/settings`
  - `POST /ai/admin/users/:userId/settings/test`
- 语义：仅管理员可用；可配置服务账号；不返回明文 Key；写审计。

- [ ] **步骤 1：写管理员配置失败测试**

覆盖非管理员 403、管理员读取摘要、保存配置、Key 留空保留、不泄露明文、写不含 Key 的审计、目标用户不存在 404。

- [ ] **步骤 2：写 Web 管理界面失败测试**

断言用户管理提供 AI 配置入口，服务账号提示可代配置，弹窗包含全部配置项且不显示明文 Key。

- [ ] **步骤 3：写 MCP 显式摘要契约失败测试**

覆盖 owner 配置使用、未配置错误、`collect_url` 不建 AI 任务、摘要结果不写文章元数据、等待接口响应结构不变。

- [ ] **步骤 4：运行测试确认失败**

```bash
cd apps/api
node --test test/admin-ai-settings.test.mjs test/phase3-mcp-collect-url.test.mjs
cd ../web
node --test test/admin-ai-settings.test.mjs
```

- [ ] **步骤 5：实现管理员代配置与 MCP 接入**

- [ ] **步骤 6：运行定向测试与构建**

```bash
cd apps/api
node --test test/admin-ai-settings.test.mjs test/phase3-mcp-collect-url.test.mjs
pnpm build
cd ../web
node --test test/admin-ai-settings.test.mjs
pnpm build
```

- [ ] **步骤 7：提交**

```bash
git add apps/api/src/routes/ai.ts apps/api/src/routes/mcp.ts apps/api/src/services/ai-generation.service.ts apps/web/src/components/content/UserManagementContent.tsx apps/web/src/lib/api.ts apps/api/test/admin-ai-settings.test.mjs apps/web/test/admin-ai-settings.test.mjs
git commit -m "feat: 支持管理员代配置用户 AI 模型"
```

### Task 11：文档、环境迁移与全量验证

**文件：**

- 修改：`docs/PRD-Readwise-Later.md`
- 修改：`docs/PROJECT-FUNCTIONAL-SPEC-FOR-UI.md`
- 修改：`docs/PRD-Archive-Categories.md`
- 修改：`.env.example`
- 修改：`README.md`
- 修改：`DOCKER.md`
- 修改：`apps/api/test/dependency-security-floor.test.mjs`
- 创建：`docs/superpowers/plans/2026-10-08-user-ai-configuration-verification.md`

**接口：**

- 使用全部前序任务。
- 产出：完整验证记录和环境迁移说明。

- [ ] **步骤 1：写文档与环境契约失败测试**

断言功能说明明确“采集不生成 AI，归档按用户设置生成”；`.env.example` 包含 `USER_AI_ENCRYPTION_KEY` 且不推荐模型提供商 API Key；API 源码不再读取公共模型 Key；部署文档说明主加密密钥丢失后需重新录入用户 Key。

- [ ] **步骤 2：更新文档与环境示例**

更新采集、归档、发布、MCP、设置、历史数据保留、模型列表手动输入和管理员代配置说明。

- [ ] **步骤 3：运行 API 全量验证**

```bash
cd apps/api
pnpm exec node --import tsx --test test/*.test.mjs test/*.test.ts
pnpm build
```

- [ ] **步骤 4：运行 Web 全量验证**

```bash
cd apps/web
node --test test/*.test.mjs
pnpm build
```

- [ ] **步骤 5：运行 Android 全量验证**

```bash
cd apps/android
./gradlew testDebugUnitTest
./gradlew assembleDebug
./gradlew compileReleaseKotlin
./gradlew assembleRelease
```

若正式 APK 打包因缺少签名 Secret 失败，记录缺失变量并保留 Release 编译验证结果。

- [ ] **步骤 6：运行 macOS 全量验证**

```bash
cd apps/macos
bash scripts/test.sh
bash scripts/build-dmg.sh
```

- [ ] **步骤 7：记录验证结果**

记录各类测试数量与失败数、四端构建结果、Android 签名限制、本地手工检查项和遗留风险。

- [ ] **步骤 8：提交**

```bash
git add docs .env.example README.md DOCKER.md apps/api/test/dependency-security-floor.test.mjs
git commit -m "docs: 更新账号级 AI 配置与归档触发说明"
```

## 自检结论

- 规格中的采集、归档、发布、手动生成、MCP、管理员、模型列表、安全、任务、状态、用量、迁移和测试要求均有对应任务。
- 后续任务依赖的接口在 Task 2 至 Task 6 中显式定义，客户端任务只消费已定义 API。
- 每个任务都有失败测试、实现、定向验证和独立提交步骤。
- 历史数据不做批量 AI 补生成，旧结果不清空。
