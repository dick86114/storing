# Storing Remote MCP — Streamable HTTP 部署

Storing 同时保留两种 MCP transport：

- `apps/mcp/src/index.ts`：stdio，供本机 Codex/Claude Desktop 兼容使用。
- `apps/mcp/src/http.ts`：Streamable HTTP，供其他 SaaS、云端 Agent 和远程 MCP Client 使用。

## 服务地址

本地默认：

```text
http://localhost:1053/mcp
```

生产环境推荐通过反向代理暴露：

```text
https://storing.example.com/mcp
```

健康检查：

```text
http://localhost:1053/health
```

## 身份认证

远程 MCP 请求必须携带用户在“我的 MCP”页面申请的 API Key：

```http
Authorization: Bearer sk-storing-...
```

HTTP MCP 服务会先调用内部 `/api/v1/mcp/auth/verify` 验证 Key、Client 状态、Owner 用户状态和 scopes。工具调用继续使用同一个 Key 访问 Storing API，因此现有的 scopes、限流、并发限制和审计逻辑保持生效。

## Nginx 反向代理

```nginx
location = /mcp {
    proxy_pass http://127.0.0.1:1053/mcp;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Origin $http_origin;
    proxy_set_header MCP-Protocol-Version $http_mcp_protocol_version;
    proxy_set_header Mcp-Session-Id $http_mcp_session_id;
    proxy_set_header Last-Event-ID $http_last_event_id;

    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

当前实现采用无状态 Streamable HTTP：不依赖内存 Session，适合反向代理、多实例部署和水平扩容。工具当前都是短请求创建异步任务，不需要服务端主动通知；结果通过 `get_collect_status` 查询。

## 客户端配置

```json
{
  "mcpServers": {
    "storing": {
      "url": "https://storing.example.com/mcp",
      "headers": {
        "Authorization": "Bearer sk-storing-..."
      }
    }
  }
}
```

## 本地启动

```bash
bash restart.sh --force
```

脚本会启动：

- Web：1050
- API：1052
- Streamable HTTP MCP：1053

也可以单独启动：

```bash
cd apps/mcp
pnpm dev:http
```
