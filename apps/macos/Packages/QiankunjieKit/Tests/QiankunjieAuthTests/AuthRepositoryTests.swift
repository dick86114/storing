import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieAuth

private actor 内存会话存储: SessionStore {
    private var 令牌: SessionTokens?
    private let 读取延迟: Duration
    private(set) var 保存次数 = 0
    private(set) var 清理次数 = 0

    init(
        tokens: SessionTokens? = nil,
        readDelay: Duration = .zero
    ) {
        令牌 = tokens
        读取延迟 = readDelay
    }

    func read() async throws -> SessionTokens? {
        try await Task.sleep(for: 读取延迟)
        return 令牌
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

private actor 门控认证客户端: AuthClient {
    private var 登录等待者: [CheckedContinuation<AuthSessionResponse, Error>] = []
    private var 会话等待者: [CheckedContinuation<AuthenticatedUser, Error>] = []
    private(set) var 等待登录数 = 0
    private(set) var 等待会话数 = 0

    func login(username: String, password: String, device: AuthDevice) async throws -> AuthSessionResponse {
        等待登录数 += 1
        defer { 等待登录数 -= 1 }
        return try await withCheckedThrowingContinuation { continuation in
            登录等待者.append(continuation)
        }
    }

    func refresh(refreshToken: String, device: AuthDevice?) async throws -> AuthSessionResponse {
        .fixture()
    }

    func logout(refreshToken: String) async throws {}

    func session(accessToken: String) async throws -> AuthenticatedUser {
        等待会话数 += 1
        defer { 等待会话数 -= 1 }
        return try await withCheckedThrowingContinuation { continuation in
            会话等待者.append(continuation)
        }
    }

    func 恢复首个登录(_ result: Result<AuthSessionResponse, Error>) {
        guard let continuation = 登录等待者.first else {
            return
        }
        登录等待者.removeFirst()
        continuation.resume(with: result)
    }

    func 恢复最后一个登录(_ result: Result<AuthSessionResponse, Error>) {
        guard let continuation = 登录等待者.last else {
            return
        }
        登录等待者.removeLast()
        continuation.resume(with: result)
    }

    func 恢复会话(_ result: Result<AuthenticatedUser, Error>) {
        guard let continuation = 会话等待者.first else {
            return
        }
        会话等待者.removeFirst()
        continuation.resume(with: result)
    }
}

private actor 保存返回前门控会话存储: SessionStore {
    private var 令牌: SessionTokens?
    private var 旧保存返回等待: CheckedContinuation<Void, Never>?
    private var 新保存返回等待: CheckedContinuation<Void, Never>?
    private(set) var 旧刷新令牌保存已到达 = false
    private(set) var 新刷新令牌已保存 = false
    private(set) var 清理次数 = 0
    private(set) var 新令牌保存后清理次数 = 0

    init(tokens: SessionTokens? = nil) {
        令牌 = tokens
    }

    func read() async throws -> SessionTokens? {
        令牌
    }

    func save(_ tokens: SessionTokens) async throws {
        令牌 = tokens
        if tokens.refreshToken == "old-refresh" {
            旧刷新令牌保存已到达 = true
            await withCheckedContinuation { continuation in
                旧保存返回等待 = continuation
            }
        } else if tokens.refreshToken == "new-refresh" {
            新刷新令牌已保存 = true
            await withCheckedContinuation { continuation in
                新保存返回等待 = continuation
            }
        }
    }

    func clear() async throws {
        if 新刷新令牌已保存 {
            新令牌保存后清理次数 += 1
        }
        令牌 = nil
        清理次数 += 1
    }

    func 允许旧保存返回() {
        旧保存返回等待?.resume()
        旧保存返回等待 = nil
    }

    func 允许新保存返回() {
        新保存返回等待?.resume()
        新保存返回等待 = nil
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
    static func fixture(
        access: String = "new-access",
        refresh: String = String(repeating: "r", count: 48),
        user: AuthenticatedUser = .fixture()
    ) -> Self {
        AuthSessionResponse(
            accessToken: access,
            refreshToken: refresh,
            user: user,
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

@Test func 存储读取延迟时并发刷新仍只执行一次() async throws {
    let client = 计数刷新客户端()
    let repository = AuthRepository(
        client: client,
        store: 内存会话存储(tokens: .fixture(), readDelay: .milliseconds(20))
    )

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

@Test func 登录等待期间退出后旧响应不会恢复会话() async throws {
    let client = 门控认证客户端()
    let store = 内存会话存储(tokens: .fixture())
    let repository = AuthRepository(client: client, store: store)
    let loginTask = Task {
        try await repository.login(
            username: "admin",
            password: "test-only-password",
            device: .fixture()
        )
    }

    while await client.等待登录数 == 0 {
        try await Task.sleep(for: .milliseconds(5))
    }
    await repository.logout()
    await client.恢复首个登录(.success(.fixture()))

    await #expect(throws: AppError.authenticationRequired) {
        _ = try await loginTask.value
    }
    #expect(try await store.read() == nil)
    #expect(await repository.currentAccessToken() == nil)
    #expect(await repository.currentUser == nil)
}

@Test func 较慢的旧登录不会覆盖较新的登录() async throws {
    let client = 门控认证客户端()
    let store = 内存会话存储()
    let repository = AuthRepository(client: client, store: store)
    let oldLogin = Task {
        try await repository.login(
            username: "old",
            password: "test-only-password",
            device: .fixture()
        )
    }
    while await client.等待登录数 != 1 {
        try await Task.sleep(for: .milliseconds(5))
    }
    let newLogin = Task {
        try await repository.login(
            username: "new",
            password: "test-only-password",
            device: .fixture()
        )
    }
    while await client.等待登录数 != 2 {
        try await Task.sleep(for: .milliseconds(5))
    }

    await client.恢复最后一个登录(
        .success(.fixture(access: "new-access", refresh: "new-refresh", user: .fixture(id: 2)))
    )
    let newUser = try await newLogin.value
    await client.恢复首个登录(
        .success(.fixture(access: "old-access", refresh: "old-refresh", user: .fixture(id: 1)))
    )

    await #expect(throws: AppError.authenticationRequired) {
        _ = try await oldLogin.value
    }
    #expect(newUser == .fixture(id: 2))
    #expect(await repository.currentUser == .fixture(id: 2))
    #expect(await repository.currentAccessToken() == "new-access")
    #expect(try await store.read()?.refreshToken == "new-refresh")
}

@Test func 旧登录清理不会丢弃已持久化的新会话() async throws {
    let client = 门控认证客户端()
    let store = 保存返回前门控会话存储()
    let repository = AuthRepository(client: client, store: store)
    let oldLogin = Task {
        try await repository.login(
            username: "old",
            password: "test-only-password",
            device: .fixture()
        )
    }
    while await client.等待登录数 != 1 {
        try await Task.sleep(for: .milliseconds(5))
    }
    await client.恢复首个登录(
        .success(.fixture(access: "old-access", refresh: "old-refresh", user: .fixture(id: 1)))
    )
    while await !store.旧刷新令牌保存已到达 {
        try await Task.sleep(for: .milliseconds(5))
    }
    let newLogin = Task {
        try await repository.login(
            username: "new",
            password: "test-only-password",
            device: .fixture()
        )
    }
    while await client.等待登录数 != 1 {
        try await Task.sleep(for: .milliseconds(5))
    }

    await client.恢复首个登录(
        .success(.fixture(access: "new-access", refresh: "new-refresh", user: .fixture(id: 2)))
    )
    while await !store.新刷新令牌已保存 {
        try await Task.sleep(for: .milliseconds(5))
    }
    await store.允许旧保存返回()
    await #expect(throws: AppError.authenticationRequired) {
        _ = try await oldLogin.value
    }
    #expect(await store.新令牌保存后清理次数 == 0)

    await store.允许新保存返回()
    let newUser = try await newLogin.value

    #expect(newUser == .fixture(id: 2))
    #expect(await repository.currentUser == .fixture(id: 2))
    #expect(await repository.currentAccessToken() == "new-access")
    #expect(try await store.read()?.refreshToken == "new-refresh")
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

@Test func 恢复会话等待期间退出后不回写旧用户() async throws {
    let client = 门控认证客户端()
    let store = 内存会话存储(tokens: .fixture())
    let repository = AuthRepository(client: client, store: store)
    let restoreTask = Task {
        try await repository.restore()
    }

    while await client.等待会话数 == 0 {
        try await Task.sleep(for: .milliseconds(5))
    }
    await repository.logout()
    await client.恢复会话(.success(.fixture(id: 3)))

    let user = try await restoreTask.value

    #expect(user == nil)
    #expect(try await store.read() == nil)
    #expect(await repository.currentAccessToken() == nil)
    #expect(await repository.currentUser == nil)
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
    #expect(model.errorMessage == "用户名或密码不正确，请检查后重试")
    #expect(!model.isSubmitting)
}

@Test @MainActor func 认证模型登录限流显示友好提示() async {
    let repository = AuthRepository(
        client: 模拟认证客户端(loginResult: .failure(.rateLimited)),
        store: 内存会话存储()
    )
    let model = AuthModel(repository: repository)

    let succeeded = await model.login(
        username: "admin",
        password: "test-only-password",
        device: .fixture()
    )

    #expect(!succeeded)
    #expect(model.errorMessage == "登录尝试过于频繁，请稍后再试")
}
