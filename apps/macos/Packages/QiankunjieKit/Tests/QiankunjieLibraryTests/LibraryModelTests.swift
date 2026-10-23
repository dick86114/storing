import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieLibrary

@MainActor
struct LibraryModelTests {
    @Test func 加载更多使用已保存页码并在末页停止() async {
        let repository = 模拟资料库仓库(
            pages: [
                1: .fixture(ids: [1, 2], page: 1, totalPages: 2),
                2: .fixture(ids: [3], page: 2, totalPages: 2),
            ]
        )
        let model = LibraryModel(repository: repository, cache: EmptyLibraryCache())

        await model.load(reset: true)
        await model.loadMore()
        await model.loadMore()

        #expect(model.articles.map(\.id) == [1, 2, 3])
        #expect(await repository.requestedPages == [1, 2])
        #expect(!model.canLoadMore)
    }

    @Test func 首页和加载更多都会移除重复文章ID() async {
        let repository = 模拟资料库仓库(
            pages: [
                1: .fixture(ids: [1, 1, 2], page: 1, totalPages: 2),
                2: .fixture(ids: [2, 3], page: 2, totalPages: 2),
            ]
        )
        let model = LibraryModel(repository: repository, cache: EmptyLibraryCache())

        await model.load(reset: true)
        await model.loadMore()

        #expect(model.articles.map(\.id) == [1, 2, 3])
    }

    @Test func 搜索会提交并重置归档来源和页码() async throws {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(repository: repository, cache: EmptyLibraryCache())
        model.select(view: .archive)
        model.selectSource("少数派")
        model.selectSort(.published)
        model.toggleOrder()
        model.searchDraft = " 乾坤戒 "
        model.submitSearch()

        await model.load(reset: true)

        let query = try #require(await repository.lastQuery)
        #expect(query.view == .archive)
        #expect(query.searchText == "乾坤戒")
        #expect(query.source == nil)
        #expect(query.sort == .published)
        #expect(query.order == .asc)
        #expect(query.page == 1)
    }

    @Test func 搜索态切换栏目时立即清除() {
        let model = LibraryModel(repository: 模拟资料库仓库(), cache: EmptyLibraryCache())
        model.searchDraft = "乾坤戒"
        model.submitSearch()

        #expect(model.isSearching)
        #expect(model.appliedSearchText == "乾坤戒")

        model.select(view: .archive)

        #expect(!model.isSearching)
        #expect(model.searchDraft.isEmpty)
        #expect(model.appliedSearchText.isEmpty)
    }

    @Test func 各栏目排序与筛选可见性对齐网页端() {
        let model = LibraryModel(repository: 模拟资料库仓库(), cache: EmptyLibraryCache())

        #expect(model.availableSorts == [.collected, .published])
        #expect(!model.isSourceFilterAvailable)
        model.selectSource("少数派")
        model.selectCategory(3)
        #expect(model.source == nil)
        #expect(model.categoryId == nil)

        model.select(view: .favorites)
        #expect(model.availableSorts == [.favorited, .collected, .published])
        #expect(!model.isSourceFilterAvailable)

        model.select(view: .archive)
        #expect(model.availableSorts == [.archived, .collected, .published])
        #expect(model.isSourceFilterAvailable)

        model.select(view: .published)
        #expect(model.availableSorts == [.published, .collected])
        #expect(!model.isSourceFilterAvailable)
    }

