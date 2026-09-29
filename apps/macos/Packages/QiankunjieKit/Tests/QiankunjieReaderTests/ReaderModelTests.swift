import Foundation
import QiankunjieCore
import QiankunjieNetworking
import Testing
@testable import QiankunjieReader

@MainActor
@Suite("阅读器模型")
struct ReaderModelTests {
    @Test func 服务端重抓响应解码内容HTML标志() throws {
        let data = Data(#"{"contentHtml":true}"#.utf8)

        let result = try JSONDecoder.qiankunjie.decode(
            ReaderRefetchResult.self,
            from: data
        )

        #expect(result.hasHTML)
    }

    @Test func 服务端发布响应解码文章和公开链接() throws {
        let data = Data(#"{"article":{"id":81,"isPublished":true},"publicUrl":"/p/token"}"#.utf8)

        let result = try JSONDecoder.qiankunjie.decode(
            ReaderPublicationResult.self,
            from: data
        )

        #expect(result.article?.id == 81)
        #expect(result.article?.isPublished == true)
        #expect(result.publicURL == "/p/token")
    }

    @Test func 阅读器加载桌面版HTML() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)

        await model.open(articleID: 12)

        #expect(await client.lastHTMLVariant == "desktop")
        #expect(model.article?.id == 12)
        #expect(model.errorMessage == nil)
    }

    @Test func 游客公开卡片使用公开文章路由() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        let selection = ReaderSelection(
            articleID: 71,
            publicID: "public-token",
            isGuest: true
        )

        await model.open(selection)

