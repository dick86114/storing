import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieAuth

private actor 内存会话存储: SessionStore {
    private var 令牌: SessionTokens?
    private(set) var 保存次数 = 0
    private(set) var 清理次数 = 0

    init(tokens: SessionTokens? = nil) {
        令牌 = tokens
    }

    func read() async throws -> SessionTokens? {
        令牌
    }

    func save(_ tokens: SessionTokens) async throws {
        令牌 = tokens
        保存次数 += 1
    }

    func clear() async throws {
        令牌 = nil
        清理次数 += 1
    }
}

private actor 模拟认证客户端: AuthClient {
    private let 登录结果: Result<AuthSessionResponse, AppError>
    private let 刷新结果: Result<AuthSessionResponse, AppError>
    private let 会话结果: Result<AuthenticatedUser, AppError>
    private(set) var 登录次数 = 0
    private(set) var 刷新次数 = 0
    private(set) var 会话次数 = 0
    private(set) var 退出次数 = 0
    private(set) var 收到的会话访问令牌: [String] = []

    init(
        loginResult: Result<AuthSessionResponse, AppError> = .success(.fixture()),
        refreshResult: Result<AuthSessionResponse, AppError> = .success(.fixture()),
        sessionResult: Result<AuthenticatedUser, AppError> = .success(.fixture())
    ) {
        登录结果 = loginResult
        刷新结果 = refreshResult
        会话结果 = sessionResult
    }

    func login(username: String, password: String, device: AuthDevice) async throws -> AuthSessionResponse {
        登录次数 += 1
        return try 登录结果.get()
    }

    func refresh(refreshToken: String, device: AuthDevice?) async throws -> AuthSessionResponse {
        刷新次数 += 1
        try await Task.sleep(for: .milliseconds(20))
        return try 刷新结果.get()
    }

    func logout(refreshToken: String) async throws {
        退出次数 += 1
    }

    func session(accessToken: String) async throws -> AuthenticatedUser {
        会话次数 += 1
        收到的会话访问令牌.append(accessToken)
        return try 会话结果.get()
    }
}

private actor 计数刷新客户端: AuthClient {
    private(set) var 刷新次数 = 0

    func refresh(refreshToken: String, device: AuthDevice?) async throws -> AuthSessionResponse {
        刷新次数 += 1
        try await Task.sleep(for: .milliseconds(20))
        return .fixture()
    }
}

private extension SessionTokens {
    static func fixture(access: String = "access", refresh: String = "refresh") -> Self {
        SessionTokens(accessToken: access, refreshToken: refresh)
    }
}

private extension AuthenticatedUser {
    static func fixture(id: Int = 1) -> Self {
        AuthenticatedUser(id: id, username: "admin", role: "admin", status: "active")
    }
}

private extension AuthSessionResponse {
    static func fixture() -> Self {
        AuthSessionResponse(
            accessToken: "new-access",
            refreshToken: String(repeating: "r", count: 48),
            user: .fixture(),
            session: AuthSession(id: UUID().uuidString, expiresAt: nil)
        )
    }
}

private extension AuthDevice {
    static func fixture() -> Self {
        AuthDevice(id: "device-1", name: "测试 Mac", appVersion: "1.0.0")
    }
}

@Test func 凭证刷新失败会清除已存会话() async throws {
    let store = 内存会话存储(tokens: .fixture(access: "expired", refresh: "revoked"))
    let repository = AuthRepository(
        client: 模拟认证客户端(refreshResult: .failure(.authenticationRequired)),
        store: store
    )

    await #expect(throws: AppError.authenticationRequired) {
        try await repository.refreshTokens()
    }
    #expect(try await store.read() == nil)
}

@Test func 并发刷新只执行一次() async throws {
    let client = 计数刷新客户端()
    let repository = AuthRepository(client: client, store: 内存会话存储(tokens: .fixture()))

    async let first: Void = repository.refreshTokens()
    async let second: Void = repository.refreshTokens()
    _ = try await (first, second)

    #expect(await client.刷新次数 == 1)
}

@Test func 登录成功只持久化刷新令牌并保留内存访问令牌() async throws {
    let store = 内存会话存储()
    let client = 模拟认证客户端()
    let repository = AuthRepository(client: client, store: store)

    let user = try await repository.login(
        username: "admin",
        password: "test-only-password",
        device: .fixture()
    )
    let saved = try #require(await store.read())

    #expect(user == .fixture())
    #expect(saved.refreshToken == String(repeating: "r", count: 48))
    #expect(saved.accessToken.isEmpty)
    #expect(await repository.currentAccessToken() == "new-access")
}

@Test func 恢复会话会轮换刷新令牌并验证当前会话() async throws {
    let oldRefresh = String(repeating: "o", count: 48)
    let store = 内存会话存储(tokens: .fixture(refresh: oldRefresh))
    let client = 模拟认证客户端()
    let repository = AuthRepository(client: client, store: store)

    let user = try await repository.restore()

    #expect(user == .fixture())
    #expect(await client.刷新次数 == 1)
    #expect(await client.会话次数 == 1)
    #expect(await client.收到的会话访问令牌 == ["new-access"])
}

@Test func 恢复时刷新令牌失效返回未登录并清理本地状态() async throws {
    let store = 内存会话存储(tokens: .fixture(refresh: "revoked"))
    let repository = AuthRepository(
        client: 模拟认证客户端(refreshResult: .failure(.authenticationRequired)),
        store: store
    )

    let user = try await repository.restore()

    #expect(user == nil)
    #expect(try await store.read() == nil)
    #expect(await repository.currentAccessToken() == nil)
}

@Test func 退出登录即使服务端失败也会清理本地会话() async throws {
    let store = 内存会话存储(tokens: .fixture())
    let repository = AuthRepository(client: 模拟认证客户端(), store: store)

    await repository.logout()

    #expect(try await store.read() == nil)
    #expect(await repository.currentAccessToken() == nil)
}

@Test func Keychain会话存储只保存刷新令牌() async throws {
    let store = KeychainSessionStore(
        service: "com.idickies.storing.macos.tests.\(UUID().uuidString)"
    )
    try await store.clear()

    do {
        try await store.save(
            SessionTokens(accessToken: "must-not-persist", refreshToken: "stored-refresh-token")
        )
        let stored = try #require(try await store.read())

        #expect(stored.accessToken.isEmpty)
        #expect(stored.refreshToken == "stored-refresh-token")

        try await store.clear()
        #expect(try await store.read() == nil)
    } catch {
        try? await store.clear()
        throw error
    }
}

@Test @MainActor func 认证模型登录失败不保留用户并显示凭据错误() async {
    let repository = AuthRepository(
        client: 模拟认证客户端(loginResult: .failure(.authenticationRequired)),
        store: 内存会话存储()
    )
    let model = AuthModel(repository: repository)

    let succeeded = await model.login(
        username: "admin",
        password: "test-only-password",
        device: .fixture()
    )

    #expect(!succeeded)
    #expect(model.user == nil)
    #expect(model.errorMessage == "用户名或密码错误")
    #expect(!model.isSubmitting)
}
