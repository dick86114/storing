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
    static let preferenceSuiteName = "com.idickies.storing.macos.uilab.preferences.\(UUID().uuidString)"
    static let preferences = UserDefaults(suiteName: preferenceSuiteName)!
    static let updateService = UILabFixtureUpdateService()
    static let updateCompletionNotice = UpdateCompletionNotice(
        version: "0.2.0",
        previousVersion: "0.1.0",
        notes: """
        ## 新增
        - 更新完成后展示当前版本与完整更新日志
        - 首页版本号可直接回看更新内容

        ## 修复
        - 修复部分长日志在深色主题下对比度不足的问题
        """,
        releaseURL: URL(string: "https://github.com/dick86114/storing/releases/tag/macos-v0.2.0")!,
        publishedAt: ISO8601DateFormatter().date(from: "2026-10-20T12:00:00Z")
    )
    static let currentVersionNotice = UpdateCompletionNotice.currentVersion(
        version: "0.2.0",
        notes: """
        修复：采集失败导致阻塞收件箱的问题
        修复：检测更新不显示更新日志的问题
        优化：增加更新日志缓存
        """
    )
    static let refreshedCurrentVersionNotes = """
    ## 修复
    - 采集失败导致阻塞收件箱的问题
    - 检测更新不显示更新日志的问题

    ## 优化
    - 增加更新日志缓存
    - 当前版本窗口支持手动刷新更新日志
    """

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

    static let categoryFixtures = [
        ArticleCategory(
            id: 1,
            name: "待整理",
            articleDescription: "AI 无法可靠判断，或暂时不适合归入其他分类的文章。",
            color: "#6B7088",
            sortOrder: 0,
            isSystem: true
        ),
        ArticleCategory(
            id: 2,
            name: "工作",
            articleDescription: "项目推进、协作沟通和产品决策相关文章。",
            includeExamples: ["产品需求评审", "跨团队项目计划"],
            excludeExamples: ["个人学习笔记"],
            color: "#5B74E8",
            sortOrder: 10
        ),
        ArticleCategory(
            id: 3,
            name: "技术",
            articleDescription: "工程实现、架构设计和稳定性相关文章。",
            includeExamples: ["架构设计", "故障复盘"],
            excludeExamples: ["团队管理"],
            color: "#39A06D",
            sortOrder: 20
        ),
        ArticleCategory(
            id: 4,
            name: "学习",
            articleDescription: "课程、书籍和长期知识积累。",
            includeExamples: ["课程笔记", "读书摘要"],
            excludeExamples: ["工作项目记录"],
            color: "#3FA5B4",
            sortOrder: 30
        ),
        ArticleCategory(
            id: 5,
            name: "生活",
            articleDescription: "健康、旅行、家庭和日常兴趣。",
            includeExamples: ["旅行攻略", "健康计划"],
            excludeExamples: ["业务复盘"],
            color: "#C97749",
            sortOrder: 40
        ),
        ArticleCategory(
            id: 6,
            name: "旧项目",
            articleDescription: "已结束项目的历史资料，保留用于追溯。",
            includeExamples: ["已结项归档", "历史交付记录"],
            excludeExamples: ["当前项目计划"],
            color: "#9868B5",
            sortOrder: 50,
            isActive: false
        ),
    ]

    static let categoryRecentIDs = [2, 3]
    static let readerCategories = categoryFixtures
    static let categoryService = FixtureCategoryCatalogService(categories: readerCategories)

    static let categoryCatalog = makeCategoryCatalog()
    static let categoryCreateCancelCatalog = makeCategoryCatalog()

    private static func makeCategoryCatalog() -> CategoryCatalogModel {
        let recentStore = CategoryRecentStore(defaults: preferences)
        recentStore.save(categoryRecentIDs, userID: user.id)
        let catalog = CategoryCatalogModel(
            service: categoryService,
            recentStore: recentStore
        )
        catalog.prepareUser(userID: user.id)
        return catalog
    }

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

    static let readerCategoryUnavailableDetail = ArticleDetail(
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
        category: readerCategories.first { $0.id == 3 },
        isFavorited: true,
        isArchived: true,
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

    static let appModel: AppModel = {
        let model = AppModel(
            authModel: authModel,
            libraryModel: libraryModel,
            collectRepository: FixtureCollectRepository(jobs: collectJobs),
            shortcutDefaults: preferences,
            readerPositionStore: MemoryReaderPositionStore(),
            categoryCatalog: categoryCatalog
        )
        model.user = user
        model.destination = .inbox
        return model
    }()

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
        // UI Lab 保持提交中状态，便于人工验收取消入口；Release 构建不包含该夹具。
        try await Task.sleep(for: .seconds(30))
        return jobs.first { $0.status == "running" } ?? jobs.first!
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

actor UILabReaderClient: ReaderNetworkClient {
    private var detail: ArticleDetail
    private let categories: [ArticleCategory]
    private let categoryService: FixtureCategoryCatalogService?

    init(
        detail: ArticleDetail,
        categories: [ArticleCategory],
        categoryService: FixtureCategoryCatalogService? = nil
    ) {
        self.detail = detail
        self.categories = categories
        self.categoryService = categoryService
    }

    func articleDetail(_ selection: ReaderSelection) async throws -> ArticleDetail {
        detail
    }

    func toggleFavorite(articleID: Int) async throws -> ReaderFavoriteResult {
        detail = 更新详情(isFavorited: true)
        return ReaderFavoriteResult(isFavorited: true)
    }

    func archive(articleID: Int, categoryID: Int?) async throws -> ReaderArchiveResult {
        detail = 更新详情(isArchived: true, categoryID: categoryID)
        return ReaderArchiveResult(isArchived: true, category: detail.category)
    }

    func unarchive(articleID: Int) async throws -> ReaderArchiveResult {
        detail = 更新详情(isArchived: false)
        return ReaderArchiveResult(isArchived: false)
    }

    func publish(articleID: Int) async throws -> ReaderPublicationResult {
        detail = 更新详情(isPublished: true)
        return ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func unpublish(articleID: Int) async throws -> ReaderPublicationResult {
        detail = 更新详情(isPublished: false)
        return ReaderPublicationResult(article: detail, publicURL: nil)
    }

    func refetch(articleID: Int) async throws -> ReaderRefetchResult {
        ReaderRefetchResult(hasHTML: true)
    }

    func regenerateAI(articleID: Int) async throws -> ReaderAIResult {
        ReaderAIResult(ok: true)
    }

    func classifyArticle(articleID: Int) async throws -> ReaderAIResult {
        ReaderAIResult(ok: true)
    }

    func delete(articleID: Int) async throws -> ReaderDeleteResult {
        ReaderDeleteResult(deleted: false)
    }

    func permanentDelete(articleID: Int) async throws {}

    func renameArticle(articleID: Int, title: String) async throws {
        detail = 更新详情(title: title)
    }

    func moveArticleToCategory(articleID: Int, categoryID: Int) async throws {
        if categoryID == 4 {
            await categoryService?.禁用下次刷新分类(categoryID)
            throw AppError.categoryUnavailable(message: "分类已停用，请重新选择")
        }
        detail = 更新详情(isArchived: true, categoryID: categoryID)
    }

    private func 更新详情(
        title: String? = nil,
        isFavorited: Bool? = nil,
        isArchived: Bool? = nil,
        isPublished: Bool? = nil,
        categoryID: Int? = nil
    ) -> ArticleDetail {
        let category = categoryID.flatMap { categoryID in
            categories.first { $0.id == categoryID }
        } ?? detail.category

        return ArticleDetail(
            id: detail.id,
            title: title ?? detail.title,
            author: detail.author,
            source: detail.source,
            originalURL: detail.originalURL,
            publicID: detail.publicID,
            coverImage: detail.coverImage,
            publishTime: detail.publishTime,
            createdAt: detail.createdAt,
            aiSummary: detail.aiSummary,
            aiCategory: detail.aiCategory,
            aiTags: detail.aiTags,
            category: category,
            categoryResult: detail.categoryResult,
            isFavorited: isFavorited ?? detail.isFavorited,
            isArchived: isArchived ?? detail.isArchived,
            isPublished: isPublished ?? detail.isPublished,
            contentHTML: detail.contentHTML,
            contentMarkdown: detail.contentMarkdown,
            aiStatus: detail.aiStatus,
            aiErrorCode: detail.aiErrorCode,
            aiErrorMessage: detail.aiErrorMessage,
            aiModel: detail.aiModel,
            aiTotalTokens: detail.aiTotalTokens
        )
    }
}

extension UILabFixtures {
    static let readerClient = UILabReaderClient(
        detail: articleDetail,
        categories: readerCategories,
        categoryService: categoryService
    )

    static let readerCategoryUnavailableClient = UILabReaderClient(
        detail: readerCategoryUnavailableDetail,
        categories: readerCategories,
        categoryService: categoryService
    )
}

actor FixtureCategoryCatalogService: CategoryCatalogServicing {
    private var categories: [ArticleCategory]
    private var counts: [String: Int]
    private var shouldFailNextListAfterMerge = false
    private var categoryToDisableOnNextList: Int?

    init(categories: [ArticleCategory]) {
        self.categories = categories
        let fixtureCounts = [1: 3, 2: 8, 3: 6, 4: 4, 5: 2, 6: 5]
        self.counts = Dictionary(
            uniqueKeysWithValues: categories.map { category in
                (String(category.id), fixtureCounts[category.id] ?? 0)
            }
        )
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        if let categoryID = categoryToDisableOnNextList {
            categoryToDisableOnNextList = nil
            categories.removeAll { $0.id == categoryID }
            counts[String(categoryID)] = 0
        }
        if shouldFailNextListAfterMerge {
            shouldFailNextListAfterMerge = false
            throw AppError.network
        }
        return 目录响应()
    }

    func 禁用下次刷新分类(_ categoryID: Int) {
        categoryToDisableOnNextList = categoryID
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        // 为 CUA 点击创建与取消留出稳定窗口，验证提交中取消不会静默跳转。
        try await Task.sleep(for: .seconds(10))
        let nextID = (categories.map(\.id).max() ?? 0) + 1
        let category = ArticleCategory(
            id: nextID,
            name: request.name ?? "未命名分类",
            articleDescription: request.description,
            includeExamples: request.includeExamples ?? [],
            excludeExamples: request.excludeExamples ?? [],
            color: request.color,
            sortOrder: (categories.map(\.sortOrder).max() ?? 0) + 10
        )
        categories.append(category)
        counts[String(category.id)] = 0
        return CategoryResponse(category: category)
    }

    func update(
        categoryID: Int,
        request: CategoryMutationRequest
    ) async throws -> CategoryResponse {
        guard let index = categories.firstIndex(where: { $0.id == categoryID }) else {
            throw AppError.contentUnavailable
        }
        let current = categories[index]
        let category = ArticleCategory(
            id: current.id,
            name: request.name ?? current.name,
            articleDescription: request.description ?? current.articleDescription,
            includeExamples: request.includeExamples ?? current.includeExamples,
            excludeExamples: request.excludeExamples ?? current.excludeExamples,
            color: request.color ?? current.color,
            sortOrder: current.sortOrder,
            isActive: request.isActive ?? current.isActive,
            isSystem: current.isSystem
        )
        categories[index] = category
        return CategoryResponse(category: category)
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        let categoriesByID = Dictionary(uniqueKeysWithValues: categories.map { ($0.id, $0) })
        categories = categoryIDs.enumerated().compactMap { index, categoryID in
            guard let category = categoriesByID[categoryID] else { return nil }
            return ArticleCategory(
                id: category.id,
                name: category.name,
                articleDescription: category.articleDescription,
                includeExamples: category.includeExamples,
                excludeExamples: category.excludeExamples,
                color: category.color,
                sortOrder: index * 10,
                isActive: category.isActive,
                isSystem: category.isSystem
            )
        }
        return CategoryReorderResponse(categories: categories)
    }

    func delete(
        categoryID: Int,
        targetCategoryID: Int
    ) async throws -> DeleteCategoryResponse {
        let movedArticleCount = counts[String(categoryID)] ?? 0
        categories.removeAll { $0.id == categoryID }
        counts.removeValue(forKey: String(categoryID))
        counts[String(targetCategoryID), default: 0] += movedArticleCount
        return DeleteCategoryResponse(movedArticleCount: movedArticleCount)
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        guard let sourceIndex = categories.firstIndex(where: { $0.id == sourceCategoryID }) else {
            throw AppError.contentUnavailable
        }
        let source = categories[sourceIndex]
        categories[sourceIndex] = ArticleCategory(
            id: source.id,
            name: source.name,
            articleDescription: source.articleDescription,
            includeExamples: source.includeExamples,
            excludeExamples: source.excludeExamples,
            color: source.color,
            sortOrder: source.sortOrder,
            isActive: false,
            isSystem: source.isSystem
        )
        let movedArticleCount = counts[String(sourceCategoryID)] ?? 0
        counts[String(sourceCategoryID)] = 0
        counts[String(targetCategoryID), default: 0] += movedArticleCount
        shouldFailNextListAfterMerge = source.name == "旧项目"
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        CategoryOptimizeResponse(
            draft: CategoryOptimizeDraft(
                description: request.description,
                includeExamples: request.includeExamples,
                excludeExamples: request.excludeExamples
            )
        )
    }

    private func 目录响应() -> CategoriesResponse {
        CategoriesResponse(
            categories: categories,
            counts: counts
        )
    }
}

struct UILabFixtureUpdateService: UpdateServicing {
    private let release = AppRelease(
        version: "0.2.0",
        tagName: "macos-v0.2.0",
        releaseNotes: "乾坤戒 macOS v0.2.0",
        publishedAt: nil,
        assetName: "Qiankunjie-0.2.0-arm64.dmg",
        downloadURL: URL(string: "https://example.com/Qiankunjie.dmg")!,
        checksumURL: URL(string: "https://github.com/dick86114/storing/Qiankunjie.dmg.sha256")!,
        sha256: String(repeating: "a", count: 64)
    )

    private let detailedReleaseNotes = """
        ## 新增
        - 下载确认弹窗展示新版本更新日志
        - 更新日志按版本持久化，重新打开无需再次请求

        ## 修复
        - 更新完成弹窗立即展示已缓存日志
        """

    func checkForUpdate() async throws -> AppRelease? {
        release
    }

    func fetchUpdateLog(for version: String) async throws -> String? {
        detailedReleaseNotes
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
