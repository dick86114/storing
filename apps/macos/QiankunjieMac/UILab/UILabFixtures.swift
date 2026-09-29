#if DEBUG
import Foundation
import QiankunjieAuth
import QiankunjieCollect
import QiankunjieLibrary
import QiankunjieReader
import QiankunjieUpdating
import QiankunjieCore

/// UI Lab 的所有内容都在进程内固定；不会写入用户数据或请求生产服务。
@MainActor
enum UILabFixtures {
    static let user = AuthenticatedUser(
        id: 9001,
        username: "uilab-user",
        role: "user",
        status: "active"
    )

    static let article = ArticleCard(
        id: 1001,
        title: "macOS 原生阅读器长文排版夹具",
        author: "UI Lab",
        source: "乾坤戒设计规范",
        originalURL: "https://example.com/ui-lab/article",
        publicID: "uilab-article-1001",
        coverImage: nil,
        publishTime: ISO8601DateFormatter().date(from: "2026-09-30T09:00:00Z"),
        createdAt: ISO8601DateFormatter().date(from: "2026-09-30T09:00:00Z"),
        aiSummary: "用于检查标题、摘要、来源、标签和正文排版的可重复夹具。",
        aiCategory: "产品设计",
        aiTags: ["macOS", "阅读器", "UI Lab"],
        isFavorited: true
    )

    static let articles = [
        article,
        ArticleCard(
            id: 1002,
            title: "三栏资料库紧凑列表压力样例",
            source: "固定样例",
            aiSummary: "验证较长标题和多行摘要不会被裁切到不可读。",
            aiTags: ["资料库"]
        ),
    ]

    static let articleDetail = ArticleDetail(
        id: article.id,
        title: article.title,
        author: article.author,
        source: article.source,
        originalURL: article.originalURL,
        publicID: article.publicID,
        publishTime: article.publishTime,
        createdAt: article.createdAt,
        aiSummary: article.aiSummary,
        aiCategory: article.aiCategory,
        aiTags: article.aiTags,
        isFavorited: true,
        isPublished: true,
        contentHTML: readerHTML
    )

    static let authModel = AuthModel(
        repository: AuthRepository(
            client: NoNetworkAuthClient(),
            store: MemorySessionStore()
        )
    )

    static let libraryModel = LibraryModel(
        repository: FixtureLibraryRepository(
            state: .content,
            articles: articles
        ),
        cache: EmptyLibraryCache(),
        userID: user.id
    )

    static let collectModel = CollectModel(
        repository: FixtureCollectRepository(jobs: collectJobs),
        userID: user.id,
        initialJobs: collectJobs
    )

    static let appModel = AppModel(
        authModel: authModel,
        libraryModel: libraryModel,
        collectRepository: FixtureCollectRepository(jobs: collectJobs),
        readerPositionStore: MemoryReaderPositionStore()
    )

    static func libraryModel(for state: FixtureLibraryState) -> LibraryModel {
        LibraryModel(
            repository: FixtureLibraryRepository(
                state: state,
                articles: articles
            ),
            cache: EmptyLibraryCache(),
            userID: user.id
        )
    }

    static let readerHTML = """
    <!doctype html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        :root { color-scheme: light dark; font: 16px/1.75 -apple-system, "PingFang SC", sans-serif; }
        body { margin: 0 auto; padding: 32px 24px 64px; max-width: 720px; }
        h1 { line-height: 1.25; } h2 { margin-top: 36px; }
        pre { background: rgba(127,127,127,.12); padding: 14px; border-radius: 8px; overflow: auto; }
        table { width: 1200px; border-collapse: collapse; } th, td { border: 1px solid gray; padding: 10px; }
        blockquote { margin: 0; padding-left: 18px; border-left: 4px solid rgba(127,127,127,.4); }
      </style>
    </head>
    <body>
      <h1>阅读器端到端固定正文</h1>
      <p>这一段验证中文换行、长英文串与链接边界：UI-Lab-deterministic-reader-fixture-with-a-very-long-token。</p>
      <blockquote><p>固定引用用于检查左侧标记与缩进。</p></blockquote>
      <h2>代码与表格</h2>
      <pre><code>let scenario = "reader"</code></pre>
      <div style="overflow-x:auto"><table><thead><tr><th>场景</th><th>验收点</th></tr></thead><tbody><tr><td>阅读器</td><td>宽表可横向滚动，不撑破页面</td></tr></tbody></table></div>
    </body>
    </html>
    """

