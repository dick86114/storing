# AI 增强阅读（深度解析）实施计划

> **给执行代理的要求：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐项执行。步骤使用 `- [ ]` 复选框跟踪。

**目标：** 按已确认的三端交互原型，为单篇文章增加服务端异步深度报告，支持跨端查看、提醒、离线读取和重新生成。

**架构：** 服务端新增独立深度报告表和通知表，复用用户 AI 配置与任务重试思想，但不覆盖普通摘要任务状态；列表接口一次返回深度报告摘要状态。Web、Android、macOS 只消费统一 API，各自实现状态入口、报告面板和账号隔离缓存。

**技术栈：** Hono、Drizzle、PostgreSQL、Next.js、React、SWR、Kotlin、Coroutines、Hilt、Retrofit、kotlinx.serialization、Room、SwiftUI、Swift Concurrency、UserNotifications。

**设计文档：** `docs/PRD-AI-Enhanced-Reading.md`

## 全局约束

- 所有新增注释、文档和用户可见文案使用中文。
- 前端包管理必须使用 `pnpm`，禁止使用 `npm`。
- 深度报告不得替换或覆盖 `article_metadata.ai_summary`、`ai_tags`、分类和 `ai_status`。
- 第一阶段只做单篇文章、手动触发、不联网检索。
- 同一用户同一文章同时最多一个排队/运行中的深度报告任务。
- 新报告成功前旧报告必须保持可读；失败不影响旧报告。
- 列表与详情必须返回深度报告状态，不允许客户端逐篇请求。
- 所有文章接口必须做服务端归属校验。
- 报告输出必须为结构化 JSON，并区分原文事实、模型推断和行动建议。
- 第一阶段输入截断上限沿用 24,000 字符；截断必须在 UI 和报告中可见。
- 通知不得包含报告正文或 AI Key。
- 离线只允许读取已缓存报告，不允许提交生成任务。
- 客户端报告缓存必须按账号隔离，退出登录后不可读取。
- 每个任务先写失败测试，再实现，再运行声明验证；不做无关重构。
- 每个任务独立提交；不得混入当前工作区已有无关改动。

## 评审重点

- **普通摘要状态污染：** 测试必须断言深度任务排队、运行、失败、成功都不修改 `article_metadata.ai_status`。
- **重复提交扣费：** 测试必须覆盖同文章并发提交返回同一任务，不新增活动任务。
- **旧报告丢失：** 测试必须覆盖重新生成失败后当前报告和版本不变。
- **JSON 伪造输出：** 测试必须覆盖 fenced JSON、非法 JSON、缺观点、缺执行摘要和超长字段。
- **越权访问：** 测试必须覆盖游客、其他用户、不存在文章和无归属元数据。
- **离线误提交：** 三端测试必须断言离线时触发按钮禁用或提交入口返回明确提示。
- **缓存串号：** 测试必须覆盖同机器不同账号读取同一文章时缓存隔离。

---

### Task 1：深度报告数据模型与服务基础

**文件：**

- 修改：`apps/api/src/db/schema.ts`
- 创建：`apps/api/src/services/deep-analysis.service.ts`
- 修改：`apps/api/src/index.ts`
- 测试：`apps/api/test/deep-analysis.service.test.ts`

**接口：**

- 产出：

```ts
export type DeepAnalysisStatus = 'not_generated' | 'queued' | 'running' | 'succeeded' | 'failed';

export type DeepAnalysisSummary = {
  hasDeepAnalysis: boolean;
  status: DeepAnalysisStatus;
  version: number | null;
  generatedAt: Date | null;
  stale: boolean;
  errorCode: string | null;
};

export async function ensureDeepAnalysisSchema(): Promise<void>;
export async function getDeepAnalysisSummary(userId: number, articleId: number): Promise<DeepAnalysisSummary>;
export async function attachDeepAnalysisSummaries(userId: number, articleIds: number[]): Promise<Map<number, DeepAnalysisSummary>>;
```

- [ ] **步骤 1：写模型与服务失败测试**

