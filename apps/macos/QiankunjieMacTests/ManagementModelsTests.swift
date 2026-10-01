import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

struct ManagementModelsTests {
    @Test func MCP接入指南生成远程与stdio配置() {
        let remote = MCPGuideContent.remoteConfiguration()
        let stdio = MCPGuideContent.stdioConfiguration()

        #expect(MCPGuideContent.remoteEndpoint == "https://storing.idickies.cc/mcp")
        #expect(remote.contains("\"url\": \"https://storing.idickies.cc/mcp\""))
        #expect(remote.contains("\"Authorization\": \"Bearer sk-storing-"))
        #expect(stdio.contains("\"command\": \"node\""))
        #expect(stdio.contains("STORING_API_BASE"))
    }

    @Test func MCP平台限额解码平台响应() throws {
        let data = Data(#"{"rate_limit_per_minute":20,"rate_limit_per_day":500,"concurrent_collect_limit":3,"updated_at":"2026-07-18T19:59:30.692Z","managed_by":"platform"}"#.utf8)

        let limits = try JSONDecoder.qiankunjie.decode(MCPPlatformLimits.self, from: data)

        #expect(limits.rateLimitPerMinute == 20)
        #expect(limits.rateLimitPerDay == 500)
        #expect(limits.concurrentCollectLimit == 3)
    }

    @Test func MCP平台限额编码使用服务端蛇形字段() throws {
        let request = MCPPlatformLimitsUpdateRequest(
            rateLimitPerMinute: 24,
            rateLimitPerDay: 500,
            concurrentCollectLimit: 3
        )
        let data = try JSONEncoder().encode(request)
        let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Int])

        #expect(json["rate_limit_per_minute"] == 24)
        #expect(json["rate_limit_per_day"] == 500)
        #expect(json["concurrent_collect_limit"] == 3)
        #expect(json["rateLimitPerMinute"] == nil)
    }

    @Test func MCP连接解码服务端蛇形字段() throws {
        let data = Data(#"{"clients":[{"id":5,"name":"qwenpaw-hp","owner_user_id":2,"owner_username":"admin","scopes":["summary:create"],"enabled":true,"rate_limit_per_minute":200,"rate_limit_per_day":5000,"concurrent_collect_limit":20,"default_save_to_inbox":false,"created_at":"2026-07-21T15:53:40.026Z","updated_at":"2026-07-22T13:48:46.339Z","last_used_at":"2026-07-22T07:31:51.872Z"}]}"#.utf8)

        let response = try JSONDecoder.qiankunjie.decode(MCPClientsResponse.self, from: data)
        let client = try #require(response.clients.first)

        #expect(client.ownerUserID == 2)
        #expect(client.ownerUsername == "admin")
        #expect(client.rateLimitPerMinute == 200)
        #expect(client.defaultSaveToInbox == false)
    }

    @Test func 管理员用户解码服务端蛇形缩写字段() throws {
        let data = Data(#"{"users":[{"id":2,"username":"admin","role":"admin","status":"active","created_at":"2026-07-18T19:59:30.692Z","last_login_at":"2026-07-22T07:31:51.872Z","mcp_client_count":3,"active_mcp_client_count":2,"mcp_request_count":401,"last_mcp_used_at":"2026-07-22T07:31:51.872Z","inbox_count":254,"archive_count":7,"favorite_count":1}]}"#.utf8)

        let response = try JSONDecoder.qiankunjie.decode(AdminUsersResponse.self, from: data)
        let user = try #require(response.users.first)

        #expect(user.activeMCPClientCount == 2)
        #expect(user.mcpRequestCount == 401)
        #expect(user.lastMCPUsedAt == "2026-07-22T07:31:51.872Z")
    }
}
