# 乾坤戒 Android 原生客户端开发计划

**状态：** 已批准，分阶段实施  
**唯一生产 API：** `https://storing.idickies.com/api/v1`  
**应用标识：** `乾坤戒` / `com.idickies.storing`

## 固定技术决策

- Android 工程位于 `apps/android`，使用 Kotlin、Jetpack Compose、单 Activity、Navigation Compose、ViewModel + StateFlow、Hilt、Room、OkHttp/Retrofit、Coil 和 WorkManager。
- 仅支持 Android 12 及以上（`minSdk 31`），首期使用 `compileSdk 36` 和 `targetSdk 36`。
- UI 延续现有 Storing 品牌，但采用 Android 原生组件和交互。
- 阅读器由 Compose 原生壳、受控 WebView 和服务端清理过的正文构成；外部链接交由系统浏览器处理。
- App 固定访问正式 API，不提供服务器切换、旧域名兼容或证书锁定。
- 分享入口只接收 HTTP/HTTPS URL，展示轻量确认页后提交。
- 采集状态使用前台轮询、WorkManager 补偿和本地通知；首期不接入 FCM。
- 列表数据可缓存；正文和图片只在用户明确下载后提供离线阅读。
- APK 自托管发布并在 App 内检查更新；签名密钥不进入仓库。

## 分阶段交付

### 阶段 0：规格与兼容性基线

- 固定移动端 API、DTO、数据库迁移和回滚边界。
- 为关键 Web/API 返回新增契约测试。
- 保存 API、Web、MCP 构建与测试基线。

### 阶段 1：工程骨架与移动认证

- 创建模块化 Compose 工程、设计系统、网络层、Room 和 Hilt 基础设施。
- 新增 `mobile_sessions`，实现 Access/Refresh Token 登录、刷新、注销、会话列表与撤销。
- Web Cookie 登录和 MCP API Key 不变。

### 阶段 2：分享采集与首个日用版本

- 接收系统分享、提取 URL、确认并异步提交移动采集任务。
- 跟踪采集状态、通知结果、离线待提交重试。
- 交付收件箱、收藏、归档、搜索、阅读、收藏/归档/删除与 APK 更新检查。

### 阶段 3：普通用户功能对齐

- 完成发布、重新抓取、AI 重生成、筛选、排序、公开文章、分享海报、阅读设置和设备会话管理。

### 阶段 4：手动离线下载

- 下载指定正文、封面和图片，使用 App 私有目录离线阅读并提供空间管理。

### 阶段 5：个人 MCP

- 原生化个人 MCP Client、配额、密钥轮换和调用日志。

### 阶段 6：管理员与平台管理

- 原生化用户管理、跨用户资料库、平台 MCP 管理和审计日志。

### 阶段 7：稳定版加固

- 生物识别、深链/App Links、发布校验、诊断导出、真机回归和稳定版发布。

## 兼容与安全原则

- 服务端变更只新增表、接口、索引或兼容字段；先部署服务端，再发布客户端。
- 移动 Refresh Token 仅保存哈希；Access Token 不写入普通偏好、日志或诊断导出。
- 角色、文章和任务归属始终以服务端授权为准。
- WebView 禁止本地文件访问、任意 Intent 和非预期导航；JavaScript 默认关闭。
- 每个阶段须完成 API、Web、MCP 回归，Android 自动测试和小米/澎湃 OS 真机验收后再推进。
