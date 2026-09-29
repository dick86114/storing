# 乾坤戒 macOS UI Lab 与截图验收

UI Lab 是 Debug 构建专用的固定场景入口。它通过 `--ui-lab <scenario>` 渲染可重复的界面夹具，用于 UI 评审和端到端截图验收。Release 构建不包含 UI Lab 类型，也不会暴露该启动参数。

## 数据边界

UI Lab 不访问真实账号、Keychain、SwiftData 用户缓存、生产 API 或用户文件。登录、资料库、任务和更新全部使用进程内固定夹具；阅读器 WebView 使用非持久化存储、禁用 JavaScript，只加载内置 HTML。测试用户固定为 `9001`，文章固定为 `1001`。

## 构建和启动

```bash
apps/macos/scripts/macos-ui-lab.sh login
```

脚本会校验 Xcode、生成工程、构建 Debug App、启动指定场景，并输出截图路径。可用场景与脚本接口保持一致：`login`、`library`、`empty`、`loading`、`offline`、`reader`、`collect`、`tasks`、`settings`、`update`。

## 场景与截图路径

| 场景 | 验收重点 | 手动截图路径 |
| --- | --- | --- |
| `login` | 品牌、用户名、密码、提交按钮 | `artifacts/macos-ui-lab/login/light.png`、`dark.png` |
| `library` | 三栏布局、列表、选中态、阅读详情 | `artifacts/macos-ui-lab/library/light.png`、`dark.png` |
| `empty` | 空态标题、图标、留白 | `artifacts/macos-ui-lab/empty/light.png`、`dark.png` |
| `loading` | 进度、文案和稳定高度 | `artifacts/macos-ui-lab/loading/light.png`、`dark.png` |
| `offline` | 离线图标、中文错误、重试 | `artifacts/macos-ui-lab/offline/light.png`、`dark.png` |
| `reader` | 长文、长链接、代码、宽表和关闭按钮 | `artifacts/macos-ui-lab/reader/light.png`、`dark.png` |
| `collect` | 链接输入、提交按钮、运行中任务 | `artifacts/macos-ui-lab/collect/light.png`、`dark.png` |
| `tasks` | `pending`/`running`/`completed`/`failed`；完成行打开文章、失败行重试、终态行删除任务 | `artifacts/macos-ui-lab/tasks/light.png`、`dark.png` |
| `settings` | 版本、环境、外观和快捷键 | `artifacts/macos-ui-lab/settings/light.png`、`dark.png` |
| `update` | 新版本、更新说明、下载和 SHA-256 | `artifacts/macos-ui-lab/update/light.png`、`dark.png` |

截图只保存在本机 `artifacts/` 目录，不应提交包含真实路径、账号或系统隐私的图片。每个场景至少保留浅色和深色证据；交互验证时补充点击前后的截图。

## 验收清单

1. 登录场景可展示完整表单，且不触发认证请求。
2. 三栏资料库、紧凑列表、空态、加载和离线重试可在对应宽度下正确呈现。
3. 阅读器长文、代码块和宽表不破坏版面；WebView 不保留会话数据。
4. 菜单栏/快捷键采集画面对应 `collect`；`tasks` 必须展示 `pending`、`running`、`completed` 和 `failed`，并只允许完成行打开文章、失败行重试、终态行删除任务。
5. 设置和更新场景展示版本、镜像状态、下载和校验文案。
6. Release 构建 `QiankunjieMac.app/Contents/MacOS/QiankunjieMac --ui-lab reader` 不应打开 UI Lab。
