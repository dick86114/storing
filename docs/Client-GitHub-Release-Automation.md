# 统一客户端 GitHub 发布

`.github/workflows/release-clients.yml` 是 Android 与浏览器插件的统一手动发布入口。它会按所选目标构建构件、保留每个工作流构件，并可把所有选中的构件附加到同一个 GitHub Release。

## 发布前准备

1. 确认待发布代码已合入目标分支。
2. 浏览器插件发布前，先在 `apps/browser-extension/package.json` 更新版本号；Manifest 会自动使用同一版本，避免双处维护。
3. Android 发布前准备递增的 `versionCode`。
4. 配置 Android 签名 Secrets：
   - `QIANKUNJIE_RELEASE_KEYSTORE_BASE64`
   - `QIANKUNJIE_RELEASE_STORE_PASSWORD`
   - `QIANKUNJIE_RELEASE_KEY_ALIAS`
   - `QIANKUNJIE_RELEASE_KEY_PASSWORD`

## 手动触发

在 GitHub Actions 中选择 **Release mobile app and browser extension**，填写：

- `release_tag`：统一 Release 标签，例如 `v0.7.1`。
- `release_title` / `release_notes`：该次统一发布的标题和说明。
- `build_android`：需要 Android 时启用，并填写 Android 版本参数。
- `build_browser_extension`：需要插件 ZIP 时启用；版本来自仓库的 `apps/browser-extension/package.json`。
- `publish_release`：关闭时只构建并保留 Actions Artifact，适合发布前验证；开启时创建同名 GitHub Release 并上传所有选中的构件。

## 产物与更新通道

- Android：签名 universal APK 与 `latest.json` 会附加到统一 Release；工作流同时更新 `android-latest` 中的 `latest.json`，因此原生 App 仍可检查更新。
- 浏览器插件：上传 `storing-browser-extension-v<版本>.zip` 与 SHA-256 文件。ZIP 会严格同步当前 `dist/`，不会残留早期 Vite 哈希资源。

以后新增桌面客户端或其他插件时，在此工作流新增独立 build job，并让 `publish` job 下载其 artifact 即可；无需另建独立发布入口。
