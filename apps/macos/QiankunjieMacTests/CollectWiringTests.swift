import Foundation
import QiankunjieAuth
import QiankunjieCollect
import QiankunjieCore
import QiankunjieLibrary
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

    @Test func 采集成功后刷新收件箱列表() async throws {
        let authModel = AuthModel(
            repository: AuthRepository(
                client: NoopAuthClient(),
                store: NoopSessionStore()
            )
        )
        let libraryRepository = 等待资料库仓库()
        let model = AppModel(
            authModel: authModel,
            libraryModel: LibraryModel(
                repository: libraryRepository,
                cache: EmptyLibraryCache(),
                userID: 7,
                view: .inbox
            )
        )
        model.destination = .inbox

        let imported = try #require(model.collectModel.onArticleImported)
        imported(try 采集完成任务())
        await libraryRepository.waitForLoadRequests(1)

        #expect(await libraryRepository.loadRequestCount == 1)
        #expect(await libraryRepository.lastQuery?.page == 1)
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

private actor 等待资料库仓库: LibraryLoading {
    private(set) var loadRequestCount = 0
    private(set) var lastQuery: LibraryQuery?
    private var loadRequestContinuations: [CheckedContinuation<Void, Never>] = []

    func load(_ query: LibraryQuery) async throws -> ArticleListPage {
        loadRequestCount += 1
        lastQuery = query
        resumeWaitingRequests()
        return ArticleListPage(articles: [], total: 0, page: 1, perPage: 20, totalPages: 0)
    }

    func loadCounts(userID: Int?) async throws -> ArticleCounts {
        ArticleCounts(inbox: 0, favorites: 0, archive: 0, published: 0)
    }

    func loadSources(userID: Int?) async throws -> [LibrarySource] {
        []
    }

    func waitForLoadRequests(_ count: Int) async {
        if loadRequestCount >= count {
            return
        }

        await withCheckedContinuation { continuation in
            loadRequestContinuations.append(continuation)
        }
    }

    private func resumeWaitingRequests() {
        let continuations = loadRequestContinuations
        loadRequestContinuations = []
        continuations.forEach { $0.resume() }
    }
}

private func 采集完成任务() throws -> CollectJob {
    let payload: [String: Any?] = [
        "id": 11,
        "url": "https://example.com/article",
        "normalizedUrl": "https://example.com/article",
        "status": "completed",
        "stage": "completed",
        "method": "singlefile",
        "captureStrategy": "desktop",
        "articleId": 31,
        "title": "已完成文章",
        "error": nil,
        "errorSummary": nil,
        "errorDetails": [String](),
        "errorHint": nil,
        "createdAt": nil,
        "updatedAt": nil,
        "startedAt": nil,
        "finishedAt": nil,
    ]
    let data = try JSONSerialization.data(withJSONObject: payload)
    return try JSONDecoder.qiankunjie.decode(CollectJob.self, from: data)
}
