# 账号级 AI 配置与归档触发验证记录

日期：2026-10-08
分支：`codex/user-ai-configuration-2088`

## 结论

功能实现已完成。API、Web、Android、macOS 的静态契约测试、单元测试和生产构建均已验证；macOS Release DMG 已生成并校验。API 全量测试 289 项中 288 项通过，唯一失败项依赖本机 PostgreSQL；本机 5432 端口未启动，错误为 `ECONNREFUSED`，不是本次功能回归。Android 正式 APK 打包因部署环境缺少签名 Secret 未执行，Release Kotlin 编译已通过。

## 验证结果

### API

命令：

```bash
cd apps/api
pnpm exec node --import tsx --test test/*.test.mjs test/*.test.ts
pnpm build
```

结果：

- 全量测试：289 项，288 通过，1 失败，0 跳过。
- 唯一失败：`登录创建的 Web 会话保存的是 Cookie secret 哈希`，原因是本机 PostgreSQL 未启动，测试连接 `127.0.0.1:5432` 和 `::1:5432` 返回 `ECONNREFUSED`。
- 生产构建：成功。
- 新增账号级 AI 环境契约测试通过：`.env.example` 只保留 `USER_AI_ENCRYPTION_KEY`，API 源码不再读取公共模型提供商 Key。

### Web

命令：

```bash
cd apps/web
node --test test/*.test.mjs
pnpm build
```

结果：

- 全量测试：64 项，64 通过，0 失败，0 跳过。
- 生产构建：成功，17 个页面生成完成。

### Android

执行目录：`apps/android`。首次执行因工作树缺少 `local.properties` 报 SDK location not found；按项目约定注入 `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools` 后继续。

命令与结果：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew testDebugUnitTest --rerun-tasks
# 成功；31 个任务全部执行。86 个测试套件、190 个测试，0 失败、0 错误、0 跳过。

ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew assembleDebug compileReleaseKotlin assembleRelease
# testDebugUnitTest、assembleDebug、compileReleaseKotlin 成功。
# assembleRelease 在 packageRelease 失败，属于预期的签名配置限制。
```

正式签名缺少以下环境变量：

- `QIANKUNJIE_RELEASE_STORE_FILE`
- `QIANKUNJIE_RELEASE_STORE_PASSWORD`
- `QIANKUNJIE_RELEASE_KEY_ALIAS`
- `QIANKUNJIE_RELEASE_KEY_PASSWORD`

### macOS

命令与结果：

```bash
bash apps/macos/scripts/test.sh
# 成功；QiankunjieMac 应用测试目标执行 148 个测试并通过。

bash apps/macos/scripts/build-dmg.sh
# Release 构建成功。
```

产物：

- `apps/macos/dist/Qiankunjie-0.1.0-arm64.dmg`
- `apps/macos/dist/Qiankunjie.dmg`
- 对应 `.sha256` 校验文件已生成。

`hdiutil verify` 返回 DMG checksum `VALID`。

## 环境迁移

1. 新增必需变量 `USER_AI_ENCRYPTION_KEY`；值必须是 Base64 编码后长度为 32 字节的主密钥。可用 `openssl rand -base64 32` 生成。
2. 删除旧的 `AI_PROVIDER`、`AI_MODEL` 和各模型提供商 API Key 环境变量；API 不再读取它们。
3. 用户在 Web、Android 或 macOS 的“AI 模型”设置中录入提供商、Base URL、模型、API Key 和自动触发开关。
4. API Key 使用 AES-256-GCM 加密保存，接口只返回是否配置和最后四位。
5. 主加密密钥丢失后，已有用户 API Key 密文无法解密，需要用户重新录入 API Key；文章正文、元数据和历史 AI 结果不需要因此删除。
6. 历史数据不做批量 AI 补生成；手动重新生成不清空旧成功结果，新结果成功后才覆盖。

## 人工检查与限制

- 未连接真实 PostgreSQL、真实模型提供商和真实移动设备执行端到端调用。
- 未在真实微信转发导入链路上重复消耗模型调用；采集与导入契约已断言不触发 AI。
- API 数据库集成测试需在 PostgreSQL 可用环境中补跑。
- Android 正式包需在签名 Secret 配置完整的环境中重新执行 `assembleRelease`。