        #expect(await client.paths.first == "publications/public-token")
        #expect(model.articleID == 71)
        #expect(model.errorMessage == nil)
    }

    @Test func 登录私有卡片使用私有文章路由() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        let selection = ReaderSelection(
            articleID: 72,
            publicID: nil,
            isGuest: false
        )

        await model.open(selection)

        #expect(await client.paths.first == "articles/72?format=html&htmlVariant=desktop")
        #expect(model.articleID == 72)
    }

    @Test func 登录公开卡片优先使用私有文章路由() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        let selection = ReaderSelection(
            articleID: 73,
            publicID: "public-token",
            isGuest: false
        )

        await model.open(selection)

        #expect(await client.paths.first == "articles/73?format=html&htmlVariant=desktop")
        #expect(model.articleID == 73)
    }

    @Test func API客户端游客公开路由不带认证头() async throws {
        let session = 模拟网络会话(
            data: Data(
                #"{"article":{"id":81,"publicId":"public-token","title":"公开文章","isPublished":true}}"#
                    .utf8
            )
        )
        let client = APIClient(
            baseURL: URL(string: "https://storing.example/api/v1")!,
            session: session
        )
        let selection = ReaderSelection(
            articleID: 81,
            publicID: "public-token",
            isGuest: true
        )

        let detail = try await client.articleDetail(selection)
        let request = try #require(await session.requests.first)

        #expect(detail.id == 81)
        #expect(request.url?.path.hasSuffix("/publications/public-token") == true)
        #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
    }

    @Test func 旧收藏响应不会更新切换后的文章() async throws {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 91)
        await client.holdFavorite()

        let favoriteTask = Task {
            await model.toggleFavorite()
        }
        await client.waitForRequestCount(1)
        await model.open(articleID: 92)
        await client.resumeFavorite()
        await favoriteTask.value

        #expect(model.articleID == 92)
        #expect(model.article?.id == 92)
        #expect(model.article?.isFavorited == false)
        #expect(model.actionErrorMessage == nil)
    }

    @Test func 旧删除响应不会关闭切换后的文章() async throws {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 93)
        var deleteCallbackCount = 0
        model.onDeleted = {
            deleteCallbackCount += 1
        }
        await client.holdDelete()

        let deleteTask = Task {
            await model.delete()
        }
        await client.waitForRequestCount(2)
        await model.open(articleID: 94)
        await client.resumeDelete()
        await deleteTask.value

        #expect(model.articleID == 94)
        #expect(model.article?.id == 94)
        #expect(!model.isDeleted)
        #expect(deleteCallbackCount == 0)
    }

    @Test func 过期阅读状态令牌不会写入存储() async throws {
        let store = 内存阅读位置存储()
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client, positionStore: store)
        await model.open(articleID: 95)
        let state = Data("新状态".utf8)

        model.updateReadingState(state, contentToken: "old-token")

        let nextModel = ReaderModel(client: client, positionStore: store)
        await nextModel.open(articleID: 95)
        #expect(nextModel.savedReadingState == nil)
    }

    @Test func 缺少服务端HTML时用文章信息生成中文回退正文() async {
        let client = 模拟阅读客户端(
            detail: 文章详情(
                id: 21,
                title: "快速入门",
                source: "乾坤戒",
                contentMarkdown: "第一段正文\n\n第二段 <正文>",
                aiSummary: "这是摘要"
            )
        )
        let model = ReaderModel(client: client)

        await model.open(articleID: 21)

        let html = model.displayHTML
        #expect(html.contains("<title>快速入门</title>"))
        #expect(html.contains("来源：乾坤戒"))
        #expect(html.contains("这是摘要"))
        #expect(html.contains("<p>第一段正文</p>"))
        #expect(html.contains("第二段 &lt;正文&gt;"))
    }

    @Test func 文章动作调用对应服务端路径并更新状态() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 31)

        await model.toggleFavorite()
        await model.archive()
        await model.moveToInbox()
        await model.publish()
        await model.unpublish()

        #expect(await client.paths == [
            "articles/31?format=html&htmlVariant=desktop",
            "articles/31/favorite",
            "articles/31/archive",
            "articles/31/unarchive",
            "articles/31/publish",
            "articles/31/unpublish",
        ])
        #expect(model.article?.isFavorited == true)
        #expect(model.article?.isArchived == false)
        #expect(model.article?.isPublished == false)
    }

    @Test func 重抓和重新生成AI完成后重新加载详情() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 42)

        await model.refetch()
        await model.regenerateAI()

        #expect(await client.paths.contains("articles/42/refetch"))
        #expect(await client.paths.contains("articles/42/regenerate-ai"))
        #expect(await client.desktopRequestCount == 3)
        #expect(model.articleID == 42)
    }

    @Test func 删除会记录结果并通知界面关闭阅读器() async {
        let client = 模拟阅读客户端()
        let model = ReaderModel(client: client)
        await model.open(articleID: 53)
        var deleteCallbackCount = 0
        model.onDeleted = {
            deleteCallbackCount += 1
        }

        await model.delete()

        #expect(await client.paths.last == "articles/53")
        #expect(model.isDeleted)
        #expect(deleteCallbackCount == 1)
    }

    @Test func 阅读位置按文章保存和恢复() async throws {
        let store = 内存阅读位置存储()
        let client = 模拟阅读客户端()
        let firstModel = ReaderModel(client: client, positionStore: store)
        await firstModel.open(articleID: 64)
        let readingState = Data("阅读位置-64".utf8)

        firstModel.updateReadingState(readingState)

        let secondModel = ReaderModel(client: client, positionStore: store)
        await secondModel.open(articleID: 64)
        #expect(secondModel.savedReadingState == readingState)

        await secondModel.open(articleID: 65)
        #expect(secondModel.savedReadingState == nil)
    }
}

