# Android 分类体验阶段二实施报告

日期：2026-10-24

分支：`codex/category-ux-refresh`

实现提交：`b80854f feat(android): 统一分类目录与分类选择体验`

## 状态

阶段二 Android 实施完成。改动范围仅限 `apps/android` 及本报告；未修改 Web、macOS、API 或数据库。

## 复审修复记录

复审发现的 Important/Minor 项已全部处理：

1. 详细规则一次创建：
   - `CategoryAssignmentSheet` 将完整 `CategoryMutationRequest` 直接传给目录仓库。
   - 名称、说明、适合/不适合示例和颜色进入同一次 `POST /categories`。
   - 管理页删除“先创建、再 PATCH 详细规则”的两阶段路径，避免创建成功但规则保存失败造成半成功。
   - 新增请求字段序列化测试和“只调用完整创建入口”契约测试。
2. 批量部分成功：
   - `CategoryAssignmentResult.Success/Partial` 现在携带 `succeededIds`，部分结果额外携带 `skippedIds`、`failedIds`。
   - 页面从本次请求的 `selectedArticleIds` 精确移除成功与跳过项，只保留失败项用于重试。
   - 完整成功时退出批量模式；全部归档视图和当前分类等于目标分类时，成功文章同样不会残留在选择集中。
   - 仅有成功与跳过、`failedIds` 为空时返回可关闭的 `CompletedWithSkipped` 终态，文案为“分类已完成，部分文章被跳过”，不提示重试；只有存在失败项时才返回 `Partial` 并提示重试失败项。
   - 新增状态测试覆盖成功、跳过、失败、无失败跳过终态及请求异常时的选择集变化。
3. 归档筛选失效：
   - 共享目录更新时校验 `archiveCategoryId` 是否存在且启用。
   - 删除、停用或合并当前分类后，自动清空分类筛选和旧文章并重新加载全部归档。
   - 从管理页返回时调用同一校验入口。
   - 新增失效/停用分类状态测试。
4. 管理与错误反馈：
   - 保存中通过 `categoryDragEnabled(saving)` 禁用拖拽手柄。
   - 删除与合并 Bottom Sheet 均显示当前 `state.error`。
   - UI Lab 新增 `category-management-error` 固定错误态，AVD 实测合并弹层显示错误文案。

## 已实现

### 1. 用户级共享分类目录

- 新增 `CategoryCatalogRepository`，作为归档 Chip、分类选择器、文章详情和分类管理页共用的唯一目录数据源。
- 目录同时保存启用/停用分类、文章计数、加载/错误状态和最近使用；选择器只派生启用分类。
- 用户切换时创建新代际并清空内存目录，旧账号的晚到响应不能覆盖新账号状态。
- 分类创建、更新、删除、排序、合并后刷新同一共享状态，归档页与管理页无需各自重复请求。
- 归档页标题显示当前分类名称和文章数；分类目录加载失败时保留缓存并提供“重试分类”。

### 2. 最近使用

- 新增 `RecentCategoryStore`，使用按用户 ID 分区的 SharedPreferences key。
- 最近分类最多 5 个，去重并按最近使用倒序。
- 每次成功手工分类或创建并分类后记录。
- 每次目录刷新会清理已删除、停用或不属于当前用户的分类 ID。
- 切号后本地 UI 状态通过 `username` key 重置，最近使用读取新账号分区。

### 3. 统一分类选择器

- 单篇、批量修改分类、批量归档和归档入口统一复用 `CategoryAssignmentSheet` Compose Bottom Sheet。
- 打开后搜索框自动聚焦；搜索支持名称包含匹配。
- 内容顺序为：搜索、AI 判断、最近使用、全部分类、创建/创建并分类动作。
- 同名精确匹配时显示并使用现有分类，不显示创建动作。
- 搜索无结果时显示“创建‘名称’并分类”。
- 详细规则默认折叠，可选择预设颜色或沿用稳定默认色。
- 请求提交期间锁定按钮和关闭操作；连续提交不会重复发出。
- 批量结果区分完整成功、部分成功、跳过和失败；部分成功时保留选择器与上下文。
- 创建成功但分类失败时保留新分类、搜索内容和选择器，并显示独立失败文案。
- 支持 Esc/系统返回关闭；焦点等待输入框完成首帧布局后再请求，避免启动崩溃。

### 4. 轻量创建

- 名称必填且限制 40 字符，默认颜色由名称稳定生成。
- 选择器与管理页共用 `CategoryQuickCreateFields`。
- 说明、适合收录、不适合收录和颜色位于“详细规则（可选）”内。
- 支持 AI 优化说明。
- 同名校验优先使用现有分类；服务端同名冲突后刷新目录并恢复现有分类，保留输入上下文。

