import Foundation
import QiankunjieCore

enum MCPGuideContent {
    static let remoteEndpoint = "https://storing.idickies.cc/mcp"
    static let maskedAPIKey = "sk-storing-••••••••••••••••"

    static func remoteConfiguration(apiKey: String = maskedAPIKey) -> String {
        """
        {
          "mcpServers": {
            "storing": {
              "url": "\(remoteEndpoint)",
              "headers": {
                "Authorization": "Bearer \(apiKey)"
              }
            }
          }
        }
        """
    }

    static func stdioConfiguration(apiKey: String = maskedAPIKey) -> String {
        """
        {
          "mcpServers": {
            "storing": {
              "command": "node",
              "args": ["<storing-repo>/apps/mcp/dist/index.js"],
              "env": {
                "STORING_API_BASE": "https://your-storing-domain.example/api/v1",
                "STORING_MCP_API_KEY": "\(apiKey)"
              }
            }
          }
        }
        """
    }
}

struct MCPPlatformLimits: Codable, Equatable, Sendable {
    let rateLimitPerMinute: Int
    let rateLimitPerDay: Int
    let concurrentCollectLimit: Int

    enum CodingKeys: String, CodingKey {
        case rateLimitPerMinute
        case rateLimitPerDay
        case concurrentCollectLimit
    }
}

struct MCPPlatformLimitsUpdateRequest: Encodable, Sendable {
    let rateLimitPerMinute: Int
    let rateLimitPerDay: Int
    let concurrentCollectLimit: Int

    enum CodingKeys: String, CodingKey {
        case rateLimitPerMinute = "rate_limit_per_minute"
        case rateLimitPerDay = "rate_limit_per_day"
        case concurrentCollectLimit = "concurrent_collect_limit"
    }
}

struct MCPClient: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let name: String
    let ownerUserID: Int
    let ownerUsername: String?
    let scopes: [String]
    let enabled: Bool
    let rateLimitPerMinute: Int?
    let rateLimitPerDay: Int?
    let concurrentCollectLimit: Int?
    let defaultSaveToInbox: Bool
    let createdAt: String?
    let updatedAt: String?
    let lastUsedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case scopes
        case enabled
        case ownerUserID = "ownerUserId"
        case ownerUsername
        case rateLimitPerMinute
        case rateLimitPerDay
        case concurrentCollectLimit
        case defaultSaveToInbox
        case createdAt
        case updatedAt
        case lastUsedAt
    }
}

struct MCPClientsResponse: Decodable, Sendable {
    let clients: [MCPClient]
}

struct MCPClientResponse: Decodable, Sendable {
    let client: MCPClient
}

struct MCPKeyResponse: Decodable, Sendable {
    let client: MCPClient
    let apiKey: String

    enum CodingKeys: String, CodingKey {
        case client
        case apiKey
    }
}

struct MCPRequestLog: Decodable, Identifiable, Sendable {
    let id: Int
    let clientID: Int?
    let toolName: String
    let url: String?
    let status: String
    let errorCode: String?
    let durationMS: Int?
    let transport: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case url
        case status
        case transport
        case clientID = "clientId"
        case toolName
        case errorCode
        case durationMS = "durationMs"
        case createdAt
    }
}

struct MCPLogsResponse: Decodable, Sendable {
    let logs: [MCPRequestLog]
}

struct MCPCreateRequest: Encodable, Sendable {
    let name: String
    let ownerUserID: Int?
    let scopes: [String]
    let enabled = true
    let rateLimitPerMinute: Int?
    let rateLimitPerDay: Int?
    let concurrentCollectLimit: Int?
    let defaultSaveToInbox: Bool

    enum CodingKeys: String, CodingKey {
        case name
        case scopes
        case enabled
        case ownerUserID = "owner_user_id"
        case rateLimitPerMinute = "rate_limit_per_minute"
        case rateLimitPerDay = "rate_limit_per_day"
        case concurrentCollectLimit = "concurrent_collect_limit"
        case defaultSaveToInbox = "default_save_to_inbox"
    }
}

struct MCPUpdateRequest: Encodable, Sendable {
    let enabled: Bool?
    let scopes: [String]?
    let rateLimitPerMinute: Int?
    let rateLimitPerDay: Int?
    let concurrentCollectLimit: Int?
    let defaultSaveToInbox: Bool?

    enum CodingKeys: String, CodingKey {
        case enabled
        case scopes
        case rateLimitPerMinute = "rate_limit_per_minute"
        case rateLimitPerDay = "rate_limit_per_day"
        case concurrentCollectLimit = "concurrent_collect_limit"
        case defaultSaveToInbox = "default_save_to_inbox"
    }
}

struct MCPDeleteResponse: Decodable, Sendable {
    let revoked: Bool
}

struct AdminUser: Decodable, Identifiable, Sendable {
    let id: Int
    let username: String
    let role: String
    let status: String
    let createdAt: String?
    let lastLoginAt: String?
    let mcpClientCount: Int
    let activeMCPClientCount: Int
    let mcpRequestCount: Int
    let lastMCPUsedAt: String?
    let inboxCount: Int
    let archiveCount: Int
    let favoriteCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case role
        case status
        case createdAt
        case lastLoginAt
        case mcpClientCount
        case activeMCPClientCount = "activeMcpClientCount"
        case mcpRequestCount
        case lastMCPUsedAt = "lastMcpUsedAt"
        case inboxCount
        case archiveCount
        case favoriteCount
    }
}

struct AdminUsersResponse: Decodable, Sendable {
    let users: [AdminUser]
}

struct AdminUserResponse: Decodable, Sendable {
    let user: AdminUser
}

struct AdminUserMutation: Encodable, Sendable {
    let username: String?
    let password: String?
    let role: String?
    let status: String?
}

struct CategoriesResponse: Decodable, Sendable {
    let categories: [ArticleCategory]
    let counts: [String: Int]
}

struct CategoryReorderResponse: Decodable, Sendable {
    let categories: [ArticleCategory]
}

struct CategoryResponse: Decodable, Sendable {
    let category: ArticleCategory
}

struct CategoryMutationRequest: Encodable, Sendable {
    let name: String?
    let description: String?
    let includeExamples: [String]?
    let excludeExamples: [String]?
    let color: String?
    let isActive: Bool?
}

struct CategoryOptimizeRequest: Encodable, Sendable {
    let name: String
    let description: String?
    let includeExamples: [String]
    let excludeExamples: [String]
}

struct CategoryOptimizeDraft: Decodable, Sendable {
    let description: String?
    let includeExamples: [String]?
    let excludeExamples: [String]?
}

struct CategoryOptimizeResponse: Decodable, Sendable {
    let draft: CategoryOptimizeDraft
}

struct DeleteCategoryResponse: Decodable, Sendable {
    let movedArticleCount: Int
}

struct ChangePasswordRequest: Encodable, Sendable {
    let currentPassword: String
    let newPassword: String
}

struct MessageResponse: Decodable, Sendable {
    let message: String
}
