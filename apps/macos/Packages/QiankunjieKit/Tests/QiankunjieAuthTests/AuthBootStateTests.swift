import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieAuth

private actor BootAuthClient: AuthClient {
    let refreshError: AppError

    init(refreshError: AppError) {
        self.refreshError = refreshError
    }

    func login(username: String, password: String, device: AuthDevice) async throws -> AuthSessionResponse {
        throw AppError.network
    }

    func refresh(refreshToken: String, device: AuthDevice?) async throws -> AuthSessionResponse {
        throw refreshError
    }

    func logout(refreshToken: String) async throws {}

    func session(accessToken: String) async throws -> AuthenticatedUser {
        throw AppError.authenticationRequired
    }
}

@MainActor
@Test func 启动恢复把网络失败标记为离线而不是未登录() async throws {
    let repository = AuthRepository(
        client: BootAuthClient(refreshError: .network),
        store: MemoryBootSessionStore(tokens: SessionTokens(accessToken: "", refreshToken: String(repeating: "r", count: 48)))
    )
    let model = AuthModel(repository: repository)

    await model.restore()

    #expect(model.bootState == .offline)
    #expect(model.user == nil)
    #expect(model.errorMessage == "无法连接服务器，请检查网络后重试")
}

@MainActor
@Test func 启动恢复把明确认证失败标记为需要登录() async throws {
    let repository = AuthRepository(
        client: BootAuthClient(refreshError: .authenticationRequired),
        store: MemoryBootSessionStore(tokens: SessionTokens(accessToken: "", refreshToken: String(repeating: "r", count: 48)))
    )
    let model = AuthModel(repository: repository)

    await model.restore()

    #expect(model.bootState == .authenticationRequired)
    #expect(model.user == nil)
}

private actor MemoryBootSessionStore: SessionStore {
    private var tokens: SessionTokens?

    init(tokens: SessionTokens?) {
        self.tokens = tokens
    }

    func read() async throws -> SessionTokens? { tokens }
    func save(_ tokens: SessionTokens) async throws { self.tokens = tokens }
    func clear() async throws { tokens = nil }
}
