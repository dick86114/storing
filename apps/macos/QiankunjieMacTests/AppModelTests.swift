import QiankunjieCore
import QiankunjieAuth
import Testing
@testable import QiankunjieMac

@MainActor
struct AppModelTests {
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

private struct 空会话存储: SessionStore {
    func read() async throws -> SessionTokens? { nil }
    func save(_ tokens: SessionTokens) async throws {}
    func clear() async throws {}
}

private struct 无操作认证客户端: AuthClient {
    func refresh(
        refreshToken: String,
        device: AuthDevice?
    ) async throws -> AuthSessionResponse {
        throw AppError.server
    }
}
