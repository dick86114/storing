import Foundation

public struct SessionTokens: Codable, Equatable, Hashable, Sendable {
    public let accessToken: String
    public let refreshToken: String

    public init(accessToken: String, refreshToken: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }
}

public struct AuthenticatedUser: Codable, Equatable, Hashable, Sendable {
    public let id: Int
    public let username: String
    public let role: String
    public let status: String

    public init(id: Int, username: String, role: String, status: String) {
        self.id = id
        self.username = username
        self.role = role
        self.status = status
    }
}

public struct AuthDevice: Codable, Equatable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let appVersion: String

    public init(id: String, name: String, appVersion: String) {
        self.id = id
        self.name = name
        self.appVersion = appVersion
    }

    enum CodingKeys: String, CodingKey {
        case id = "deviceId"
        case name = "deviceName"
        case appVersion
    }
}

public struct AuthSession: Codable, Equatable, Hashable, Sendable {
    public let id: String
    public let expiresAt: Date?

    public init(id: String, expiresAt: Date?) {
        self.id = id
        self.expiresAt = expiresAt
    }
}

public struct AuthSessionResponse: Codable, Equatable, Sendable {
    public let accessToken: String
    public let refreshToken: String
    public let user: AuthenticatedUser
    public let session: AuthSession

    public init(
        accessToken: String,
        refreshToken: String,
        user: AuthenticatedUser,
        session: AuthSession
    ) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.user = user
        self.session = session
    }
}

public protocol SessionStore: Sendable {
    func read() async throws -> SessionTokens?
    func save(_ tokens: SessionTokens) async throws
    func clear() async throws
}
