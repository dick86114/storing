import Foundation
import QiankunjieCore
import QiankunjieAuth
import Testing
@testable import QiankunjieMac

@MainActor
struct AppModelTests {
    @Test func 游客保留主外壳且登录流程默认关闭() {
        let model = AppModel.fixture(
            user: nil,
            destination: .published,
            selectedArticleID: nil
        )

        #expect(model.destination == .published)
        #expect(!model.isLoginPresented)

        model.presentLogin()

        #expect(model.isLoginPresented)
    }

    @Test func 登录成功关闭登录流程并进入收件箱() async {
        let authModel = AuthModel(
            repository: AuthRepository(
                client: 无操作认证客户端(loginUser: .fixture(id: 9)),
                store: 空会话存储()
            )
        )
        let model = AppModel(authModel: authModel)

        model.presentLogin()
        let succeeded = await authModel.login(
            username: "admin",
            password: "test-only-password",
            device: .fixture()
        )
        model.didAuthenticate()

        #expect(succeeded)
        #expect(!model.isLoginPresented)
        #expect(model.destination == .inbox)
    }

    @Test func 退出登录清理用户相关选择和导航() async {
        let model = AppModel.fixture(
            user: .fixture(id: 9),
            destination: .archive,
            selectedArticleID: 42
        )

        await model.didLogout()

        #expect(model.user == nil)
        #expect(model.destination == .published)
        #expect(model.selectedArticleID == nil)
    }

    @Test func 首版导航不包含管理端入口() {
        #expect(
            AppDestination.allCases == [
                .inbox, .favorites, .archive, .published,
                .collect, .tasks, .search, .settings,
            ]
        )
    }
}

private extension AppModel {
    static func fixture(
        user: AuthenticatedUser?,
        destination: AppDestination,
        selectedArticleID: Int?
    ) -> AppModel {
        let model = AppModel(
            authModel: AuthModel(
                repository: AuthRepository(
                    client: 无操作认证客户端(),
                    store: 空会话存储()
                )
            )
        )
        model.user = user
        model.destination = destination
        model.selectedArticleID = selectedArticleID
        return model
    }
}

private extension AuthenticatedUser {
    static func fixture(id: Int) -> Self {
        AuthenticatedUser(id: id, username: "admin", role: "admin", status: "active")
    }
}

private extension AuthDevice {
    static func fixture() -> Self {
        AuthDevice(id: "device-1", name: "测试 Mac", appVersion: "1.0.0")
    }
}

private struct 空会话存储: SessionStore {
    func read() async throws -> SessionTokens? { nil }
    func save(_ tokens: SessionTokens) async throws {}
    func clear() async throws {}
}

private struct 无操作认证客户端: AuthClient, Sendable {
    private let loginUser: AuthenticatedUser?

    init(loginUser: AuthenticatedUser? = nil) {
        self.loginUser = loginUser
    }

    func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async throws -> AuthSessionResponse {
        guard let loginUser else {
            throw AppError.server
        }
        return AuthSessionResponse(
            accessToken: "access",
            refreshToken: String(repeating: "r", count: 48),
            user: loginUser,
            session: AuthSession(id: UUID().uuidString, expiresAt: nil)
        )
    }

    func refresh(
        refreshToken: String,
        device: AuthDevice?
    ) async throws -> AuthSessionResponse {
        throw AppError.server
    }
}
