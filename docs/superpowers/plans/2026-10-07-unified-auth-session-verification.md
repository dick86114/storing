# 三端统一认证会话验证记录

日期：2026-10-08
分支：`codex/unified-auth-sessions`
验证 HEAD：`3a0cbcb`
基线：`origin/master`（`f77b7cd`）

## 结论

自动化验证已完成，实现可以进入人工验收和发布演练。尚未完成真机端到端手测和 staging 数据库迁移演练，因此不能宣称“端到端发布完成”。

## 已证实

### API

命令：

```bash
cd apps/api
NODE_OPTIONS=--disable-warning=DEP0205 pnpm exec tsx --test test/*.test.mjs test/*.test.ts
pnpm build
```

结果：217/217 通过，TypeScript 构建通过。

覆盖：

- 通用会话窗口：90 天空闲、365 天绝对过期。
- 刷新轮换事务、60 秒宽限恢复、3 次上限。
- Web opaque Cookie、旧 JWT 迁移契约、CSRF 双 Cookie。
- 认证错误码矩阵。
- Android、macOS、浏览器扩展会话隔离。
- 移动刷新禁用会话按 Android 撤销，不误标为浏览器扩展。

### Web

命令：

```bash
cd apps/web
node --test test/*.mjs
pnpm lint
pnpm build
```

结果：57/57 通过，lint 通过，Next.js 生产构建通过。

覆盖：

- `ApiRequestError` 保留 HTTP status 和服务端错误码。
- AbortError 语义保留。
- 3 秒兜底超时移除，`/verify` 显式 10 秒超时。
- 网络失败进入 `bootFailed`，不进入未登录态。
- 私有路由只在明确 unauthenticated 时重定向。
- 启动失败显示重试。
- 根路由同时识别新旧 Cookie。

### 浏览器扩展

命令：

```bash
pnpm --filter browser-extension test
pnpm --filter browser-extension lint
```

结果：4 个测试文件、9 个测试全部通过，TypeScript 检查通过。

### Android

命令：

```bash
cd apps/android
./gradlew :app:testDebugUnitTest
./gradlew lint
./gradlew assembleRelease
./gradlew compileReleaseKotlin
```

结果：

- Debug 全量单元测试通过。
- lint 无 error。
- `assembleRelease` 在最终打包阶段停止，原因是本机缺少四个正式签名 Secret：`QIANKUNJIE_RELEASE_STORE_FILE`、`QIANKUNJIE_RELEASE_STORE_PASSWORD`、`QIANKUNJIE_RELEASE_KEY_ALIAS`、`QIANKUNJIE_RELEASE_KEY_PASSWORD`。
- `compileReleaseKotlin` 通过。因此不能宣称正式 APK 构建完成。

### macOS

命令：

```bash
pnpm macos:test
bash apps/macos/scripts/build-dmg.sh
```

结果：

- macOS 全量测试通过，Xcode 输出 `TEST SUCCEEDED`。
- Release 构建通过。
- 生成并校验 `apps/macos/dist/Qiankunjie-0.1.0-arm64.dmg`、`apps/macos/dist/Qiankunjie.dmg` 和对应 SHA-256 文件。

### 仓库级

命令：

```bash
pnpm lint
pnpm build
git diff --check origin/master..HEAD
```

结果：全部通过，工作区干净。

### 安全抽查

检查命令覆盖：

- Keychain 写入 API：`SecItemAdd`、`SecItemUpdate`。
- Keychain 旧类型引用：`KeychainSessionStore`。
- 服务端日志中的 token、Cookie、密码、Authorization。
- Web 硬编码 Bearer token 和 localStorage token。

结果：

- `KeychainSessionStore` 已删除。
- `LegacyKeychainSessionStore` 只包含 `SecItemCopyMatching` 和 `SecItemDelete`，不包含写入 API。
- 新 token 正式持久化只写 `FileSessionStore`。
- 未发现认证日志输出敏感凭据。
- Web MCP 管理页的 Bearer header 属于用户输入的 MCP API Key，不属于 Storing 登录 token。

## 独立审查状态

计划要求全分支独立审查。已生成差异包：

`review-f77b7cd..57ce94b.diff`

两次派发独立审查代理均只返回通用项目约定确认，没有接收任务正文；最终审查降级为基于差异包和自动化结果的控制器自审。

自审发现并修复：

- Android mobile refresh 对禁用用户误用 `browser_extension` 会话撤销路径；已改为 `android`。
- macOS runtime 不再包含 `KeychainSessionStore`，只保留只读/清理的 `LegacyKeychainSessionStore`。

## 未验证 / 受阻

以下项没有通过，不得写成已完成：

1. Android 真机分享 URL 未登录 -> 页内登录 -> 自动提交。
2. Android 真机分享文件未登录 -> 页内登录 -> 自动导入。
3. Android 正式签名 APK 构建和安装。
4. macOS 真机菜单栏 QuickCollect 未登录 -> 面板内登录 -> 自动提交。
5. macOS 真机旧 Keychain token 到文件存储迁移。
6. macOS 真机旧 `android` 会话类型到 `macos` 会话迁移。
7. Web 浏览器慢网/断网/5xx 的真实 UI 手测。
8. Web 旧 JWT Cookie 在真实浏览器中的自动升级。
9. staging 或独立数据库上的 `mobile_sessions` 增量迁移演练和回填统计。
10. 修改密码后三端真实并发会话失效验证。

## 发布顺序

1. 先部署兼容版 API；确认健康检查通过。
2. 在 staging 或独立数据库副本执行 API 启动迁移，记录回填行数。
3. 部署 Web。
4. 发布 Android。
5. 发布 macOS。
6. 观察 refresh 成功率、宽限恢复次数、本地会话丢失率和未登录采集拦截次数。
7. 生产观察至少 30 天且兼容调用归零后，执行实施计划中的 Task 13 清理。

## 回滚

- API 回滚到 `f77b7cd` 镜像。
- Web 回滚到本次改造前前端镜像或静态构建。
- Android/macOS 停止分发新版本，用户继续使用旧安装包。
- 已新增的 nullable 数据列和索引可保留；不建议在观察期内反向迁移。