    @Test func 单篇分类直接使用传入分类更新文章卡片() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)
        let category = ArticleCategory(id: 21, name: "产品设计")

        await model.runArticleCategory(articleID: 7, category: category)

        #expect(model.articles.first?.category?.id == 21)
        #expect(await repository.lastBulkCategoryID == 21)
    }

    @Test func 批量分类直接使用传入分类更新文章卡片() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7, 8], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)
        model.toggleBulkMode()
        model.selectAllLoadedForBulk()
        let category = ArticleCategory(id: 21, name: "产品设计")

        await model.runBulkCategory(category)

        #expect(model.articles.allSatisfy { $0.category?.id == 21 })
        #expect(await repository.lastBulkCategoryID == 21)
    }

    @Test func 分类筛选继续作为归档列表查询条件() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )

        await model.load(reset: true)
        #expect(await repository.lastQuery?.categoryId == nil)

        model.selectCategory(21)
        await model.load(reset: true)
        #expect(await repository.lastQuery?.categoryId == 21)

        model.select(view: .inbox)
        #expect(model.categoryId == nil)
    }

    @Test func 分类失败保留结构化错误和服务端消息() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7], page: 1, totalPages: 1)],
            bulkError: .categoryUnavailable(message: "分类已停用，不能用于归类")
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)

        await model.runArticleCategory(
            articleID: 7,
            category: ArticleCategory(id: 21, name: "产品设计")
        )

        #expect(model.lastBulkActionError == .categoryUnavailable(message: "分类已停用，不能用于归类"))
        #expect(model.bulkResult?.issues.first?.message == "分类已停用，不能用于归类")
    }

    @Test func 手动分类请求在途时切换用户不会更新新用户文章() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)
        await repository.holdNextBulkCategory()

        let request = Task {
            await model.runArticleCategory(
                articleID: 7,
                category: ArticleCategory(id: 21, name: "产品设计")
            )
        }
        await repository.waitForBulkCategoryRequests(1)

        model.prepareUser(userID: 8, view: .archive)
        await model.load(reset: true)
        await repository.resumeBulkCategory(with: .success(ArticleBulkActionResult(
            requestedCount: 1,
            succeededIDs: [7],
            skipped: [],
            failed: []
        )))
        await request.value

        #expect(model.userID == 8)
        #expect(model.articles.first?.category == nil)
        #expect(model.bulkResult == nil)
        #expect(model.lastBulkActionError == nil)
        #expect(model.bulkRunningAction == nil)
    }

    @Test func 分类结果刷新列表时切换用户不会写回旧分类() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)
        await repository.holdNextLoad()

        let request = Task {
            await model.runArticleCategory(
                articleID: 7,
                category: ArticleCategory(id: 21, name: "产品设计")
            )
        }
        await repository.waitForBulkCategoryRequests(1)
        await repository.waitForRequests(count: 2)

        model.prepareUser(userID: 8, view: .archive)
        await model.load(reset: true)
        await repository.resumeHeldLoad(
            with: .success(.fixture(ids: [7], page: 1, totalPages: 1))
        )
        await request.value

        #expect(model.userID == 8)
        #expect(model.articles.first?.category == nil)
        #expect(model.bulkResult == nil)
        #expect(model.bulkRunningAction == nil)
    }

    @Test func 批量AI分类请求在途时切换用户不会写回新用户状态() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)
        model.toggleBulkMode()
        model.selectAllLoadedForBulk()
        await repository.holdNextBulkRegenerateAI()

        let request = Task {
            await model.runBulkCategoryByAI()
        }
        await repository.waitForBulkRegenerateAIRequests(1)

        model.prepareUser(userID: 8, view: .archive)
        await model.load(reset: true)
        await repository.resumeBulkRegenerateAI(with: .success(ArticleBulkAIResult(
            requestedCount: 1,
            queuedIDs: [7],
            alreadyQueuedIDs: [],
            failed: []
        )))
        await request.value

        #expect(model.userID == 8)
        #expect(model.articles.first?.aiStatus == nil)
        #expect(model.bulkSelection.isEmpty)
        #expect(model.bulkResult == nil)
        #expect(model.lastBulkActionError == nil)
        #expect(model.bulkRunningAction == nil)
    }

    @Test func 切换用户后可以立即执行新的分类操作() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)
        await repository.holdNextBulkCategory()

        let oldRequest = Task {
            await model.runArticleCategory(
                articleID: 7,
                category: ArticleCategory(id: 21, name: "产品设计")
            )
        }
        await repository.waitForBulkCategoryRequests(1)

        model.prepareUser(userID: 8, view: .archive)
        await model.load(reset: true)
        #expect(model.bulkRunningAction == nil)

        await model.runArticleCategory(
            articleID: 7,
            category: ArticleCategory(id: 22, name: "工程实践")
        )

        #expect(model.articles.first?.category?.id == 22)
        #expect(model.bulkResult?.succeededCount == 1)
        #expect(await repository.bulkCategoryRequestCount == 2)
        #expect(await repository.lastBulkCategoryID == 22)

        await repository.resumeBulkCategory(with: .success(ArticleBulkActionResult(
            requestedCount: 1,
            succeededIDs: [7],
            skipped: [],
            failed: []
        )))
        await oldRequest.value

        #expect(model.articles.first?.category?.id == 22)
        #expect(model.bulkRunningAction == nil)
    }

    @Test func 来源统计解码兼容PostgreSQL时间() throws {
        let data = Data(#"""
        [{"source":"知新坊","count":2,"latestCreatedAt":"2026-08-31 14:00:17.446"}]
        """#.utf8)

        let sources = try JSONDecoder.qiankunjie.decode([LibrarySource].self, from: data)

        #expect(sources.first?.source == "知新坊")
        #expect(sources.first?.latestCreatedAt != nil)
    }

    @Test func 来源统计解码兼容毫秒时间() throws {
        let data = Data(#"""
        [{"source":"少数派","count":2,"latestCreatedAt":"2026-09-30T04:00:00.000Z"}]
        """#.utf8)

        let sources = try JSONDecoder.qiankunjie.decode([LibrarySource].self, from: data)

        #expect(sources.first?.source == "少数派")
        #expect(sources.first?.count == 2)
        #expect(sources.first?.latestCreatedAt != nil)
    }

    @Test func 无网络时优先显示同作用域缓存并保留文章() async throws {
        let cache = 内存资料库缓存()
        try await cache.save(
            .fixture(ids: [11], page: 1, totalPages: 1),
            scope: .fixture(userID: 7, view: .inbox)
        )
        let repository = 模拟资料库仓库(error: AppError.network)
        let model = LibraryModel(
            repository: repository,
            cache: cache,
            userID: 7,
            view: .inbox
        )

        await model.load(reset: true)

        #expect(model.articles.map(\.id) == [11])
        #expect(model.isShowingCache)
        #expect(model.errorMessage == nil)

        await repository.setResult(
            .fixture(ids: [12, 13], page: 1, totalPages: 1)
        )
        await model.retry()

        #expect(model.articles.map(\.id) == [12, 13])
        #expect(!model.isShowingCache)
    }

    @Test func 请求失败且无缓存时进入错误状态并支持重试() async {
        let repository = 模拟资料库仓库(error: AppError.network)
        let model = LibraryModel(repository: repository, cache: EmptyLibraryCache())

        await model.load(reset: true)

        #expect(model.articles.isEmpty)
        #expect(model.errorMessage == "网络连接失败，请稍后重试")
        #expect(model.displayState == .error)

        await repository.setResult(.fixture(ids: [], page: 1, totalPages: 0))
        await model.retry()

        #expect(model.errorMessage == nil)
        #expect(model.displayState == .empty)
    }

    @Test func 手动刷新失败时恢复非空缓存并显示缓存标签() async throws {
        let cache = 内存资料库缓存()
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [12], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            cache: cache,
            userID: 7,
            view: .inbox
        )
        await model.load(reset: true)
        try await cache.save(
            .fixture(ids: [11], page: 1, totalPages: 1),
            scope: .fixture(userID: 7, view: .inbox)
        )
        await repository.setError(AppError.network)

        await model.load(reset: false)

        #expect(model.articles.map(\.id) == [11])
        #expect(model.isShowingCache)
        #expect(model.errorMessage == nil)
        #expect(model.displayState == .content)
    }

    @Test func 手动刷新失败时保留有效空缓存页() async throws {
        let cache = 内存资料库缓存()
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [12], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            cache: cache,
            userID: 7,
            view: .inbox
        )
        await model.load(reset: true)
        try await cache.save(
            .fixture(ids: [], page: 1, totalPages: 0),
            scope: .fixture(userID: 7, view: .inbox)
        )
        await repository.setError(AppError.network)

        await model.load(reset: false)

        #expect(model.articles.isEmpty)
        #expect(model.isShowingCache)
        #expect(model.errorMessage == nil)
        #expect(model.displayState == .empty)
    }

    @Test func 切换账号清理旧用户内存状态并重新加载() async throws {
        let cache = 内存资料库缓存()
        try await cache.save(
            .fixture(ids: [21], page: 1, totalPages: 1),
            scope: .fixture(userID: 7, view: .inbox)
        )
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [31], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            cache: cache,
            userID: 7,
            view: .inbox
        )
        model.selectSort(.published)

        await model.switchUser(userID: 8, view: .favorites)

        #expect(model.userID == 8)
        #expect(model.view == .favorites)
        #expect(model.sort == .favorited)
        #expect(model.articles.map(\.id) == [31])
        #expect(try await cache.load(scope: .fixture(userID: 7, view: .inbox)) == nil)
    }

    @Test func 准备新账号时清理用户作用域筛选和辅助状态() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [51], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        model.selectSource("少数派")
        model.selectCategory(3)
        model.selectedArticleID = 51
        await model.load(reset: true)

        model.prepareUser(userID: 8, view: .favorites)

        #expect(model.source == nil)
        #expect(model.categoryId == nil)
        #expect(model.counts == nil)
        #expect(model.availableSources.isEmpty)
        #expect(model.selectedArticleID == nil)
    }

    @Test func 账号切换等待清理时旧请求不能写回界面() async throws {
        let cache = 可阻塞资料库缓存()
        let repository = 模拟资料库仓库()
        let model = LibraryModel(
            repository: repository,
            cache: cache,
            userID: 7,
            view: .inbox
        )
        await repository.holdNextLoad()
        let oldLoad = Task {
            await model.load(reset: true)
        }
        await repository.waitForRequests(count: 1)

        let userSwitch = Task {
            await model.switchUser(userID: 8, view: .favorites)
        }
        await cache.waitForClearRequest()
        await repository.resumeHeldLoad(
            with: .success(.fixture(ids: [71], page: 1, totalPages: 1))
        )
        _ = await oldLoad.value

        #expect(model.articles.isEmpty)

        await cache.finishClear()
        await userSwitch.value

        #expect(model.userID == 8)
        #expect(model.articles.isEmpty)
    }

    @Test func 列表会刷新生成完成的AI摘要() async {
        let article = ArticleCard(
            id: 41,
            title: "文章 41",
            source: "测试来源",
            aiStatus: "queued"
        )
        let repository = 模拟资料库仓库(pages: [1: .fixture(ids: [41], page: 1, totalPages: 1)])
        await repository.setArticleCard(article)
        let model = LibraryModel(repository: repository, cache: EmptyLibraryCache())
        await model.load(reset: true)

        await repository.setArticleCard(
            ArticleCard(
                id: 41,
                title: "文章 41",
                source: "测试来源",
                aiSummary: "生成完成",
                aiStatus: "succeeded"
            )
        )
        await model.refreshAIStatusesOnce()

        #expect(model.articles.first?.aiSummary == "生成完成")
        #expect(model.articles.first?.aiStatus == "succeeded")
    }

    @Test func 同步列表重载不会清除当前选择() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [41], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(repository: repository, cache: EmptyLibraryCache())
        await model.load(reset: true)

        model.selectedArticleID = 41
        await model.load(reset: true)

        #expect(model.selectedArticleID == 41)
        #expect(model.articles.map(\.id) == [41])
    }

    @Test func 资料库手动归档取消归档删除和分类都会通知目录刷新() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)
        var 刷新信号次数 = 0
        model.onCatalogAffectingChange = {
            刷新信号次数 += 1
        }

        await model.runArticleCategory(
            articleID: 7,
            category: ArticleCategory(id: 21, name: "产品设计")
        )
        await model.runArticleToolbarAction(.archive, articleID: 7, categoryID: 21)
        await model.runArticleToolbarAction(.unarchive, articleID: 7)
        await model.runArticleToolbarAction(.delete, articleID: 7)

        #expect(刷新信号次数 == 4)
    }

    @Test func 资料库批量分类和AI后台完成都会通知目录刷新() async {
        let repository = 模拟资料库仓库(
            pages: [1: ArticleListPage(
                articles: [ArticleCard(id: 7, isArchived: true)],
                total: 1,
                page: 1,
                perPage: 20,
                totalPages: 1
            )]
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)
        var 刷新信号次数 = 0
        model.onCatalogAffectingChange = {
            刷新信号次数 += 1
        }

        model.toggleBulkMode()
        model.selectAllLoadedForBulk()
        await model.runBulkCategory(ArticleCategory(id: 21, name: "产品设计"))
        #expect(刷新信号次数 == 1)

        model.clearBulkResult()
        model.selectAllLoadedForBulk()
        await model.runBulkCategoryByAI()
        #expect(刷新信号次数 == 1)

        await repository.setArticleCard(ArticleCard(
            id: 7,
            category: ArticleCategory(id: 22, name: "工程实践"),
            isArchived: true,
            aiStatus: "succeeded"
        ))
        await model.refreshAIStatusesOnce()

        #expect(刷新信号次数 == 2)
    }

    @Test func 资料库批量取消归档归档和删除都会通知目录刷新() async {
        let repository = 模拟资料库仓库(
            pages: [1: .fixture(ids: [7, 8], page: 1, totalPages: 1)]
        )
        let model = LibraryModel(
            repository: repository,
            bulkRepository: repository,
            cache: EmptyLibraryCache(),
            userID: 7,
            view: .archive
        )
        await model.load(reset: true)
        var 刷新信号次数 = 0
        model.onCatalogAffectingChange = {
            刷新信号次数 += 1
        }
        model.toggleBulkMode()

        model.selectAllLoadedForBulk()
        await model.runBulkToolbarAction(.unarchive)
        model.selectAllLoadedForBulk()
        await model.runBulkToolbarAction(.archive, categoryID: 21)
        model.selectAllLoadedForBulk()
        await model.runBulkToolbarAction(.delete)

        #expect(刷新信号次数 == 3)
    }
}

private actor 模拟资料库仓库: LibraryLoading, LibraryBulkOperating {
    private var pages: [Int: ArticleListPage]
    private var currentError: AppError?
    private let bulkError: AppError?
    private var shouldHoldNextLoad = false
    private var heldContinuations: [Int: CheckedContinuation<ArticleListPage, Error>] = [:]
    private var shouldHoldNextBulkCategory = false
    private var heldBulkCategoryContinuation: CheckedContinuation<ArticleBulkActionResult, Error>?
    private var shouldHoldNextBulkRegenerateAI = false
    private var heldBulkRegenerateAIContinuation: CheckedContinuation<ArticleBulkAIResult, Error>?
    private(set) var requestedPages: [Int] = []
    private(set) var lastQuery: LibraryQuery?
    private(set) var lastBulkCategoryID: Int?
    private(set) var bulkCategoryRequestCount = 0
    private(set) var bulkRegenerateAIRequestCount = 0

    init(
        pages: [Int: ArticleListPage] = [:],
        error: AppError? = nil,
        bulkError: AppError? = nil
    ) {
        self.pages = pages
        self.currentError = error
        self.bulkError = bulkError
    }

    func load(_ query: LibraryQuery) async throws -> ArticleListPage {
        let requestIndex = requestedPages.count
        requestedPages.append(query.page)
        lastQuery = query
        if shouldHoldNextLoad {
            shouldHoldNextLoad = false
            return try await withCheckedThrowingContinuation { continuation in
                heldContinuations[requestIndex] = continuation
            }
        }
        if let currentError {
            throw currentError
        }
        return pages[query.page] ?? .fixture(ids: [], page: query.page, totalPages: 0)
    }

    func setArticleCard(_ card: ArticleCard) {
        pages = pages.mapValues { page in
            ArticleListPage(
                articles: page.articles.map { $0.id == card.id ? card : $0 },
                total: page.total,
                page: page.page,
                perPage: page.perPage,
                totalPages: page.totalPages
            )
        }
    }

    func loadCounts(userID: Int?) async throws -> ArticleCounts {
        ArticleCounts(inbox: 1, favorites: 2, archive: 3, published: 4)
    }

    func loadSources(userID: Int?) async throws -> [LibrarySource] {
        [LibrarySource(source: "少数派", count: 2, latestCreatedAt: nil)]
    }

    func runBulkAction(
        _ action: ArticleBulkAction,
        articleIDs: [Int],
        categoryID: Int?
    ) async throws -> ArticleBulkActionResult {
        try 执行批量操作(articleIDs: articleIDs)
    }

    func runBulkCategory(
        articleIDs: [Int],
        categoryID: Int
    ) async throws -> ArticleBulkActionResult {
        bulkCategoryRequestCount += 1
        lastBulkCategoryID = categoryID
        if shouldHoldNextBulkCategory {
            shouldHoldNextBulkCategory = false
            return try await withCheckedThrowingContinuation { continuation in
                heldBulkCategoryContinuation = continuation
            }
        }
        return try 执行批量操作(articleIDs: articleIDs)
    }

    func runBulkRegenerateAI(
        articleIDs: [Int],
        includeCategory: Bool,
        resetUserCategory: Bool
    ) async throws -> ArticleBulkAIResult {
        bulkRegenerateAIRequestCount += 1
        if shouldHoldNextBulkRegenerateAI {
            shouldHoldNextBulkRegenerateAI = false
            return try await withCheckedThrowingContinuation { continuation in
                heldBulkRegenerateAIContinuation = continuation
            }
        }
        if let bulkError {
            throw bulkError
        }
        return ArticleBulkAIResult(
            requestedCount: articleIDs.count,
            queuedIDs: articleIDs,
            alreadyQueuedIDs: [],
            failed: []
        )
    }

    func runCreateBulkExport(articleIDs: [Int]) async throws -> ArticleBulkExportJob {
        if let bulkError {
            throw bulkError
        }
        return ArticleBulkExportJob(
            id: 1,
            format: "zip",
            status: .succeeded,
            requestedCount: articleIDs.count,
            succeededCount: articleIDs.count,
            failedCount: 0,
            downloadURL: nil,
            createdAt: nil,
            finishedAt: nil,
            expiresAt: nil
        )
    }

    func runBulkExportJob(jobID: Int) async throws -> ArticleBulkExportJob {
        try await runCreateBulkExport(articleIDs: [])
    }

    func setResult(_ page: ArticleListPage) {
        currentError = nil
        pages[page.page] = page
    }

    func setError(_ error: AppError?) {
        currentError = error
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
        while requestedPages.count < count {
            await Task.yield()
        }
    }

    func holdNextBulkCategory() {
        shouldHoldNextBulkCategory = true
    }

    func waitForBulkCategoryRequests(_ count: Int) async {
        while bulkCategoryRequestCount < count {
            await Task.yield()
        }
    }

    func resumeBulkCategory(with result: Result<ArticleBulkActionResult, Error>) {
        let continuation = heldBulkCategoryContinuation
        heldBulkCategoryContinuation = nil
        continuation?.resume(with: result)
    }

    func holdNextBulkRegenerateAI() {
        shouldHoldNextBulkRegenerateAI = true
    }

    func waitForBulkRegenerateAIRequests(_ count: Int) async {
        while bulkRegenerateAIRequestCount < count {
            await Task.yield()
        }
    }

    func resumeBulkRegenerateAI(with result: Result<ArticleBulkAIResult, Error>) {
        let continuation = heldBulkRegenerateAIContinuation
        heldBulkRegenerateAIContinuation = nil
        continuation?.resume(with: result)
    }

    private func 执行批量操作(articleIDs: [Int]) throws -> ArticleBulkActionResult {
        if let bulkError {
            throw bulkError
        }
        return ArticleBulkActionResult(
            requestedCount: articleIDs.count,
            succeededIDs: articleIDs,
            skipped: [],
            failed: []
        )
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
    private var pages: [LibraryCacheScope: ArticleListPage] = [:]
    private var clearContinuations: [CheckedContinuation<Void, Never>] = []
    private(set) var clearRequestCount = 0

    func load(scope: LibraryCacheScope) async throws -> ArticleListPage? {
        pages[scope]
    }

    func save(_ page: ArticleListPage, scope: LibraryCacheScope) async throws {
        pages[scope] = page
    }

    func clear(userID: Int?) async throws {
        clearRequestCount += 1
        await withCheckedContinuation { continuation in
            clearContinuations.append(continuation)
        }
        pages = pages.filter { $0.key.userID != userID }
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

private extension LibraryCacheScope {
    static func fixture(userID: Int?, view: LibraryView) -> Self {
        LibraryCacheScope(
            userID: userID,
            view: view,
            searchText: "",
            sort: ArticleSort.default(for: view),
            order: .desc,
            source: nil,
            categoryId: nil,
            page: 1,
            perPage: 20
        )
    }
}

private extension ArticleSort {
    static func `default`(for view: LibraryView) -> Self {
        switch view {
        case .favorites: .favorited
        case .archive: .archived
        case .published: .published
        case .inbox: .collected
        }
    }
}

private extension ArticleListPage {
    static func fixture(ids: [Int], page: Int = 1, totalPages: Int) -> Self {
        ArticleListPage(
            articles: ids.map {
                ArticleCard(id: $0, title: "文章 \($0)", source: "测试来源")
            },
            total: ids.count + max(0, totalPages - page) * ids.count,
            page: page,
            perPage: 20,
            totalPages: totalPages
        )
    }
}