覆盖 schema 表和索引、状态语义、批量查询去重、不存在报告返回 `not_generated`、`stale` 由内容指纹判断。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/api
pnpm exec node --import tsx --test test/deep-analysis.service.test.ts
```

- [ ] **步骤 3：实现表与服务**

表包含报告、任务审计、内容指纹、版本、当前标记、JSON/Markdown、Token、错误和重试字段；创建 `(user_id, article_id)` 活动任务唯一索引和列表状态查询索引；初始化 SQL 幂等。

- [ ] **步骤 4：运行测试**

```bash
cd apps/api
pnpm exec node --import tsx --test test/deep-analysis.service.test.ts
```

- [ ] **步骤 5：提交**

```bash
git add apps/api/src/db/schema.ts apps/api/src/services/deep-analysis.service.ts apps/api/src/index.ts apps/api/test/deep-analysis.service.test.ts
git commit -m "feat(api): 增加深度报告数据模型"
```

### Task 2：提示词、输出解析与报告渲染

**文件：**

- 创建：`apps/api/src/services/deep-analysis-ai.service.ts`
- 测试：`apps/api/test/deep-analysis-ai.service.test.ts`

**接口：**

- 使用：`resolveUserAiRuntimeConfig`、`callUserAi`。
- 产出：

```ts
export type DeepAnalysisReport = {
  executiveSummary: string;
  coreArguments: Array<{ claim: string; evidence: string; quoteAnchor: string | null }>;
  reasoningChain: string[];
  keyFacts: Array<{ fact: string; basis: 'source' | 'inference'; quoteAnchor: string | null }>;
  viewpoints: Array<{ stance: 'support' | 'oppose' | 'conditional'; summary: string; reasoning: string }>;
  risks: string[];
  actions: Array<{ action: string; condition: string }>;
  questions: string[];
  readingPath: string[];
};

export function buildDeepAnalysisPrompt(input: { title: string; summary: string; content: string }): { system: string; user: string; maxTokens: number; contentTruncated: boolean };
export function parseDeepAnalysisReport(raw: string): DeepAnalysisReport;
export function renderDeepAnalysisMarkdown(report: DeepAnalysisReport): string;
```

- [ ] **步骤 1：写提示词、解析和渲染失败测试**

覆盖 24,000 字符截断、必填结构、观点枚举、事实依据枚举、 fenced JSON、非法 JSON、缺字段、空数组、过长字段裁剪或失败、Markdown 分区标题。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/api
pnpm exec node --import tsx --test test/deep-analysis-ai.service.test.ts
```

- [ ] **步骤 3：实现纯函数**

提示词强制中文、只基于原文、输出 JSON、观点至少三个方向；解析失败抛 `AI_OUTPUT_INVALID`；Markdown 不渲染不可信 HTML。

- [ ] **步骤 4：运行测试**

```bash
cd apps/api
pnpm exec node --import tsx --test test/deep-analysis-ai.service.test.ts
```

- [ ] **步骤 5：提交**

```bash
git add apps/api/src/services/deep-analysis-ai.service.ts apps/api/test/deep-analysis-ai.service.test.ts
git commit -m "feat(api): 定义深度报告提示词与结构化输出"
```

### Task 3：异步任务、状态隔离与版本保留

**文件：**

- 修改：`apps/api/src/services/deep-analysis.service.ts`
- 测试：`apps/api/test/deep-analysis-job.test.ts`

**接口：**

- 产出：

```ts
export async function enqueueDeepAnalysis(userId: number, articleId: number): Promise<{ jobId: number; status: DeepAnalysisStatus }>;
export async function runDeepAnalysisWorkers(): Promise<void>;
export async function resumeDeepAnalysisJobs(): Promise<void>;
export async function retryDeepAnalysisJob(userId: number, jobId: number): Promise<void>;
```

- [ ] **步骤 1：写任务失败测试**

覆盖立即入队、每用户串行、重复提交复用活动任务、401 不重试、429/5xx 重试、最多三次尝试、成功写新版本、失败保留旧版本、任何状态不修改普通摘要状态。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/api
pnpm exec node --import tsx --test test/deep-analysis-job.test.ts
```

- [ ] **步骤 3：实现任务执行**

复用 `FOR UPDATE SKIP LOCKED` 认领模式；任务快照记录模型和内容指纹；新版本成功后原子切换当前标记；失败保留当前报告。

- [ ] **步骤 4：运行测试**

```bash
cd apps/api
pnpm exec node --import tsx --test test/deep-analysis-job.test.ts
```

- [ ] **步骤 5：提交**

```bash
git add apps/api/src/services/deep-analysis.service.ts apps/api/test/deep-analysis-job.test.ts
git commit -m "feat(api): 实现深度报告异步任务"
```

### Task 3.1：补齐版本恢复服务

**文件：**

- 修改：`apps/api/src/services/deep-analysis.service.ts`

**接口：**

- 产出：`export async function restoreDeepAnalysisVersion(userId: number, articleId: number, version: number): Promise<void>`。

实现：校验目标版本 `status = 'succeeded'`；事务中将旧当前版本置为 `false`、目标版本置为 `true`；版本不存在抛 `DEEP_ANALYSIS_VERSION_NOT_FOUND`。

### Task 4：文章 API 与用户通知

**文件：**

- 创建：`apps/api/src/routes/deep-analysis.ts`
- 修改：`apps/api/src/routes/articles.ts`
- 创建：`apps/api/src/services/user-notification.service.ts`
- 修改：`apps/api/src/index.ts`
- 测试：`apps/api/test/deep-analysis-route.test.mjs`
- 测试：`apps/api/test/user-notification.service.test.ts`

**接口：**

- API：`POST /articles/:id/deep-analysis`、`GET /articles/:id/deep-analysis`、`GET /articles/:id/deep-analysis/versions`、`POST /articles/:id/deep-analysis/:version/restore`、`GET /notifications`、`PATCH /notifications/:id/read`。
- 列表与详情响应增加 `deepAnalysis` 对象。

- [ ] **步骤 1：写路由与通知失败测试**

覆盖登录要求、归属校验、未配置 AI、活动任务复用、报告读取、版本列表、恢复版本、完成通知、已读接口、通知不包含正文。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/api
pnpm exec node --import tsx --test test/user-notification.service.test.ts
node --test test/deep-analysis-route.test.mjs
```

