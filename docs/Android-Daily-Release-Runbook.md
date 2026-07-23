# 乾坤戒 Android 日用版发布与回滚手册

## 一次性准备：正式签名密钥

在离线、安全位置生成并备份一套正式签名密钥；不要提交到仓库、不要放入 Docker 镜像、不要放进生产 `.env`：

```bash
keytool -genkeypair -v \
  -keystore ~/secure-backups/qiankunjie-release.jks \
  -alias qiankunjie \
  -keyalg RSA -keysize 4096 -validity 10000
```

至少保存两份离线备份，并记录 SHA-256 证书指纹。后续所有正式 APK 都必须使用**同一密钥**签名，否则 Android 无法覆盖安装。

## 构建正式 APK

在开发机临时导出下列环境变量，再构建；不要把变量值写入 Gradle 文件：

```bash
export QIANKUNJIE_RELEASE_STORE_FILE="$HOME/secure-backups/qiankunjie-release.jks"
export QIANKUNJIE_RELEASE_STORE_PASSWORD='...'
export QIANKUNJIE_RELEASE_KEY_ALIAS='qiankunjie'
export QIANKUNJIE_RELEASE_KEY_PASSWORD='...'
pnpm android:assembleRelease
```

构建产物名称固定包含产品名和版本号，例如：

```text
apps/android/app/build/outputs/apk/release/乾坤戒-v0.7.0-release.apk
```

发布前校验：

```bash
apksigner verify --verbose --print-certs <apk>
shasum -a 256 <apk>
```

## 部署更新包与清单

1. 将 APK 上传到反向代理公开的 `https://storing.idickies.com/downloads/android/`；保留上一稳定 APK。
2. 在服务器仓库的 `releases/android/latest.json` 写入新版本字段，模板见 `releases/android/README.md`。
3. `docker compose up -d --build` 后，API 的 `GET /api/v1/mobile/releases/latest?versionCode=<旧版本>` 会读取该清单。
4. 使用已安装旧版的真机验证：发现更新、下载、SHA-256 校验、系统安装器、覆盖安装后登录与本地缓存仍在。

## 回滚

- APK 有问题时，将 `latest.json` 指向保留的上一个稳定 APK 和其真实 SHA-256。
- 不改变签名密钥，不降低 `minimumSupportedVersionCode`。
- 服务端兼容性问题优先回滚 API/Docker；移动认证、采集与更新接口均为新增兼容接口，不要求 App 切换服务器地址。