### 5. 归档 Chip 与管理入口

- 归档页保留横向分类 Chip，依次为“全部”、系统分类和用户分类。
- Chip 行末尾增加“管理”入口，可横向滚动到达。
- 当前分类由顶部标题展示名称与文章数。
- 分类加载错误显示可重试提示。
- 从分类管理返回时主动刷新共享目录与文章计数。

### 6. 分类管理页

- 改为“搜索 + 分类列表 + 详情”结构；移动端详情使用 Bottom Sheet，避免重新堆叠大卡片。
- 系统分类固定，不显示拖拽、编辑、停用、删除和合并操作，并明确提示不可修改。
- 用户分类显示拖拽手柄，可拖动排序；同时提供“上移/下移”按钮作为键盘和辅助功能替代。
- 支持轻量创建、完整规则编辑、AI 优化、启停、迁移删除和合并分类。
- 合并分类接入现有 Android API：`POST categories/merge`。
- 成功操作使用 Snackbar 弱提示；失败时保留表单和详情上下文。

### 7. UI Lab 固定场景

- `categories`：分类管理固定数据，含系统、启用、停用和不同颜色分类。
- `category-picker`：统一选择器固定数据，含最近使用、同名词条、AI、无结果创建及固定失败态。
- `library`：更新归档 Chip 固定场景，验证末尾“管理”入口。
- 支持 `FORCE_DARK_THEME` 固定深色模式。

## 验证结果

### 自动化验证

- `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools pnpm android:test`
  - 通过。
  - 261 个测试，0 failures，0 errors，0 skipped。
- `cd apps/android && ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew :app:compileDebugKotlin --no-daemon`
  - `BUILD SUCCESSFUL`。
- `cd apps/android && ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew :app:lintDebug --no-daemon`
  - `BUILD SUCCESSFUL`。
- `git diff --check`
  - 通过。

### AVD 真实验证

环境：`Qiankunjie_API_36`，Android 16，headless AVD，1080×2400。

已验证：

- 分类管理浅色模式：列表、搜索、系统/用户分类、拖拽手柄、上移/下移按钮、停用状态与文章数显示正常。
- 分类管理深色模式：文字、颜色点、选中和提示态可辨识。
- 用户分类详情：完整规则、颜色、保存区和 AI 优化入口可滚动访问。
- 系统分类详情：显示“系统分类固定，不能编辑、停用或删除。”，无编辑操作。
- 轻量创建：只有名称输入和折叠的“详细规则（可选）”，按钮在名称为空时禁用。
- 归档 Chip：横向滚动后“管理”入口可达。
- 统一选择器：输入框实际获得焦点（UI Automator `focused=true`）。
- 输入 `Design` 后无结果时出现“创建‘Design’并分类”。
- 点击创建后，UI Lab 固定失败态显示“UI Lab 固定失败态：Design”，输入 `Design` 和创建按钮仍保留。
- 修复后重新运行上述场景，crash buffer 无新异常。
- 复审后重新启动 Android 16 AVD：统一选择器自动聚焦仍通过（UI Automator `focused=true`）。
- 复审后新增 `category-management-error` 场景；实测进入用户分类详情的合并分类弹层，错误文案“分类合并失败：网络连接已中断，请重试。”可见，crash buffer 无新异常。

AVD 验证期间发现并修复了 `FocusRequester is not initialized` 启动崩溃：改为在输入框完成首帧布局后请求焦点，并重新安装 APK 回归通过。

## 技术说明

- 共享目录请求使用互斥锁串行化，避免创建/刷新并发覆盖。
- 响应写入同时校验用户 ID 与 generation。
- 选择器渲染使用当前活跃分类；管理页使用完整目录以保留停用分类。
- 最近使用不进入服务端，仅保存在本机当前用户分区。
- 分类操作结果使用结构化结果类型，区分完整成功、部分成功、创建后分类失败和普通失败。
- `artifacts/` 保持未跟踪，未提交任何构建截图或产物。

## 剩余项

- 未使用真实登录账号对分类创建、排序、合并和删除执行线上 API 端到端操作；这些路径已通过编译、请求字段测试、接口契约代码和策略测试覆盖，AVD 使用固定 UI Lab 数据验证交互。
- 批量成功/跳过/失败的 ID 状态及“无失败跳过终态”已用状态测试覆盖，但尚未用真实后端构造部分成功响应做设备级联调。
- 未在 Xiaomi/HyperOS 等物理设备验证；本次真实渲染验证环境为 Android 16 AVD。
- 未新增 Compose instrumentation 测试；现有回归由 JVM 行为测试、源码契约测试和 AVD 手工场景共同覆盖。
