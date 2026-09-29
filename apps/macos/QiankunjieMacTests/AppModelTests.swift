import Foundation
import QiankunjieAuth
import QiankunjieCore
import QiankunjieLibrary
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
        let model = AppModel(
            authModel: authModel,
            libraryModel: LibraryModel(
                repository: 模拟资料库仓库(),
                cache: EmptyLibraryCache()
            )
        )

        model.presentLogin()
        let succeeded = await authModel.login(
            username: "admin",
            password: "test-only-password",
            device: .fixture()
        )
        model.didAuthenticate()
        while model.libraryModel.isLoading {
            await Task.yield()
        }

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

    @Test func 资料库目的地同步筛选状态并重置文章选择() {
        let model = AppModel.fixture(
            user: .fixture(id: 9),
            destination: .inbox,
            selectedArticleID: 42,
            libraryRepository: 模拟资料库仓库(),
            libraryCache: EmptyLibraryCache()
        )

        model.selectDestination(.archive)

        #expect(model.libraryModel.view == .archive)
        #expect(model.libraryModel.sort == .archived)
        #expect(model.libraryModel.userID == 9)
        #expect(model.selectedArticleID == nil)
    }

    @Test func 退出登录清理用户缓存并切换游客资料库() async throws {
        let cache = 内存资料库缓存()
        try await cache.save(
            ArticleListPage(
                articles: [ArticleCard(id: 42)],
                total: 1,
                page: 1,
                perPage: 20,
                totalPages: 1
            ),
            scope: LibraryCacheScope(
                userID: 9,
                view: .inbox,
                searchText: "",
                sort: .collected,
                order: .desc,
                source: nil,
                categoryId: nil,
                page: 1,
                perPage: 20
            )
        )
        let model = AppModel.fixture(
            user: .fixture(id: 9),
            destination: .inbox,
            selectedArticleID: 42,
            libraryRepository: 模拟资料库仓库(),
            libraryCache: cache
        )

        await model.didLogout()

        #expect(model.user == nil)
        #expect(model.destination == .published)
        #expect(model.libraryModel.userID == nil)
        #expect(model.libraryModel.view == .published)
        #expect(try await cache.load(
            scope: LibraryCacheScope(
                userID: 9,
                view: .inbox,
                searchText: "",
                sort: .collected,
                order: .desc,
                source: nil,
                categoryId: nil,
                page: 1,
                perPage: 20
            )
        ) == nil)
    }

    @Test func 登录回调立即关闭流程不等待资料库请求() async throws {
        let authModel = AuthModel(
            repository: AuthRepository(
                client: 无操作认证客户端(loginUser: .fixture(id: 9)),
                store: 空会话存储()
            )
        )
        let repository = 模拟资料库仓库()
        let model = AppModel(
            authModel: authModel,
            libraryModel: LibraryModel(
                repository: repository,
                cache: EmptyLibraryCache()
            )
        )
        let succeeded = await authModel.login(
            username: "admin",
            password: "test-only-password",
            device: .fixture()
        )
        await repository.holdNextLoad()
        model.presentLogin()

        model.didAuthenticate()

        #expect(succeeded)
        #expect(!model.isLoginPresented)
        await repository.waitForRequests(count: 1)
        #expect(!model.isLoginPresented)

        await repository.resumeHeldLoad(
            with: .success(
                ArticleListPage(
                    articles: [ArticleCard(id: 91)],
                    total: 1,
                    page: 1,
                    perPage: 20,
                    totalPages: 1
                )
            )
        )
        while model.libraryModel.isLoading {
            await Task.yield()
        }
        #expect(model.libraryModel.articles.map(\.id) == [91])
    }

    @Test func 退出登录等待清理时旧请求不能写回游客界面() async throws {
        let cache = 可阻塞资料库缓存()
        let repository = 模拟资料库仓库()
        let model = AppModel.fixture(
            user: .fixture(id: 9),
            destination: .inbox,
            selectedArticleID: 42,
            libraryRepository: repository,
            libraryCache: cache
        )
        await repository.holdNextLoad()
        let oldLoad = Task {
            await model.libraryModel.load(reset: true)
        }
        await repository.waitForRequests(count: 1)

        let logout = Task {
            await model.didLogout()
        }
        await cache.waitForClearRequest()
        await repository.resumeHeldLoad(
            with: .success(
                ArticleListPage(
                    articles: [ArticleCard(id: 90)],
                    total: 1,
                    page: 1,
                    perPage: 20,
                    totalPages: 1
                )
            )
        )
        _ = await oldLoad.value

        #expect(model.libraryModel.articles.isEmpty)

        await cache.finishClear()
        await logout.value

        #expect(model.user == nil)
        #expect(model.libraryModel.userID == nil)
        #expect(model.libraryModel.view == .published)
    }
}

