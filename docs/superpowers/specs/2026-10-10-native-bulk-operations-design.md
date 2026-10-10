# macOS 与 Android 批量操作设计

日期：2026-10-10

## 目标

在 macOS 和 Android 原生客户端提供与 Web 一致的文章批量操作能力。用户可以在文章列表中多选当前已加载文章，执行批量状态变更、分类、AI 生成和导出，并清晰看到成功、跳过和失败结果。

服务端批量 API 已经在 `master` 上可用。本设计只覆盖原生客户端接入，不修改 API 契约。

## 范围

首期两端都支持：

- 批量收藏
- 批量取消收藏
- 批量归档
- 批量取消归档
- 批量删除
- 批量彻底删除
- 批量设置分类
- 批量重判分类
- 批量生成 AI 摘要和标签
- 批量发布
- 批量取消发布
- 批量导出 ZIP

平台差异：

- Android 不提供批量 Obsidian 导出。
- macOS 复用现有本机 Obsidian 导出器，新增批量 Obsidian 导出。
- Android 的批量分类和重判分类已有部分实现，本设计将其并入统一批量动作和结果模型。

明确不做：

- Android 直接写入 Obsidian 保管库
- 第三方笔记应用云同步
- 按筛选条件选择服务器端全部匹配文章
- 一次性执行超过 200 篇文章

## 交互原则

两端在列表工具栏提供「批量操作」入口。进入批量模式后：

- 卡片主体点击切换选择，不再打开阅读器
- 显示已选数量
- 支持全选当前已加载文章和反选
- 加载更多后保留已选 ID
- 列表刷新时自动移除已不存在的 ID
- 退出批量模式或切换筛选时清空选择

动作统一收敛到一个下拉或系统菜单，不在列表上铺开一排按钮。动作数量和文案按视图收敛：

- 收件箱：收藏、归档、删除、彻底删除、生成 AI、发布、导出 ZIP
- 收藏：取消收藏、归档、删除、彻底删除、生成 AI、发布、导出 ZIP
- 归档：收藏、取消收藏、取消归档、设置分类、重判分类、生成 AI、删除、彻底删除、发布、取消发布、导出 ZIP
- 已发布：取消发布、删除、彻底删除、导出 ZIP

macOS 在上述视图动作外额外提供「批量 Obsidian」。

所有动作必须先确认。普通删除和彻底删除使用危险样式；彻底删除明确提示不可恢复，并说明共享原文只会在没有其他用户引用时物理删除。设置分类先确认，再显示分类选择器。macOS 批量 Obsidian 先确认，再按已配置的 Obsidian 目录执行。

结果使用两端已有系统弹窗样式展示成功、跳过和失败数量；失败明细保留文章 ID、错误码和原因。发布成功项提供公开链接。导出 ZIP 在生成中显示进度状态，成功后提供下载或保存入口。

## API 契约

原生客户端复用以下已上线接口，单次最多 200 个正整数文章 ID：

`POST /articles/bulk-actions`

```json
{
  "action": "favorite",
  "articleIds": [1, 2]
}
```

响应包含 `requestedCount`、`succeededIds`、`skipped`、`failed`；发布动作还包含 `publications`。

`POST /articles/bulk-category` 继续用于设置分类，响应迁移为统一批量结果结构。

`POST /articles/bulk-regenerate-ai` 用于摘要、标签和重判分类。`includeCategory` 为 false 时只生成摘要和标签，为 true 时进入后台重判分类。

`POST /articles/bulk-export` 创建 ZIP 导出任务；`GET /articles/bulk-export/:jobId` 查询状态；`GET /articles/bulk-export/:jobId/download` 下载文件。

所有请求都必须携带当前用户认证。客户端不得假设返回 ID 顺序与请求一致，必须以服务端结果为准。

## Android 设计

### 数据层

新增模型和 Retrofit 接口：

- `ArticleBulkActionRequest`
- `ArticleBulkActionResult`
- `ArticleBulkIssue`
- `ArticleBulkAiRequest`
- `ArticleBulkAiResult`
- `ArticleBulkExportRequest`
- `ArticleBulkExportJob`

`ArticleApi` 新增：

- `POST articles/bulk-actions`
- `POST articles/bulk-regenerate-ai`
- `POST articles/bulk-export`
- `GET articles/bulk-export/{jobId}`

`ArticleRepository` 暴露类型化方法并统一错误信息：

- `runBulkAction(action, articleIds)`
- `bulkCategory(articleIds, categoryId)`
- `bulkRegenerateAi(articleIds, includeCategory)`
- `createBulkExport(articleIds)`
- `getBulkExport(jobId)`

现有 `moveToCategory(List<Int>)` 和 `classify(List<Int>)` 的旧调用点迁移到统一方法，避免两套批量语义并存。

### 状态层

`LibraryUiState` 新增：

- `bulkAction: BulkArticleAction?`
- `bulkRunning: Boolean`
- `bulkResult: NativeBulkResult?`
- `bulkExportJob: ArticleBulkExportJob?`

`NativeBulkResult` 是 UI 层结果模型，统一普通动作和 AI 动作的差异：