    static let collectJobs: [CollectJob] = {
        let payload = """
        [
          {"id":7000,"url":"https://example.com/collect-queued","normalized_url":"https://example.com/collect-queued","status":"pending","stage":"排队等待抓取","article_id":null,"title":"排队中的固定采集任务","error_details":[]},
          {"id":7001,"url":"https://example.com/collect-running","normalized_url":"https://example.com/collect-running","status":"running","stage":"正在提取正文","article_id":null,"title":"运行中的固定采集任务","error_details":[]},
          {"id":7002,"url":"https://example.com/collect-complete","normalized_url":"https://example.com/collect-complete","status":"completed","stage":"finished","article_id":1001,"title":"已完成的固定采集任务","error_details":[]},
          {"id":7003,"url":"https://example.com/collect-failed","normalized_url":"https://example.com/collect-failed","status":"failed","stage":"failed","article_id":null,"title":"失败的固定采集任务","error":"fixture timeout","error_summary":"内容提取超时","error_details":["fixture timeout"],"error_hint":"重试时使用同一个固定夹具"}
        ]
        """
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        do {
            let jobs = try decoder.decode([CollectJob].self, from: Data(payload.utf8))
            precondition(!jobs.isEmpty, "UI Lab 采集任务夹具不能为空")
            return jobs
        } catch {
            fatalError("UI Lab 采集任务夹具解码失败：\(error)")
        }
    }()

    static var runningCollectJob: CollectJob {
        guard let job = collectJobs.first(where: { $0.status == "running" }) else {
            fatalError("UI Lab 采集任务夹具缺少运行中任务")
        }
        return job
    }
}

enum FixtureLibraryState: Sendable {
    case content
    case empty
    case loading
    case offline
}

private final class FixtureLibraryRepository: LibraryLoading, @unchecked Sendable {
    private let state: FixtureLibraryState
    private let articles: [ArticleCard]

    init(state: FixtureLibraryState) {
        self.state = state
        self.articles = []
    }

    init(state: FixtureLibraryState, articles: [ArticleCard]) {
        self.state = state
        self.articles = articles
    }

    func load(_ query: LibraryQuery) async throws -> ArticleListPage {
        switch state {
        case .content:
            return ArticleListPage(
                articles: self.articles,
                total: articles.count,
                page: 1,
                perPage: 20,
                totalPages: 1
            )
        case .empty:
            return ArticleListPage(articles: [], total: 0, page: 1, perPage: 20, totalPages: 1)
        case .loading:
            try? await Task.sleep(for: .seconds(30))
            return ArticleListPage(articles: [], total: 0, page: 1, perPage: 20, totalPages: 1)
        case .offline:
            throw AppError.network
        }
    }

    func loadCounts(userID: Int?) async throws -> ArticleCounts {
        ArticleCounts(inbox: 1, favorites: 1, archive: 0, published: 1)
    }

    func loadSources(userID: Int?) async throws -> [LibrarySource] {
        [LibrarySource(source: "乾坤戒设计规范", count: 1, latestCreatedAt: nil)]
    }
}

private struct FixtureCollectRepository: CollectServicing {
    private let jobs: [CollectJob]

    init(jobs: [CollectJob]) {
        self.jobs = jobs
    }

    func submit(url: URL) async throws -> CollectJob {
        jobs.first { $0.status == "running" } ?? jobs.first!
    }

    func jobs(limit: Int, offset: Int) async throws -> CollectJobPage {
        CollectJobPage(jobs: jobs, total: jobs.count, hasMore: false)
    }

