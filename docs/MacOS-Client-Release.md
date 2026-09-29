# 乾坤戒 macOS 发布与安装

本文说明如何安装、首次通过 Gatekeeper 运行、更新乾坤戒 macOS 客户端，以及在更新失败后恢复。GitHub Actions 会从 `master` 手动触发，构建无签名 Apple Silicon DMG，并发布到 `macos-vX.Y.Z` 标签。

## 系统要求

- Apple Silicon（arm64）Mac。
- macOS 27.0 或更高版本。
- 至少足够容纳应用包和 DMG 下载的磁盘空间。

CI 构建环境使用 Xcode 27 与 macOS 27 SDK；普通使用者不需要安装 Xcode。构建脚本固定使用 `CODE_SIGNING_ALLOWED=NO`，产物只包含 arm64 架构。

## 下载与首次运行

1. 打开目标版本的 GitHub Release，下载 `Qiankunjie.dmg`。需要固定版本存档时，也可以下载 `Qiankunjie-X.Y.Z-arm64.dmg`。
2. 对照 Release 中的同名 `.sha256` 文件确认下载完整。例如：
   ```bash
   shasum -a 256 -c Qiankunjie.dmg.sha256
   ```
3. 打开 DMG，把「乾坤戒.app」拖入「Applications」。
4. 在 Launchpad 或「应用程序」文件夹中启动乾坤戒。

因为当前发布没有 Developer ID 证书、公证或 stapler 流程，macOS Gatekeeper 可能阻止首次启动，并提示无法验证开发者。先确认 DMG 和应用确实来自本仓库 Release 后，可执行以下命令移除下载隔离属性，再正常打开：

```bash
xattr -dr com.apple.quarantine "/Applications/乾坤戒.app"
```

不要把该命令用于来源不明的应用。校验 `.sha256` 只能发现下载损坏或被篡改，不能单独证明发布者身份；发布来源仍应以后续仓库 Release 页面为准。

## 应用内更新

在「设置」中检查更新时，客户端只会识别名为 `macos-vX.Y.Z` 的稳定版 Release，其中 `X.Y.Z` 是三段数字版本；预发布和畸形标签会被忽略。客户端下载版本化 DMG 和 `.sha256`，校验 SHA-256 后等待应用退出，再替换应用并验证新版本号。

更新失败时优先保持旧应用可启动。若新应用启动失败，安装器会恢复替换前创建的备份；不要在更新进行中强制关闭电源或删除 `乾坤戒.app`。

## 更新失败恢复

如果更新中断后应用无法打开或「应用程序」中没有乾坤戒，先关闭应用，检查 `/Applications` 是否存在类似 `乾坤戒.app.backup-数字` 的目录。若存在，把旧备份移回正式名称：

```bash
mv "/Applications/乾坤戒.app.backup-数字" "/Applications/乾坤戒.app"
```

然后将 `数字` 替换成实际目录名。恢复后重新启动应用。仍无法解决时，从最新 `macos-vX.Y.Z` Release 重新下载 DMG，按上文流程校验、安装并移除隔离属性。应用数据不会保存在应用包内；重装应用不会主动删除用户数据。

## 无证书分发限制

当前工作流不使用 Developer ID、公证、stapler 或 Sparkle。这意味着：

- 首次下载和安装需要手动处理 Gatekeeper 隔离提示。
- 系统不会自动信任后续版本；应用内更新依赖应用自己的下载、SHA-256 校验和备份恢复逻辑。
- 清理应用缓存或使用镜像下载时，镜像只能提供传输通道；客户端仍必须通过 GitHub Release 中同名 `.sha256` 的校验。
- 若没有 `.sha256` 资产，Atom 回退路径会因缺少校验和而失败。发布工作流必须上传两个 DMG 和两个同名 `.sha256` 文件。
