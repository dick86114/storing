# 乾坤戒 Android：GitHub Actions 自动签名与自更新发布

该流程只在 GitHub Actions 页面手动触发，不会在每次推送时误发 APK：

```text
workflow_dispatch
  -> 恢复 GitHub Secrets 中的正式签名密钥
  -> 构建并验证 Release APK
  -> 计算 SHA-256
  -> 生成 latest.json
  -> 创建 GitHub Release
  -> 上传 APK 与 latest.json
  -> 生产 API 读取 GitHub 固定 Android 更新通道清单
  -> App 每日检查、下载、SHA-256 校验、唤起系统安装器
```

仓库为公开仓库，因此 APK 和 `latest.json` 可由未登录的 Android 客户端下载。不要把签名密钥或密码放进仓库、Release 附件、日志或 `latest.json`。

## 一次性准备

### 1. 生成并离线备份正式签名密钥

在本地安全位置生成并保留至少两份离线备份：

```bash
keytool -genkeypair -v \
  -keystore ~/secure-backups/qiankunjie-release.jks \
  -alias qiankunjie \
  -keyalg RSA -keysize 4096 -validity 10000
```

后续所有正式 APK 都必须使用这一个密钥，不能丢失、不能更换。

### 2. 添加 GitHub Actions Secrets

在仓库 **Settings → Secrets and variables → Actions → New repository secret** 新增：

| Secret | 值 |
| --- | --- |
| `QIANKUNJIE_RELEASE_KEYSTORE_BASE64` | `qiankunjie-release.jks` 的单行 Base64 内容 |
| `QIANKUNJIE_RELEASE_STORE_PASSWORD` | keystore 密码 |
| `QIANKUNJIE_RELEASE_KEY_ALIAS` | 例如 `qiankunjie` |
| `QIANKUNJIE_RELEASE_KEY_PASSWORD` | key 密码 |

macOS 生成单行 Base64：

```bash
base64 -i ~/secure-backups/qiankunjie-release.jks | tr -d '\n' | pbcopy
```

将剪贴板内容粘贴为 `QIANKUNJIE_RELEASE_KEYSTORE_BASE64`。不要把上述 Base64 写入 `.env`、仓库文件或聊天记录。

### 3. 部署一次服务端 GitHub 清单读取能力

生产服务器 `.env` 添加：

```bash
ANDROID_RELEASE_MANIFEST_URL=https://github.com/dick86114/storing/releases/download/android-latest/latest.json
APP_ORIGIN=https://storing.idickies.com
```

然后部署当前 `master`：

```bash
git pull --ff-only origin master
docker compose up -d --build
```

本地挂载的 `releases/android/latest.json` 仍保留为 GitHub 网络不可用时的人工回退；正常发布无需再手工上传 APK 或 JSON 到服务器。

## 每次发布

1. 打开 GitHub 仓库 **Actions**。
2. 选择 **Release Android APK**。
3. 点击 **Run workflow**。
4. 填写：
   - `version_name`：例如 `0.7.0`；
   - `version_code`：必须递增，例如 `7`；
   - `minimum_supported_version_code`：通常写当前最低兼容版本；
   - `mandatory`：仅安全漏洞或 API 不兼容时设为 `true`；
   - `release_notes`：可输入多行。
5. 等待 Workflow 成功。

成功后 GitHub 会创建标签，例如 `android-v0.7.0`，并创建对应的版本 Release，包含：

```text
Qiankunjie-v0.7.0-universal-release.apk
latest.json
```

Workflow 同时维护一个固定标签 `android-latest`，并将该版本的 `latest.json` 上传到此更新通道。API 固定读取：

```text
https://github.com/dick86114/storing/releases/download/android-latest/latest.json
```

因此即使仓库未来存在非 Android 的 GitHub Release，也不会错误影响 App 的更新通道。

App 只在正式 Release 包中每日最多检查一次；Debug 包不会提示 GitHub 更新，以免尝试用正式包覆盖 `com.idickies.storing.debug`。

GitHub Release 资产使用 `Qiankunjie-v<版本>-universal-release.apk` 命名：`universal` 表示该 APK 未做 ABI 拆分，可供支持该 App 的 ARM 设备及兼容设备直接安装；这比在文件名中错误标注单一芯片架构更准确。

## 回滚

若发现新版本有问题，重新运行 Workflow 发布一个更高版本；固定 `android-latest` 更新通道会自动指向新生成的 `latest.json`：

1. 从此前稳定 APK 创建一个新的修复或回退 Release；
2. 使用更高的 `versionCode`；
3. `latest.json` 指向该签名一致、SHA-256 正确的 APK；
4. 不删除正式签名密钥，也不要发布不同签名的 APK。

Android 不能把较低 `versionCode` 覆盖安装到已安装的高版本，因此回滚必须用更高版本号重新发包。
