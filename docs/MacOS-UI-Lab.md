# 乾坤戒 macOS UI Lab 与截图验收

UI Lab 是 Debug 构建专用的固定场景入口。它通过 `--ui-lab <scenario>` 渲染可重复的界面夹具，用于 UI 评审和端到端截图验收。Release 构建不包含 UI Lab 类型，也不会暴露该启动参数。

## 数据边界

UI Lab 不访问真实账号、Keychain、SwiftData 用户缓存、生产 API 或用户文件。登录、资料库、分类、任务和更新全部使用进程内固定夹具；阅读器 WebView 使用非持久化存储、禁用 JavaScript，只加载内置 HTML。测试用户固定为 `9001`，文章固定为 `1001`。

分类夹具包含系统分类“待整理”、启用的“工作”“技术”“学习”“生活”，以及停用的“旧项目”。最近使用固定为“工作”“技术”，保存在 UI Lab 专属的隔离 `UserDefaults` 中，不会读写真实用户的 `category.recents.<userID>` 数据。

## 构建和启动

```bash
apps/macos/scripts/macos-ui-lab.sh login
# 强制浅色或深色，便于分别截图
apps/macos/scripts/macos-ui-lab.sh update-notice light
apps/macos/scripts/macos-ui-lab.sh update-notice dark
```

脚本会校验 Xcode、生成工程、构建 Debug App、启动指定场景，并输出当前外观对应的截图路径。可用场景与脚本接口保持一致：`login`、`library`、`empty`、`loading`、`offline`、`reader`、`collect`（快速采集弹窗）、`tasks`（历史任务页）、`settings`、`update`、`update-notice`、`current-version`、`category-picker`（分类选择器）、`category-management`（分类管理）。第二个参数可省略，支持 `light` 或 `dark`；省略时使用系统外观，建议截图路径会标记为 `system.png`。

## 场景与截图路径

| 场景 | 验收重点 | 手动截图路径 |
| --- | --- | --- |
| `login` | 品牌、用户名、密码、提交按钮 | `artifacts/macos-ui-lab/login/light.png`、`dark.png` |
| `library` | 三栏布局、归档分类层级、列表、选中态、阅读详情；窄侧栏 | `artifacts/macos-ui-lab/library/light.png`、`dark.png` |
| `empty` | 空态标题、图标、留白 | `artifacts/macos-ui-lab/empty/light.png`、`dark.png` |
| `loading` | 进度、文案和稳定高度 | `artifacts/macos-ui-lab/loading/light.png`、`dark.png` |
| `offline` | 离线图标、中文错误、重试 | `artifacts/macos-ui-lab/offline/light.png`、`dark.png` |
| `reader` | 长文、长链接、代码、宽表和关闭按钮 | `artifacts/macos-ui-lab/reader/light.png`、`dark.png` |
| `collect` | 快速采集浮出弹窗：链接输入、读取剪贴板、提交按钮 | `artifacts/macos-ui-lab/collect/light.png`、`dark.png` |
| `tasks` | 历史任务页：`pending`/`running`/`completed`/`failed`；完成行打开文章、失败行重试、终态行删除任务 | `artifacts/macos-ui-lab/tasks/light.png`、`dark.png` |
| `settings` | 版本、环境、外观和快捷键 | `artifacts/macos-ui-lab/settings/light.png`、`dark.png` |
| `update` | 新版本、更新说明、下载和 SHA-256 | `artifacts/macos-ui-lab/update/light.png`、`dark.png` |
| `update-notice` | 更新完成后的版本信息、更新日志和深浅色主题 | `artifacts/macos-ui-lab/update-notice/light.png`、`dark.png` |
| `current-version` | 当前版本日志、刷新按钮、刷新后的结构和日志缓存更新 | `artifacts/macos-ui-lab/current-version/light.png`、`dark.png` |
| `category-picker` | 搜索、AI、最近使用、全部分类、当前分类、搜索无结果时的内联创建、部分成功与网络失败文案 | `artifacts/macos-ui-lab/category-picker/light.png`、`dark.png` |
| `category-management` | 列表与详情、轻量创建、高级规则入口、启用/停用/系统分类、重复名称与合并部分成功文案 | `artifacts/macos-ui-lab/category-management/light.png`、`dark.png` |

截图只保存在本机 `artifacts/` 目录，不应提交包含真实路径、账号或系统隐私的图片。每个场景至少保留浅色和深色证据；交互验证时补充点击前后的截图。

补充交互证据建议使用 `library/light-narrow.png`、`category-picker/light-no-result.png`、`category-picker/light-partial.png`、`category-picker/light-error.png` 和 `category-management/light-duplicate.png`，便于分别复核窄侧栏、内联创建、部分成功、网络失败与同名冲突。

## 验收清单

1. 登录场景可展示完整表单，且不触发认证请求。
2. 三栏资料库、紧凑列表、空态、加载和离线重试可在对应宽度下正确呈现。
3. 阅读器长文、代码块和宽表不破坏版面；WebView 不保留会话数据。
4. 菜单栏/快捷键采集画面对应 `collect`；`tasks` 必须展示 `pending`、`running`、`completed` 和 `failed`，并只允许完成行打开文章、失败行重试、终态行删除任务。
5. 设置和更新场景展示版本、镜像状态、下载和校验文案。
6. Release 构建 `QiankunjieMac.app/Contents/MacOS/QiankunjieMac --ui-lab reader` 不应打开 UI Lab。
7. `library` 在默认与最窄侧栏宽度下都不隐藏收件箱、收藏、归档和已发布，分类层级缩进清楚，且不依赖筛选菜单。
8. `category-picker` 打开后搜索框自动聚焦；最近使用顺序为“工作”“技术”，“技术”显示当前标记，全部分类中不重复混淆；加载、空态和错误状态不产生明显尺寸跳动。输入“工作”时必须出现“使用现有分类”建议。
9. 在 `category-picker` 输入没有匹配项的名称（例如“项目复盘”）后，“创建并分类”动作保持单行可读；点击“生活”后展示“成功 1 篇，跳过 1 篇，失败 1 篇”的部分成功文案，点击“由 AI 判断”后展示网络失败文案。
10. 在 `category-management` 选择“工作”查看列表与详情、轻量创建按钮和“编辑高级规则”；新建时输入已有名称“工作”应保留输入并显示同名冲突与“使用现有分类”动作。
11. 在 `category-management` 选择已停用的“旧项目”并合并到任一启用分类，确认“合并已提交，但分类目录刷新失败，请重试刷新”提示不溢出，随后可通过“刷新”恢复目录。
12. 深色模式下分类颜色点、当前/选中背景、停用状态和禁用按钮仍能清楚区分；所有固定截图均不包含真实账号、路径或用户数据。
13. `library` 先选择“工作”，再提交文章搜索并清除；搜索态与清除后都必须显示“全部文章”，侧栏“归档”主行保持一致，不能残留“工作”选中态。
14. `reader` 打开分类选择器并点击“学习”，应显示“分类已停用，请重新选择”，刷新后该分类从选择器移除。
15. `category-management` 新建分类后点击创建，并在两秒内的创建态点击取消；表单应关闭且显示“已取消创建。分类可能已在服务器创建，正在刷新分类目录”，不得静默进入新分类。
