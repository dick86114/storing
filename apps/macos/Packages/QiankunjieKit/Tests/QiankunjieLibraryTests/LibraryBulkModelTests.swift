import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieLibrary

@MainActor
struct LibraryBulkModelTests {
    @Test func 批量模式选择跨分页保留() async {
        let repository = 批量资料库仓库(pages: [
            1: .fixture(ids: [1], page: 1, totalPages: 2),
            2: .fixture(ids: [2], page: 2, totalPages: 2),
        ])
        let model = LibraryModel(repository: repository, bulkRepository: 批量动作仓库())

        await model.load(reset: true)
        model.toggleBulkMode()
        model.toggleBulkSelection(1)
        await model.loadMore()

        model.toggleBulkSelection(2)

        #expect(model.isBulkSelecting)
        #expect(model.bulkSelection == [1, 2])
    }

    @Test func 列表刷新清理失效选择() async {
        let repository = 批量资料库仓库(pages: [1: .fixture(ids: [1, 2], page: 1, totalPages: 1)])
        let model = LibraryModel(repository: repository, bulkRepository: 批量动作仓库())
        await model.load(reset: true)
        model.toggleBulkMode()
        model.selectAllLoadedForBulk()

        await repository.setPage(.fixture(ids: [2], page: 1, totalPages: 1))
        await model.load(reset: true)

        #expect(model.bulkSelection == [2])
    }

    @Test func 部分成功更新列表和结果() async {
        let repository = 批量资料库仓库(pages: [1: .fixture(ids: [1, 2, 3], page: 1, totalPages: 1)])
        let bulkRepository = 批量动作仓库(
            actionResult: .init(
                requestedCount: 3,
                succeededIDs: [1],
                skipped: [.init(articleID: 2, code: "ALREADY_FAVORITED", message: "已收藏")],
                failed: [.init(articleID: 3, code: "NOT_FOUND", message: "文章不存在")]
            )
        )
        let model = LibraryModel(repository: repository, bulkRepository: bulkRepository)
        await model.load(reset: true)
        model.toggleBulkMode()
        model.selectAllLoadedForBulk()

        await model.runBulkToolbarAction(.favorite)

        #expect(model.bulkRunningAction == nil)
        #expect(model.bulkSelection == [2, 3])
        #expect(model.articles.first { $0.id == 1 }?.isFavorited == true)
        #expect(model.bulkResult?.succeededCount == 1)
        #expect(model.bulkResult?.skippedCount == 1)
        #expect(model.bulkResult?.issues.count == 2)
    }

    @Test func 运行中禁止重复提交() async {
        let repository = 批量资料库仓库(pages: [1: .fixture(ids: [1], page: 1, totalPages: 1)])
        let bulkRepository = 可阻塞批量动作仓库()
        let model = LibraryModel(repository: repository, bulkRepository: bulkRepository)
        await model.load(reset: true)
        model.toggleBulkMode()
        model.toggleBulkSelection(1)

        let task = Task { await model.runBulkToolbarAction(.favorite) }
        await bulkRepository.waitForAction()

        await model.runBulkToolbarAction(.favorite)

        #expect(await bulkRepository.actionCount == 1)
        await bulkRepository.resume()
        await task.value
    }

    @Test func 删除成功项从列表和选择集移除() async {
        let repository = 批量资料库仓库(pages: [1: .fixture(ids: [1, 2, 3], page: 1, totalPages: 1)])
        let bulkRepository = 批量动作仓库(
            actionResult: .init(
                requestedCount: 3,
                succeededIDs: [1],
                skipped: [.init(articleID: 2, code: "ALREADY_DELETED", message: "已删除")],
                failed: [.init(articleID: 3, code: "NOT_FOUND", message: "文章不存在")]
            )
        )
        let model = LibraryModel(repository: repository, bulkRepository: bulkRepository)
        await model.load(reset: true)
        model.toggleBulkMode()
        model.selectAllLoadedForBulk()

        await model.runBulkToolbarAction(.delete)

        #expect(model.articles.map(\.id) == [2, 3])
        #expect(model.bulkSelection == [2, 3])
        #expect(model.bulkResult?.succeededCount == 1)
    }
}

