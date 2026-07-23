# Android 自托管更新目录

生产服务器将本目录挂载到 API 容器的 `/app/releases`。更新接口读取：

```text
/app/releases/android/latest.json
```

`latest.json` 必须由发行人手动更新，格式如下：

```json
{
  "versionCode": 7,
  "versionName": "0.7.0",
  "minimumSupportedVersionCode": 6,
  "mandatory": false,
  "releaseNotes": ["..."],
  "apkUrl": "https://storing.idickies.com/downloads/android/qiankunjie-0.7.0.apk",
  "sha256": "64 位小写 SHA-256",
  "publishedAt": "2026-07-23T00:00:00.000Z"
}
```

APK 由反向代理或静态文件服务器以 `apkUrl` 提供；APK 与 `latest.json` 都不提交到仓库。发布前必须使用同一正式签名密钥签名 APK，并保留上一稳定 APK 作为人工回滚包。
