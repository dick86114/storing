# macOS Native Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 `master` 新建并交付一个纯原生 macOS 客户端，完成游客阅读、登录、资料库、原文阅读、采集、菜单栏快捷采集、应用内更新和无证书分发闭环。

**Architecture:** 使用 XcodeGen 生成单一 macOS App，核心逻辑放在本地 Swift Package `QiankunjieKit` 的独立模块中。SwiftUI 负责窗口和页面，AppKit 负责菜单栏、全局快捷键和 Vibrancy 桥接，`WKWebView` 负责完整 HTML 阅读；服务端新增 `macos` 会话和采集来源，保持现有客户端契约不变。

**Tech Stack:** macOS 27、Xcode 27、Swift 6.4、SwiftUI、Observation、AppKit、SwiftData、URLSession、WKWebView、Keychain、Swift Testing、XCTest、Hono、Drizzle、Node test runner、GitHub Actions、XcodeGen、DMG。

**Spec:** `docs/superpowers/specs/2026-09-29-macos-native-client-design.md`

## Global Constraints

- 从 `master` 创建新分支 `codex/macos-native-rewrite`；不得修改或删除现有 `codex/macos-native-client` worktree。
- 包标识固定为 `com.idickies.storing.macos`，产品显示名固定为 `乾坤戒`。
- 仅支持 Apple Silicon `arm64`，最低系统为 macOS 27，Swift 编译器为 6.4、语言模式为 6.0。
- API 基地址固定为 `https://storing.idickies.cc/api/v1`，不提供服务器切换。
- 编译器基线为 Swift 6.4；Xcode 工程 `SWIFT_VERSION` 使用语言模式 `6.0`，并开启完整严格并发检查。
- 不启用 App Sandbox、Hardened Runtime、Developer ID、公证和 stapling。
- 不依赖 Sparkle、electron-updater 或第三方状态框架。
- 发布标签固定为 `macos-vX.Y.Z`，Release 资产包含通用 DMG 和带版本号、架构的 DMG。
- 视觉系统使用 Android“澄明书斋”令牌；品牌图形、微信图标、空状态插图和封面占位来自 `apps/android/app/src/main/res/`。
- 项目注释、测试名称、用户可见文案和文档使用中文。
- 每个任务结束必须运行该任务指定的测试并独立提交。

## Review Focus

- 无效、私有网络或本地 URL 必须在提交前拒绝，不能创建服务端任务。
- 过期或已撤销的 Refresh Token 必须清理本地会话，不能进入刷新循环。
- 账号切换后绝不能读取上一账号的 SwiftData 缓存。
- 阅读 HTML 不能通过脚本、本地文件导航或恶意链接逃逸受控 `WKWebView`。
- 更新下载中断、校验失败或替换失败时必须保留当前可运行版本。

---

### Task 1: macOS 会话服务端契约

**Files:**
- Modify: `apps/api/src/services/mobile-session.service.ts`
- Modify: `apps/api/src/middleware/auth.ts`
- Modify: `apps/api/src/routes/auth.ts`
- Test: `apps/api/test/macos-auth-contract.test.mjs`
- Modify: `apps/api/test/mobile-auth-contract.test.mjs`

**Interfaces:**
- Consumes: 现有 `mobile_sessions` 表、`createMobileSession`、`rotateMobileSession`、`revokeMobileSession`、`revokeMobileSessionByRefreshToken`、`revokeMobileSessionsForUser`。
- Produces: `ClientSessionType = 'android' | 'browser_extension' | 'macos'`；`generateMacOSAccessToken(userId: number, sessionId: string): string`；`POST /macos/auth/login`、`POST /macos/auth/refresh`、`POST /macos/auth/logout`、`GET /macos/auth/session`、`GET /macos/auth/sessions`、`DELETE /macos/auth/sessions/:id`。

- [ ] **Step 1: 写失败契约测试**

```javascript
test('macOS auth uses revocable macos sessions and leaves Android and extension sessions isolated', () => {
  const service = read('src/services/mobile-session.service.ts');
  const middleware = read('src/middleware/auth.ts');
  const route = read('src/routes/auth.ts');

  assert.match(service, /'android' \| 'browser_extension' \| 'macos'/);
  assert.match(middleware, /generateMacOSAccessToken/);
  for (const path of [
    '/macos/auth/login',
    '/macos/auth/refresh',
    '/macos/auth/logout',
    '/macos/auth/session',
    '/macos/auth/sessions',
  ]) {
    assert.match(route, new RegExp(path.replaceAll('/', '\\/')));
  }
  assert.match(route, /createMobileSession\(\{ userId: user\.id, device, clientType: 'macos' \}\)/);
  assert.match(route, /revokeMobileSessionsForUser\(user\.id, 'macos'\)/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd apps/api && node --test test/macos-auth-contract.test.mjs`

Expected: FAIL，缺少 `macos` 类型、辅助函数和路由。

- [ ] **Step 3: 实现 macOS 会话契约**

在 `mobile-session.service.ts` 扩展 `ClientSessionType`。在 `auth.ts` 中实现 `generateMacOSAccessToken`，把通用客户端 JWT 的 `client` 参数扩展为 `ClientSessionType`。在 `routes/auth.ts` 中新增 `macosAuthResponse` 和六个路由，复用 Android 的限流、设备校验、会话轮换和撤销逻辑，但所有查询与撤销都限定 `clientType: 'macos'`。修改密码时同时撤销 `android`、`browser_extension` 和 `macos` 会话。

- [ ] **Step 4: 运行新增和回归测试**

