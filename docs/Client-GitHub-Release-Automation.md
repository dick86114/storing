# 统一客户端 GitHub 发布

客户端发布分为两个明确阶段：先准备并审核浏览器插件版本 PR，再从已合并的 `master` 构建并发布 Android APK 和浏览器插件 ZIP。统一 GitHub Release 标签是所有客户端版本的唯一来源。

## 发布前准备

1. 确认待发布代码已合入 `master`。
2. 配置 Android 签名 Secrets：
   - `QIANKUNJIE_RELEASE_KEYSTORE_BASE64`
   - `QIANKUNJIE_RELEASE_STORE_PASSWORD`
   - `QIANKUNJIE_RELEASE_KEY_ALIAS`
   - `QIANKUNJIE_RELEASE_KEY_PASSWORD`
3. 选择新的统一版本，例如 `v2.1.0`。标签必须以 `v` 开头，Android 与浏览器插件实际版本会使用去掉 `v` 后的 `2.1.0`。

## 第一步：准备浏览器插件版本 PR

在 GitHub Actions 从 `master` 选择 **Prepare client release version**，只填写：

```text
release_tag: v2.1.0
```

该工作流会：

1. 校验标签格式、既有 Git Tag 和既有 GitHub Release，拒绝重复版本；
2. 将 `apps/browser-extension/package.json` 的版本更新为 `2.1.0`；
3. 创建或复用 `release/browser-extension-v2.1.0` 分支上的 PR；
4. 在 Job Summary 中显示 PR 地址和后续操作。

必须先审核并**合并 PR**，再进行第二步。工作流不会直接修改 `master`，也不会在此阶段创建 Release。

如果插件源码版本已经是目标版本，准备工作流不会创建空 PR；确认该版本已在 `master` 后可直接进入第二步。

## 第二步：构建与发布客户端

在合并 PR 后的 `master` 上运行 **Release mobile app and browser extension**。

- `release_tag`：例如 `v2.1.0`，必须与浏览器插件 `package.json.version` 去掉 `v` 后完全一致。
- `release_title` / `release_notes`：本次 Release 的标题和说明。
- `build_browser_extension`：启用时，工作流会在打包前校验源码版本，并在打包后再次验证 ZIP 内 `manifest.json` 版本。
- `publish_release`：关闭时只构建并保留 Actions Artifact；开启时创建 GitHub Release 并上传所选构件。

版本不一致时发布会在构建前失败，并提示先运行 **Prepare client release version**、合并 PR。

## Android 版本规则

Android `versionName` 不再手填，由 `release_tag` 自动推导：

```text
v2.1.0 -> 2.1.0
```

以下 `*` 字段仅在勾选“构建并签名 Android APK”时适用：

- **Android versionCode ***：留空时，自动使用 `android-latest` Release 中上一稳定版本的 `versionCode + 1`。
- **Android 最低可继续使用 versionCode ***：留空时，自动继承 `android-latest` Release 中的上一最低兼容值。

例如上一稳定更新清单为：

```json
{
  "versionName": "2.0.3",
  "versionCode": 203,
  "minimumSupportedVersionCode": 203
}
```

本次填写 `v2.1.0` 后，工作流建议并在留空时自动采用：

```text
Android versionName: 2.1.0
Android versionCode: 204       # 上一版本 + 1
最低兼容 versionCode: 203
```

如果手动填写，校验规则为：

| 字段 | 规则 |
| --- | --- |
| Android versionCode | 必须为正整数，且严格大于上一稳定 versionCode。上一值为 `203` 时，至少填写 `204`。 |
| 最低兼容 versionCode | 必须为正整数；不能小于上一最低兼容值，也不能大于本次最终 versionCode。 |

校验 Job 会在 Summary 中显示上一稳定值、自动建议、手动输入和最终采用值。若 `android-latest` 中没有有效 `latest.json`，两个 Android 数字字段必须手动填写。

GitHub Actions 的网页表单不支持根据上一 Release 在打开页面时动态预填输入框；因此 `*` 是条件业务必填标记。留空并不报错，而是由工作流在启动后读取 `android-latest/latest.json` 并解析自动默认值。只发布浏览器插件时，Android 字段可保持为空。

## 产物与更新通道

- Android：签名 universal APK 与 `latest.json` 附加到统一 GitHub Release；同一份 `latest.json` 会上传到 `android-latest` Release，供原生 App 查询更新。
- 浏览器插件：上传 `storing-browser-extension-v<版本>.zip` 与 SHA-256 文件。ZIP 内 Manifest、ZIP 文件名、插件 `package.json` 和统一 Release 标签保持一致。

发布失败时先查看 **Validate and resolve release inputs** Job Summary；其中会给出上一版本、可填写的最小 versionCode，以及插件版本或 Android 兼容门槛不一致的具体原因。