private actor 批量资料库仓库: LibraryLoading {
    private var pages: [Int: ArticleListPage]

    init(pages: [Int: ArticleListPage]) {
        self.pages = pages
    }

    func load(_ query: LibraryQuery) async throws -> ArticleListPage {
        pages[query.page] ?? .fixture(ids: [], page: query.page, totalPages: 0)
    }

    func loadCounts(userID: Int?) async throws -> ArticleCounts {
        .init(inbox: 1, favorites: 2, archive: 3, published: 4)
    }

    func loadSources(userID: Int?) async throws -> [LibrarySource] { [] }

    func loadCategoryFilters(userID: Int?) async throws -> [LibraryCategoryFilter] { [] }

    func setPage(_ page: ArticleListPage) {
        pages[page.page] = page
    }
}

private actor 批量动作仓库: LibraryBulkOperating {
    let actionResult: ArticleBulkActionResult
    let aiResult: ArticleBulkAIResult
    let exportJob: ArticleBulkExportJob

    init(
        actionResult: ArticleBulkActionResult = .init(
            requestedCount: 1,
            succeededIDs: [1],
            skipped: [],
            failed: []
        ),
        aiResult: ArticleBulkAIResult = .init(requestedCount: 1, queuedIDs: [1], alreadyQueuedIDs: [], failed: []),
        exportJob: ArticleBulkExportJob = .init(
            id: 1,
            format: "zip",
            status: .succeeded,
            requestedCount: 1,
            succeededCount: 1,
            failedCount: 0,
            downloadURL: nil,
            createdAt: nil,
            finishedAt: nil,
            expiresAt: nil
        )
    ) {
        self.actionResult = actionResult
        self.aiResult = aiResult
        self.exportJob = exportJob
    }

    func runBulkAction(_ action: ArticleBulkAction, articleIDs: [Int]) async throws -> ArticleBulkActionResult {
        actionResult
    }

    func runBulkCategory(articleIDs: [Int], categoryID: Int) async throws -> ArticleBulkActionResult {
        actionResult
    }

    func runBulkRegenerateAI(articleIDs: [Int], includeCategory: Bool) async throws -> ArticleBulkAIResult {
        aiResult
    }

    func runCreateBulkExport(articleIDs: [Int]) async throws -> ArticleBulkExportJob {
        exportJob
    }

    func runBulkExportJob(jobID: Int) async throws -> ArticleBulkExportJob {
        exportJob
    }
}

private actor 可阻塞批量动作仓库: LibraryBulkOperating {
    private var isPaused = true
    private(set) var actionCount = 0

    func runBulkAction(_ action: ArticleBulkAction, articleIDs: [Int]) async throws -> ArticleBulkActionResult {
        actionCount += 1
        while isPaused {
            try? await Task.sleep(nanoseconds: 5_000_000)
        }
        return .init(requestedCount: articleIDs.count, succeededIDs: articleIDs, skipped: [], failed: [])
    }

    func runBulkCategory(articleIDs: [Int], categoryID: Int) async throws -> ArticleBulkActionResult {
        .init(requestedCount: articleIDs.count, succeededIDs: articleIDs, skipped: [], failed: [])
    }

    func runBulkRegenerateAI(articleIDs: [Int], includeCategory: Bool) async throws -> ArticleBulkAIResult {
        .init(requestedCount: articleIDs.count, queuedIDs: articleIDs, alreadyQueuedIDs: [], failed: [])
    }

    func runCreateBulkExport(articleIDs: [Int]) async throws -> ArticleBulkExportJob {
        .init(
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
        .init(
            id: jobID,
            format: "zip",
            status: .succeeded,
            requestedCount: 1,
            succeededCount: 1,
            failedCount: 0,
            downloadURL: nil,
            createdAt: nil,
            finishedAt: nil,
            expiresAt: nil
        )
    }

    func waitForAction() async {
        while actionCount == 0 {
            try? await Task.sleep(nanoseconds: 5_000_000)
        }
    }

    func resume() {
        isPaused = false
    }
}

private extension ArticleListPage {
    static func fixture(ids: [Int], page: Int, totalPages: Int) -> Self {
        ArticleListPage(
            articles: ids.map { ArticleCard(id: $0, title: "文章 \($0)", source: "测试来源") },
            total: ids.count,
            page: page,
            perPage: 20,
            totalPages: totalPages
        )
    }
}