Run: `cd apps/api && node --test test/macos-auth-contract.test.mjs test/mobile-auth-contract.test.mjs && npx tsc --noEmit`

Expected: PASS，TypeScript 无错误。

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/services/mobile-session.service.ts apps/api/src/middleware/auth.ts apps/api/src/routes/auth.ts apps/api/test/macos-auth-contract.test.mjs apps/api/test/mobile-auth-contract.test.mjs
git commit -m "feat(api): add macOS client sessions"
```

### Task 2: macOS 采集服务端契约

**Files:**
- Modify: `apps/api/src/services/collect.service.ts`
- Modify: `apps/api/src/routes/collect.ts`
- Test: `apps/api/test/macos-collect-contract.test.mjs`
- Modify: `apps/api/test/mobile-collect-contract.test.mjs`

**Interfaces:**
- Consumes: `createCollectJob`、`listCollectJobs`、`getCollectJob`、`retryCollectJob`、`deleteCollectJob`、`clearFinishedCollectJobs`。
- Produces: `CollectRequestSource` 增加 `'macos'`；`POST /macos/collect` 接收 `{ url: string }`；`GET /macos/collect/jobs`；`GET /macos/collect/jobs/:id`；`POST /macos/collect/jobs/:id/retry`；`DELETE /macos/collect/jobs`；`DELETE /macos/collect/jobs/:id`。

- [ ] **Step 1: 写失败契约测试**

```javascript
test('macOS collection has isolated routes and uses the shared guarded worker', () => {
  const route = read('src/routes/collect.ts');
  const service = read('src/services/collect.service.ts');

  assert.match(route, /collectRoutes\.post\('\/macos\/collect'/);
  assert.match(route, /requestSource: 'macos'/);
  assert.match(route, /requestSource: \['android', 'android_share'\]/);
  assert.match(route, /requestSource: 'browser_extension'/);
  assert.match(service, /\| 'macos'/);
  assert.match(service, /\['web', 'android', 'android_share', 'browser_extension', 'macos'\]/);
  assert.match(service, /\['web', 'android', 'android_share', 'browser_extension', 'macos', 'mcp'\]/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd apps/api && node --test test/macos-collect-contract.test.mjs`

Expected: FAIL，缺少 macOS 路由和采集来源。

- [ ] **Step 3: 实现 macOS 采集来源和任务路由**

把 `macos` 加入 `CollectRequestSource`、`FIRST_PARTY_COLLECT_SOURCES`、worker 来源列表和进程重启恢复列表。新增 `/macos/collect` 及任务查询、重试、删除、清理路由，所有过滤器固定为 `requestSource: 'macos'`。实现必须继续通过 `createCollectJob` 进入共享队列，不得在路由内直接抓取。

- [ ] **Step 4: 运行新增和回归测试**

Run: `cd apps/api && node --test test/macos-collect-contract.test.mjs test/mobile-collect-contract.test.mjs test/web-collect-queue.test.mjs test/restart-orphan-worker-cleanup.test.mjs && npx tsc --noEmit`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/services/collect.service.ts apps/api/src/routes/collect.ts apps/api/test/macos-collect-contract.test.mjs apps/api/test/mobile-collect-contract.test.mjs
git commit -m "feat(api): add macOS collection queue"
```

### Task 3: macOS 工程骨架和构建脚本

**Files:**
- Create: `apps/macos/project.yml`
- Create: `apps/macos/Packages/QiankunjieKit/Package.swift`
- Create: `apps/macos/scripts/test.sh`
- Create: `apps/macos/scripts/build-dmg.sh`
- Create: `apps/macos/scripts/verify-xcode.sh`
- Modify: `package.json`
- Test: `apps/api/test/macos-project-config.test.mjs`

**Interfaces:**
- Consumes: XcodeGen 2.46.0、Xcode 27、Swift 6.4。
- Produces: `QiankunjieMac` app target；`QiankunjieMacTests` test target；包产品 `QiankunjieKit`；根命令 `pnpm macos:generate`、`pnpm macos:test`、`pnpm macos:build`。

- [ ] **Step 1: 写失败配置测试**

```javascript
test('macOS project fixes the latest platform and does not include share extension entitlements', () => {
  const project = read('../macos/project.yml');
  const packageJson = read('../../package.json');
  const build = read('../macos/scripts/build-dmg.sh');

  assert.match(project, /macOS: "27\.0"/);
  assert.match(project, /SWIFT_VERSION: "6\.0"/);
  assert.match(project, /SWIFT_STRICT_CONCURRENCY: complete/);
  assert.match(project, /ARCHS: arm64/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER: com\.idickies\.storing\.macos/);
  assert.doesNotMatch(project, /QiankunjieShareExtension|application-groups/);
  assert.match(packageJson, /macos:generate/);
  assert.match(build, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(build, /hdiutil create/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd apps/api && node --test test/macos-project-config.test.mjs`

Expected: FAIL，`apps/macos` 尚不存在。

- [ ] **Step 3: 创建工程、包和脚本**

创建 XcodeGen 工程，固定 macOS 27、Swift 编译器 6.4、Swift 语言模式 6.0、完整严格并发、arm64、Bundle ID `com.idickies.storing.macos`。创建本地 Swift Package，包含 `QiankunjieCore`、`QiankunjieNetworking`、`QiankunjieAuth`、`QiankunjieLibrary`、`QiankunjieCollect`、`QiankunjieReader`、`QiankunjieDesignSystem`、`QiankunjieUpdating`。`test.sh` 执行 `xcodegen generate`、`swift test` 和 `xcodebuild test`；`build-dmg.sh` 使用 `CODE_SIGNING_ALLOWED=NO` 构建并生成 DMG，支持 `MACOS_DMG_DRY_RUN=1`。

- [ ] **Step 4: 生成工程并跑空骨架测试**

Run: `pnpm macos:generate && pnpm macos:test`

Expected: PASS；`Qiankunjie.xcodeproj` 生成成功，主应用和测试 target 可编译。

- [ ] **Step 5: 提交**

```bash
git add apps/macos package.json apps/api/test/macos-project-config.test.mjs pnpm-lock.yaml
git commit -m "build(macos): scaffold native client project"
```

### Task 4: 核心领域模型

**Files:**
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Models/ArticleModels.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Models/LibraryModels.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Models/CollectModels.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore/Errors/AppError.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieCoreTests/DomainModelTests.swift`

**Interfaces:**
- Consumes: 服务端 JSON 字段命名和 Android 文章模型语义。
- Produces: `LibraryView`、`ArticleSort`、`SortOrder`、`LibraryQuery`、`ArticleCard`、`ArticleListPage`、`ArticleDetail`、`ArticleCounts`、`CollectJob`、`AppError`。

- [ ] **Step 1: 写失败模型测试**

```swift
import Testing
@testable import QiankunjieCore

@Test func articleCardDecodesServerSnakeCaseFields() throws {
    let data = #"{"id":7,"title":"测试","original_url":"https://example.com","is_favorited":true,"is_archived":false,"is_published":true}"#.data(using: .utf8)!
    let article = try JSONDecoder.qiankunjie.decode(ArticleCard.self, from: data)
    #expect(article.id == 7)
    #expect(article.originalURL == "https://example.com")
    #expect(article.isFavorited)
    #expect(article.isPublished)
}

@Test func libraryQueryCacheIdentityChangesWithEveryScopeField() {
    let base = LibraryQuery(view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, page: 1, perPage: 20)
    #expect(base.cacheIdentity != LibraryQuery(view: .archive, searchText: "swift", sort: .collected, order: .desc, source: nil, page: 1, perPage: 20).cacheIdentity)
    #expect(base.cacheIdentity != LibraryQuery(view: .archive, searchText: "", sort: .collected, order: .desc, source: "wechat", page: 1, perPage: 20).cacheIdentity)
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter DomainModelTests`

Expected: FAIL，模型和 JSONDecoder 扩展不存在。

- [ ] **Step 3: 实现模型和错误类型**

模型全部遵循 `Sendable`，需要跨 actor 传递的值类型遵循 `Hashable` 和 `Codable`。`LibraryQuery.cacheIdentity` 由 `userId`、`view`、规范化搜索词、排序、顺序、分类、来源和分页尺寸组成。`AppError` 分为 `.network`、`.authenticationRequired`、`.forbidden`、`.contentUnavailable`、`.invalidInput`、`.server`。

- [ ] **Step 4: 运行包测试**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCore apps/macos/Packages/QiankunjieKit/Tests/QiankunjieCoreTests
git commit -m "feat(macos): add core domain models"
```

### Task 5: 视觉系统和 Android 资源迁移

**Files:**
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieDesignSystem/QiankunjieTheme.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieDesignSystem/GlassSurface.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieDesignSystem/BrandAssets.swift`
- Create: `apps/macos/QiankunjieMac/Resources/Assets.xcassets/Contents.json`
- Create: `apps/macos/QiankunjieMac/Resources/Assets.xcassets/BrandLogo.imageset/Contents.json`
- Create: `apps/macos/QiankunjieMac/Resources/Assets.xcassets/QiankunjieMark.imageset/Contents.json`
- Create: `apps/macos/QiankunjieMac/Resources/Assets.xcassets/WechatSource.imageset/Contents.json`
- Create: `apps/macos/QiankunjieMac/Resources/Assets.xcassets/EmptyLibraryLight.imageset/Contents.json`
- Create: `apps/macos/QiankunjieMac/Resources/Assets.xcassets/EmptyLibraryDark.imageset/Contents.json`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieDesignSystemTests/ThemeTests.swift`

**Interfaces:**
- Consumes: Android `LightColors`、`DarkColors`、`LiquidGlassRole`、`ArticleVisualPalettes` 和品牌资源文件。
- Produces: `QiankunjieTheme`、`QiankunjieColors`、`LiquidGlassRole`、`GlassSurface`、`ArticleCoverFallback`、`BrandAssetName`。

- [ ] **Step 1: 写失败主题测试**

```swift
import Testing
import SwiftUI
@testable import QiankunjieDesignSystem

@Test func themeUsesApprovedClarityStudyTokens() {
    #expect(QiankunjieColors.lightBackground == Color(hex: 0xF3F7F3))
    #expect(QiankunjieColors.lightAccent == Color(hex: 0xB86F54))
    #expect(QiankunjieColors.darkBackground == Color(hex: 0x071A12))
    #expect(QiankunjieColors.darkAccent == Color(hex: 0xC9A84C))
}

@Test func glassRolesPreserveAndroidSemanticOrder() {
    #expect(LiquidGlassRole.allCases == [.panel, .chrome, .control, .accent])
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter ThemeTests`

Expected: FAIL，主题和颜色类型不存在。

- [ ] **Step 3: 实现设计令牌和资源**

实现浅色与深色色彩令牌、四级玻璃语义、`8/12/16pt` 圆角常量、文章封面四组渐变。把 Android 品牌图形、微信来源图标、亮暗空状态插图转换为 macOS Asset Catalog 资源；系统动作继续使用 SF Symbols。

- [ ] **Step 4: 运行主题测试和资源检查**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter ThemeTests && pnpm macos:build`

Expected: PASS；资源编译无缺失。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieDesignSystem apps/macos/Packages/QiankunjieKit/Tests/QiankunjieDesignSystemTests apps/macos/QiankunjieMac/Resources
git commit -m "feat(macos): add Clarity Study design system"
```

### Task 6: 网络层和 macOS 认证

**Files:**
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieNetworking/APIRequest.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieNetworking/APIClient.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieNetworking/TokenRefreshing.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/SessionTokens.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/KeychainSessionStore.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/AuthRepository.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/AuthModel.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieAuthTests/AuthRepositoryTests.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieNetworkingTests/APIClientTests.swift`

**Interfaces:**
- Consumes: Task 1 的 `/macos/auth/*` 契约、Task 4 的 `AppError`。
- Produces: `APIClient.send<T: Decodable & Sendable>(_ request: APIRequest, authenticated: Bool) async throws -> T`；`AuthRepository.login(username:password:device:) async throws -> AuthenticatedUser`；`AuthRepository.restore() async throws -> AuthenticatedUser?`；`AuthRepository.logout() async`；`@MainActor @Observable final class AuthModel`。

- [ ] **Step 1: 写失败认证测试**

```swift
@Test func refreshFailureClearsStoredSession() async throws {
    let store = MemorySessionStore(tokens: .fixture(access: "expired", refresh: "revoked"))
    let repository = AuthRepository(client: MockAuthClient(refreshResult: .failure(.authenticationRequired)), store: store)
    await #expect(throws: AppError.authenticationRequired) {
        _ = try await repository.refreshTokens()
    }
    #expect(await store.read() == nil)
}

@Test func concurrentRefreshRunsOnlyOnce() async throws {
    let client = CountingRefreshClient()
    let repository = AuthRepository(client: client, store: .fixture())
    async let a: Void = repository.refreshTokens()
    async let b: Void = repository.refreshTokens()
    _ = try await (a, b)
    #expect(await client.refreshCount == 1)
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter AuthRepositoryTests`

Expected: FAIL，网络和认证类型不存在。

- [ ] **Step 3: 实现网络、Keychain 和认证仓库**

`APIClient` 使用 `URLSession`，仅在收到 401 时调用单个 `TokenRefreshing` actor，并只重试一次。Refresh Token 使用 `kSecClassGenericPassword` 存储；Access Token 只保存在内存。错误响应解析服务端 `{ error: { code, message } }` 并映射到 `AppError`。

- [ ] **Step 4: 运行认证和网络测试**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter AuthRepositoryTests && swift test --package-path apps/macos/Packages/QiankunjieKit --filter APIClientTests`

Expected: PASS；并发刷新只执行一次。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieNetworking apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth apps/macos/Packages/QiankunjieKit/Tests/QiankunjieAuthTests apps/macos/Packages/QiankunjieKit/Tests/QiankunjieNetworkingTests
git commit -m "feat(macos): add networking and macOS auth"
```

### Task 7: 应用外壳、三栏导航和登录界面

**Files:**
- Create: `apps/macos/QiankunjieMac/App/QiankunjieApp.swift`
- Create: `apps/macos/QiankunjieMac/App/AppModel.swift`
- Create: `apps/macos/QiankunjieMac/App/RootWindow.swift`
- Create: `apps/macos/QiankunjieMac/App/SidebarView.swift`
- Create: `apps/macos/QiankunjieMac/Features/Auth/LoginView.swift`
- Test: `apps/macos/QiankunjieMacTests/AppModelTests.swift`

**Interfaces:**
- Consumes: Task 5 的设计系统、Task 6 的 `AuthModel`。
- Produces: `AppDestination`；`@MainActor @Observable final class AppModel`；`RootWindow`；`LoginView`；主窗口三栏切换行为。

- [ ] **Step 1: 写失败应用状态测试**

```swift
@Test func logoutClearsUserScopedSelectionAndNavigation() async {
    let model = AppModel.fixture(user: .fixture(id: 9), destination: .archive, selectedArticleID: 42)
    await model.didLogout()
    #expect(model.user == nil)
    #expect(model.destination == .published)
    #expect(model.selectedArticleID == nil)
}

@Test func adminDestinationIsAlwaysAbsentInFirstVersion() {
    #expect(AppDestination.allCases == [.inbox, .favorites, .archive, .published, .collect, .tasks, .search, .settings])
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -destination 'platform=macOS' test -only-testing:QiankunjieMacTests/AppModelTests`

Expected: FAIL，应用外壳不存在。

- [ ] **Step 3: 实现应用外壳和登录**

使用 `NavigationSplitView` 实现三栏结构；窄窗口自动折叠为列表和详情两级。游客默认进入发布页，登录后进入收件箱。登录页使用原生 SecureField、错误提示和提交状态，不显示服务器切换。

- [ ] **Step 4: 运行应用测试**

Run: `xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -destination 'platform=macOS' test -only-testing:QiankunjieMacTests/AppModelTests`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/QiankunjieMac/App apps/macos/QiankunjieMac/Features/Auth apps/macos/QiankunjieMacTests/AppModelTests.swift
git commit -m "feat(macos): add app shell and login"
```

### Task 8: 资料库列表、搜索、筛选和缓存

**Files:**
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryRepository.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryModel.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryCache.swift`
- Create: `apps/macos/QiankunjieMac/Features/Library/CompactArticleListView.swift`
- Create: `apps/macos/QiankunjieMac/Features/Library/LibraryToolbar.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests/LibraryModelTests.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests/LibraryCacheTests.swift`

**Interfaces:**
- Consumes: Task 4 的 `LibraryQuery`、`ArticleCard`、`ArticleListPage`、`ArticleCounts`；Task 6 的 `APIClient`。
- Produces: `LibraryRepository.load(_ query: LibraryQuery) async throws -> ArticleListPage`；`LibraryModel.load(reset:) async`；`LibraryModel.loadMore() async`；`LibraryCache.scope(for:userId:)`；`CompactArticleListView`。

- [ ] **Step 1: 写失败缓存和分页测试**

```swift
@Test func cacheLoadNeverReturnsAnotherUsersRows() async throws {
    let cache = try LibraryCache.inMemory()
    try await cache.save(.fixture(ids: [1, 2]), scope: .fixture(userID: 7, view: .inbox))
    #expect(try await cache.load(scope: .fixture(userID: 8, view: .inbox)) == nil)
}

@Test func loadMoreUsesTheStoredPageAndStopsAtLastPage() async {
    let repository = MockLibraryRepository(pages: [.fixture(ids: [1, 2], totalPages: 2), .fixture(ids: [3], totalPages: 2)])
    let model = LibraryModel(repository: repository, cache: .empty)
    await model.load(reset: true)
    await model.loadMore()
    await model.loadMore()
    #expect(model.articles.map(\.id) == [1, 2, 3])
    #expect(await repository.requestedPages == [1, 2])
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter LibraryModelTests && swift test --package-path apps/macos/Packages/QiankunjieKit --filter LibraryCacheTests`

Expected: FAIL，资料库类型不存在。

- [ ] **Step 3: 实现资料库状态和紧凑列表**

实现文章列表请求、搜索、排序、来源筛选、计数和滚动分页。SwiftData 缓存以 `userId`、资料库、搜索词、排序、分类和来源为作用域；账号切换时清理内存并切换模型作用域。列表使用 Task 5 的视觉令牌，显示小封面、标题、摘要、来源、时间和标签。

- [ ] **Step 4: 运行资料库测试和应用编译**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter Library && pnpm macos:build`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests apps/macos/QiankunjieMac/Features/Library
git commit -m "feat(macos): add library browsing and cache"
```

### Task 9: 完整 HTML 阅读器和文章操作

**Files:**
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieReader/ReaderNavigationPolicy.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieReader/ReaderModel.swift`
- Create: `apps/macos/QiankunjieMac/Features/Reader/ReaderWebView.swift`
- Create: `apps/macos/QiankunjieMac/Features/Reader/ReaderPaneView.swift`
- Create: `apps/macos/QiankunjieMac/Features/Reader/ArticleActionBar.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieReaderTests/ReaderNavigationPolicyTests.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieReaderTests/ReaderModelTests.swift`

**Interfaces:**
- Consumes: `GET /articles/:id?format=html&htmlVariant=desktop`、收藏、归档、发布、重新抓取、重新生成 AI、删除接口。
- Produces: `ReaderNavigationPolicy.decision(for: URL) -> ReaderNavigationDecision`；`ReaderModel.open(articleID:) async`；`ReaderModel.toggleFavorite() async`；`ReaderWebView`；`ReaderPaneView`；`ArticleActionBar`。

- [ ] **Step 1: 写失败阅读器策略测试**

```swift
@Test func fileAndCustomSchemeNavigationIsBlocked() {
    #expect(ReaderNavigationPolicy.decision(for: URL(string: "file:///etc/passwd")!) == .block)
    #expect(ReaderNavigationPolicy.decision(for: URL(string: "javascript:alert(1)")!) == .block)
    #expect(ReaderNavigationPolicy.decision(for: URL(string: "qiankunjie://collect")!) == .block)
}

@Test func httpLinksOpenOutsideTheReader() {
    #expect(ReaderNavigationPolicy.decision(for: URL(string: "https://example.com")!) == .openExternally)
}

@Test func readerLoadsDesktopHtmlVariant() async {
    let api = MockArticleClient()
    let model = ReaderModel(api: api)
    await model.open(articleID: 12)
    #expect(await api.lastHTMLVariant == "desktop")
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter Reader`

Expected: FAIL，阅读器类型不存在。

- [ ] **Step 3: 实现受控 WKWebView 和原生操作栏**

`WKWebView` 默认关闭 JavaScript、禁用本地文件访问；主文档导航只加载服务端 HTML，文章内外部链接交给系统浏览器。阅读器顶部使用原生信息栏和固定操作栏，正文下方完整渲染 HTML。实现收藏、归档、移回收件箱、发布、重新抓取、重新生成 AI、删除和打开原文。

- [ ] **Step 4: 运行阅读器测试和应用编译**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter Reader && pnpm macos:build`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieReader apps/macos/Packages/QiankunjieKit/Tests/QiankunjieReaderTests apps/macos/QiankunjieMac/Features/Reader
git commit -m "feat(macos): add HTML reader and article actions"
```

### Task 10: 主窗口采集和任务记录

**Files:**
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCollect/CollectUrlValidator.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCollect/CollectRepository.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCollect/CollectModel.swift`
- Create: `apps/macos/QiankunjieMac/Features/Collect/CollectView.swift`
- Create: `apps/macos/QiankunjieMac/Features/Collect/CollectTasksView.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieCollectTests/CollectUrlValidatorTests.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieCollectTests/CollectModelTests.swift`

**Interfaces:**
- Consumes: Task 2 的 `/macos/collect` 与任务接口。
- Produces: `CollectUrlValidator.validate(_ input: String) throws -> URL`；`CollectRepository.submit(url:)`；`CollectRepository.jobs(limit:offset:)`；`CollectModel.submit(_ input: String) async`；`CollectModel.refreshJobs() async`。

- [ ] **Step 1: 写失败采集测试**

```swift
@Test func invalidAndPrivateUrlsAreRejectedBeforeSubmission() {
    #expect(throws: AppError.invalidInput) { try CollectUrlValidator.validate("not a url") }
    #expect(throws: AppError.invalidInput) { try CollectUrlValidator.validate("http://127.0.0.1/a") }
    #expect(throws: AppError.invalidInput) { try CollectUrlValidator.validate("http://192.168.1.5/a") }
    #expect(throws: AppError.invalidInput) { try CollectUrlValidator.validate("file:///tmp/a.html") }
}

@Test func successfulSubmissionPollsUntilTerminalState() async {
    let repository = MockCollectRepository(statuses: ["pending", "running", "completed"])
    let model = CollectModel(repository: repository)
    await model.submit("https://example.com/article")
    #expect(model.currentJob?.status == "completed")
    #expect(await repository.submitCount == 1)
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter Collect`

Expected: FAIL，采集类型不存在。

- [ ] **Step 3: 实现 URL 校验、提交和任务状态**

校验只接受公开 HTTP/HTTPS URL，拒绝本地地址、私有网络、文件 URL 和无效主机。提交后立即插入任务状态，并使用轮询刷新；失败任务支持重试，终态任务支持删除，批量清理只删除已完成和失败任务。

- [ ] **Step 4: 运行采集测试和应用编译**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter Collect && pnpm macos:build`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCollect apps/macos/Packages/QiankunjieKit/Tests/QiankunjieCollectTests apps/macos/QiankunjieMac/Features/Collect
git commit -m "feat(macos): add collection jobs"
```

### Task 11: 菜单栏、全局快捷键和通知

**Files:**
- Create: `apps/macos/QiankunjieMac/AppKit/MenuBarController.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCollect/GlobalShortcut.swift`
- Create: `apps/macos/QiankunjieMac/AppKit/GlobalHotKeyManager.swift`
- Create: `apps/macos/QiankunjieMac/Features/Collect/QuickCollectPanel.swift`
- Create: `apps/macos/QiankunjieMac/App/CollectNotificationService.swift`
- Test: `apps/macos/QiankunjieMacTests/MenuBarStateTests.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieCollectTests/ShortcutMappingTests.swift`

**Interfaces:**
- Consumes: Task 10 的 `CollectModel`、Task 7 的 `AppModel`。
- Produces: `GlobalShortcut`；`CollectNotificationEvent`；`MenuBarController.togglePanel()`；`GlobalHotKeyManager.register(_ shortcut: GlobalShortcut)`；`QuickCollectPanel`；`CollectNotificationService.notify(job:) async`。

- [ ] **Step 1: 写失败快捷键和任务通知测试**

```swift
@Test func globalShortcutMappingSupportsApprovedChoices() {
    #expect(GlobalShortcut.default.commandKey == "s")
    #expect(GlobalShortcut.allCases.map(\.displayName) == ["⌥⌘S", "⇧⌘S", "⌃⌥S"])
}

@Test func completedAndFailedJobsProduceNotifications() {
    #expect(CollectNotificationEvent(job: .fixture(status: "completed")) == .completed)
    #expect(CollectNotificationEvent(job: .fixture(status: "failed")) == .failed)
    #expect(CollectNotificationEvent(job: .fixture(status: "running")) == nil)
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter ShortcutMappingTests && xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -destination 'platform=macOS' test -only-testing:QiankunjieMacTests/MenuBarStateTests`

Expected: FAIL，菜单栏与快捷键类型不存在。

- [ ] **Step 3: 实现菜单栏弹窗、快捷键和通知**

菜单栏图标和快捷键都打开同一个 `QuickCollectPanel`，共享 `CollectModel`。默认快捷键为 `⌥⌘S`，设置中可选 `⇧⌘S` 或 `⌃⌥S`。任务完成后发送通知，点击通知打开对应文章；失败时打开任务列表。

- [ ] **Step 4: 运行相关测试和应用编译**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter ShortcutMappingTests && xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -destination 'platform=macOS' test -only-testing:QiankunjieMacTests/MenuBarStateTests`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieCollect/GlobalShortcut.swift apps/macos/QiankunjieMac/AppKit apps/macos/QiankunjieMac/Features/Collect/QuickCollectPanel.swift apps/macos/QiankunjieMac/App/CollectNotificationService.swift apps/macos/QiankunjieMacTests/MenuBarStateTests.swift apps/macos/Packages/QiankunjieKit/Tests/QiankunjieCollectTests/ShortcutMappingTests.swift
git commit -m "feat(macos): add menu bar quick collect"
```

### Task 12: 设置、外观和设备会话

**Files:**
- Create: `apps/macos/QiankunjieMac/Features/Settings/SettingsWindow.swift`
- Create: `apps/macos/QiankunjieMac/Features/Settings/AppearanceSettingsView.swift`
- Create: `apps/macos/QiankunjieMac/Features/Settings/DeviceSessionsView.swift`
- Create: `apps/macos/QiankunjieMac/Features/Settings/SettingsModel.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/AppearancePreference.swift`
- Test: `apps/macos/QiankunjieMacTests/SettingsModelTests.swift`

**Interfaces:**
- Consumes: Task 1 的 `/macos/auth/sessions`、Task 5 的主题、Task 6 的 `AuthRepository`。
- Produces: `AppearancePreference`；`SettingsModel.setAppearance(_:)`；`SettingsModel.loadSessions() async`；`SettingsModel.revokeSession(id:) async`；`SettingsModel.logout() async`。

- [ ] **Step 1: 写失败设置测试**

```swift
@Test func appearancePreferenceResolvesSystemFollow() {
    #expect(AppearancePreference.system.resolvedColorScheme(system: .dark) == .dark)
    #expect(AppearancePreference.light.resolvedColorScheme(system: .dark) == .light)
}

@Test func logoutClearsTokensAndUserState() async {
    let model = SettingsModel.fixture()
    await model.logout()
    #expect(await model.sessionStore.read() == nil)
    #expect(model.authState.user == nil)
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -destination 'platform=macOS' test -only-testing:QiankunjieMacTests/SettingsModelTests`

Expected: FAIL，设置模型不存在。

- [ ] **Step 3: 实现设置页面**

设置页面展示版本、固定服务地址、外观切换、设备会话和退出登录。会话列表只展示 `macos` 会话；撤销当前会话后退出本地账号；退出登录清除 Keychain、SwiftData 用户缓存、任务和选中状态。首版不显示登录时启动和分享扩展开关。

- [ ] **Step 4: 运行设置测试和应用编译**

Run: `xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -destination 'platform=macOS' test -only-testing:QiankunjieMacTests/SettingsModelTests && pnpm macos:build`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/QiankunjieMac/Features/Settings apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/AppearancePreference.swift apps/macos/QiankunjieMacTests/SettingsModelTests.swift
git commit -m "feat(macos): add settings and sessions"
```

### Task 13: GitHub 更新与失败回滚

**Files:**
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieUpdating/AppRelease.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieUpdating/UpdateChecking.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieUpdating/GitHubUpdateService.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieUpdating/UpdateInstaller.swift`
- Create: `apps/macos/QiankunjieMac/Features/Settings/UpdateSettingsView.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieUpdatingTests/GitHubUpdateServiceTests.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieUpdatingTests/UpdateInstallerTests.swift`

**Interfaces:**
- Consumes: `https://api.github.com/repos/dick86114/storing/releases?per_page=100`、`https://github.com/dick86114/storing/releases.atom`。
- Produces: `AppRelease`；`DownloadedUpdate`；`UpdateServiceError`；`UpdateChecking.checkForUpdate() async throws -> AppRelease?`；`GitHubUpdateService.download(_ release: AppRelease, progress: @Sendable (Double?) -> Void) async throws -> DownloadedUpdate`；`UpdateInstaller.install(_ update: DownloadedUpdate) throws`。

- [ ] **Step 1: 写失败更新测试**

```swift
@Test func onlyNewerMacOSReleaseTagsAreSelected() async throws {
    let service = GitHubUpdateService.fixture(currentVersion: "1.2.0", releases: [
        .fixture(tag: "browser-extension-v9.9.9"),
        .fixture(tag: "macos-v1.2.0"),
        .fixture(tag: "macos-v1.3.0"),
    ])
    #expect(try await service.checkForUpdate()?.version == "1.3.0")
}

@Test func interruptedOrTamperedDownloadDoesNotInstall() async throws {
    let downloader = MockDownloader(result: .failure(.checksumMismatch))
    await #expect(throws: UpdateServiceError.checksumMismatch) {
        _ = try await downloader.download(.fixture(version: "1.3.0")) { _ in }
    }
}

@Test func installScriptBacksUpBeforeReplacing() {
    let script = UpdateInstaller.makeScript(source: "/tmp/new.app", destination: "/Applications/乾坤戒.app", pid: 99, version: "1.3.0")
    #expect(script.contains("backup"))
    #expect(script.contains("mv"))
    #expect(script.contains("CFBundleShortVersionString"))
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter Updating`

Expected: FAIL，更新模块不存在。

- [ ] **Step 3: 实现 GitHub 检查、断点下载和安装回滚**

GitHub API 失败时回退 Atom。版本标签只识别 `macos-vX.Y.Z`。下载支持镜像前缀、Range 续传、超时重试和 SHA-256 校验。安装器等待当前 PID 退出，备份旧应用，复制新应用，验证 `CFBundleShortVersionString`，启动新版本；启动失败时恢复备份。不验证 Developer ID 签名。

- [ ] **Step 4: 运行更新测试和应用编译**

Run: `swift test --package-path apps/macos/Packages/QiankunjieKit --filter Updating && pnpm macos:build`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieUpdating apps/macos/Packages/QiankunjieKit/Tests/QiankunjieUpdatingTests apps/macos/QiankunjieMac/Features/Settings/UpdateSettingsView.swift
git commit -m "feat(macos): add GitHub-backed updates"
```

### Task 14: macOS 发布工作流和 DMG

**Files:**
- Create: `.github/workflows/release-macos.yml`
- Create: `docs/MacOS-Client-Release.md`
- Modify: `apps/macos/scripts/build-dmg.sh`
- Modify: `apps/macos/scripts/verify-xcode.sh`
- Test: `apps/api/test/macos-release-workflow.test.mjs`

**Interfaces:**
- Consumes: Task 3 的构建脚本、Task 13 的 `macos-vX.Y.Z` 更新规则。
- Produces: 手动 GitHub Actions 发布；通用 DMG 与架构 DMG；首次运行说明；`macos-vX.Y.Z` Release。

- [ ] **Step 1: 写失败发布契约测试**

```javascript
test('macOS release workflow builds an unsigned arm64 DMG and publishes macos-v tags', () => {
  const repoRoot = new URL('../../', import.meta.url);
  const workflow = readFileSync(new URL('.github/workflows/release-macos.yml', repoRoot), 'utf8');
  const script = readFileSync(new URL('apps/macos/scripts/build-dmg.sh', repoRoot), 'utf8');
  const guide = readFileSync(new URL('docs/MacOS-Client-Release.md', repoRoot), 'utf8');

  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /version/);
  assert.match(workflow, /release_notes/);
  assert.match(workflow, /macos-v\$\{\{ inputs\.version \}\}/);
  assert.match(workflow, /Xcode 27/);
  assert.match(workflow, /scripts\/build-dmg\.sh/);
  assert.match(script, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(guide, /Gatekeeper/);
  assert.doesNotMatch(workflow, /codesign|notarytool|stapler/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test apps/api/test/macos-release-workflow.test.mjs`

Expected: FAIL，发布工作流不存在。

- [ ] **Step 3: 实现发布工作流和文档**

工作流从 `master` 手动运行，输入 `version` 和 `release_notes`。先校验 Xcode 27 和 macOS SDK，再更新 `project.yml` 版本、生成工程、构建 DMG、验证文件为 arm64、创建 `macos-vX.Y.Z` Release。Release 上传 `Qiankunjie.dmg` 和 `Qiankunjie-X.Y.Z-arm64.dmg`。文档说明首次运行、Gatekeeper、更新失败恢复和无证书限制。

- [ ] **Step 4: 运行发布契约测试和 DMG 构建**

Run: `node --test apps/api/test/macos-release-workflow.test.mjs && MACOS_DMG_DRY_RUN=1 bash apps/macos/scripts/build-dmg.sh`

Expected: PASS；dry-run 只打印清理和构建目标。

- [ ] **Step 5: 提交**

```bash
git add .github/workflows/release-macos.yml docs/MacOS-Client-Release.md apps/macos/scripts apps/api/test/macos-release-workflow.test.mjs
git commit -m "ci(macos): add release and DMG workflow"
```

### Task 15: UI Lab 和端到端验收

**Files:**
- Create: `apps/macos/QiankunjieMac/UILab/UILabScenario.swift`
- Create: `apps/macos/QiankunjieMac/UILab/UILabFixtures.swift`
- Create: `apps/macos/scripts/macos-ui-lab.sh`
- Create: `docs/MacOS-UI-Lab.md`
- Modify: `apps/macos/QiankunjieMac/App/QiankunjieApp.swift`
- Test: `apps/macos/QiankunjieMacTests/UILabTests.swift`
- Test: `apps/api/test/macos-ui-lab-contract.test.mjs`

**Interfaces:**
- Consumes: Task 5 至 Task 13 的全部界面和状态模型。
- Produces: `UILabScenario` 枚举；`--ui-lab <scenario>` 启动参数；固定夹具；Debug 截图脚本；端到端验收清单。

- [ ] **Step 1: 写失败 UI Lab 测试**

```swift
@Test func uiLabCoversEveryCoreScenario() {
    #expect(UILabScenario.allCases == [
        .login, .library, .empty, .loading, .offline, .reader, .collect, .tasks, .settings, .update
    ])
    #expect(UILabFixtures.article.id == 1001)
    #expect(UILabFixtures.user.id == 9001)
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -destination 'platform=macOS' test -only-testing:QiankunjieMacTests/UILabTests`

Expected: FAIL，UI Lab 不存在。

- [ ] **Step 3: 实现 UILab 和验收脚本**

Debug 构建读取 `--ui-lab <scenario>`，使用固定用户、文章、任务和更新数据，不访问 Keychain、SwiftData、真实 API 或用户文件。`macos-ui-lab.sh` 负责构建、启动指定场景并提示手动截图路径；文档列出登录、三栏资料库、空态、加载、离线、阅读器、采集弹窗、任务、设置和更新场景。

- [ ] **Step 4: 运行完整验证**

Run: `pnpm macos:test && xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -configuration Debug -destination 'platform=macOS' build && node --test apps/api/test/macos-ui-lab-contract.test.mjs && node --test apps/api/test/macos-auth-contract.test.mjs apps/api/test/macos-collect-contract.test.mjs apps/api/test/macos-release-workflow.test.mjs`

Expected: PASS；Debug 应用可以以 UILab 场景启动，API 契约回归通过。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/QiankunjieMac/UILab apps/macos/scripts/macos-ui-lab.sh docs/MacOS-UI-Lab.md apps/macos/QiankunjieMac/App/QiankunjieApp.swift apps/macos/QiankunjieMacTests/UILabTests.swift apps/api/test/macos-ui-lab-contract.test.mjs
git commit -m "test(macos): add UI lab and acceptance coverage"
```

## 完成标准

- `pnpm macos:test`、`pnpm macos:build` 和所有新增 Node 契约测试通过。
- 主窗口三栏布局、紧凑列表、完整 HTML 阅读器、菜单栏采集和快捷键采集可以完成日用闭环。
- 游客阅读、登录、刷新、退出、账号切换和缓存隔离通过验收。
- 更新检查、断点下载、SHA-256 校验和失败回滚通过测试。
- GitHub Actions 可以发布 `macos-vX.Y.Z` DMG，干净 Mac 可以按文档安装和更新。
- 现有 Android、Web、API、MCP 和浏览器插件测试没有回归。
