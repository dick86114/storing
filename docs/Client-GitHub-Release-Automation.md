# Android 与浏览器插件 GitHub 发布

Android APK 与浏览器插件使用两套独立 GitHub Actions 工作流，互不阻塞。

## 发布 Android APK：手动版本方式

在 `master` 选择 **Release Android APK**，手动填写：

- `release_tag`：例如 `v2.1.0`；
- `android_version_name`：例如 `2.1.0`；
- `android_version_code`：必须为递增正整数；
- `minimum_supported_version_code`：正整数且不能大于本次 versionCode；
- 标题、更新说明和是否强制更新。

工作流构建并签名 APK，创建对应 GitHub Release，并将 `latest.json` 更新到 `android-latest` Release。Android 流程不会读取或修改浏览器插件版本。

## 发布浏览器插件：自动递增补丁版本

在 `master` 选择 **Release browser extension**，只填写更新说明。

工作流会自动：

1. 优先读取最新 `browser-extension-v*` Release 标签；首次发布时才回退到 `apps/browser-extension/package.json`；
2. 自动递增补丁版本，例如 `0.1.1 → 0.1.2`、`2.1.0 → 2.1.1`；
3. 只在 GitHub Actions 临时工作区写入该版本，运行测试和 TypeScript 检查，并打包 ZIP；
4. 验证 ZIP 内 `manifest.json` 版本；
5. 创建 `browser-extension-v<版本>` GitHub Release，上传 ZIP 和 SHA-256 文件，并绑定触发工作流的 `master` 提交；
6. 不提交、不推送版本文件到 `master`。

只支持稳定 `X.Y.Z` 插件版本自动递增。若当前版本为预发布版本（例如 `2.1.0-rc.1`），工作流会停止并要求先人工处理版本。

> 浏览器插件发布工作流不再写入 `master`；Release 标签是浏览器插件已发布版本的权威来源。可以在迁移后启用分支保护，阻止 GitHub Actions 或其他身份直接推送 `master`。

## 历史统一工作流

旧的统一客户端发布和“准备版本 PR”工作流已归档到 `docs/history/release-workflows/`，不再出现在 GitHub Actions 的可运行工作流列表中。