- [ ] **步骤 3：实现路由与通知**

所有接口使用认证用户 ID；响应错误码稳定；恢复版本只切换当前指针；任务成功创建未读通知。

- [ ] **步骤 4：运行测试与类型检查**

```bash
cd apps/api
pnpm exec node --import tsx --test test/user-notification.service.test.ts test/deep-analysis.service.test.ts test/deep-analysis-job.test.ts
node --test test/deep-analysis-route.test.mjs
npx tsc --noEmit
```

- [ ] **步骤 5：提交**

```bash
git add apps/api/src/routes/deep-analysis.ts apps/api/src/routes/articles.ts apps/api/src/services/user-notification.service.ts apps/api/src/index.ts apps/api/test/deep-analysis-route.test.mjs apps/api/test/user-notification.service.test.ts
git commit -m "feat(api): 开放深度报告与通知接口"
```

### Task 5：Web 状态入口与报告抽屉

**文件：**

- 修改：`apps/web/src/lib/api.ts`
- 修改：`apps/web/src/components/article/WechatArticleCard.tsx`
- 修改：`apps/web/src/components/article/WechatDetailPanel.tsx`
- 创建：`apps/web/src/components/article/DeepAnalysisPanel.tsx`
- 修改：`apps/web/src/app/globals.css`
- 测试：`apps/web/test/deep-analysis-panel.test.mjs`
- 测试：`apps/web/test/article-deep-analysis-state.test.mjs`

**接口：**

- 消费 Task 4 的 API 与 `deepAnalysis` 字段。
- 产出组件状态：未生成、排队、运行、成功、失败、过期、离线。

- [ ] **步骤 1：写 Web 失败测试**

覆盖卡片状态胶囊、详情入口卡、提交后异步返回、失败重试、旧报告可读、报告分区、历史版本、复制 Markdown、离线禁用、通知授权降级。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/web
node --test test/deep-analysis-panel.test.mjs test/article-deep-analysis-state.test.mjs
```

- [ ] **步骤 3：实现 Web UI**

保持现有卡片流、详情层和二级抽屉结构；报告面板复用现有主题变量；请求失败使用中文提示。

- [ ] **步骤 4：运行测试与构建**

```bash
cd apps/web
node --test test/deep-analysis-panel.test.mjs test/article-deep-analysis-state.test.mjs
pnpm build
```

- [ ] **步骤 5：提交**

```bash
git add apps/web/src/lib/api.ts apps/web/src/components/article/WechatArticleCard.tsx apps/web/src/components/article/WechatDetailPanel.tsx apps/web/src/components/article/DeepAnalysisPanel.tsx apps/web/src/app/globals.css apps/web/test/deep-analysis-panel.test.mjs apps/web/test/article-deep-analysis-state.test.mjs
git commit -m "feat(web): 增加深度报告入口与抽屉"
```

### Task 6：Android API、卡片状态、底部报告面板与缓存

**文件：**

- 修改：`apps/android/app/src/main/java/com/idickies/storing/network/ArticleApi.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/library/ArticleModels.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/library/ArticleRepository.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/ui/components/QiankunjieArticleCard.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/ui/components/ReaderActionBar.kt`
- 创建：`apps/android/app/src/main/java/com/idickies/storing/ui/DeepAnalysisSheet.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/database/ArticleCacheDatabase.kt`
- 测试：`apps/android/app/src/test/java/com/idickies/storing/library/DeepAnalysisModelsTest.kt`
- 测试：`apps/android/app/src/test/java/com/idickies/storing/reader/DeepAnalysisPresentationTest.kt`

**接口：**

- 产出 Retrofit API、`DeepAnalysisSummary`、`DeepAnalysisReport`、缓存 DTO、底部弹层与系统通知跳转。

- [ ] **步骤 1：写 Android 失败测试**

覆盖 JSON 序列化、卡片状态、底部第四操作位、报告分区、失败重试、离线禁用、通知点击定位、缓存账号隔离与删除失效。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/android
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk" ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew :app:testDebugUnitTest --tests '*DeepAnalysis*'
```

