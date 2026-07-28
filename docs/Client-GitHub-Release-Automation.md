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

1. 读取 `apps/browser-extension/package.json` 的当前稳定版本；
2. 自动递增补丁版本，例如 `0.1.1 → 0.1.2`、`2.1.0 → 2.1.1`；
3. 更新版本、运行测试和 TypeScript 检查，并打包 ZIP；
4. 验证 ZIP 内 `manifest.json` 版本；
5. 自动提交并推送 `chore(browser-extension): release v<版本>` 到 `master`；
6. 创建 `browser-extension-v<版本>` GitHub Release，上传 ZIP 和 SHA-256 文件。

只支持稳定 `X.Y.Z` 插件版本自动递增。若当前版本为预发布版本（例如 `2.1.0-rc.1`），工作流会停止并要求先人工处理版本。

> 浏览器插件发布工作流会直接写入 `master`。若仓库分支保护不允许 GitHub Actions 推送，工作流会在推送步骤失败，且不会创建 Release。

## 历史统一工作流

旧的统一客户端发布和“准备版本 PR”工作流已归档到 `docs/history/release-workflows/`，不再出现在 GitHub Actions 的可运行工作流列表中。
