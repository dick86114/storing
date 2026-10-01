import QiankunjieAuth
import QiankunjieCollect
import QiankunjieCore
import QiankunjieNetworking
import Testing
@testable import QiankunjieMac

@MainActor
struct CollectWiringTests {
    @Test func 生产采集仓库使用认证客户端提供者() throws {
        let authModel = AuthModel(
            repository: AuthRepository(
                client: NoopAuthClient(),
                store: NoopSessionStore()
            )
        )

        let model = AppModel(authModel: authModel)
        #expect(model.collectAPIClient.usesTokenProvider(authModel.repository))
    }

    @Test func 生产阅读器使用认证客户端提供者() throws {
        let authModel = AuthModel(
            repository: AuthRepository(
                client: NoopAuthClient(),
                store: NoopSessionStore()
            )
        )

        let model = AppModel(authModel: authModel)
        #expect(model.readerAPIClient.usesTokenProvider(authModel.repository))
    }
}

private final class NoopAuthClient: AuthClient {
    func login(username: String, password: String, device: AuthDevice) async throws -> AuthSessionResponse {
        throw AppError.network
    }

    func refresh(refreshToken: String, device: AuthDevice?) async throws -> AuthSessionResponse {
        throw AppError.network
    }

    func logout(refreshToken: String) async throws {}

    func session(accessToken: String) async throws -> AuthenticatedUser {
        throw AppError.network
    }
}

private final class NoopSessionStore: SessionStore {
    func read() async throws -> SessionTokens? { nil }
    func save(_ tokens: SessionTokens) async throws {}
    func clear() async throws {}
}
