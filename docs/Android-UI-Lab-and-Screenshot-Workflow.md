# 乾坤戒 Android UI Lab 与模拟器截图联调

## 目的

UI Lab 是只存在于 Debug APK 的演示入口。它通过固定夹具展示可重复的页面状态，避免 UI 评审依赖真实账号、网络、采集时机或频繁发布正式 APK。

```text
改 UI
  -> 构建 Debug APK
  -> ADB 安装到模拟器或已配对真机
  -> 启动指定 UI Lab 路由
  -> 导出 PNG 截图
  -> 对比、修改、重复
```

Release 构建不包含 UI Lab Activity 或夹具。

## 首期场景与稳定路由

| 路由 | 场景 | 用途 |
| --- | --- | --- |
| `login` | 产品 Logo、用户名 / 密码输入、禁用提交态 | 登录页浅色 / Nord 深色评审；不会请求认证接口 |
| `library` | 归档资料库卡片、采集进行中、排序与来源筛选 | 资料库、封面比例、卡片/紧凑列表、筛选芯片与紧凑导航评审 |
| `reader` | 真实受控 WebView：长文、内联宽图、长链接、引用与超宽表格 | 阅读器排版、外链边界、表格横向滚动和底部操作栏评审；不请求线上正文 |
| `poster` | 长标题、长摘要和二维码的公开文章海报 | 海报内容安全区、二维码区与深浅主题截图评审；不请求线上文章 |
| `share` | 单 URL、多 URL、无 URL | 分享确认页状态 |
| `tasks` | 进行中、完成、失败、重试 | 任务与后台说明页 |
| `states` | 加载、空态、错误与重试 | 通用状态反馈评审 |
| `settings` | 版本信息、手动检查更新、后台说明、账户退出 | 设置与更新页评审；Debug 构建不会请求 GitHub Release |

所有路由名称都是脚本接口；重命名时必须同步更新 `scripts/android-ui-lab.sh` 与单元测试。

## ADB 脚本

脚本位置：

```text
scripts/android-ui-lab.sh
```

常用命令：

```bash
# 检查 ADB、连接设备、模拟器和所需命令
scripts/android-ui-lab.sh doctor

# 构建并安装 Debug 包
scripts/android-ui-lab.sh install

# 进入 UI Lab 收件箱场景
scripts/android-ui-lab.sh launch library

# 进入后截图
scripts/android-ui-lab.sh screenshot library-default

# 一步构建、安装、启动并截图
scripts/android-ui-lab.sh capture reader reader-long-article
```

截图输出目录：

```text
artifacts/android-ui-lab/
```

该目录仅保存本地视觉产物，已忽略，不提交仓库。

## 创建模拟器

脚本位置：

```text
scripts/android-create-ui-emulator.sh
```

Apple Silicon Mac：

```bash
scripts/android-create-ui-emulator.sh
"$ANDROID_SDK_ROOT/emulator/emulator" -avd Qiankunjie_API_36
```

脚本会选择：

- Apple Silicon：`system-images;android-36;google_apis;arm64-v8a`
- Intel：`system-images;android-36;google_apis;x86_64`

首次运行需要下载 Emulator、平台工具和系统镜像，体积较大；不会由普通构建脚本自动执行。

## 真机无线 ADB（可选）

真机用于最终手势、澎湃 OS、分享和后台限制验证。完成一次配对后，也可以复用同一组 UI Lab 命令：

```bash
adb pair <手机 IP>:<配对端口>
adb connect <手机 IP>:<调试端口>
scripts/android-ui-lab.sh doctor
```

不要将 ADB 私钥、手机 IP、截图中可能出现的真实内容提交到仓库。

## UI 重构协作规则

1. 先在 UI Lab 使用固定场景确认布局、层级和视觉方向。
2. 每个页面先交付浅色、深色和异常状态截图，再进入下一页。
3. 真机仅检查系统级差异，不作为每轮视觉修改的唯一反馈渠道。
4. Debug UI Lab 可以包含演示数据，但不得使用真实 Token、API Key、正文或用户 URL。
5. `reader` 路由使用本地固定 HTML 和与正式阅读器相同的 WebView 安全配置；它可验证渲染和手势，不代表真实账号文章的端到端验收。
6. `settings` 的手动更新行在正式 Release APK 中会强制绕过每日检查间隔；Debug APK 为避免开发误触发布源而不会真正请求 Release。

## 阶段 2.5 当前收口边界

已完成模拟器基线：登录、资料库、真实 WebView 阅读器、分享采集、采集任务、状态反馈、设置与更新，均支持浅色或 Nord 深色截图联调。

仍需在进入阶段 3 前执行的非视觉验收：

- 小米 / 红米澎湃 OS 真机：系统分享、通知权限、电池优化说明、锁屏与杀进程后的任务恢复；
- 正式签名 Release APK：手动检查更新、发现新版本、下载 SHA-256 校验与系统安装器链路；
- 普通用户真实资料库：长文章、真实微信公众号封面、真实抓取 HTML 与大图滚动。
