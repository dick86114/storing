# 乾坤戒浏览器采集插件安装与部署

## 支持范围

首版支持 Chrome 和 Edge。插件只提交当前 HTTP(S) 网页 URL，服务端沿用现有 Web / Android 的异步采集队列，并默认写入收件箱。

- 不读取或上传浏览器侧正文、Cookie、localStorage
- 不支持浏览器内部页、扩展页、空白页或本地文件
- 不提供快捷键、右键菜单、标签、标题编辑、多账号、多服务器或任务轮询

## 先升级服务端

先部署包含浏览器插件接口的 API 版本，再在服务器的环境变量中设置：

```dotenv
BROWSER_EXTENSION_ALLOWED_ORIGINS=chrome-extension://hpdboifbaofmnjmlajfjabplneololfl
```

该值只允许当前发布包的固定插件 ID 发起跨域 Bearer 请求。保留既有的 `APP_ORIGIN` 配置；它仍仅用于网页 Cookie 会话和 CSRF 边界。

启动 API 后，运行时会为既有 `mobile_sessions` 表增加 `client_type` 字段。Android 记录保持 `android`，浏览器插件记录为 `browser_extension`。

## 构建与安装

在仓库根目录执行：

```bash
pnpm --filter browser-extension package
```

生成结果：

- `apps/browser-extension/dist/`：Chrome / Edge 开发者模式“加载已解压的扩展程序”所需目录
- `releases/browser-extension/storing-browser-extension-v0.1.1.zip`：相同内容的分发包

在 Chrome 或 Edge 的扩展管理页面开启开发者模式，选择“加载已解压的扩展程序”，并选择 `dist/`。安装后显示的扩展 ID 应为：

```
hpdboifbaofmnjmlajfjabplneololfl
```

## 首次连接与退出

1. 打开插件设置页，填写乾坤戒网页地址，例如 `https://storing.example.com`。
2. 插件默认自动拼接 `/api/v1`；只有非标准部署才填写“高级 API 地址”。
3. 点击“测试并授权此服务器”，确认该服务器的浏览器访问权限。
4. 输入乾坤戒账号密码登录。插件使用独立的可撤销 Refresh Session，不复用网页 Cookie。
5. 点击工具栏图标，确认当前网页后选择“采集到收件箱”。提交成功后可点击“打开收件箱”。

更换服务器或退出登录会撤销本地会话并移除旧服务器的插件访问权限。对于非 `localhost` 的 HTTP 地址，设置页必须在明确确认明文传输风险后才能登录；生产部署应使用 HTTPS。
