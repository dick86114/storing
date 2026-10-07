import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieAuth

private actor MemoryLegacySessionStore: SessionStore, LegacySessionStore {
    private var tokens: SessionTokens?
    private(set) var readCount = 0

    init(tokens: SessionTokens?) {
        self.tokens = tokens
    }

    func read() async throws -> SessionTokens? {
        readCount += 1
        return tokens
    }

    func save(_ tokens: SessionTokens) async throws {
        self.tokens = tokens
    }

    func clear() async throws {
        tokens = nil
    }

    func clearLegacy() async throws {
        tokens = nil
    }
}

private struct FailingRefreshClient: AuthClient, LegacyMacAuthClient {
    var refreshError: Error
    var migrateResponse: AuthSessionResponse?

    func login(username: String, password: String, device: AuthDevice) async throws -> AuthSessionResponse {
        throw AppError.network
    }

    func refresh(refreshToken: String, device: AuthDevice?) async throws -> AuthSessionResponse {
        throw refreshError
    }

    func logout(refreshToken: String) async throws {
        throw AppError.network
    }

    func session(accessToken: String) async throws -> AuthenticatedUser {
        AuthenticatedUser(id: 7, username: "reader", role: "user", status: "active")
    }

    func migrateLegacy(refreshToken: String, device: AuthDevice?) async throws -> AuthSessionResponse {
        guard let migrateResponse else { throw AppError.authenticationRequired }
        return migrateResponse
    }
}

private func response(refreshToken: String) -> AuthSessionResponse {
    AuthSessionResponse(
        accessToken: "migrated-access",
        refreshToken: refreshToken,
        user: AuthenticatedUser(id: 7, username: "reader", role: "user", status: "active"),
        session: AuthSession(id: "migrated", expiresAt: nil)
    )
}

@Test func 文件为空时从旧存储迁移到文件并保留旧存储() async throws {
    let primary = FileSessionStore(fileURL: URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent("migrating-primary-\(UUID().uuidString).json"))
    let legacy = MemoryLegacySessionStore(tokens: SessionTokens(accessToken: "", refreshToken: "legacy"))
    let store = MigratingSessionStore(primary: primary, legacy: legacy)

    let tokens = try await store.read()

    #expect(tokens?.refreshToken == "legacy")
    #expect(try await primary.read()?.refreshToken == "legacy")
    #expect(try await legacy.read()?.refreshToken == "legacy")
    #expect(await store.hasLegacyOrigin())
}

@Test func 文件已有令牌时不读取旧存储() async throws {
    let primary = FileSessionStore(fileURL: URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent("migrating-existing-\(UUID().uuidString).json"))
    try await primary.save(SessionTokens(accessToken: "", refreshToken: "primary"))
    let legacy = MemoryLegacySessionStore(tokens: SessionTokens(accessToken: "", refreshToken: "legacy"))
    let store = MigratingSessionStore(primary: primary, legacy: legacy)

    let tokens = try await store.read()

    #expect(tokens?.refreshToken == "primary")
    #expect(await legacy.readCount == 0)
    #expect(await !store.hasLegacyOrigin())
}

@Test func 网络刷新失败时文件与旧存储都保留() async throws {
    let directory = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("migrating-refresh-\(UUID().uuidString)", isDirectory: true)
    let primary = FileSessionStore(fileURL: directory.appendingPathComponent("session.json"))
    let legacy = MemoryLegacySessionStore(tokens: SessionTokens(accessToken: "", refreshToken: "legacy"))
    let store = MigratingSessionStore(primary: primary, legacy: legacy)
    let repository = AuthRepository(
        client: FailingRefreshClient(refreshError: AppError.network),
        store: store
    )

    await #expect(throws: AppError.network) {
        try await repository.refreshTokens()
    }

    #expect(try await store.read()?.refreshToken == "legacy")
    #expect(try await primary.read()?.refreshToken == "legacy")
    #expect(try await legacy.read()?.refreshToken == "legacy")
    #expect(await store.hasLegacyOrigin())
}

@Test func 明确认证失败后迁移旧会话并清理旧存储() async throws {
    let directory = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("migrating-auth-\(UUID().uuidString)", isDirectory: true)
    let primary = FileSessionStore(fileURL: directory.appendingPathComponent("session.json"))
    let legacy = MemoryLegacySessionStore(tokens: SessionTokens(accessToken: "", refreshToken: "legacy"))
    let store = MigratingSessionStore(primary: primary, legacy: legacy)
    let client = FailingRefreshClient(
        refreshError: AppError.authenticationRequired,
        migrateResponse: response(refreshToken: "migrated")
    )
    let repository = AuthRepository(client: client, store: store)

    let user = try await repository.restore()

    #expect(user?.id == 7)
    #expect(try await store.read()?.refreshToken == "migrated")
    #expect(try await primary.read()?.refreshToken == "migrated")
    #expect(try await legacy.read() == nil)
    #expect(await !store.hasLegacyOrigin())
}