    func job(id: Int) async throws -> CollectJob? {
        jobs.first { $0.id == id }
    }

    func retry(id: Int) async throws -> CollectJob {
        jobs.first { $0.status == "running" } ?? jobs.first!
    }

    func delete(id: Int) async throws -> Bool {
        true
    }

    func clearFinished() async throws -> Int {
        2
    }
}

private struct NoNetworkAuthClient: AuthClient {
    func login(
        username: String,
        password: String,
        device: AuthDevice
    ) async throws -> AuthSessionResponse {
        throw AppError.network
    }

    func refresh(
        refreshToken: String,
        device: AuthDevice?
    ) async throws -> AuthSessionResponse {
        throw AppError.network
    }

    func logout(refreshToken: String) async throws {
        throw AppError.network
    }

    func session(accessToken: String) async throws -> AuthenticatedUser {
        throw AppError.network
    }
}

private struct MemorySessionStore: SessionStore {
    func read() async throws -> SessionTokens? { nil }
    func save(_ tokens: SessionTokens) async throws {}
    func clear() async throws {}
}

private final class MemoryReaderPositionStore: ReaderPositionStoring, @unchecked Sendable {
    private var states: [Int: Data] = [:]
    private let lock = NSLock()

    func readingState(articleID: Int) -> Data? {
        lock.withLock { states[articleID] }
    }

    func save(_ state: Data, articleID: Int) {
        lock.withLock { states[articleID] = state }
    }

    func remove(articleID: Int) {
        lock.withLock { _ = states.removeValue(forKey: articleID) }
    }

    func prepareUser(userID: Int?) {
        lock.withLock { states.removeAll() }
    }
}

struct UILabReaderClient: ReaderNetworkClient {
    private let detail: ArticleDetail

    init(detail: ArticleDetail) {
        self.detail = detail
    }

    func articleDetail(_ selection: ReaderSelection) async throws -> ArticleDetail {
        detail
    }

    func toggleFavorite(articleID: Int) async throws -> ReaderFavoriteResult {
        ReaderFavoriteResult(isFavorited: true)
    }

    func archive(articleID: Int) async throws -> ReaderArchiveResult {
        ReaderArchiveResult(isArchived: false)
    }

    func unarchive(articleID: Int) async throws -> ReaderArchiveResult {
        ReaderArchiveResult(isArchived: false)
    }

    func publish(articleID: Int) async throws -> ReaderPublicationResult {
        ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func unpublish(articleID: Int) async throws -> ReaderPublicationResult {
        ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func refetch(articleID: Int) async throws -> ReaderRefetchResult {
        ReaderRefetchResult(hasHTML: true)
    }

    func regenerateAI(articleID: Int) async throws -> ReaderAIResult {
        ReaderAIResult(ok: true)
    }

    func delete(articleID: Int) async throws -> ReaderDeleteResult {
        ReaderDeleteResult(deleted: false)
    }
}

extension UILabFixtures {
    static let readerClient = UILabReaderClient(detail: articleDetail)
}

struct UILabFixtureUpdateService: UpdateServicing {
    private let release = AppRelease(
        version: "0.2.0",
        tagName: "macos-v0.2.0",
        releaseNotes: "UI Lab 固定更新说明。",
        publishedAt: nil,
        assetName: "Qiankunjie-0.2.0-arm64.dmg",
        downloadURL: URL(string: "https://example.com/Qiankunjie.dmg")!,
        checksumURL: URL(string: "https://github.com/dick86114/storing/Qiankunjie.dmg.sha256")!,
        sha256: String(repeating: "a", count: 64)
    )

    func checkForUpdate() async throws -> AppRelease? {
        release
    }

    func download(
        _ release: AppRelease,
        progress: @Sendable (Double?) -> Void
    ) async throws -> DownloadedUpdate {
        progress(1)
        return DownloadedUpdate(
            version: release.version,
            fileURL: URL(fileURLWithPath: "/tmp/qiankunjie-ui-lab.dmg"),
            sha256: String(repeating: "a", count: 64)
        )
    }
}
#endif