- `requestedCount`
- `succeededCount`
- `skippedCount`
- `issues`
- `publications`

`LibraryViewModel` 新增统一入口 `runBulkAction(action, articleIds)`。它根据动作分发到普通动作、分类、AI 或导出；成功后刷新当前列表、分类计数和全局计数；删除和彻底删除会从当前选择集与列表中移除成功 ID。导出任务单独轮询，间隔 1.5 秒，终态后停止。

Android 下载 ZIP 使用 OkHttp 携带当前会话凭证写入 `MediaStore.Downloads`，并发出系统通知。下载失败保留可重试提示，不静默丢弃。

### 界面层

扩展现有多选模式：

- 工具栏进入「批量操作」
- 卡片复用现有选择框和选择态
- 底部显示固定批量操作栏：全选、反选、「批量操作」下拉、退出
- 动作菜单使用 `DropdownMenu`
- 确认弹窗统一使用 `QiankunjieAlertDialog`
- 结果弹窗也使用 `QiankunjieAlertDialog`

导出成功后提供「打开 ZIP」或「下载 ZIP」；生成中禁止重复提交。批量运行时退出选择模式被禁用。

## macOS 设计

### 数据与状态

`QiankunjieLibrary` 新增批量模型和请求类型：

- `ArticleBulkAction`
- `ArticleBulkActionResult`
- `ArticleBulkIssue`
- `ArticleBulkAiResult`
- `ArticleBulkExportJob`
- `BulkOperationRequest`

`LibraryNetworkClient` 扩展类型化方法。`LibraryRepository` 增加与 Android 相同的批量方法，并保持现有列表加载接口不变。

`LibraryModel` 新增：

- `isBulkSelecting: Bool`
- `bulkSelection: Set<Int>`
- `bulkRunningAction: ArticleBulkAction?`
- `bulkResult: NativeBulkResult?`
- `bulkExportJob: ArticleBulkExportJob?`

选择方法包括 `toggleBulkSelection`、`selectAllLoaded`、`invertBulkSelection`、`removeFromBulkSelection`、`clearBulkSelection`。进入或退出批量模式会清空选择；刷新和分页会清理失效 ID。

批量动作成功后刷新当前页、计数和分类筛选。普通删除和彻底删除从列表与选择集中移除成功 ID。部分失败不关闭结果弹窗，用户可以继续处理失败项。

### 界面层

`LibraryToolbar` 增加批量模式切换。批量模式中：

- 卡片显示选择框
- 工具栏显示已选数量、全选、反选、「批量操作」菜单和退出
- 系统菜单列出当前视图允许的动作
- 确认使用 `.confirmationDialog` 或 `.alert`
- 结果和导出状态使用系统 alert

选择模式下点击卡片主体只切换选择；阅读器不打开。已打开的阅读器保持当前文章不变。

### Obsidian 批量导出

macOS 批量 Obsidian 复用现有本机 Obsidian 导出器和目录配置：

1. 用户确认批量 Obsidian。
2. 检查目录配置；未配置时提示先选择目录。
3. 按顺序导出所选文章。
4. 同名文件继续沿用现有追加序号策略。
5. 单篇失败不中断整批。
6. 结果弹窗显示成功、失败数量和失败原因。

ZIP 走服务端后台任务。完成后使用认证请求下载，`NSSavePanel` 选择保存位置，成功后提供「在访达中显示」。

## 错误处理

- 请求参数无效：显示服务端或本地中文错误
- AI 未配置：显示明确配置提示，不提交部分任务
- 单篇已处于目标状态：计入跳过
- 单篇服务端失败：计入失败，不阻断其他文章
- 认证失败：回到统一登录/刷新流程
- 网络失败：保留选择集和结果上下文
- 导出失败：保留失败原因，可重新提交

客户端不把部分失败包装成整体成功。运行中的动作禁用重复提交。

## 测试与验证

Android：

- Repository 请求体、路径和认证测试
- ViewModel 成功、跳过、失败、部分成功与状态刷新测试
- 动作可见性按视图收敛的测试
- 选择跨分页保留与失效 ID 清理测试
- `./gradlew -p apps/android testDebugUnitTest lintDebug`
- Release 包构建验证：`./gradlew -p apps/android assembleRelease`

macOS：

- 请求生成与解码测试
- 选择集策略测试
- 批量状态刷新与部分失败测试
- 按视图生成动作菜单测试
- Obsidian 批量导出的同名处理、单篇失败和结果汇总测试
- `pnpm macos:test`
- Release 构建验证：`xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -configuration Release -destination 'platform=macOS' -derivedDataPath apps/macos/.derivedData build`

人工验收：

- Android 在收件箱、收藏、归档和已发布四个入口各执行至少一次批量动作
- macOS 在同样四个入口各执行至少一次批量动作
- 两端都验证删除与彻底删除确认
- 两端都验证导出 ZIP
- macOS 验证批量 Obsidian

## 里程碑

1. Android API、状态层和现有批量能力迁移
2. Android 批量操作栏、确认、结果与 ZIP 下载
3. macOS 批量契约、选择模型和网络层
4. macOS 工具栏、确认、结果与导出
5. 双端 Release 构建、真机/桌面人工验收和回归测试