- [ ] **步骤 3：实现 Android**

沿用 Material 3、现有底部导航高度和 ModalBottomSheet；系统通知复用现有通道策略；缓存写入 Room 并按用户与文章组合键隔离。

- [ ] **步骤 4：运行定向测试与 Lint**

```bash
cd apps/android
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk" ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew :app:testDebugUnitTest :app:lintDebug :app:compileReleaseKotlin --no-daemon
```

- [ ] **步骤 5：提交**

```bash
git add apps/android
git commit -m "feat(android): 支持深度报告查看与提醒"
```

### Task 7：macOS 模型、列表状态、Inspector 面板与缓存

**文件：**

- 修改：`apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Models/ArticleModels.swift`
- 创建：`apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Models/DeepAnalysisModels.swift`
- 修改：`apps/macos/Packages/QiankunjieKit/Sources/QiankunjieNetworking/APIClient.swift`
- 修改：`apps/macos/QiankunjieMac/Features/Library/CompactArticleListView.swift`
- 修改：`apps/macos/QiankunjieMac/Features/Reader/ArticleActionBar.swift`
- 创建：`apps/macos/QiankunjieMac/Features/Reader/DeepAnalysisInspector.swift`
- 修改：`apps/macos/QiankunjieMac/App/CollectNotificationService.swift`
- 修改：`apps/macos/Packages/QiankunjieKit/Sources/QiankunjieReader/ReaderArticleCache.swift`
- 测试：`apps/macos/QiankunjieMacTests/DeepAnalysisModelsTests.swift`
- 测试：`apps/macos/QiankunjieMacTests/DeepAnalysisPresentationTests.swift`

**接口：**

- 产出 Swift Codable 模型、API 方法、列表状态、Inspector、通知事件和缓存字段。

- [ ] **步骤 1：写 macOS 失败测试**

覆盖解码兼容、列表状态、操作栏入口、Inspector 分区、历史版本、失败重试、离线禁用、通知点击、缓存账号隔离与旧缓存兼容。

- [ ] **步骤 2：运行测试确认失败**

```bash
pnpm macos:test --filter DeepAnalysis
```

- [ ] **步骤 3：实现 macOS**

保持三栏结构和右侧 Inspector 浮层；使用 `UserNotifications`；缓存跟随现有 ReaderArticleCache 生命周期和账号键。

- [ ] **步骤 4：运行 macOS 测试**

```bash
pnpm macos:test
```

- [ ] **步骤 5：提交**

```bash
git add apps/macos
git commit -m "feat(macos): 支持深度报告 Inspector 与提醒"
```

### Task 8：跨端契约、发布文档与总验收

**文件：**

- 创建：`apps/api/test/deep-analysis-cross-client-contract.test.mjs`
- 修改：`README.md`
- 创建：`CHANGELOG.md`
- 修改：`docs/PRD-AI-Enhanced-Reading.md`

**接口：**

- 消费所有前序任务产物。

- [ ] **步骤 1：写跨端契约失败测试**

断言三端字段名、状态枚举、API 路径、离线策略和通知文案一致；断言没有端直接写普通摘要状态。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/api
node --test test/deep-analysis-cross-client-contract.test.mjs
```

- [ ] **步骤 3：补齐文档与发布说明**

README 增加功能说明；创建根 CHANGELOG 并使用 `新增 / 优化 / 修复`；PRD 状态改为已实现并记录已知限制。

- [ ] **步骤 4：运行总验收**

```bash
cd apps/api && npx tsc --noEmit && pnpm exec node --import tsx --test test/deep-analysis*.test.ts && node --test test/deep-analysis*.test.mjs
cd ../web && node --test test/deep-analysis*.test.mjs && pnpm build
cd ../android && export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk" ANDROID_HOME="$HOME/Library/Android/sdk" && ./gradlew :app:testDebugUnitTest :app:lintDebug :app:compileReleaseKotlin --no-daemon
cd .. && pnpm macos:test
```

- [ ] **步骤 5：人工验收**

用同一账号分别在 Web、Android、macOS 提交、查看、重试和重新生成；断网验证离线读取；确认系统通知点击定位；确认普通摘要状态不变。

- [ ] **步骤 6：提交**

```bash
git add apps/api/test/deep-analysis-cross-client-contract.test.mjs README.md CHANGELOG.md docs/PRD-AI-Enhanced-Reading.md
git commit -m "feat: 完成AI增强阅读跨端支持"
```