private extension AppModel {
    static func fixture(
        user: AuthenticatedUser?,
        destination: AppDestination,
        selectedArticleID: Int?,
        libraryRepository: any LibraryLoading = 模拟资料库仓库(),
        libraryCache: any LibraryCaching = EmptyLibraryCache()
    ) -> AppModel {
        let authModel = AuthModel(
            repository: AuthRepository(
                client: 无操作认证客户端(),
                store: 空会话存储()
            )
        )
        let model = AppModel(
            authModel: authModel,
            libraryModel: LibraryModel(
                repository: libraryRepository,
                cache: libraryCache,
                userID: user?.id,
                view: destination.libraryView ?? .inbox
            )
        )
        model.user = user
        model.destination = destination
        model.selectedArticleID = selectedArticleID
        return model
    }
}

private extension AppDestination {
    var libraryView: LibraryView? {
        switch self {
        case .inbox: .inbox
        case .favorites: .favorites
        case .archive: .archive
        case .published: .published
        default: nil
        }
    }
}

private actor 模拟资料库仓库: LibraryLoading {
    private var shouldHoldNextLoad = false
    private var heldContinuations: [Int: CheckedContinuation<ArticleListPage, Error>] = [:]
    private var requestedPageCount = 0

    func load(_ query: LibraryQuery) async throws -> ArticleListPage {
        let requestIndex = requestedPageCount
        requestedPageCount += 1
        if shouldHoldNextLoad {
            shouldHoldNextLoad = false
            return try await withCheckedThrowingContinuation { continuation in
                heldContinuations[requestIndex] = continuation
            }
        }
        return ArticleListPage(articles: [], total: 0, page: 1, perPage: 20, totalPages: 0)
    }

    func loadCounts(userID: Int?) async throws -> ArticleCounts {
        ArticleCounts(inbox: 0, favorites: 0, archive: 0, published: 0)
    }

    func loadSources(userID: Int?) async throws -> [LibrarySource] {
        []
    }

    func holdNextLoad() {
        shouldHoldNextLoad = true
    }

    func resumeHeldLoad(with result: Result<ArticleListPage, Error>) {
        let requestIndex = heldContinuations.keys.min() ?? -1
        guard let continuation = heldContinuations.removeValue(forKey: requestIndex) else {
            return
        }
        switch result {
        case .success(let page):
            continuation.resume(returning: page)
        case .failure(let error):
            continuation.resume(throwing: error)
        }
    }

    func waitForRequests(count: Int) async {
        while requestedPageCount < count {
            await Task.yield()
        }
    }
}

private actor 内存资料库缓存: LibraryCaching {
    private var pages: [LibraryCacheScope: ArticleListPage] = [:]

    func load(scope: LibraryCacheScope) async throws -> ArticleListPage? {
        pages[scope]
    }

    func save(_ page: ArticleListPage, scope: LibraryCacheScope) async throws {
        pages[scope] = page
    }

    func clear(userID: Int?) async throws {
        pages = pages.filter { $0.key.userID != userID }
    }
}

private actor 可阻塞资料库缓存: LibraryCaching {
    private var clearContinuations: [CheckedContinuation<Void, Never>] = []
    private(set) var clearRequestCount = 0

    func load(scope: LibraryCacheScope) async throws -> ArticleListPage? {
        nil
    }

    func save(_ page: ArticleListPage, scope: LibraryCacheScope) async throws {}

    func clear(userID: Int?) async throws {
        clearRequestCount += 1
        await withCheckedContinuation { continuation in
            clearContinuations.append(continuation)
        }
    }

    func waitForClearRequest() async {
        while clearRequestCount == 0 {
            await Task.yield()
        }
    }

    func finishClear() {
        let continuations = clearContinuations
        clearContinuations = []
        continuations.forEach { $0.resume() }
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