private actor 模拟阅读客户端: ReaderNetworkClient {
    private let detail: ArticleDetail
    private(set) var paths: [String] = []
    private(set) var lastHTMLVariant: String?
    private(set) var desktopRequestCount = 0
    private var shouldHoldFavorite = false
    private var shouldHoldDelete = false
    private var favoriteContinuation: CheckedContinuation<ReaderFavoriteResult, Error>?
    private var deleteContinuation: CheckedContinuation<ReaderDeleteResult, Error>?
    private var requestWaiters: [Int: [CheckedContinuation<Void, Never>]] = [:]

    init(detail: ArticleDetail = 文章详情(id: 12)) {
        self.detail = detail
    }

    func articleDetail(articleID: Int, htmlVariant: String) async throws -> ArticleDetail {
        paths.append("articles/\(articleID)?format=html&htmlVariant=\(htmlVariant)")
        notifyRequestWaiters()
        lastHTMLVariant = htmlVariant
        if htmlVariant == "desktop" {
            desktopRequestCount += 1
        }
        return articleID == detail.id ? detail : 文章详情(id: articleID)
    }

    func articleDetail(_ selection: ReaderSelection) async throws -> ArticleDetail {
        if selection.isGuest, let publicID = selection.publicID {
            paths.append("publications/\(publicID)")
            notifyRequestWaiters()
            return 文章详情(id: selection.articleID)
        }

        return try await articleDetail(
            articleID: selection.articleID,
            htmlVariant: "desktop"
        )
    }

    func toggleFavorite(articleID: Int) async throws -> ReaderFavoriteResult {
        paths.append("articles/\(articleID)/favorite")
        notifyRequestWaiters()
        if shouldHoldFavorite {
            shouldHoldFavorite = false
            return try await withCheckedThrowingContinuation { continuation in
                favoriteContinuation = continuation
            }
        }
        return ReaderFavoriteResult(isFavorited: true)
    }

    func archive(articleID: Int) async throws -> ReaderArchiveResult {
        paths.append("articles/\(articleID)/archive")
        return ReaderArchiveResult(isArchived: true)
    }

    func unarchive(articleID: Int) async throws -> ReaderArchiveResult {
        paths.append("articles/\(articleID)/unarchive")
        return ReaderArchiveResult(isArchived: false)
    }

    func publish(articleID: Int) async throws -> ReaderPublicationResult {
        paths.append("articles/\(articleID)/publish")
        return ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func unpublish(articleID: Int) async throws -> ReaderPublicationResult {
        paths.append("articles/\(articleID)/unpublish")
        return ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func refetch(articleID: Int) async throws -> ReaderRefetchResult {
        paths.append("articles/\(articleID)/refetch")
        return ReaderRefetchResult(hasHTML: true)
    }

    func regenerateAI(articleID: Int) async throws -> ReaderAIResult {
        paths.append("articles/\(articleID)/regenerate-ai")
        return ReaderAIResult(ok: true)
    }

    func delete(articleID: Int) async throws -> ReaderDeleteResult {
        paths.append("articles/\(articleID)")
        notifyRequestWaiters()
        if shouldHoldDelete {
            shouldHoldDelete = false
            return try await withCheckedThrowingContinuation { continuation in
                deleteContinuation = continuation
            }
        }
        return ReaderDeleteResult(deleted: true)
    }

    func holdFavorite() {
        shouldHoldFavorite = true
    }

    func resumeFavorite() {
        favoriteContinuation?.resume(returning: ReaderFavoriteResult(isFavorited: true))
        favoriteContinuation = nil
    }

    func holdDelete() {
        shouldHoldDelete = true
    }

    func resumeDelete() {
        deleteContinuation?.resume(returning: ReaderDeleteResult(deleted: true))
        deleteContinuation = nil
    }

    func waitForRequestCount(_ count: Int) async {
        guard paths.count < count else {
            return
        }

        await withCheckedContinuation { continuation in
            requestWaiters[count, default: []].append(continuation)
        }
    }

    private func notifyRequestWaiters() {
        let readyKeys = requestWaiters.keys.filter { $0 <= paths.count }
        for key in readyKeys {
            let waiters = requestWaiters.removeValue(forKey: key) ?? []
            waiters.forEach { $0.resume() }
        }
    }
}

private final class 内存阅读位置存储: ReaderPositionStoring, @unchecked Sendable {
    private var states: [Int: Data] = [:]
    private let lock = NSLock()

    func readingState(articleID: Int) -> Data? {
        lock.withLock {
            states[articleID]
        }
    }

    func save(_ state: Data, articleID: Int) {
        lock.withLock {
            states[articleID] = state
        }
    }

    func remove(articleID: Int) {
        lock.withLock {
            _ = states.removeValue(forKey: articleID)
        }
    }
}

private actor 模拟网络会话: URLSessioning {
    private let data: Data
    private(set) var requests: [URLRequest] = []

    init(data: Data) {
        self.data = data
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        requests.append(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        return (data, response)
    }
}

private func 文章详情(
    id: Int,
    title: String? = nil,
    source: String? = nil,
    contentMarkdown: String? = nil,
    aiSummary: String? = nil
) -> ArticleDetail {
    ArticleDetail(
        id: id,
        title: title,
        source: source,
        aiSummary: aiSummary,
        contentMarkdown: contentMarkdown
    )
}
